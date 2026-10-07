"""Are backups healthy: pure logic (no Home Assistant imports), unit tested.

Inputs come from Home Assistant's backup manager (schedule, last successful
automatic backup, locations) and from a scan of the optional copy folder (a second
disk the backups are copied to). Times are epoch seconds.
"""

from __future__ import annotations

DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
GRACE_H = 12  # a backup can run late or take a while
COPY_LAG_S = 6 * 3600  # how far the newest disk copy may trail the last backup


def max_age_hours(recurrence: str, days: list[str]) -> float | None:
    """Longest expected gap between automatic backups, or None when they're off."""
    if recurrence == "daily":
        return 24 + GRACE_H
    if recurrence == "custom_days":
        picked = sorted(DAYS.index(d) for d in days if d in DAYS)
        if not picked:
            return None
        gaps = [(picked[(i + 1) % len(picked)] - d) % 7 or 7 for i, d in enumerate(picked)]
        return max(gaps) * 24 + GRACE_H
    return None


def location_name(agent_id: str) -> str:
    """Readable name for a backup agent id ("hassio.local", "hassio.<share>", "cloud.cloud")."""
    if agent_id in ("hassio.local", "backup.local"):
        return "This system"
    if agent_id == "cloud.cloud":
        return "Home Assistant Cloud"
    domain, _, name = agent_id.partition(".")
    return name if domain == "hassio" and name else agent_id


def summarize_copies(files: list[tuple[str, float, int]]) -> dict:
    """Backup files in the copy folder: (name, mtime, size) of each `.tar`."""
    tars = [f for f in files if f[0].endswith(".tar")]
    newest = max(tars, key=lambda f: f[1], default=None)
    return {
        "count": len(tars),
        "total_bytes": sum(f[2] for f in tars),
        "newest_name": newest[0] if newest else None,
        "newest_time": newest[1] if newest else None,
    }


def _ago(seconds: float) -> str:
    hours = seconds / 3600
    return f"{hours:.0f} h ago" if hours < 48 else f"{hours / 24:.0f} days ago"


def assess(
    now: float,
    recurrence: str,
    days: list[str],
    last_success: float | None,
    copy_dir: str,
    copy: dict | None,
) -> dict:
    """Overall level ("ok" | "warning" | "off") and the problems behind it.

    `copy` is `summarize_copies(...)` of the copy folder, or None when the folder
    can't be found (disk missing or not mounted). Ignored when `copy_dir` is empty.
    """
    problems: list[str] = []
    limit_h = max_age_hours(recurrence, days)
    if limit_h is None:
        problems.append("Automatic backups are off")
    elif last_success is None:
        problems.append("No automatic backup has completed yet")
    elif now - last_success > limit_h * 3600:
        problems.append(f"Last automatic backup was {_ago(now - last_success)}")

    if copy_dir:
        if copy is None:
            problems.append(f"Backup disk not found ({copy_dir})")
        elif not copy["count"]:
            problems.append("No backups copied to the disk yet")
        elif last_success is not None and last_success - copy["newest_time"] > COPY_LAG_S:
            problems.append("The disk is missing the latest backup")

    if limit_h is None:
        level = "off"
    else:
        level = "warning" if problems else "ok"
    return {"level": level, "problems": problems}
