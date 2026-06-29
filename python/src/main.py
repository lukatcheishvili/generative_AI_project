"""
PageForge CLI runner — the non-interactive path.

Runs the straight-through graph (strategist -> generator, no approval pause) on a
free-form brief and writes the landing page to disk. Useful for tests/automation
and to demonstrate the same pipeline without the UI.

Usage:
    python -m src.main --brief "A cozy coffee shop in Madrid ..." --out page.html
"""

import argparse
import json

from dotenv import load_dotenv

from src.graph import get_straight_through


def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="PageForge CLI runner")
    parser.add_argument("--brief", required=True, help="Free-form business description")
    parser.add_argument("--model", default=None, help="Optional model id override")
    parser.add_argument("--out", default="landing_page.html", help="Output HTML path")
    args = parser.parse_args()

    graph = get_straight_through()
    print("\n--- Running PageForge pipeline (straight-through) ---")
    state = {"brief": args.brief, "model": args.model, "images": []}
    final = graph.invoke(state)

    print("\nPlan:\n" + json.dumps(final["plan"], indent=2))
    with open(args.out, "w") as f:
        f.write(final["html"])
    print(f"\nLanding page written to {args.out}")


if __name__ == "__main__":
    main()
