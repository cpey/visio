"""WebSocket commands used by the Visio panel."""

from __future__ import annotations

from typing import Any

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

try:  # HA >= 2026.x replaced voluptuous with probatio
    import probatio as vol
except ImportError:  # pragma: no cover
    import voluptuous as vol

from .const import DOMAIN
from .schema import BLIND_MODES, ConfigError


def _store(hass: HomeAssistant):
    return hass.data[DOMAIN]["store"]


@websocket_api.websocket_command({vol.Required("type"): "visio/config/get"})
@callback
def ws_get_config(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Return the configuration (any authenticated user)."""
    if DOMAIN not in hass.data:
        connection.send_error(msg["id"], "not_loaded", "Visio is not set up")
        return
    connection.send_result(msg["id"], _store(hass).config)


@websocket_api.websocket_command(
    {vol.Required("type"): "visio/config/set", vol.Required("config"): dict}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_set_config(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Replace the configuration (admin only)."""
    if DOMAIN not in hass.data:
        connection.send_error(msg["id"], "not_loaded", "Visio is not set up")
        return
    try:
        config = await _store(hass).async_save(msg["config"])
    except ConfigError as err:
        connection.send_error(msg["id"], "invalid_config", str(err))
        return
    connection.send_result(msg["id"], config)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "visio/blinds/mode",
        vol.Required("mode"): str,
    }
)
@websocket_api.async_response
async def ws_set_blind_mode(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Switch blinds between automatic schedules and manual (any household user)."""
    if DOMAIN not in hass.data:
        connection.send_error(msg["id"], "not_loaded", "Visio is not set up")
        return
    if msg["mode"] not in BLIND_MODES:
        connection.send_error(msg["id"], "invalid_mode", f"mode must be one of {BLIND_MODES}")
        return
    config = await _store(hass).async_set_blind_mode(msg["mode"])
    connection.send_result(msg["id"], config)


@websocket_api.websocket_command({vol.Required("type"): "visio/updates/status"})
@websocket_api.require_admin
@callback
def ws_updates_status(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Available updates, whether a run is in progress, and the run history."""
    if DOMAIN not in hass.data:
        connection.send_error(msg["id"], "not_loaded", "Visio is not set up")
        return
    connection.send_result(msg["id"], hass.data[DOMAIN]["updates"].status())


@websocket_api.websocket_command(
    {vol.Required("type"): "visio/updates/run", vol.Optional("entity_ids"): list}
)
@websocket_api.require_admin
@callback
def ws_updates_run(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Start updating now (all pending, or only `entity_ids`). Returns immediately."""
    if DOMAIN not in hass.data:
        connection.send_error(msg["id"], "not_loaded", "Visio is not set up")
        return
    only = msg.get("entity_ids")
    if only is not None and not all(isinstance(e, str) and e.startswith("update.") for e in only):
        connection.send_error(msg["id"], "invalid", "entity_ids must be update entities")
        return
    hass.async_create_task(hass.data[DOMAIN]["updates"].async_run("manual", only), "visio updates")
    connection.send_result(msg["id"], {"started": True})


@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_updates_status)
    websocket_api.async_register_command(hass, ws_updates_run)
    websocket_api.async_register_command(hass, ws_get_config)
    websocket_api.async_register_command(hass, ws_set_config)
    websocket_api.async_register_command(hass, ws_set_blind_mode)
