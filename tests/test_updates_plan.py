"""Tests for update planning and weekly scheduling."""

from updates_plan import CORE, OS, is_due, plan, supports_backup

SUN, MON = 6, 0


def st(state="on", features=0):
    return {"state": state, "attributes": {"supported_features": features}}


STATES = {
    CORE: st(),
    OS: st(),
    "update.tailscale_update": st(),
    "update.visio_update": st(),
    "update.norman_update": st("off"),
    "sensor.not_an_update": st(),
}


def test_plan_orders_integrations_then_core_then_os():
    assert plan(STATES) == [
        ["update.tailscale_update", "update.visio_update"],
        [CORE],
        [OS],
    ]


def test_plan_skips_up_to_date_and_empty_phases():
    states = {CORE: st("off"), OS: st("off"), "update.visio_update": st()}
    assert plan(states) == [["update.visio_update"]]
    assert plan({CORE: st("off")}) == []


def test_plan_limited_to_selected_entities():
    assert plan(STATES, only=[OS, "update.visio_update"]) == [["update.visio_update"], [OS]]


def test_supports_backup_reads_feature_bit():
    assert supports_backup(st(features=1 | 8))
    assert not supports_backup(st(features=1 | 4))


def test_weekly_schedule_due_only_at_its_minute():
    cfg = {"mode": "weekly", "day": "sun", "time": "04:00"}
    assert is_due(cfg, SUN, "04:00")
    assert not is_due(cfg, SUN, "04:01")
    assert not is_due(cfg, MON, "04:00")


def test_manual_is_default_and_never_due():
    assert not is_due({"day": "sun", "time": "04:00"}, SUN, "04:00")
    assert not is_due({"mode": "manual", "day": "sun", "time": "04:00"}, SUN, "04:00")
