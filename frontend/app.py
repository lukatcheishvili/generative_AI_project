import streamlit as st
import time
import sys
import os

# Add the project root to the Python path so 'src' can be imported
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.graph import build_graph

st.set_page_config(page_title="Hotel Intelligence MVP", layout="wide")

st.title("Hotel Market & Acquisition Intelligence")
st.markdown("A Multi-Agent System for Dynamic Pricing and Acquisition Due Diligence.")

# Initialize session state for the LangGraph
if "graph" not in st.session_state:
    st.session_state.graph = build_graph()
    st.session_state.thread_config = {"configurable": {"thread_id": "streamlit_session_1"}}

if "workflow_state" not in st.session_state:
    st.session_state.workflow_state = "input"  # 'input', 'running', 'human_review', 'completed'

if "current_graph_state" not in st.session_state:
    st.session_state.current_graph_state = {}

# Layout
if st.session_state.workflow_state == "input":
    with st.form("query_form"):
        query = st.text_area("Enter your analysis prompt:", 
                             value="Assess acquiring 'The Seaside Inn' in Miami. What are the CapEx red flags and local market conditions?",
                             height=150)
        submitted = st.form_submit_button("Run Analysis")
        
        if submitted and query:
            st.session_state.workflow_state = "running"
            
            initial_state = {
                "user_query": query,
                "task_type": "",
                "reputation_data": "",
                "market_data": "",
                "preliminary_report": "",
                "human_feedback": "",
                "final_dossier": "",
                "messages": []
            }
            
            # Start workflow
            with st.spinner("Orchestrating agents..."):
                for event in st.session_state.graph.stream(initial_state, st.session_state.thread_config):
                    pass # We just stream to the pause point
                
            st.session_state.current_graph_state = st.session_state.graph.get_state(st.session_state.thread_config).values
            st.session_state.workflow_state = "human_review"
            st.rerun()

elif st.session_state.workflow_state == "human_review":
    st.warning("⚠️ Workflow Paused: Human-in-the-Loop Review Required")
    
    st.subheader("Preliminary Financial & Risk Report")
    report = st.session_state.current_graph_state.get("preliminary_report", "No report generated.")
    st.markdown(report)
    
    st.divider()
    st.subheader("Provide Strategic Feedback")
    with st.form("feedback_form"):
        feedback = st.text_area("Enter your feedback for the Synthesizer (or just type 'approve'):")
        submit_feedback = st.form_submit_button("Submit & Finalize")
        
        if submit_feedback and feedback:
            st.session_state.workflow_state = "completing"
            
            with st.spinner("Synthesizer is finalizing the dossier..."):
                st.session_state.graph.update_state(
                    st.session_state.thread_config,
                    {"human_feedback": feedback},
                    as_node="financial_evaluator"
                )
                
                for event in st.session_state.graph.stream(None, st.session_state.thread_config):
                    pass
            
            st.session_state.current_graph_state = st.session_state.graph.get_state(st.session_state.thread_config).values
            st.session_state.workflow_state = "completed"
            st.rerun()

elif st.session_state.workflow_state == "completed":
    st.success("✅ Final Executive Dossier Generated")
    dossier = st.session_state.current_graph_state.get("final_dossier", "No dossier generated.")
    st.markdown(dossier)
    
    if st.button("Start New Analysis"):
        st.session_state.workflow_state = "input"
        # Reset thread id to start fresh
        st.session_state.thread_config = {"configurable": {"thread_id": f"streamlit_session_{int(time.time())}"}}
        st.rerun()
