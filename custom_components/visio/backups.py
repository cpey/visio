"""Backup status for the System view, from Home Assistant's backup manager.

Reads Settings → System → Backups (schedule, locations such as a network share,
last/next backup). Visio doesn't create backups itself; it only reports whether
they're happening.
"""

from __future__ import annotations

import time
from datetime import datetime
from typing import Any

from homeassistant.core import HomeAssistant

from .backups_plan import assess, location_name

def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def _epoch(value: datetime | None) -> float | None:
    return value.timestamp() if value is not None else None


def _ha_backup_config(hass: HomeAssistant) -> dict[str, Any]:
    """Schedule, locations and last/next backup from HA's backup manager.

    The manager isn't a public API, so every field is read defensively; anything
    missing comes back as None and the view says "unknown".
    """
    manager = hass.data.get("backup")
    data = getattr(getattr(manager, "config", None), "data", None)
    if data is None:
        return {"available": False}
    schedule = getattr(data, "schedule", None)
    create = getattr(data, "create_backup", None)
    retention = getattr(data, "retention", None)
    recurrence = str(getattr(schedule, "recurrence", "never") or "never")
    sched_time = getattr(schedule, "time", None)
    return {
        "available": True,
        "recurrence": recurrence,
        "days": [str(d) for d in getattr(schedule, "days", None) or []],
        "time": sched_time.strftime("%H:%M") if sched_time else None,
        "next": getattr(schedule, "next_automatic_backup", None),
        "last_success": getattr(data, "last_completed_automatic_backup", None),
        "last_attempt": getattr(data, "last_attempted_automatic_backup", None),
        "locations": [location_name(a) for a in getattr(create, "agent_ids", None) or []],
        "keep_copies": getattr(retention, "copies", None),
        "keep_days": getattr(retention, "days", None),
    }


def backup_status(hass: HomeAssistant) -> dict[str, Any]:
    ha = _ha_backup_config(hass)
    if ha["available"]:
        health = assess(time.time(), ha["recurrence"], ha["days"], _epoch(ha["last_success"]))
    else:
        health = {"level": "warning", "problems": ["Home Assistant's backup status isn't available"]}

    return {
        **health,
        "schedule": {
            key: ha.get(key) for key in ("recurrence", "days", "time", "locations", "keep_copies", "keep_days")
        },
        "next": _iso(ha.get("next")),
        "last_success": _iso(ha.get("last_success")),
        "last_attempt": _iso(ha.get("last_attempt")),
    }
