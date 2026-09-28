"""Tests for which blind actions are due at a given day/minute."""

from schedule import due_actions

MON, TUE, SAT = 0, 1, 5


def blinds(mode="auto", **sched_overrides):
    base = {
        "id": "all",
        "enabled": True,
        "entities": ["cover.kitchen", "cover.living"],
        "days": {"mon": {"open": "07:30", "close": "21:00"}, "sat": {"open": "09:00"}},
    }
    return {"mode": mode, "schedules": [{**base, **sched_overrides}]}


def test_opens_and_closes_at_the_configured_minute():
    assert due_actions(blinds(), MON, "07:30") == [("open_cover", ["cover.kitchen", "cover.living"])]
    assert due_actions(blinds(), MON, "21:00") == [("close_cover", ["cover.kitchen", "cover.living"])]


def test_nothing_at_other_times_or_days():
    assert due_actions(blinds(), MON, "07:31") == []
    assert due_actions(blinds(), TUE, "07:30") == []  # no Tuesday entry
    assert due_actions(blinds(), SAT, "21:00") == []  # Saturday has no close


def test_manual_mode_runs_nothing():
    assert due_actions(blinds(mode="manual"), MON, "07:30") == []


def test_missing_mode_is_manual():
    cfg = blinds()
    del cfg["mode"]
    assert due_actions(cfg, MON, "07:30") == []


def test_disabled_schedule_runs_nothing():
    assert due_actions(blinds(enabled=False), MON, "07:30") == []


def test_several_schedules_merge_and_later_one_wins_per_blind():
    cfg = {
        "mode": "auto",
        "schedules": [
            {"id": "a", "entities": ["cover.kitchen", "cover.living"], "days": {"mon": {"open": "07:30"}}},
            {"id": "b", "entities": ["cover.living", "cover.bed"], "days": {"mon": {"close": "07:30"}}},
        ],
    }
    assert due_actions(cfg, MON, "07:30") == [
        ("open_cover", ["cover.kitchen"]),
        ("close_cover", ["cover.living", "cover.bed"]),
    ]
