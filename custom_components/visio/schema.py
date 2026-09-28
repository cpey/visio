"""Validation of the Visio configuration document.

Kept free of Home Assistant imports so it can be unit tested standalone.

Document shape:
    {
      "entities": {"<entity_id>": {<profile>}},
      "layouts":  {"<layout_id>": {<layout>}},
      "blinds":   {"mode": "auto"|"manual",
                   "schedules": [{"id", "name", "enabled", "entities": [cover ids],
                                  "days": {"mon": {"open": "07:30", "close": "21:00"}, ...}}]}
    }
"""

from __future__ import annotations

import re
from typing import Any

ENTITY_ID_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
LAYOUT_ID_RE = re.compile(r"^[a-z0-9_-]{1,32}$")

MODES = ("live", "snapshot", "placeholder")
FALLBACKS = ("snapshot", "placeholder", "none")

MIN_INTERVAL = 1
MAX_INTERVAL = 3600
MAX_TEXT = 200
MAX_ENTITIES = 500
MAX_LAYOUTS = 20
MAX_SCHEDULES = 20

BLIND_MODES = ("auto", "manual")
UPDATE_MODES = ("manual", "weekly")
DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")  # index = datetime.weekday()
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class ConfigError(ValueError):
    """Raised when a configuration document is invalid."""


def default_config() -> dict[str, Any]:
    """Return the configuration used before anything is stored."""
    return {
        "entities": {},
        "layouts": {"default": {"name": "Default", "columns": 3}},
        # Manual by default: nothing moves on its own until someone opts in.
        "blinds": {"mode": "manual", "schedules": []},
        # Manual by default: nothing updates until someone picks a weekly slot.
        "updates": {"mode": "manual", "day": "sun", "time": "04:00", "backup": True},
    }


def _text(value: Any, field: str) -> str:
    if not isinstance(value, str) or len(value) > MAX_TEXT:
        raise ConfigError(f"{field} must be a string of at most {MAX_TEXT} chars")
    return value


