"""Tests for the standalone config validation (no Home Assistant needed)."""

import pytest

import schema  # standalone module, see conftest.py


def test_default_config_is_valid():
    assert schema.validate_config(schema.default_config()) == schema.default_config()


def test_full_profile_roundtrip():
    config = {
        "entities": {
            "camera.front": {
                "name": "Front",
                "order": 1,
                "hidden": False,
                "mode": "live",
                "interval": 5,
                "fallback": "snapshot",
                "motion_entity": "binary_sensor.front_motion",
            },
            "camera.garden": {
                "mode": "placeholder",
                "placeholder_text": "View in Aosu app",
                "placeholder_url": "https://example.com",
            },
            "cover.blind": {"hide_tilt": True},
        },
        "layouts": {
            "tv": {"name": "TV", "columns": 2, "show_clock": True},
            "blinds": {"name": "Blinds", "domains": ["cover"]},
        },
        "blinds": {
            "mode": "manual",
            "schedules": [
                {
                    "id": "bedrooms",
                    "name": "Bedrooms",
                    "enabled": True,
                    "entities": ["cover.blind"],
                    "days": {"mon": {"open": "07:30", "close": "21:00"}, "sat": {"open": "09:15"}},
                }
            ],
        },
        "updates": {"mode": "weekly", "day": "sat", "time": "03:30", "backup": False},
    }
    assert schema.validate_config(config) == config


def test_updates_default_to_manual_and_fill_missing_fields():
    assert schema.validate_config({})["updates"] == {
        "mode": "manual", "day": "sun", "time": "04:00", "backup": True,
    }
    assert schema.validate_config({"updates": {"mode": "weekly"}})["updates"]["time"] == "04:00"


def test_missing_blinds_section_gets_defaults():
    assert schema.validate_config({})["blinds"] == {"mode": "manual", "schedules": []}


def test_empty_days_are_dropped():
    cfg = {"blinds": {"schedules": [{"id": "a", "days": {"tue": {}}}]}}
    assert schema.validate_config(cfg)["blinds"]["schedules"][0]["days"] == {}


def test_empty_layouts_get_default():
    assert schema.validate_config({"entities": {}, "layouts": {}})["layouts"] == (
        schema.default_config()["layouts"]
    )


@pytest.mark.parametrize(
    "config",
    [
        [],
        {"extra": 1},
        {"entities": {"not an id": {}}},
        {"entities": {"camera.a": {"mode": "stream"}}},
        {"entities": {"camera.a": {"interval": 0}}},
        {"entities": {"camera.a": {"interval": True}}},
        {"entities": {"cover.a": {"hide_tilt": "yes"}}},
        {"entities": {"camera.a": {"unknown": 1}}},
        {"entities": {"camera.a": {"placeholder_url": "javascript:alert(1)"}}},
        {"entities": {"camera.a": {"name": "x" * 201}}},
        {"layouts": {"Bad Id": {}}},
        {"layouts": {"tv": {"columns": 9}}},
        {"layouts": {"tv": {"entities": ["camera.a", "bad"]}}},
        {"layouts": {"tv": {"domains": ["Camera!"]}}},
        {"layouts": {"tv": {"domains": "camera"}}},
        {"blinds": {"mode": "sometimes"}},
        {"updates": {"mode": "daily"}},
        {"updates": {"day": "someday"}},
        {"updates": {"time": "4am"}},
        {"updates": {"reboot_host": True}},
        {"blinds": {"extra": 1}},
        {"blinds": {"schedules": [{"name": "no id"}]}},
        {"blinds": {"schedules": [{"id": "a"}, {"id": "a"}]}},
        {"blinds": {"schedules": [{"id": "a", "entities": ["camera.front"]}]}},
        {"blinds": {"schedules": [{"id": "a", "days": {"funday": {}}}]}},
        {"blinds": {"schedules": [{"id": "a", "days": {"mon": {"open": "24:00"}}}]}},
        {"blinds": {"schedules": [{"id": "a", "days": {"mon": {"open": "7:30"}}}]}},
        {"blinds": {"schedules": [{"id": "a", "days": {"mon": {"noon": "12:00"}}}]}},
    ],
)
def test_invalid_configs_rejected(config):
    with pytest.raises(schema.ConfigError):
        schema.validate_config(config)
