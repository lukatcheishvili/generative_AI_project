import argparse
import json

from src.graph import build_graph


def main():
    parser = argparse.ArgumentParser(description="BrewPage CLI runner")
    parser.add_argument("--name", required=True, help="Shop name")
    parser.add_argument("--location", required=True, help="Location / setting")
    parser.add_argument("--differentiator", required=True, help="What makes it different")
    parser.add_argument("--vibe", required=True, help="Vibe / atmosphere")
    parser.add_argument("--target", required=True, help="Target customer (your guess)")
    parser.add_argument("--address", default="", help="Street address (optional)")
    parser.add_argument(
        "--goal", default="Get people to visit in person",
        choices=[
            "Get people to visit in person", "Drive online orders / pre-orders",
            "Sign up for a loyalty program", "Book the space for events",
        ],
    )
    parser.add_argument("--out", default="landing_page.html", help="Output HTML path")
    args = parser.parse_args()

    shop = {
        "name": args.name, "location": args.location, "address": args.address,
        "vibe": args.vibe, "differentiator": args.differentiator,
        "target": args.target, "goal": args.goal,
    }

    graph = build_graph()
    print("\n--- Running BrewPage pipeline ---")
    state = {"shop": shop, "images": []}
    for event in graph.stream(state, stream_mode="updates"):
        for node_name, update in event.items():
            print(f"\n[Node completed: {node_name}]")
            state.update(update)

    print("\nStrategy:\n" + json.dumps(state["strategy"], indent=2))
    with open(args.out, "w") as f:
        f.write(state["html"])
    print(f"\nLanding page written to {args.out}")


if __name__ == "__main__":
    main()
