"""Tests for detecting stuck integrations."""

from watchdog_plan import DOWN_AFTER_S, RETRY_EVERY_S, down_entries, due_for_reload

ENTRIES = {
    "cover.kitchen": "norman",
    "cover.living": "norman",
    "camera.billie": "tapo",
    "sensor.kitchen_battery": "rest",  # not a watched domain
}


def test_entry_down_only_when_all_its_entities_unavailable():
    states = {"cover.kitchen": "unavailable", "cover.living": "unavailable", "camera.billie": "idle"}
    assert down_entries(ENTRIES, states) == {"norman"}
    states["cover.living"] = "open"
    assert down_entries(ENTRIES, states) == set()


def test_unwatched_domains_and_missing_entities_are_ignored():
    states = {"sensor.kitchen_battery": "unavailable", "camera.billie": "unavailable"}
    assert down_entries(ENTRIES, states) == {"tapo"}


def test_reload_after_grace_period_then_rate_limited():
    now = 10_000.0
    assert due_for_reload({"norman": now - DOWN_AFTER_S + 1}, {}, now) == []
    assert due_for_reload({"norman": now - DOWN_AFTER_S}, {}, now) == ["norman"]
    assert due_for_reload({"norman": now - 1000}, {"norman": now - 60}, now) == []
    assert due_for_reload({"norman": now - 5000}, {"norman": now - RETRY_EVERY_S}, now) == ["norman"]
