"""
PageForge — AI Marketing Strategy → Landing Page (Streamlit + LangGraph)

A strategy-first, two-agent landing-page generator:
  1. STRATEGIST makes the marketing decisions (positioning, audience, value
     proposition, tone, conversion goal) and picks a design system.
  2. You REVIEW & APPROVE that plan — the human-in-the-loop gate, enforced at
     runtime by a LangGraph `interrupt_before` pause.
  3. GENERATOR turns the approved plan (+ any photos) into a real landing page.

Run:  streamlit run app.py
Needs: GEMINI_API_KEY in a .env file (or Vertex env vars with LLM_PROVIDER=vertex)
"""

import os
import sys
import uuid

import streamlit as st
import streamlit.components.v1 as components
from dotenv import load_dotenv

# Allow `from src...` when run as `streamlit run app.py`.
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.agents import BUSINESS_GOALS, image_to_data_uri  # noqa: E402
from src.framers import FRAMERS, FRAMER_IDS  # noqa: E402
from src.graph import STEP_LABELS, get_pipeline  # noqa: E402
from src.llm import active_provider  # noqa: E402

load_dotenv()

MODELS = [
    ("gemini-2.5-flash", "Gemini 2.5 Flash"),
    ("gemini-2.5-pro", "Gemini 2.5 Pro"),
    ("gemini-2.0-flash", "Gemini 2.0 Flash"),
]


# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #
def strategy_to_md(business: dict, strategy: dict) -> str:
    lines = [f"# Strategist — {business.get('name', '')}", ""]
    lines += [f"**Business type:** {business.get('businessType', '')}", ""]
    lines += [f"**Location:** {business.get('location', '')}", ""]
    lines += [f"**Goal:** {business.get('goal', '')}", ""]
    lines += [f"**Positioning:** {strategy['positioning']}", ""]
    lines += [f"**Target customer:** {strategy['target_customer']}", ""]
    lines += [f"**Value proposition:** {strategy['value_proposition']}", ""]
    lines += [f"**Tone:** {strategy['tone']}", ""]
    lines += [f"**Conversion goal:** {strategy['conversion_goal']}", ""]
    lines += ["**Key messages:**", ""]
    lines += [f"- {m}" for m in strategy["key_messages"]]
    return "\n".join(lines) + "\n"


def config_for_session() -> dict:
    if "thread_id" not in st.session_state:
        st.session_state["thread_id"] = str(uuid.uuid4())
    return {"configurable": {"thread_id": st.session_state["thread_id"]}}


def reset_session():
    for key in ("thread_id", "plan", "html", "images", "model", "creds"):
        st.session_state.pop(key, None)


# --------------------------------------------------------------------------- #
# Page + styling                                                              #
# --------------------------------------------------------------------------- #
st.set_page_config(page_title="PageForge", page_icon=None, layout="wide")
st.markdown(
    """
<style>
.block-container { padding-top: 3rem; max-width: 980px; }
h1 { font-weight: 600; letter-spacing: -0.02em; }
.pf-overline {
    text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.75rem;
    color: #6b7280; margin-bottom: 0.25rem;
}
.pf-rule { border: none; border-top: 1px solid #e5e7eb; margin: 1.75rem 0; }
</style>
""",
    unsafe_allow_html=True,
)

st.markdown('<div class="pf-overline">Marketing strategy → landing page</div>', unsafe_allow_html=True)
st.title("PageForge")
st.caption(
    "Describe your business in plain language. An AI Strategist makes the marketing "
    "decisions a brand strategist would, you review and approve the plan, then an AI "
    "Generator turns it into a complete landing page."
)
st.markdown('<hr class="pf-rule">', unsafe_allow_html=True)


