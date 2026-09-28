# Visio

Home camera dashboard (TV-friendly, remotely accessible) built on top of **Home Assistant (HA)**.
Later phases add smart plugs, curtains and an AI agent on the same foundation.

## Architecture

- **HA is the hub.** Vendor logins, streams (HA's built-in go2rtc) and device control live in HA
  integrations. Visio never talks to cameras or vendor clouds directly.
- **Visio = one HACS custom integration** (`custom_components/visio`) that:
  - registers a sidebar panel and serves the built frontend JS,
  - stores layouts + per-camera profiles in HA's `helpers.storage.Store` (included in HA backups),
  - exposes WebSocket commands `visio/config/get` (any user) and `visio/config/set` (admin only).
- **Frontend** (`frontend/`, Vite + React + TypeScript) is a web component panel that receives
  the `hass` object, so it reuses HA's login session — no separate server, tokens or auth code.
- **Modular, entity-driven.** No camera is named in code. Every `camera.*` entity is discovered
  automatically; per-camera behaviour (mode `live|snapshot|placeholder`, refresh interval,
  fallback, name, order, hidden, placeholder text/link, motion sensor) comes from stored profiles
  edited in the panel's Settings view.
- **Standalone app** at `/visio-app` (`frontend/visio-app.html` → `src/standalone/main.tsx`,
  built by `vite.app.config.ts` into `www/app/`): logs in via HA's OAuth page
  (home-assistant-js-websocket), builds the same `hass` shape and renders the same `<App>`.
  The integration serves the HTML shell unauthenticated (`app_view.py`, no data in it) and
  the built files under `/visio-app/files/`. Installable as a PWA (manifest + icons in
  `frontend/public-app/`, PNGs from `npm run icons`).
- **Tiles are plugins** registered in `frontend/src/tiles/registry.ts` (`type → { component, settingsSchema }`).
  New device types (switch, cover, …) = a new tile, no grid changes.

Deployment: Home Assistant OS (VM on the dev machine now, dedicated Raspberry Pi later),
remote access via the Tailscale add-on (no open ports, no paid subscriptions),
updates through the HA/HACS UI only.

## Repo layout

```
custom_components/visio/   HA integration (Python): __init__, config_flow, store, websocket_api, www/ (built JS)
frontend/                  React panel source (src/panel.tsx, src/api, src/tiles, src/views)
tests/                     Python tests for the HA-independent parts (plain pytest in .venv)
hacs.json                  HACS metadata
.github/workflows/         CI: build frontend, run tests, publish release zip
.tools/                    (gitignored) project-local tool downloads/caches
.venv/                     (gitignored) project-local Python virtualenv
.vm/                       (gitignored) HAOS VM disk image for local development
```

## Self-contained environment

Everything the project needs lives inside this directory. **Do not install anything globally
without asking the user first.**

- **Approved system-wide installs** (user-approved 2026-09-27): Node.js 24 LTS (NodeSource apt repo),
  `qemu-system-x86`, `qemu-utils`, `libvirt-daemon-system`, `libvirt-clients`, `virtinst`, `ovmf`.
  Anything beyond this list still needs approval. Node packages stay local in `frontend/node_modules`.
- Python: `.venv/` created with `python3 -m venv .venv`; always use `.venv/bin/pip` / `.venv/bin/pytest`.
  Dependencies are pinned exactly: `requirements-dev.txt` (tests, used by CI) and
  `requirements-tools.txt` (LAN discovery: python-kasa, tinytuya, zeroconf; git-filter-repo).
  When adding a package, install it into `.venv` and add it (and new transitive deps) with
  its exact version to the right file.
- Node: `frontend/package.json` + `package-lock.json` pin everything; use `npm ci`.
- VM images, downloads and caches go in `.vm/` or `.tools/`, never in system paths
  (the libvirt domain points its disk at `.vm/haos.qcow2`).
- **Requires explicit user approval** (ask before running): `sudo`, `apt`/`apt-get`/`dpkg`, `snap`,
  `npm install -g`, `pip install` outside `.venv` (incl. `--user`), `curl … | sh` installers,
  adding system services, users/groups or any package not in the approved list. Explain what and why first.
- Docker is already installed on the host and may be used for isolated tooling if preferred.

## Commands

```bash
# One-time setup (from repo root)
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt -r requirements-tools.txt
(cd frontend && npm ci && PLAYWRIGHT_BROWSERS_PATH=../.tools/ms-playwright npx playwright install chromium)

cd frontend && npm ci                      # install
npm run dev                                # dev server (mock hass)
npm run build                              # builds ../custom_components/visio/www/visio-panel.js
npm run test                               # vitest
npm run lint                               # tsc --noEmit (strict type check)
.venv/bin/pytest tests/                    # integration tests (from repo root)
# Visual check: with `npm run dev -- --port 5199` running (mock hass), capture desktop/phone
# screenshots (incl. the side menu) using the project-local headless Chromium:
PLAYWRIGHT_BROWSERS_PATH=../.tools/ms-playwright node scripts/screenshot.mjs http://localhost:5199/ <outdir> [light|dark]
```

Local HA VM: `scripts/haos-vm.sh create|start|stop|status|console` (libvirt **user session**,
disk in `.vm/`, UI at http://localhost:8123 → guest port 80; HAOS ≥ 2026.9 serves the UI on port 80).
Networking is QEMU user-mode NAT (the host is on Wi-Fi, which can't be bridged): the VM reaches the LAN
and internet, but LAN devices can't reach the VM directly — use Tailscale for other devices.

Dev loop against real HA: `scripts/deploy-dev.sh` builds the panel, installs
`custom_components/visio` into the VM through its root console (VM fetches from the host at
`10.0.2.2`) and restarts HA Core. Then reload the "Visio" sidebar panel.

## Conventions

- TypeScript `strict`; functional React components and hooks.
- Configuration lives in the HA Store, never hardcoded.
- Snapshot polling pauses when the tab is hidden and backs off on errors (battery cameras).
- Never put credentials in the repo or the frontend bundle; vendor credentials stay inside HA.

## Workflow rules

- **Commit after every implemented feature**: one focused commit per feature, conventional
  messages (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- Never commit secrets (`secrets.yaml`, `.env`, tokens), build output, `.tools/`, `.venv/` or `.vm/`.
- Do not `git push` unless explicitly asked.

## Public and private repos

- `cpey/visio` (this repo) is **public** (HACS requires it): code, README and this file
  only. All documentation is private. Never commit house-specific details here:
  tailnet name, domains, LAN IPs, MACs, device ids, room/person names.
- `docs/local` is a **submodule** → private `cpey/visio-notes`: all docs and guides
  (`guides/`: remote access, short links, Pi migration, Alexa), house configuration
  notes, the real HA YAML in use, and `DECISIONS.md` (decision log). Write new docs there.
  Record every notable design decision in `DECISIONS.md` (context → decision →
  consequences), commit it in the submodule, then commit the updated submodule pointer here.
- Clone with `git clone --recurse-submodules`, or run `git submodule update --init`.
  CI and HACS don't need the submodule.
- Neither repo holds credentials; those stay in Home Assistant.
