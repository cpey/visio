"""Persistent storage of the Visio configuration (included in HA backups)."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION
from .schema import ConfigError, default_config, validate_config


class VisioStore:
    """Load and save the configuration document."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.config: dict[str, Any] = default_config()

    async def async_load(self) -> None:
        data = await self._store.async_load()
        if data is None:
            return
        try:
            self.config = validate_config(data)
        except ConfigError:
            # Corrupt or outdated document: keep defaults, do not crash setup.
            self.config = default_config()

    async def async_save(self, data: Any) -> dict[str, Any]:
        """Validate and persist; raises ConfigError on invalid input."""
        self.config = validate_config(data)
        await self._store.async_save(self.config)
        return self.config

    async def async_set_blind_mode(self, mode: str) -> dict[str, Any]:
        """Change only the blinds mode (allowed for any user, unlike full saves)."""
        config = {**self.config, "blinds": {**self.config.get("blinds", {}), "mode": mode}}
        return await self.async_save(config)