# --------------------------------------------------------------------------- #
# Settings (provider / model / own keys)                                      #
# --------------------------------------------------------------------------- #
with st.expander("Settings — model & credentials (optional)"):
    model = st.selectbox(
        "Model", [m[0] for m in MODELS],
        format_func=lambda mid: dict(MODELS)[mid],
    )
    provider = st.radio(
        "Provider", ["(use server default)", "gemini", "vertex"], horizontal=True,
        help=f"Server default is currently: {active_provider()}",
    )
    creds: dict = {}
    if provider != "(use server default)":
        creds["provider"] = provider
    if provider in ("(use server default)", "gemini"):
        gk = st.text_input("Gemini API key", type="password",
                           help="Free key: https://aistudio.google.com/apikey")
        if gk.strip():
            creds["geminiApiKey"] = gk.strip()
    if provider == "vertex":
        creds["vertexProject"] = st.text_input("Vertex project id").strip()
        creds["vertexLocation"] = st.text_input("Vertex location", value="us-central1").strip()
        sa = st.text_area("Service account JSON (raw or base64) — optional")
        if sa.strip():
            creds["vertexServiceAccountJson"] = sa.strip()

st.session_state["model"] = model
st.session_state["creds"] = {k: v for k, v in creds.items() if v}

effective_provider = st.session_state["creds"].get("provider") or active_provider()
have_gemini_key = bool(
    st.session_state["creds"].get("geminiApiKey") or os.environ.get("GEMINI_API_KEY")
)
if effective_provider == "gemini" and not have_gemini_key:
    st.warning(
        "No Gemini API key found. Add one in Settings above, or set GEMINI_API_KEY "
        "in a .env file, before generating."
    )


# --------------------------------------------------------------------------- #
# PHASE 1 — Brief  (only while there is no pending plan / page)               #
# --------------------------------------------------------------------------- #
if "plan" not in st.session_state and "html" not in st.session_state:
    st.subheader("Describe your business")
    brief = st.text_area(
        "Brief",
        height=160,
        placeholder=(
            "e.g. We're a family-run law firm in central Madrid specialising in "
            "immigration cases. We want to win more consultation bookings from "
            "professionals relocating to Spain."
        ),
        label_visibility="collapsed",
    )

    st.markdown("**Photos** (optional — used as real photos instead of placeholder gradients)")
    uploaded = st.file_uploader(
        "Upload photos", type=["png", "jpg", "jpeg", "webp"],
        accept_multiple_files=True, label_visibility="collapsed",
    )
    if uploaded:
        cols = st.columns(min(len(uploaded), 6))
        for i, photo in enumerate(uploaded):
            cols[i % len(cols)].image(photo, use_container_width=True)

    if st.button("Plan strategy", type="primary", disabled=not brief.strip()):
        images = [image_to_data_uri(f.getvalue()) for f in (uploaded or [])]
        st.session_state["images"] = images
        config = config_for_session()
        with st.status("Running the Strategist…", expanded=True) as box:
            initial = {
                "brief": brief.strip(),
                "model": st.session_state["model"],
                "creds": st.session_state["creds"],
                "images": images,
            }
            # interrupt_before=["generator"] makes this run the Strategist and
            # then PAUSE — the human-in-the-loop gate.
            for update in get_pipeline().stream(initial, config, stream_mode="updates"):
                for node_name in update:
                    box.write(STEP_LABELS.get(node_name, node_name))
            snapshot = get_pipeline().get_state(config)
            st.session_state["plan"] = snapshot.values["plan"]
            box.update(label="Strategy ready — review the plan below", state="complete")
        st.rerun()


