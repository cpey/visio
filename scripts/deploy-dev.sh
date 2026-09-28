#!/usr/bin/env bash
# Build Visio and install it into the local HAOS VM (scripts/haos-vm.sh), then restart HA Core.
# The VM fetches a tarball from a short-lived HTTP server on the host (10.0.2.2 from inside
# QEMU user networking) via the VM's root console. No add-ons or SSH needed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=8765
OUT="$ROOT/.tools/deploy"
CONFIG_DIR=/mnt/data/supervisor/homeassistant   # HA /config inside HAOS

(cd "$ROOT/frontend" && npm run build)

# Stamp a dev version into the deployed copy only (the repo's manifest keeps its release
# version; CI stamps releases from the tag): <latest tag>-dev+<short sha>[.dirty]
LAST_TAG="$(git -C "$ROOT" describe --tags --abbrev=0 2>/dev/null || echo v0.0.0)"
SHA="$(git -C "$ROOT" rev-parse --short HEAD)"
DIRTY="$(git -C "$ROOT" status --porcelain -- custom_components frontend | grep -q . && echo .dirty || true)"
DEV_VERSION="${LAST_TAG#v}-dev+${SHA}${DIRTY}"

mkdir -p "$OUT"
rm -rf "$OUT/stage" && mkdir -p "$OUT/stage"
cp -r "$ROOT/custom_components/visio" "$OUT/stage/visio"
python3 - "$OUT/stage/visio/manifest.json" "$DEV_VERSION" <<'EOF'
import json, sys
path, version = sys.argv[1], sys.argv[2]
manifest = json.load(open(path))
manifest["version"] = version
json.dump(manifest, open(path, "w"), indent=2)
EOF
echo "Deploying Visio $DEV_VERSION"
tar -C "$OUT/stage" --exclude=__pycache__ -cf "$OUT/visio.tar" visio

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$OUT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1

{
  printf '\r'; sleep 2
  printf 'root\r'; sleep 3
  printf 'mkdir -p %s/custom_components && rm -rf %s/custom_components/visio\r' "$CONFIG_DIR" "$CONFIG_DIR"; sleep 1
  printf 'curl -fsS http://10.0.2.2:%s/visio.tar | tar -x -C %s/custom_components && echo DEPLOY_OK\r' "$PORT" "$CONFIG_DIR"; sleep 4
  printf 'ls %s/custom_components/visio\r' "$CONFIG_DIR"; sleep 1
  printf 'ha core restart --no-progress && echo RESTART_OK\r'; sleep 45
  printf 'exit\r'; sleep 1
} | timeout 90 script -qfc "virsh -c qemu:///session console visio-haos --force" /dev/null 2>&1 \
  | tr -d '\033\r' | sed 's/\[[0-9;?]*[a-zA-Z]//g' | grep -E '^(DEPLOY_OK|RESTART_OK)|rror|__init__' || true
echo "Deployed Visio $DEV_VERSION"
