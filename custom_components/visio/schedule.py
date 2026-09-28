"""Blind schedules: which actions are due at a given local day and minute.

Pure (no Home Assistant imports) so it can be unit tested standalone.
"""

from __future__ import annotations

from typing import Any

try:
    from .schema import DAYS
except ImportError:  # loaded standalone by the unit tests
    from schema import DAYS

ACTIONS = {"open": "open_cover", "close": "close_cover"}


def due_actions(blinds: dict[str, Any], weekday: int, hhmm: str) -> list[tuple[str, list[str]]]:
    """(cover service, entity ids) to run at `hhmm` on `weekday` (0 = Monday).

    Nothing runs in manual mode or for disabled schedules. If several schedules
    act on the same blind at the same minute, the blind is included once per
    action; open and close for the same blind at the same minute cancel out to
    the later one in the schedule list.
    """
    if blinds.get("mode", "manual") != "auto":  # missing mode = manual (safe default)
        return []
    day = DAYS[weekday]
    per_entity: dict[str, str] = {}
    for sched in blinds.get("schedules", []):
        if not sched.get("enabled", True):
            continue
        times = sched.get("days", {}).get(day, {})
        for action in ("open", "close"):
            if times.get(action) == hhmm:
                for eid in sched.get("entities", []):
                    per_entity[eid] = action
    result: list[tuple[str, list[str]]] = []
    for action, service in ACTIONS.items():
        ids = [eid for eid, a in per_entity.items() if a == action]
        if ids:
            result.append((service, ids))
    return result
