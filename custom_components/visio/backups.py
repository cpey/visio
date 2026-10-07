"""Backup status for the System view: Home Assistant's backup schedule plus the copy disk.

Reads Home Assistant's backup manager (Settings → System → Backups) and scans the
optional copy folder (`backups.copy_dir`, a second disk). Visio doesn't create or copy
backups itself; it only reports whether they're happening.
"""

from __future__ import annotations

import logging
import os
import shutil
import time
from datetime import datetime
from typing import Any, Callable

from homeassistant.core import HomeAssistant

from .backups_plan import assess, location_name, summarize_copies

_LOGGER = logging.getLogger(__name__)


def _iso(value: datetime | float | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        value = datetime.fromtimestamp(value).astimezone()
    return value.isoformat()


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


def _scan_copy_dir(path: str) -> dict[str, Any] | None:
    """Backups in the copy folder plus free space, or None if it isn't there."""
    if not os.path.isdir(path):
        return None
    files = []
    with os.scandir(path) as entries:
        for entry in entries:
            if entry.is_file():
                info = entry.stat()
                files.append((entry.name, info.st_mtime, info.st_size))
    usage = shutil.disk_usage(path)
    return {**summarize_copies(files), "free_bytes": usage.free, "disk_bytes": usage.total}


async def async_backup_status(hass: HomeAssistant, get_config: Callable[[], dict]) -> dict[str, Any]:
    ha = _ha_backup_config(hass)
    copy_dir = get_config().get("backups", {}).get("copy_dir", "")
    copy = None
    if copy_dir:
        try:
            copy = await hass.async_add_executor_job(_scan_copy_dir, copy_dir)
        except OSError as err:
            _LOGGER.warning("Visio: can't read the backup copy folder %s: %s", copy_dir, err)

    if ha["available"]:
        health = assess(
            time.time(), ha["recurrence"], ha["days"], _epoch(ha["last_success"]), copy_dir, copy
        )
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
        "copy_dir": copy_dir,
        "copy": {**copy, "newest_time": _iso(copy["newest_time"])} if copy else None,
    }
