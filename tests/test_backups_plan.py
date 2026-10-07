"""Tests for the backup health check."""

from backups_plan import assess, location_name, max_age_hours, summarize_copies

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


def test_summarize_copies_counts_only_backups():
    files = [("a.tar", 10.0, 100), ("b.tar", 30.0, 200), ("notes.txt", 99.0, 5)]
    assert summarize_copies(files) == {"count": 2, "total_bytes": 300, "newest_name": "b.tar", "newest_time": 30.0}
    assert summarize_copies([])["newest_time"] is None


def test_ok_when_recent_and_copied():
    copy = {"count": 3, "total_bytes": 1, "newest_name": "x.tar", "newest_time": NOW - 2 * H}
    result = assess(NOW, "daily", [], NOW - 3 * H, "/media/ha-backups", copy)
    assert result == {"level": "ok", "problems": []}


def test_off_and_stale_backups():
    assert assess(NOW, "never", [], None, "", None)["level"] == "off"
    stale = assess(NOW, "daily", [], NOW - 40 * H, "", None)
    assert stale["level"] == "warning" and "40 h ago" in stale["problems"][0]
    assert assess(NOW, "daily", [], None, "", None)["problems"] == ["No automatic backup has completed yet"]


def test_copy_folder_problems():
    last = NOW - H
    assert "not found" in assess(NOW, "daily", [], last, "/media/ha-backups", None)["problems"][0]
    empty = {"count": 0, "total_bytes": 0, "newest_name": None, "newest_time": None}
    assert assess(NOW, "daily", [], last, "/media/ha-backups", empty)["problems"] == ["No backups copied to the disk yet"]
    behind = {"count": 2, "total_bytes": 1, "newest_name": "x.tar", "newest_time": last - 30 * H}
    assert assess(NOW, "daily", [], last, "/media/ha-backups", behind)["problems"] == [
        "The disk is missing the latest backup"
    ]
    # No copy folder configured: the disk isn't checked.
    assert assess(NOW, "daily", [], last, "", None)["level"] == "ok"
