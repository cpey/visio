"""Are backups healthy: pure logic (no Home Assistant imports), unit tested.

Inputs come from Home Assistant's backup manager (schedule, last successful
automatic backup, locations). Times are epoch seconds.
"""

from __future__ import annotations

DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
GRACE_H = 12  # a backup can run late or take a while


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


def _ago(seconds: float) -> str:
    hours = seconds / 3600
    return f"{hours:.0f} h ago" if hours < 48 else f"{hours / 24:.0f} days ago"


def assess(
    now: float,
    recurrence: str,
    days: list[str],
    last_success: float | None,
) -> dict:
    """Overall level ("ok" | "warning" | "off") and the problems behind it."""
    problems: list[str] = []
    limit_h = max_age_hours(recurrence, days)
    if limit_h is None:
        problems.append("Automatic backups are off")
    elif last_success is None:
        problems.append("No automatic backup has completed yet")
    elif now - last_success > limit_h * 3600:
        problems.append(f"Last automatic backup was {_ago(now - last_success)}")

    if limit_h is None:
        level = "off"
    else:
        level = "warning" if problems else "ok"
    return {"level": level, "problems": problems}
