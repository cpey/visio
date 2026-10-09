"""Tests for blind command targets and the post-command check."""

import pytest

from blinds_plan import target_of, verdict


def test_targets():
    assert target_of("open") == 100
    assert target_of("close") == 0
    assert target_of("set_position", 40) == 40
    with pytest.raises(ValueError):
        target_of("set_position")
    with pytest.raises(ValueError):
        target_of("set_position", 120)


def test_arrived_within_tolerance():
    assert verdict(100, 0, "closed", 97, "open") == "arrived"
    assert verdict(40, 100, "open", 43, "open") == "arrived"


def test_dropped_when_the_blind_never_moved():
    assert verdict(100, 0, "closed", 0, "closed") == "dropped"
    assert verdict(0, 80, "open", 78, "open") == "dropped"


def test_moved_elsewhere_is_left_alone():
    # Someone stopped it halfway or moved it with the Norman app.
    assert verdict(100, 0, "closed", 55, "open") == "moved"


def test_state_only_blinds():
    assert verdict(100, None, "closed", None, "open") == "arrived"
    assert verdict(100, None, "closed", None, "closed") == "dropped"
    assert verdict(0, None, "open", None, "opening") == "moved"
