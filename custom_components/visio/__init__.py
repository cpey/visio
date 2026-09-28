"""Visio: camera and home dashboard panel for Home Assistant."""

from __future__ import annotations

import hashlib
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from . import websocket_api
from .app_view import VisioAppView
from .scheduler import BlindScheduler
from .const import (
    APP_FILES_URL,
    DOMAIN,
    PANEL_ICON,
    PANEL_JS,
    PANEL_TITLE,
    PANEL_URL_PATH,
    PANEL_WEBCOMPONENT,
    STATIC_URL,
)
from .store import VisioStore

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

WWW_DIR = Path(__file__).parent / "www"
APP_DIR = WWW_DIR / "app"


def _bundle_hash() -> str:
    """Content hash of the panel bundle, so every new build busts the browser cache."""
    try:
        return hashlib.sha256((WWW_DIR / PANEL_JS).read_bytes()).hexdigest()[:12]
    except FileNotFoundError:
        return "missing"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    websocket_api.async_register(hass)
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(STATIC_URL, str(WWW_DIR), cache_headers=False),
            StaticPathConfig(APP_FILES_URL, str(APP_DIR), cache_headers=False),
        ]
    )
    hass.http.register_view(VisioAppView(APP_DIR))
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store = VisioStore(hass)
    await store.async_load()
    # Reads the store on every tick, so saved schedule changes apply immediately.
    scheduler = BlindScheduler(hass, lambda: store.config)
    scheduler.async_start()
    hass.data[DOMAIN] = {"store": store, "scheduler": scheduler}

    bundle_hash = await hass.async_add_executor_job(_bundle_hash)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_WEBCOMPONENT,
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=f"{STATIC_URL}/{PANEL_JS}?v={bundle_hash}",
        embed_iframe=False,
        require_admin=False,
    )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    frontend.async_remove_panel(hass, PANEL_URL_PATH)
    data = hass.data.pop(DOMAIN, None)
    if data:
        data["scheduler"].async_stop()
    return True
