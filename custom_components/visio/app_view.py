"""Serves the standalone Visio app page at /visio-app.

The page is a static shell with no data; it logs in through Home Assistant's
OAuth flow and then talks to the authenticated WebSocket API.
"""

from __future__ import annotations

from pathlib import Path

from aiohttp import web

from homeassistant.components.http import HomeAssistantView

from .const import APP_HTML, APP_URL


class VisioAppView(HomeAssistantView):
    url = APP_URL
    extra_urls = [f"{APP_URL}/"]
    name = "visio:app"
    requires_auth = False

    def __init__(self, app_dir: Path) -> None:
        self._html = app_dir / APP_HTML

    async def get(self, request: web.Request) -> web.StreamResponse:
        if not self._html.is_file():
            return web.Response(status=404, text="Visio app is not built")
        return web.FileResponse(self._html, headers={"Cache-Control": "no-cache"})
