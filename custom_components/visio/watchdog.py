"""Reconnects integrations whose devices all dropped out (e.g. Norman after a hub blip).

"Reconnect" = Home Assistant's own config-entry reload for that integration: it closes
and reopens the integration's connections. It never restarts Home Assistant and never
touches other integrations or the devices themselves.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import timedelta
import logging
import time
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_track_time_interval

from .watchdog_plan import WATCHED_DOMAINS, down_entries, due_for_reload

_LOGGER = logging.getLogger(__name__)

CHECK_EVERY = 30  # seconds


class IntegrationWatchdog:
    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass
        self._down_since: dict[str, float] = {}
        self._last_reload: dict[str, float] = {}
        self._unsub: Callable[[], None] | None = None

    @callback
    def async_start(self) -> None:
        self._unsub = async_track_time_interval(self._hass, self._check, timedelta(seconds=CHECK_EVERY))

    @callback
    def async_stop(self) -> None:
        if self._unsub:
            self._unsub()
            self._unsub = None

    def _entity_entries(self) -> dict[str, str]:
        registry = er.async_get(self._hass)
        return {
            e.entity_id: e.config_entry_id
            for e in registry.entities.values()
            if e.config_entry_id and e.domain in WATCHED_DOMAINS and not e.disabled_by
        }

    @callback
    def _check(self, _now: Any) -> None:
        states = {s.entity_id: s.state for s in self._hass.states.async_all(WATCHED_DOMAINS)}
        down = down_entries(self._entity_entries(), states)
        now = time.monotonic()
        # Track how long each entry has been down; forget the ones that recovered.
        self._down_since = {e: self._down_since.get(e, now) for e in down}
        for entry_id in due_for_reload(self._down_since, self._last_reload, now):
            self._hass.async_create_task(self.async_reconnect([entry_id], reason="automatic"), "visio reconnect")

    async def async_reconnect(self, entry_ids: list[str], reason: str = "manual") -> dict[str, Any]:
        """Reload the given config entries; returns reloaded titles and errors."""
        reloaded, errors = [], []
        for entry_id in dict.fromkeys(entry_ids):
            entry = self._hass.config_entries.async_get_entry(entry_id)
            if entry is None:
                continue
            self._last_reload[entry_id] = time.monotonic()
            try:
                ok = await self._hass.config_entries.async_reload(entry_id)
                (reloaded if ok else errors).append(entry.title)
                _LOGGER.warning("Visio reconnected %s (%s): %s", entry.title, reason, "ok" if ok else "failed")
            except Exception as err:  # noqa: BLE001 - report and continue with the next entry
                errors.append(f"{entry.title}: {err}")
        return {"reloaded": reloaded, "errors": errors}

    def entries_for(self, entity_ids: list[str]) -> list[str]:
        registry = er.async_get(self._hass)
        return [
            entry.config_entry_id
            for entity_id in entity_ids
            if (entry := registry.async_get(entity_id)) and entry.config_entry_id
        ]
