"""WebSocket commands used by the Visio panel."""

from __future__ import annotations

from typing import Any

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

try:  # HA >= 2026.x replaced voluptuous with probatio
    import probatio as vol
except ImportError:  # pragma: no cover
    import voluptuous as vol

from .backups import backup_status
from .blinds_plan import COMMANDS
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


@websocket_api.websocket_command({vol.Required("type"): "visio/info"})
@callback
def ws_info(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Installed Visio version (any authenticated user)."""
    if DOMAIN not in hass.data:
        connection.send_error(msg["id"], "not_loaded", "Visio is not set up")
        return
    connection.send_result(msg["id"], {"version": hass.data[DOMAIN]["version"]})


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


@websocket_api.websocket_command(
    {vol.Required("type"): "visio/reconnect", vol.Required("entity_ids"): list}
)
@websocket_api.async_response
async def ws_reconnect(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Reconnect (reload) the integrations behind these entities. Any household user.

    Limited to the watched device types, so it can't be used to reload arbitrary
    integrations.
    """
    if DOMAIN not in hass.data:
        connection.send_error(msg["id"], "not_loaded", "Visio is not set up")
        return
    ids = [e for e in msg["entity_ids"] if isinstance(e, str) and e.split(".", 1)[0] in ("cover", "camera")]
    watchdog = hass.data[DOMAIN]["watchdog"]
    result = await watchdog.async_reconnect(watchdog.entries_for(ids), reason="button")
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({vol.Required("type"): "visio/updates/check"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_updates_check(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Look for new versions now (Supervisor + HACS), then return the fresh status."""
    if DOMAIN not in hass.data:
        connection.send_error(msg["id"], "not_loaded", "Visio is not set up")
        return
    updates = hass.data[DOMAIN]["updates"]
    result = await updates.async_check()
    connection.send_result(msg["id"], {**updates.status(), **result})


@websocket_api.websocket_command({vol.Required("type"): "visio/backups/status"})
@websocket_api.require_admin
@callback
def ws_backups_status(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Whether automatic backups run, where they go, and when the last one finished."""
    if DOMAIN not in hass.data:
        connection.send_error(msg["id"], "not_loaded", "Visio is not set up")
        return
    connection.send_result(msg["id"], backup_status(hass))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "visio/blinds/move",
        vol.Required("entity_ids"): list,
        vol.Required("command"): str,
        vol.Optional("position"): int,
    }
)
@callback
def ws_blinds_move(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Queue a blind command (any household user, like the cover services themselves)."""
    if DOMAIN not in hass.data:
        connection.send_error(msg["id"], "not_loaded", "Visio is not set up")
        return
    ids = msg["entity_ids"]
    if not ids or not all(isinstance(e, str) and e.startswith("cover.") for e in ids):
        connection.send_error(msg["id"], "invalid", "entity_ids must be cover entities")
        return
    if msg["command"] not in COMMANDS:
        connection.send_error(msg["id"], "invalid", f"command must be one of {COMMANDS}")
        return
    try:
        hass.data[DOMAIN]["blinds"].async_move(ids, msg["command"], msg.get("position"), source="panel")
    except ValueError as err:
        connection.send_error(msg["id"], "invalid", str(err))
        return
    connection.send_result(msg["id"], hass.data[DOMAIN]["blinds"].status())


@websocket_api.websocket_command({vol.Required("type"): "visio/blinds/status"})
@callback
def ws_blinds_status(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Blinds waiting to be sent or checked, and those that didn't respond."""
    if DOMAIN not in hass.data:
        connection.send_error(msg["id"], "not_loaded", "Visio is not set up")
        return
    connection.send_result(msg["id"], hass.data[DOMAIN]["blinds"].status())


@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_blinds_move)
    websocket_api.async_register_command(hass, ws_blinds_status)
    websocket_api.async_register_command(hass, ws_backups_status)
    websocket_api.async_register_command(hass, ws_updates_check)
    websocket_api.async_register_command(hass, ws_reconnect)
    websocket_api.async_register_command(hass, ws_info)
    websocket_api.async_register_command(hass, ws_updates_status)
    websocket_api.async_register_command(hass, ws_updates_run)
    websocket_api.async_register_command(hass, ws_get_config)
    websocket_api.async_register_command(hass, ws_set_config)
    websocket_api.async_register_command(hass, ws_set_blind_mode)
