"""One queue for every blind command: panel, schedules and the visio.move_blinds action.

Commands go out one at a time (Norman Gen 2 drops near-simultaneous ones). After the
travel time each blind is checked (blinds_plan.verdict); a blind that didn't move gets
the command once more. A newer command for the same blind replaces an older one.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
import itertools
import logging
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.event import async_call_later
from homeassistant.util import dt as dt_util

from .blinds_plan import (
    COMMAND_GAP_S,
    MAX_ATTEMPTS,
    SERVICES,
    VERIFY_AFTER_S,
    target_of,
    verdict,
)

_LOGGER = logging.getLogger(__name__)


@dataclass
class _Pending:
    token: int
    command: str
    position: int | None
    target: int
    source: str
    attempt: int = 0
    start_position: float | None = None
    start_state: str | None = None


class BlindQueue:
    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass
        self._queue: asyncio.Queue[tuple[str, int]] = asyncio.Queue()
        self._pending: dict[str, _Pending] = {}
        self._checks: dict[str, Callable[[], None]] = {}
        self._tokens = itertools.count(1)
        self._worker: asyncio.Task | None = None
        # entity_id → ISO time it last failed to respond (cleared by its next command)
        self.not_responding: dict[str, str] = {}

    @callback
    def async_start(self) -> None:
        self._worker = self._hass.async_create_background_task(self._run(), "visio blind queue")

    @callback
    def async_stop(self) -> None:
        if self._worker:
            self._worker.cancel()
            self._worker = None
        for cancel in self._checks.values():
            cancel()
        self._checks.clear()
        self._pending.clear()

    def status(self) -> dict[str, Any]:
        return {"pending": sorted(self._pending), "not_responding": dict(self.not_responding)}

    @callback
    def async_move(self, entity_ids: list[str], command: str, position: int | None = None, source: str = "") -> None:
        """Queue a command for each blind (in order). Returns immediately."""
        target = target_of(command, position)
        for entity_id in dict.fromkeys(entity_ids):  # dedupe, keep order
            self._cancel_check(entity_id)
            self.not_responding.pop(entity_id, None)
            token = next(self._tokens)
            self._pending[entity_id] = _Pending(token, command, position, target, source)
            self._queue.put_nowait((entity_id, token))

    def _cancel_check(self, entity_id: str) -> None:
        cancel = self._checks.pop(entity_id, None)
        if cancel:
            cancel()

    async def _run(self) -> None:
        while True:
            entity_id, token = await self._queue.get()
            pending = self._pending.get(entity_id)
            if pending is None or pending.token != token:
                continue  # replaced by a newer command
            await self._send(entity_id, pending)
            await asyncio.sleep(COMMAND_GAP_S)

    async def _send(self, entity_id: str, pending: _Pending) -> None:
        state = self._hass.states.get(entity_id)
        if state is None:
            _LOGGER.warning("Blind %s not found", entity_id)
            self._pending.pop(entity_id, None)
            return
        if pending.attempt == 0:  # where it was before Visio moved it
            pending.start_position = _position(state)
            pending.start_state = state.state
        pending.attempt += 1
        data: dict[str, Any] = {"entity_id": entity_id}
        if pending.command == "set_position":
            data["position"] = pending.position
        try:
            await self._hass.services.async_call("cover", SERVICES[pending.command], data, blocking=True)
            _LOGGER.info("Blinds (%s): %s %s, attempt %d", pending.source, pending.command, entity_id, pending.attempt)
        except HomeAssistantError as err:
            _LOGGER.warning("Blinds (%s): %s %s failed: %s", pending.source, pending.command, entity_id, err)
        token = pending.token
        self._checks[entity_id] = async_call_later(
            self._hass, VERIFY_AFTER_S, lambda _now: self._check(entity_id, token)
        )

    @callback
    def _check(self, entity_id: str, token: int) -> None:
        self._checks.pop(entity_id, None)
        pending = self._pending.get(entity_id)
        if pending is None or pending.token != token:
            return
        state = self._hass.states.get(entity_id)
        result = verdict(
            pending.target,
            pending.start_position,
            pending.start_state,
            _position(state) if state else None,
            state.state if state else None,
        )
        if result == "dropped" and pending.attempt < MAX_ATTEMPTS:
            _LOGGER.info("Blinds: %s didn't move, sending %s again", entity_id, pending.command)
            self._queue.put_nowait((entity_id, token))
            return
        self._pending.pop(entity_id, None)
        if result == "dropped":
            _LOGGER.warning("Blinds: %s didn't respond to %s", entity_id, pending.command)
            self.not_responding[entity_id] = dt_util.now().isoformat()


def _position(state: Any) -> float | None:
    value = state.attributes.get("current_position")
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None
