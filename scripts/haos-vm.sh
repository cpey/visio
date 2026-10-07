#!/usr/bin/env bash
# Local Home Assistant OS VM for development (libvirt user session, files in .vm/).
# HA is forwarded to http://localhost:8123 (HAOS >= 2026.9 serves the UI on guest port 80;
# guest port 8123 only redirects to 80).
#
# Usage: scripts/haos-vm.sh create [version] | start [--offline] | stop | status | console | destroy
#                           | offline | online
#
# The VM is a copy of the real house (same Tailscale identity, integrations, ...).
# `start --offline` boots it with its network link already down, so nothing connects
# before you've cleaned it up from the console; `online` / `offline` switch the link.
# While offline, http://localhost:8123 is unreachable too (it goes over the same link).
set -euo pipefail

NAME=visio-haos
CONN=qemu:///session
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VM_DIR="$ROOT/.vm"
DISK="$VM_DIR/haos.qcow2"
VARS="$VM_DIR/haos_VARS.fd"
virsh() { command virsh -c "$CONN" "$@"; }
# The guest NIC's backend is the QEMU netdev "hn0" (see --qemu-commandline in create).
set_link() { virsh qemu-monitor-command "$NAME" --hmp "set_link hn0 $1" >/dev/null; }

case "${1:-}" in
  create)
    version="${2:-$(curl -fsSL https://api.github.com/repos/home-assistant/operating-system/releases/latest \
      | python3 -c 'import sys,json;print(json.load(sys.stdin)["tag_name"])')}"
    mkdir -p "$VM_DIR"
    if [ ! -f "$DISK" ]; then
      curl -fL -o "$VM_DIR/haos.qcow2.xz" \
        "https://github.com/home-assistant/operating-system/releases/download/$version/haos_ova-$version.qcow2.xz"
      xz -d "$VM_DIR/haos.qcow2.xz"
      qemu-img resize "$DISK" 64G
    fi
    cp -n /usr/share/OVMF/OVMF_VARS_4M.fd "$VARS"
    virt-install --connect "$CONN" \
      --name "$NAME" --memory 4096 --vcpus 2 --osinfo linux2022 \
      --import --disk "path=$DISK,bus=virtio" \
      --boot "loader=/usr/share/OVMF/OVMF_CODE_4M.fd,loader.readonly=yes,loader.type=pflash,nvram=$VARS" \
      --network none \
      --qemu-commandline='-netdev user,id=hn0,hostfwd=tcp:127.0.0.1:8123-:80 -device virtio-net-pci,netdev=hn0,addr=0x10' \
      --graphics none --noautoconsole
    echo "Created $NAME. Open http://localhost:8123 in a few minutes."
    ;;
  start)
    if [ "${2:-}" = "--offline" ]; then
      # Start paused so the guest can't send a single packet before the link is down.
      virsh start --paused "$NAME" >/dev/null
      if ! set_link off; then
        virsh destroy "$NAME" >/dev/null
        echo "Couldn't cut the network; VM stopped again." >&2
        exit 1
      fi
      virsh resume "$NAME" >/dev/null
      echo "Started $NAME offline. Use: $0 console   then: $0 online"
    else
      virsh start "$NAME"
    fi
    ;;
  offline) set_link off && echo "Network link down." ;;
  online) set_link on && echo "Network link up (http://localhost:8123 in a moment)." ;;
  stop)
    # Clean ACPI shutdown: HAOS stops add-ons and Core first, which takes 1-3 minutes.
    if [ "$(virsh domstate "$NAME")" = "shut off" ]; then echo "Already stopped."; exit 0; fi
    virsh shutdown "$NAME" >/dev/null
    printf 'Shutting down %s' "$NAME"
    for _ in $(seq 150); do
      if [ "$(virsh domstate "$NAME")" = "shut off" ]; then echo; echo "Stopped."; exit 0; fi
      printf '.'
      sleep 2
    done
    echo
    echo "Still shutting down after 5 minutes. To force it off: virsh -c $CONN destroy $NAME" >&2
    exit 1
    ;;
  status) virsh domstate "$NAME" ;;
  console) virsh console "$NAME" ;;   # login: root (no password) -> HA CLI; exit with Ctrl+]
  destroy)
    virsh destroy "$NAME" 2>/dev/null || true
    virsh undefine "$NAME" --nvram
    echo "VM removed; disk kept in $VM_DIR (delete manually if wanted)."
    ;;
  *) sed -n '2,12p' "$0"; exit 1 ;;
esac
