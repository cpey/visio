"""Runs blind schedules inside Home Assistant (no cron, survives restarts)."""

from __future__ import annotations

from collections.abc import Callable
import logging
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_change
from homeassistant.util import dt as dt_util

from .blinds_queue import BlindQueue
from .schedule import ACTIONS, due_actions

_LOGGER = logging.getLogger(__name__)
# cover service → blind queue command
COMMAND_FOR = {service: action for action, service in ACTIONS.items()}


class BlindScheduler:
    """Checks every minute (local time, DST-aware) which schedule actions are due."""

    def __init__(
        self,
        hass: HomeAssistant,
        get_config: Callable[[], dict[str, Any]],
        queue: BlindQueue,
        enabled: bool = True,
    ) -> None:
        self._hass = hass
        self._get_config = get_config
        self._queue = queue
        self._enabled = enabled
        self._unsub: Callable[[], None] | None = None

    @callback
    def async_start(self) -> None:
        if not self._enabled:
            _LOGGER.info("Development build: blind schedules don't run")
            return
        self._unsub = async_track_time_change(self._hass, self._tick, second=0)

    @callback
    def async_stop(self) -> None:
        if self._unsub:
            self._unsub()
            self._unsub = None

    @callback
    def _tick(self, _now: Any) -> None:
        now = dt_util.now()  # HA's configured time zone
        actions = due_actions(self._get_config().get("blinds", {}), now.weekday(), now.strftime("%H:%M"))
        for service, entity_ids in actions:
            # Through the shared queue: one at a time, checked and resent if dropped.
            self._queue.async_move(entity_ids, COMMAND_FOR[service], source="schedule")
