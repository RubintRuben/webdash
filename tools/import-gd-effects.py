#!/usr/bin/env python3
"""Import native ambient effect settings without changing their numeric values."""

import argparse
import json
from pathlib import Path
import plistlib


EFFECTS = (
    "ringEffect", "bumpEffect", "fireballEffect", "portalEffect01",
    "portalEffect02", "portalEffect03", "portalEffect04", "portalEffect08", "portalEffect09",
    "glassDestroy01", "explodeEffect", "keyEffect", "coinPickupEffect",
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("resources", type=Path, help="Geometry Dash Resources directory")
    args = parser.parse_args()
    effects = {}
    for name in EFFECTS:
        with (args.resources / (name + ".plist")).open("rb") as source:
            effects[name] = plistlib.load(source)
    destination = Path(__file__).resolve().parent.parent / "assets/scripts/game/gd-effect-presets.js"
    destination.write_text(
        "// Imported from the supplied Geometry Dash Resources/*.plist.\n"
        "window.GD_EFFECT_PRESETS = " + json.dumps(effects, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"Imported {len(effects)} native effect presets: {destination}")


if __name__ == "__main__":
    main()
