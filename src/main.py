"""
CLI runner — demonstrates the full end-to-end flow including the human-in-the-loop pause.

Usage:
    python -m src.main                       # runs a built-in sample ticket
    python -m src.main "I was charged twice for order 1001"
    echo "approve" | python -m src.main ...  # non-interactive approve (for demos/CI)

Flow:
    1. Invoke the graph; it runs router -> specialist -> critic loop, then PAUSES at the
       human-approval interrupt and shows the proposed reply.
    2. The human approves, or types an edited reply.
    3. The graph resumes -> finalize -> done.
"""

from __future__ import annotations

import sys
import uuid

from .graph import build_graph


SAMPLE = "Hi, I think I was overcharged on order 1002 and want a refund. The amount looks wrong."


def run(ticket: str, interactive: bool = True) -> dict:
    app = build_graph()
    thread = {"configurable": {"thread_id": str(uuid.uuid4())}}

    # --- Phase 1: run until the human-approval interrupt -------------------- #
    app.invoke({"ticket": ticket, "revisions": 0}, config=thread)
    snapshot = app.get_state(thread)
    draft = snapshot.values.get("draft", "")

    print("\n" + "=" * 70)
    print("TICKET:", ticket)
    print("-" * 70)
    print("ROUTED TO:", snapshot.values.get("category"))
    print("TOOL CALLS:")
    for tr in snapshot.values.get("tool_results", []):
        print("   ", tr)
    print("-" * 70)
    print("PROPOSED REPLY (awaiting your approval):\n")
    print(draft)
    print("=" * 70)

    # --- Phase 2: human decision -------------------------------------------- #
    if interactive and sys.stdin.isatty():
        choice = input("\n[a]pprove / [e]dit / [r]eject? ").strip().lower()
        if choice.startswith("e"):
            edited = input("Type the edited reply:\n")
            app.update_state(thread, {"human_edit": edited})
        elif choice.startswith("r"):
            print("Rejected. Nothing sent.")
            return snapshot.values
    else:
        # Non-interactive: auto-approve so demos/CI can run unattended.
        print("\n(non-interactive: auto-approving)")

    # --- Phase 3: resume -> finalize ---------------------------------------- #
    app.invoke(None, config=thread)
    final = app.get_state(thread).values

    print("\nFINAL REPLY SENT:\n")
    print(final.get("final_reply", ""))
    print("\nTRACE:")
    for line in final.get("log", []):
        print("   -", line)
    return final


if __name__ == "__main__":
    ticket = " ".join(sys.argv[1:]) or SAMPLE
    run(ticket)
