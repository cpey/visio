"""Make the HA-independent integration modules importable as top-level modules."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "custom_components" / "visio"))
