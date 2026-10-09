"""Blind commands: targets and the post-command check. Pure logic, unit tested.

Some hubs (Norman Gen 2) drop a command when another arrives at nearly the same
moment, without any error. Visio therefore sends blind commands one at a time and,
once the blind should have arrived, checks it: a blind that didn't move at all gets
the command once more; one that moved somewhere else was moved by someone (or
stopped), so it's left alone.
"""

from __future__ import annotations

COMMANDS = ("open", "close", "set_position")
SERVICES = {"open": "open_cover", "close": "close_cover", "set_position": "set_cover_position"}
COMMAND_GAP_S = 0.3  # between commands, so the hub treats each as a separate task
VERIFY_AFTER_S = 75  # a full open/close takes ~40 s; the integration shows the target for up to 30 s
TOLERANCE = 5  # percent
MAX_ATTEMPTS = 2  # first send + one resend


def target_of(command: str, position: int | None = None) -> int:
    """Target position (0 = closed, 100 = open)."""
    if command == "open":
        return 100
    if command == "close":
        return 0
    if position is None or not 0 <= position <= 100:
        raise ValueError("set_position needs a position between 0 and 100")
    return position


def _near(a: float, b: float) -> bool:
    return abs(a - b) <= TOLERANCE


def verdict(
    target: int,
    start_position: float | None,
    start_state: str | None,
    position: float | None,
    state: str | None,
) -> str:
    """After the travel time: "arrived", "dropped" (didn't move: resend) or "moved".

    Uses the position when the blind reports one, else the open/closed state.
    """
    if position is not None:
        if _near(position, target):
            return "arrived"
        if start_position is not None and _near(position, start_position):
            return "dropped"
        return "moved"
    expected = "open" if target > 0 else "closed"
    if state == expected:
        return "arrived"
    if state == start_state:
        return "dropped"
    return "moved"
