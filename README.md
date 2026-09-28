# Visio

Dashboard for Home Assistant: a clean, TV- and phone-friendly view of your cameras and blinds.

- **Cameras:** live WebRTC video where the camera supports it, refreshing snapshots otherwise,
  full screen on tap, motion highlight and battery levels. Any camera Home Assistant knows
  about appears automatically; there is no per-vendor code.
- **Blinds:** open/close/position per blind, several at once, and weekly schedules
  (Monday–Sunday open/close times) run by Home Assistant, with an Automatic/Manual switch.
- **Standalone app** at `/visio-app`: Home Assistant login, then only Visio, full screen.
  Installable on a phone's home screen. Light and dark themes, pull to refresh.

## Install (HACS)

1. HACS → ⋮ → *Custom repositories* → add `https://github.com/cpey/visio` as type **Integration**.
2. Download **Visio**, restart Home Assistant.
3. Settings → Devices & services → *Add integration* → **Visio**.
4. Open **Visio** in the sidebar. Admins configure cameras, blinds, schedules and layouts
   under *Settings* in the menu.

Updates appear under Settings → Updates when a new release is published.

## Standalone app

Open `https://<your-ha>/visio-app` (add `?layout=<id>` for a layout). It uses the Home Assistant
login and then shows only Visio, full screen. On a phone, use *Add to Home Screen* to install it
like an app. Give household members non-admin Home Assistant users: they only need this address.

## Adding devices

Add the device's Home Assistant integration (Ring, Tapo, Generic Camera for any RTSP or snapshot
URL, Norman, …). New `camera.*` and `cover.*` entities show up in Visio automatically.

## Development

See [CLAUDE.md](CLAUDE.md) for architecture, commands and conventions.