# --------------------------------------------------------------------------- #
# PHASE 2 — Approve / edit the plan, then resume the graph                    #
# --------------------------------------------------------------------------- #
if "plan" in st.session_state and "html" not in st.session_state:
    plan = st.session_state["plan"]
    business = plan["business"]
    strategy = plan["strategy"]

    st.subheader("Review the plan")
    st.caption("This is the marketing-thinking step. Edit anything, then build the page.")

    st.markdown("**Business**")
    b1, b2 = st.columns(2)
    with b1:
        name = st.text_input("Name", business.get("name", ""))
        business_type = st.text_input("Business type", business.get("businessType", ""))
        location = st.text_input("Location", business.get("location", ""))
    with b2:
        address = st.text_input("Address (optional, for the map link)", business.get("address", ""))
        goal_idx = BUSINESS_GOALS.index(business["goal"]) if business.get("goal") in BUSINESS_GOALS else 0
        goal = st.selectbox("Goal", BUSINESS_GOALS, index=goal_idx)

    st.markdown("**Strategy**")
    positioning = st.text_area("Positioning", strategy.get("positioning", ""), height=70)
    target_customer = st.text_area("Target customer", strategy.get("target_customer", ""), height=70)
    value_proposition = st.text_area("Value proposition", strategy.get("value_proposition", ""), height=70)
    s1, s2 = st.columns(2)
    with s1:
        tone = st.text_input("Tone", strategy.get("tone", ""))
    with s2:
        conversion_goal = st.text_input("Conversion goal", strategy.get("conversion_goal", ""))
    key_messages_text = st.text_area(
        "Key messages (one per line)",
        "\n".join(strategy.get("key_messages", [])),
        height=90,
    )

    framer_idx = FRAMER_IDS.index(plan["framerId"]) if plan.get("framerId") in FRAMER_IDS else 0
    framer_id = st.selectbox(
        "Design system",
        FRAMER_IDS,
        index=framer_idx,
        format_func=lambda fid: next(
            f"{f['name']} — {f['tagline']}" for f in FRAMERS if f["id"] == fid
        ),
    )

    c_build, c_reset = st.columns([3, 1])
    with c_build:
        build = st.button("Confirm & build page", type="primary")
    with c_reset:
        if st.button("Start over"):
            reset_session()
            st.rerun()

    if build:
        edited_plan = {
            "business": {
                "name": name,
                "businessType": business_type,
                "location": location,
                "address": address,
                "goal": goal,
            },
            "strategy": {
                "positioning": positioning,
                "target_customer": target_customer,
                "value_proposition": value_proposition,
                "tone": tone,
                "conversion_goal": conversion_goal,
                "key_messages": [m.strip() for m in key_messages_text.splitlines() if m.strip()],
            },
            "framerId": framer_id,
        }
        config = config_for_session()
        # Write the human-approved (possibly edited) plan back into the paused
        # graph, then RESUME — the Generator runs from the approved state.
        get_pipeline().update_state(config, {"plan": edited_plan})
        with st.status("Running the Generator…", expanded=True) as box:
            for update in get_pipeline().stream(None, config, stream_mode="updates"):
                for node_name in update:
                    box.write(STEP_LABELS.get(node_name, node_name))
            snapshot = get_pipeline().get_state(config)
            st.session_state["plan"] = edited_plan
            st.session_state["html"] = snapshot.values["html"]
            box.update(label="Page complete", state="complete")
        st.rerun()


# --------------------------------------------------------------------------- #
# PHASE 3 — Result                                                            #
# --------------------------------------------------------------------------- #
if "html" in st.session_state:
    plan = st.session_state["plan"]
    html = st.session_state["html"]

    if st.button("Start over"):
        reset_session()
        st.rerun()

    tab_page, tab_strategy = st.tabs(["Page", "Strategy"])
    with tab_page:
        components.html(html, height=700, scrolling=True)
        st.download_button(
            "Download page (HTML)", html, file_name="landing_page.html", mime="text/html"
        )
    with tab_strategy:
        s = plan["strategy"]
        st.markdown(f"**Positioning** — {s['positioning']}")
        st.markdown(f"**Target customer** — {s['target_customer']}")
        st.markdown(f"**Value proposition** — {s['value_proposition']}")
        st.markdown(f"**Tone** — {s['tone']}")
        st.markdown(f"**Conversion goal** — {s['conversion_goal']}")
        st.markdown("**Key messages:**")
        for m in s["key_messages"]:
            st.markdown(f"- {m}")
        st.download_button(
            "Download strategist output (.md)",
            strategy_to_md(plan["business"], s),
            file_name="strategist.md",
            mime="text/markdown",
        )
