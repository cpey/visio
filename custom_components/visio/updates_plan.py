"""Update planning: which update entities to install, in which order, and when.

Pure (no Home Assistant imports) so it can be unit tested standalone. Everything is
applied through Home Assistant's own `update.*` entities inside Home Assistant OS;
nothing here touches the machine hosting it.
"""

from __future__ import annotations

from typing import Any

try:
    from .schema import DAYS
except ImportError:  # loaded standalone by the unit tests
    from schema import DAYS

CORE = "update.home_assistant_core_update"
OS = "update.home_assistant_operating_system_update"

# UpdateEntityFeature.BACKUP
FEATURE_BACKUP = 8

KIND_LABELS = {"os": "System (Home Assistant OS)", "core": "Home Assistant Core", "other": "Add-ons & integrations"}


def kind_of(entity_id: str) -> str:
    if entity_id == CORE:
        return "core"
    if entity_id == OS:
        return "os"
    return "other"


def pending(states: dict[str, dict[str, Any]]) -> list[str]:
    """Update entities with an update available (state "on"), not skipped."""
    return sorted(
        eid
        for eid, st in states.items()
        if eid.startswith("update.") and st.get("state") == "on"
    )


def plan(states: dict[str, dict[str, Any]], only: list[str] | None = None) -> list[list[str]]:
    """Phases to run, in order.

    1. add-ons, integrations and Supervisor (no restart needed to install)
    2. Home Assistant Core (restarts Home Assistant)
    3. Home Assistant OS (reboots the VM/Pi) — resumed after the Core restart

    `only` limits the plan to those entities (manual "update this one").
    """
    ids = [eid for eid in pending(states) if only is None or eid in only]
    phases = [
        [eid for eid in ids if kind_of(eid) == "other"],
        [eid for eid in ids if kind_of(eid) == "core"],
        [eid for eid in ids if kind_of(eid) == "os"],
    ]
    return [p for p in phases if p]


def supports_backup(state: dict[str, Any]) -> bool:
    return bool(int(state.get("attributes", {}).get("supported_features", 0)) & FEATURE_BACKUP)


def is_due(updates: dict[str, Any], weekday: int, hhmm: str) -> bool:
    """True at the configured weekly minute; never in manual mode (the default)."""
    if updates.get("mode", "manual") != "weekly":
        return False
    return updates.get("day") == DAYS[weekday] and updates.get("time") == hhmm
