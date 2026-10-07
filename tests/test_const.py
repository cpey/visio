"""Tests for the development-build check."""

from const import is_dev_build


def test_dev_builds_are_detected_from_the_version():
    assert is_dev_build("0.4.0-dev+ab4b01a")
    assert is_dev_build("0.4.0-dev+ab4b01a.dirty")
    assert not is_dev_build("0.4.0")
    assert not is_dev_build("unknown")
