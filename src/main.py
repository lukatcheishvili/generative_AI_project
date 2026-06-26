import argparse
from src.graph import build_graph

def main():
    parser = argparse.ArgumentParser(description="Hotel Intelligence CLI Runner")
    parser.add_argument("--query", type=str, required=True, help="The analysis prompt")
    args = parser.parse_args()

    graph = build_graph()
    
    # LangGraph requires a thread ID when using a checkpointer
    config = {"configurable": {"thread_id": "cli_thread_1"}}
    
    initial_state = {
        "user_query": args.query,
        "task_type": "",
        "reputation_data": "",
        "market_data": "",
        "preliminary_report": "",
        "human_feedback": "",
        "final_dossier": "",
        "messages": []
    }
    
    print("\\n--- Starting Hotel Intelligence Agent Workflow ---")
    
    # Run until interrupted (HITL)
    for event in graph.stream(initial_state, config):
        for node_name, state_update in event.items():
            print(f"\\n[Node Completed: {node_name}]")
            if isinstance(state_update, dict):
                # Print a snippet of what was updated
                for k, v in state_update.items():
                    if k != "messages" and v:
                        preview = str(v)[:100] + "..." if len(str(v)) > 100 else str(v)
                        print(f"  -> {k}: {preview}")

    # Check if we are paused for human approval
    current_state = graph.get_state(config)
    if current_state.next and "synthesizer" in current_state.next:
        print("\\n--- HUMAN IN THE LOOP PAUSE ---")
        print("Preliminary Report Generated:")
        print(current_state.values.get("preliminary_report", ""))
        
        feedback = input("\\nEnter your strategic feedback (or type 'approve'): ")
        
        # Update the state with human feedback
        graph.update_state(
            config, 
            {"human_feedback": feedback if feedback.lower() != "approve" else "Approved as is."}, 
            as_node="financial_evaluator"
        )
        
        print("\\n--- Resuming Workflow: Synthesizer ---")
        for event in graph.stream(None, config):
            for node_name, state_update in event.items():
                print(f"\\n[Node Completed: {node_name}]")

    print("\\n--- Final Executive Dossier ---")
    final_state = graph.get_state(config).values
    print(final_state.get("final_dossier", "No dossier generated."))

if __name__ == "__main__":
    main()
