"""Which integrations look stuck: pure logic (no Home Assistant imports), unit tested.

An integration (config entry) is "down" when every watched entity it provides is
unavailable. After it has been down for `DOWN_AFTER_S`, it's due for a reload,
at most once per `RETRY_EVERY_S`.
"""

from __future__ import annotations

WATCHED_DOMAINS = ("cover", "camera")
DOWN_AFTER_S = 120
RETRY_EVERY_S = 900


def down_entries(entity_entry: dict[str, str], states: dict[str, str]) -> set[str]:
    """Config entries whose watched entities are all unavailable.

    `entity_entry`: entity_id → config entry id (watched domains only).
    `states`: entity_id → state string (missing entities are ignored).
    """
    by_entry: dict[str, list[str]] = {}
    for entity_id, entry_id in entity_entry.items():
        if entity_id.split(".", 1)[0] in WATCHED_DOMAINS and entity_id in states:
            by_entry.setdefault(entry_id, []).append(states[entity_id])
    return {entry for entry, values in by_entry.items() if values and all(v == "unavailable" for v in values)}


def due_for_reload(
    down_since: dict[str, float], last_reload: dict[str, float], now: float
) -> list[str]:
    """Entries down long enough and not reloaded recently."""
    return sorted(
        entry
        for entry, since in down_since.items()
        if now - since >= DOWN_AFTER_S and now - last_reload.get(entry, float("-inf")) >= RETRY_EVERY_S
    )
