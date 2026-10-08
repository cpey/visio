"""Tests for the backup health check."""

from backups_plan import assess, location_name, max_age_hours

H = 3600
NOW = 1_000_000.0


def test_max_age_follows_the_schedule():
    assert max_age_hours("daily", []) == 36
    assert max_age_hours("custom_days", ["mon", "thu"]) == 4 * 24 + 12  # thu → mon
    assert max_age_hours("custom_days", ["sun"]) == 7 * 24 + 12
    assert max_age_hours("custom_days", []) is None
    assert max_age_hours("never", []) is None


def test_location_names():
    assert location_name("hassio.local") == "This system"
    assert location_name("backup.local") == "This system"
    assert location_name("hassio.nas_backups") == "nas_backups"
    assert location_name("cloud.cloud") == "Home Assistant Cloud"
    assert location_name("google_drive.abc") == "google_drive.abc"


def test_ok_when_recent():
    assert assess(NOW, "daily", [], NOW - 3 * H) == {"level": "ok", "problems": []}


def test_off_and_stale_backups():
    assert assess(NOW, "never", [], None)["level"] == "off"
    stale = assess(NOW, "daily", [], NOW - 40 * H)
    assert stale["level"] == "warning" and "40 h ago" in stale["problems"][0]
    assert assess(NOW, "daily", [], None)["problems"] == ["No automatic backup has completed yet"]

