"""
BrewPage — AI Marketing Strategy → Landing Page Engine for Coffee Shops

Pipeline (a LangGraph graph, see src/graph.py):
  1. STRATEGIST node  -> makes the marketing decisions a strategist would:
        positioning, target customer, value proposition, tone, conversion goal.
  2. GENERATOR node   -> turns that strategy (+ any uploaded photos) into a
        real, styled landing page.

Run:  streamlit run frontend/app.py
Needs: GEMINI_API_KEY set in a .env file in the project root
"""

import os
import sys

import streamlit as st
import streamlit.components.v1 as components
import google.generativeai as genai
from dotenv import load_dotenv

# Add the project root to the Python path so 'src' can be imported
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.graph import STEP_LABELS, get_pipeline
from src.agents import image_to_data_uri

load_dotenv()


def run_pipeline(shop, images, status_box):
    """Streams the LangGraph pipeline node-by-node so the UI can report
    progress, and returns the final accumulated state."""
    state = {"shop": shop, "images": images}
    for update in get_pipeline().stream(state, stream_mode="updates"):
        for node_name, partial in update.items():
            state.update(partial)
            status_box.write(STEP_LABELS.get(node_name, node_name))
    return state


# ----------------------------------------------------------------------------
# MARKDOWN EXPORT — strategist output, for the assignment report
# ----------------------------------------------------------------------------
def strategy_to_md(shop, strategy):
    lines = [f"# Strategist — {shop['name']}", ""]
    lines += [f"**Positioning:** {strategy['positioning']}", ""]
    lines += [f"**Target customer:** {strategy['target_customer']}", ""]
    lines += [f"**Value proposition:** {strategy['value_proposition']}", ""]
    lines += [f"**Tone:** {strategy['tone']}", ""]
    lines += [f"**Conversion goal:** {strategy['conversion_goal']}", ""]
    lines += ["**Key messages:**", ""]
    lines += [f"- {m}" for m in strategy["key_messages"]]
    return "\n".join(lines) + "\n"


# ----------------------------------------------------------------------------
# STREAMLIT UI
# ----------------------------------------------------------------------------
st.set_page_config(page_title="BrewPage", page_icon=None, layout="wide")

st.markdown("""
<style>
.block-container { padding-top: 3rem; max-width: 980px; }
h1 { font-weight: 600; letter-spacing: -0.02em; color: #1e5638; }
.bp-overline {
    text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.75rem;
    color: #2e7d4f; margin-bottom: 0.25rem;
}
.bp-rule { border: none; border-top: 1px solid #d9ece0; margin: 1.75rem 0; }
[data-testid="stMetricValue"] { font-weight: 600; color: #1e5638; }
.stButton > button[kind="primary"] { background-color: #2e7d4f; border-color: #2e7d4f; }
.stButton > button[kind="primary"]:hover { background-color: #256241; border-color: #256241; }
</style>
""", unsafe_allow_html=True)

try:
    secrets_api_key = st.secrets.get("GEMINI_API_KEY", "")
except Exception:
    secrets_api_key = ""
api_key = os.environ.get("GEMINI_API_KEY", "") or secrets_api_key

if api_key:
    genai.configure(api_key=api_key)

st.markdown('<div class="bp-overline">Marketing strategy → landing page</div>',
            unsafe_allow_html=True)
st.title("BrewPage")
st.caption("Makes the marketing decisions a strategist would — positioning, "
           "audience, value proposition — then renders them into a landing "
           "page for an independent coffee shop.")

if not api_key:
    st.error("Add GEMINI_API_KEY to a .env file in the project root, then "
             "restart the app.")

with st.expander("Pipeline"):
    st.markdown("**Pipeline:** Strategist → Generator")

st.markdown('<hr class="bp-rule">', unsafe_allow_html=True)
st.subheader("Tell me about the coffee shop")
c1, c2 = st.columns(2)
with c1:
    name = st.text_input("Shop name", "Ember & Oak")
    location = st.text_input("Location / setting", "A quiet corner in Lavapiés, Madrid")
    address = st.text_input(
        "Street address (optional, for the map link)", "",
        placeholder="e.g. Calle de la Cabeza 12, 28012 Madrid",
        help="Only used for the 'visit in person' button. Leave blank if this "
             "is a fictional shop — without a real address, Google Maps will "
             "guess the nearest match instead of finding this exact place.",
    )
    vibe = st.text_input("Vibe / atmosphere", "Cozy, slow, lots of plants and warm wood")
with c2:
    differentiator = st.text_input("What makes it different",
        "Single-origin beans roasted in-house; the only pour-over bar in the neighborhood")
    target = st.text_input("Target customer (your guess)",
        "Remote workers and students who care about good coffee")
    goal = st.selectbox("Main goal of the page",
        ["Get people to visit in person", "Drive online orders / pre-orders",
         "Sign up for a loyalty program", "Book the space for events"])

shop = {"name": name, "location": location, "address": address, "vibe": vibe,
        "differentiator": differentiator, "target": target, "goal": goal}

if goal == "Get people to visit in person" and not address.strip():
    st.caption(
        "No street address entered — the map button will guess the nearest "
        "match for the shop name instead of pointing at a real place."
    )

st.markdown("**Photos** (optional — used as real photos on the page instead "
            "of placeholder gradients)")
uploaded_photos = st.file_uploader(
    "Upload shop photos", type=["png", "jpg", "jpeg", "webp"],
    accept_multiple_files=True, label_visibility="collapsed",
)
if uploaded_photos:
    n_cols = min(len(uploaded_photos), 6)
    cols = st.columns(n_cols)
    for i, photo in enumerate(uploaded_photos):
        cols[i % n_cols].image(photo, use_container_width=True)

if st.button("Generate page", type="primary", disabled=not api_key):
    images = [image_to_data_uri(f.getvalue()) for f in (uploaded_photos or [])]
    with st.status("Running the LangGraph pipeline...", expanded=True) as status_box:
        result = run_pipeline(shop, images, status_box)
        status_box.update(label="Pipeline complete", state="complete")

    # stash for the report tab
    st.session_state["last"] = {
        "shop": shop.copy(),
        "strategy": result["strategy"],
        "html": result["html"],
    }

if "last" in st.session_state:
    data = st.session_state["last"]
    generated_shop = data.get("shop", shop)
    tab_page, tab_strategy = st.tabs(["Page", "Strategy"])

    with tab_page:
        components.html(data["html"], height=700, scrolling=True)
        st.download_button("Download page (HTML)", data["html"],
                           file_name="landing_page.html", mime="text/html")

    with tab_strategy:
        s = data["strategy"]
        st.markdown(f"**Positioning** — {s['positioning']}")
        st.markdown(f"**Target customer** — {s['target_customer']}")
        st.markdown(f"**Value proposition** — {s['value_proposition']}")
        st.markdown(f"**Tone** — {s['tone']}")
        st.markdown(f"**Conversion goal** — {s['conversion_goal']}")
        st.markdown("**Key messages:**")
        for m in s["key_messages"]:
            st.markdown(f"- {m}")
        st.caption("This is the marketing-thinking step — the part that "
                   "separates this from a generic website builder.")
        st.download_button("Download strategist output (.md)",
                           strategy_to_md(generated_shop, s),
                           file_name="strategist.md", mime="text/markdown")
