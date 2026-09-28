"""Runs blind schedules inside Home Assistant (no cron, survives restarts)."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
import logging
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.event import async_track_time_change
from homeassistant.util import dt as dt_util

from .schedule import due_actions

_LOGGER = logging.getLogger(__name__)

# Some hubs (Norman Gen 2) drop simultaneous commands, so blinds move one at a time.
COMMAND_GAP_S = 0.3


class BlindScheduler:
    """Checks every minute (local time, DST-aware) which schedule actions are due."""

    def __init__(self, hass: HomeAssistant, get_config: Callable[[], dict[str, Any]]) -> None:
        self._hass = hass
        self._get_config = get_config
        self._unsub: Callable[[], None] | None = None

    @callback
    def async_start(self) -> None:
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
        if actions:
            self._hass.async_create_task(self._run(actions), "visio blind schedule")

    async def _run(self, actions: list[tuple[str, list[str]]]) -> None:
        first = True
        for service, entity_ids in actions:
            for entity_id in entity_ids:
                if not first:
                    await asyncio.sleep(COMMAND_GAP_S)
                first = False
                if self._hass.states.get(entity_id) is None:
                    _LOGGER.warning("Schedule skipped %s: entity not found", entity_id)
                    continue
                try:
                    await self._hass.services.async_call(
                        "cover", service, {"entity_id": entity_id}, blocking=True
                    )
                    _LOGGER.info("Schedule: %s %s", service, entity_id)
                except HomeAssistantError as err:
                    _LOGGER.warning("Schedule: %s %s failed: %s", service, entity_id, err)
