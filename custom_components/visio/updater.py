"""System updates, run inside Home Assistant through its own `update.*` entities.

Order: add-ons/integrations/Supervisor → Home Assistant Core (restarts HA) →
Home Assistant OS (reboots the machine HAOS runs on: the VM or the Pi). A pending
OS phase is persisted before the Core update and resumed after the restart.
Nothing here touches any other machine.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
import logging
from typing import Any

from homeassistant.components import persistent_notification
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CoreState, Event, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later, async_track_time_change
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .updates_plan import is_due, kind_of, plan, supports_backup

_LOGGER = logging.getLogger(__name__)

STATE_KEY = f"{DOMAIN}.updates_state"
MAX_HISTORY = 20
RESUME_DELAY_S = 90  # let update entities load after a restart before resuming
NOTIFICATION_ID = "visio_updates"


class UpdateManager:
    def __init__(self, hass: HomeAssistant, get_config: Callable[[], dict[str, Any]]) -> None:
        self._hass = hass
        self._get_config = get_config
        self._store: Store[dict[str, Any]] = Store(hass, 1, STATE_KEY)
        self._state: dict[str, Any] = {"history": [], "pending": None}
        self._running = False
        self._unsubs: list[Callable[[], None]] = []

    async def async_load(self) -> None:
        self._state = (await self._store.async_load()) or {"history": [], "pending": None}
        self._run_id: str | None = None

    async def _close_interrupted_runs(self) -> None:
        """Entries left open by a Core restart / OS reboot: check what actually got installed."""
        changed = False
        for entry in self._state.get("history", []):
            if not entry.get("run_open"):
                continue
            for result in entry["results"]:
                if result.get("started"):
                    state = self._hass.states.get(result["entity_id"])
                    installed = state.attributes.get("installed_version") if state else None
                    result["started"] = False
                    result["ok"] = installed is not None and installed == result.get("to")
                    if not result["ok"]:
                        result["error"] = f"still on {installed}" if installed else "unknown after restart"
            entry["run_open"] = False
            entry["summary"] = "All updates installed" if all(r["ok"] for r in entry["results"]) else "Some updates failed"
            changed = True
        if changed:
            await self._store.async_save(self._state)

    @callback
    def async_start(self) -> None:
        self._unsubs.append(async_track_time_change(self._hass, self._tick, second=0))
        interrupted = any(e.get("run_open") for e in self._state.get("history", []))
        if self._state.get("pending") or interrupted:
            if self._hass.state is CoreState.running:
                self._schedule_resume()
            else:
                self._unsubs.append(
                    self._hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, self._on_started)
                )

    @callback
    def async_stop(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()

    # ---------- status for the UI ----------

    def status(self) -> dict[str, Any]:
        registry = er.async_get(self._hass)
        items = []
        for state in self._hass.states.async_all("update"):
            attrs = state.attributes
            entry = registry.async_get(state.entity_id)
            items.append(
                {
                    "entity_id": state.entity_id,
                    "title": attrs.get("title") or attrs.get("friendly_name") or state.entity_id,
                    "installed": attrs.get("installed_version"),
                    "latest": attrs.get("latest_version"),
                    "available": state.state == "on",
                    "in_progress": bool(attrs.get("in_progress")),
                    "kind": kind_of(state.entity_id),
                    "platform": entry.platform if entry else None,
                    "release_url": attrs.get("release_url"),
                }
            )
        items.sort(key=lambda i: ({"os": 0, "core": 1}.get(i["kind"], 2), i["title"].lower()))
        return {
            "items": items,
            "running": self._running,
            "pending": self._state.get("pending"),
            "history": self._state.get("history", []),
        }

    # ---------- triggers ----------

    @callback
    def _tick(self, _now: Any) -> None:
        now = dt_util.now()
        if is_due(self._get_config().get("updates", {}), now.weekday(), now.strftime("%H:%M")):
            self._hass.async_create_task(self.async_run("scheduled"), "visio updates")

    @callback
    def _on_started(self, _event: Event) -> None:
        self._schedule_resume()

    @callback
    def _schedule_resume(self) -> None:
        async def _resume(_now: Any) -> None:
            await self._close_interrupted_runs()
            pending = self._state.get("pending") or []
            await self._set_pending(None)
            if pending:
                _LOGGER.info("Resuming updates after restart: %s", pending)
                await self.async_run("resumed", only=pending)

        self._unsubs.append(async_call_later(self._hass, RESUME_DELAY_S, _resume))

    # ---------- the run ----------

    async def async_run(self, trigger: str, only: list[str] | None = None) -> None:
        if self._running:
            return
        states = {s.entity_id: {"state": s.state, "attributes": dict(s.attributes)} for s in self._hass.states.async_all("update")}
        phases = plan(states, only)
        if not phases:
            self._run_id = None
            await self._record(trigger, [], "Nothing to update")
            return

        self._running = True
        self._run_id = dt_util.now().isoformat()
        results: list[dict[str, Any]] = []
        backup = self._get_config().get("updates", {}).get("backup", True)
        registry = er.async_get(self._hass)
        needs_restart = False
        try:
            for phase in phases:
                kind = kind_of(phase[0])
                if kind == "core":
                    # Core restarts Home Assistant: persist what's left (OS) first.
                    remaining = [e for p in phases if kind_of(p[0]) == "os" for e in p]
                    await self._set_pending(remaining or None)
                    await self._record(trigger, results + [self._result(phase[0], states, None, started=True)],
                                       "Updating Home Assistant Core (Home Assistant will restart)")
                if kind == "os":
                    await self._record(trigger, results + [self._result(phase[0], states, None, started=True)],
                                       "Updating Home Assistant OS (the system will reboot)")
                for entity_id in phase:
                    error = await self._install(entity_id, states, backup)
                    results.append(self._result(entity_id, states, error))
                    entry = registry.async_get(entity_id)
                    if error is None and entry and entry.platform == "hacs":
                        needs_restart = True
            summary = "All updates installed" if all(r["ok"] for r in results) else "Some updates failed"
            await self._record(trigger, results, summary)
            if needs_restart:
                _LOGGER.info("Restarting Home Assistant to load updated integrations")
                await self._hass.services.async_call("homeassistant", "restart", {}, blocking=False)
        finally:
            self._running = False

    async def _install(self, entity_id: str, states: dict[str, dict[str, Any]], backup: bool) -> str | None:
        data: dict[str, Any] = {"entity_id": entity_id}
        if backup and supports_backup(states.get(entity_id, {})):
            data["backup"] = True
        try:
            await self._hass.services.async_call("update", "install", data, blocking=True)
            _LOGGER.info("Updated %s", entity_id)
            return None
        except (HomeAssistantError, asyncio.TimeoutError) as err:
            _LOGGER.warning("Update of %s failed: %s", entity_id, err)
            return str(err) or type(err).__name__

    def _result(self, entity_id: str, states: dict[str, dict[str, Any]], error: str | None, started: bool = False) -> dict[str, Any]:
        attrs = states.get(entity_id, {}).get("attributes", {})
        return {
            "entity_id": entity_id,
            "title": attrs.get("title") or attrs.get("friendly_name") or entity_id,
            "from": attrs.get("installed_version"),
            "to": attrs.get("latest_version"),
            "ok": error is None and not started,
            "started": started,
            "error": error,
        }

    async def _set_pending(self, pending: list[str] | None) -> None:
        self._state["pending"] = pending
        await self._store.async_save(self._state)

    async def _record(self, trigger: str, results: list[dict[str, Any]], summary: str) -> None:
        run_id = self._run_id or dt_util.now().isoformat()
        entry = {"time": dt_util.now().isoformat(), "run_id": run_id, "trigger": trigger, "summary": summary, "results": results}
        history = self._state.setdefault("history", [])
        # Progress updates within one run replace that run's previous entry (only that run's).
        if history and history[-1].get("run_id") == run_id:
            history.pop()
        entry["run_open"] = any(r.get("started") for r in results)
        history.append(entry)
        del history[:-MAX_HISTORY]
        await self._store.async_save(self._state)
        if not entry["run_open"]:
            lines = [f"- {r['title']}: {r['from']} → {r['to']}" + ("" if r["ok"] else f" ⚠ {r['error']}") for r in results]
            persistent_notification.async_create(
                self._hass,
                "\n".join([summary, *lines]) if lines else summary,
                title="Visio updates",
                notification_id=NOTIFICATION_ID,
            )
