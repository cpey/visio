"""Constants for the Visio integration."""

DOMAIN = "visio"

PANEL_URL_PATH = "visio"
PANEL_TITLE = "Visio"
PANEL_ICON = "mdi:cctv"
PANEL_WEBCOMPONENT = "visio-panel"

STATIC_URL = "/visio_static"
PANEL_JS = "visio-panel.js"

# Standalone app: HTML at APP_URL, built files under APP_FILES_URL.
APP_URL = "/visio-app"
APP_FILES_URL = "/visio-app/files"
APP_HTML = "visio-app.html"

STORAGE_KEY = DOMAIN
STORAGE_VERSION = 1


def is_dev_build(version: str) -> bool:
    """Development deploy (scripts/deploy-dev.sh stamps "<tag>-dev+<sha>").

    Dev builds run in the development VM next to the real house, so they never move
    blinds or install updates on their own (manual buttons still work).
    """
    return "-dev" in version