def _int(value: Any, field: str, lo: int, hi: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not lo <= value <= hi:
        raise ConfigError(f"{field} must be an integer between {lo} and {hi}")
    return value


def _bool(value: Any, field: str) -> bool:
    if not isinstance(value, bool):
        raise ConfigError(f"{field} must be a boolean")
    return value


def _choice(value: Any, field: str, choices: tuple[str, ...]) -> str:
    if value not in choices:
        raise ConfigError(f"{field} must be one of {', '.join(choices)}")
    return value


def _entity_id(value: Any, field: str) -> str:
    if not isinstance(value, str) or not ENTITY_ID_RE.match(value):
        raise ConfigError(f"{field} must be an entity id")
    return value


def _url(value: Any, field: str) -> str:
    value = _text(value, field)
    if not value.startswith(("https://", "http://", "/")):
        raise ConfigError(f"{field} must be an http(s) URL or an absolute path")
    return value


# field -> validator; unknown fields are rejected.
_PROFILE_FIELDS = {
    "name": lambda v, f: _text(v, f),
    "order": lambda v, f: _int(v, f, -10000, 10000),
    "hidden": _bool,
    "tile": lambda v, f: _text(v, f),
    "mode": lambda v, f: _choice(v, f, MODES),
    "interval": lambda v, f: _int(v, f, MIN_INTERVAL, MAX_INTERVAL),
    "fallback": lambda v, f: _choice(v, f, FALLBACKS),
    "placeholder_text": lambda v, f: _text(v, f),
    "placeholder_url": _url,
    "motion_entity": _entity_id,
    "hide_tilt": _bool,
    "battery_entity": _entity_id,
    "hide_battery": _bool,
}

_LAYOUT_FIELDS = {
    "name": lambda v, f: _text(v, f),
    "columns": lambda v, f: _int(v, f, 1, 8),
    "show_clock": _bool,  # legacy: accepted for stored configs, no longer used
    "entities": lambda v, f: _entity_list(v, f),
}


def _entity_list(value: Any, field: str) -> list[str]:
    if not isinstance(value, list) or len(value) > MAX_ENTITIES:
        raise ConfigError(f"{field} must be a list of entity ids")
    return [_entity_id(item, f"{field}[]") for item in value]


def _object(value: Any, fields: dict, where: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ConfigError(f"{where} must be an object")
    result = {}
    for key, item in value.items():
        if key not in fields:
            raise ConfigError(f"{where}: unknown field '{key}'")
        result[key] = fields[key](item, f"{where}.{key}")
    return result


def _time(value: Any, field: str) -> str:
    if not isinstance(value, str) or not TIME_RE.match(value):
        raise ConfigError(f"{field} must be a time HH:MM (24 h)")
    return value


def _days(value: Any, field: str) -> dict[str, dict[str, str]]:
    if not isinstance(value, dict):
        raise ConfigError(f"{field} must be an object")
    result = {}
    for day, times in value.items():
        if day not in DAYS:
            raise ConfigError(f"{field}: unknown day '{day}' (use {', '.join(DAYS)})")
        clean = _object(times, {"open": _time, "close": _time}, f"{field}.{day}")
        if clean:
            result[day] = clean
    return result


def _cover_list(value: Any, field: str) -> list[str]:
    ids = _entity_list(value, field)
    if any(not eid.startswith("cover.") for eid in ids):
        raise ConfigError(f"{field} may only contain cover entities")
    return ids


_SCHEDULE_FIELDS = {
    "id": lambda v, f: _schedule_id(v, f),
    "name": lambda v, f: _text(v, f),
    "enabled": _bool,
    "entities": _cover_list,
    "days": _days,
}


def _schedule_id(value: Any, field: str) -> str:
    if not isinstance(value, str) or not LAYOUT_ID_RE.match(value):
        raise ConfigError(f"{field} must be an id (lowercase letters, digits, - or _)")
    return value


def _blinds(value: Any, field: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ConfigError(f"{field} must be an object")
    unknown = set(value) - {"mode", "schedules"}
    if unknown:
        raise ConfigError(f"{field}: unknown fields {', '.join(sorted(unknown))}")
    schedules = value.get("schedules", [])
    if not isinstance(schedules, list) or len(schedules) > MAX_SCHEDULES:
        raise ConfigError(f"{field}.schedules must be a list of at most {MAX_SCHEDULES}")
    clean = []
    for i, sched in enumerate(schedules):
        item = _object(sched, _SCHEDULE_FIELDS, f"{field}.schedules[{i}]")
        if "id" not in item:
            raise ConfigError(f"{field}.schedules[{i}] needs an id")
        clean.append(item)
    ids = [s["id"] for s in clean]
    if len(ids) != len(set(ids)):
        raise ConfigError(f"{field}.schedules ids must be unique")
    return {
        "mode": _choice(value.get("mode", "manual"), f"{field}.mode", BLIND_MODES),
        "schedules": clean,
    }


def _updates(value: Any, field: str) -> dict[str, Any]:
    clean = _object(
        value,
        {
            "mode": lambda v, f: _choice(v, f, UPDATE_MODES),
            "day": lambda v, f: _choice(v, f, DAYS),
            "time": _time,
            "backup": _bool,
        },
        field,
    )
    return {**default_config()["updates"], **clean}


def validate_config(data: Any) -> dict[str, Any]:
    """Validate a full configuration document and return a clean copy."""
    if not isinstance(data, dict):
        raise ConfigError("config must be an object")
    unknown = set(data) - {"entities", "layouts", "blinds", "updates"}
    if unknown:
        raise ConfigError(f"unknown top-level fields: {', '.join(sorted(unknown))}")

    entities = data.get("entities", {})
    if not isinstance(entities, dict) or len(entities) > MAX_ENTITIES:
        raise ConfigError("entities must be an object")
    layouts = data.get("layouts", {})
    if not isinstance(layouts, dict) or len(layouts) > MAX_LAYOUTS:
        raise ConfigError(f"layouts must be an object with at most {MAX_LAYOUTS} items")

    clean_layouts = {}
    for layout_id, layout in layouts.items():
        if not isinstance(layout_id, str) or not LAYOUT_ID_RE.match(layout_id):
            raise ConfigError(f"invalid layout id '{layout_id}'")
        clean_layouts[layout_id] = _object(layout, _LAYOUT_FIELDS, f"layouts.{layout_id}")
    if not clean_layouts:
        clean_layouts = default_config()["layouts"]

    return {
        "entities": {
            _entity_id(eid, "entities key"): _object(p, _PROFILE_FIELDS, f"entities.{eid}")
            for eid, p in entities.items()
        },
        "layouts": clean_layouts,
        "blinds": _blinds(data.get("blinds", {}), "blinds"),
        "updates": _updates(data.get("updates", {}), "updates"),
    }
