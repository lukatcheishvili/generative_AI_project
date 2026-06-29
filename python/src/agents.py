"""
The two agents in the pipeline (graph nodes).

  1. strategist_node -> reads the user's free-form brief, EXTRACTS the business
       basics and MAKES the marketing decisions, returning a Plan to approve.
  2. generator_node  -> turns an APPROVED plan (+ any photos) into a real,
       styled, single-file HTML landing page in the chosen design system.

Python port of web/lib/agents.ts; both nodes call the model through the
provider seam in llm.py.
"""

import base64
import json
import re
import urllib.parse
from io import BytesIO

from PIL import Image

from src.framers import (
    framer_catalog_for_prompt,
    framer_prompt_block,
    resolve_framer_id,
)
from src.llm import call_model
from src.state import PipelineState

# The conversion goals the page can be optimised for (port of web/lib/types.ts).
BUSINESS_GOALS = [
    "Get people to visit in person",
    "Drive online orders / bookings",
    "Generate leads / enquiries",
    "Sign up / subscribe",
    "Book a consultation / appointment",
]


# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #
def parse_json(raw: str):
    clean = (
        raw.strip()
        .replace("```json", "")
        .replace("```html", "")
        .replace("```", "")
        .strip()
    )
    return json.loads(clean)


def open_links_in_new_tab(html: str) -> str:
    """The generated page is shown inside an embedded iframe — without this,
    clicking a CTA navigates the iframe itself instead of opening the
    destination, which looks like the click just bounces back to the app."""

    def add_target(m):
        attrs = m.group(1)
        if "target=" in attrs:
            return m.group(0)
        return f'<a{attrs} target="_blank" rel="noopener noreferrer"{m.group(2)}>'

    return re.sub(r"<a\b([^>]*?)(/?)>", add_target, html, flags=re.IGNORECASE)


def image_to_data_uri(raw_bytes: bytes, max_dim: int = 1600, quality: int = 82) -> str:
    """Downscale/recompress an uploaded photo so embedding it directly in the
    single-file HTML (as a base64 data URI) doesn't make the page huge."""
    img = Image.open(BytesIO(raw_bytes))
    if img.mode != "RGB":
        img = img.convert("RGB")
    img.thumbnail((max_dim, max_dim))
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def inject_images(html: str, images: list) -> str:
    """The generator references photos as the placeholder tokens IMAGE_1,
    IMAGE_2, ... (so the model never has to see/repeat base64 in its own
    output). Swap those tokens for the real data URIs afterwards."""
    if not images:
        return html

    def repl(match):
        idx = int(match.group(1))
        if 1 <= idx <= len(images):
            return images[idx - 1]
        return match.group(0)

    return re.sub(r"IMAGE_(\d+)", repl, html)


def cta_link_for(shop: dict) -> str:
    """A CTA needs a real destination or the button is dead. Map each
    conversion goal to something that actually does something on click."""
    address = (shop.get("address") or "").strip()
    query = address if address else f"{shop.get('name', '')} {shop.get('location', '')}"
    place = urllib.parse.quote(query)
    mapping = {
        "Get people to visit in person":
            f"https://www.google.com/maps/search/?api=1&query={place}",
        "Drive online orders / bookings":
            "mailto:hello@example.com?subject=Order%20or%20Booking%20Inquiry",
        "Generate leads / enquiries":
            "mailto:hello@example.com?subject=Enquiry",
        "Sign up / subscribe":
            "mailto:hello@example.com?subject=Sign-up",
        "Book a consultation / appointment":
            "mailto:hello@example.com?subject=Appointment%20Booking",
    }
    return mapping.get(shop.get("goal"), "mailto:hello@example.com")


def _images_block(images: list) -> str:
    if not images:
        return (
            "AVAILABLE PHOTOS: none were provided. Use placeholder gradient/duotone "
            "panels wherever a photo would go (see DESIGN BAR and RULES below)."
        )
    n = len(images)
    tokens = ", ".join(f'"IMAGE_{i}"' for i in range(1, n + 1))
    return f"""AVAILABLE PHOTOS: {n} real photo(s) of this business were provided.
Reference them ONLY as <img src="IMAGE_1">, <img src="IMAGE_2">, ... up to
IMAGE_{n} — these are exact placeholder tokens (one of: {tokens}) that get
swapped for the real photo afterwards. Do not alter them, do not invent
IMAGE_n tokens beyond {n}, and never put the same IMAGE_n token in two
different places on the page.
- Use these REAL photos (not gradients) for every photo-shaped slot the
  structure below calls for, distributing them across different sections.
- If there are fewer photos than photo-shaped sections, fall back to a
  placeholder gradient panel for the remaining sections — never reuse the
  same photo twice.
- Style every <img> like a real photo: width/height via CSS, object-fit:
  cover, consistent rounded corners — never a tiny inline icon."""


# --------------------------------------------------------------------------- #
# Agent 1 — Strategist (brief -> editable plan)                               #
# --------------------------------------------------------------------------- #
def run_strategist(brief: str, model=None, creds=None) -> dict:
    prompt = f"""You are a senior brand strategist for small and medium businesses.
A business owner describes their business and what they want, in their own words.
First EXTRACT the business basics, then MAKE the marketing decisions.
Do NOT write any website copy yet.

OWNER'S BRIEF:
\"\"\"
{brief}
\"\"\"

For "goal", choose the single closest option from this list:
- "Get people to visit in person"
- "Drive online orders / bookings"
- "Generate leads / enquiries"
- "Sign up / subscribe"
- "Book a consultation / appointment"

For "design_system", pick the SINGLE framer whose vibe best fits this business
and tone from the list below. Match on industry and feel, not just keywords.
If none clearly fits, leave it as an empty string "" and one will be chosen for you.
{framer_catalog_for_prompt()}

Return ONLY a JSON object, no markdown:
{{
  "business": {{
    "name": "the business name (invent a tasteful one ONLY if none is given)",
    "businessType": "e.g. coffee shop, gym, law firm, bakery",
    "location": "city / neighbourhood / setting if mentioned, else a sensible placeholder",
    "address": "street address if explicitly given, else empty string",
    "goal": "one of the exact options above"
  }},
  "strategy": {{
    "positioning": "one sentence: how this business is positioned vs. generic competitors",
    "target_customer": "a crisp persona — who exactly we're talking to",
    "value_proposition": "the single most compelling reason to choose this business",
    "tone": "3-4 adjectives describing the voice",
    "conversion_goal": "the ONE action the page should drive",
    "key_messages": ["3 supporting points the page should make"]
  }},
  "design_system": "one framer id from the list above, or empty string if unsure"
}}"""
    parsed = parse_json(call_model(prompt, 0.6, model, creds))
    # Honour the model's pick when it names a real framer; otherwise choose
    # randomly ("if it can't identify the pattern, go random").
    return {
        "business": parsed["business"],
        "strategy": parsed["strategy"],
        "framerId": resolve_framer_id(parsed.get("design_system")),
    }


def strategist_node(state: PipelineState) -> dict:
    plan = run_strategist(state["brief"], state.get("model"), state.get("creds"))
    return {"plan": plan}


# --------------------------------------------------------------------------- #
# Agent 2 — Generator (approved plan -> landing page)                         #
# --------------------------------------------------------------------------- #
def run_generator(plan: dict, images: list, model=None, creds=None) -> str:
    shop = plan["business"]
    strategy = plan["strategy"]
    cta_link = cta_link_for(shop)
    # The framer dictates the look; fall back to a random valid one for older
    # plans that predate framer selection.
    design_system = framer_prompt_block(resolve_framer_id(plan.get("framerId")))
    prompt = f"""You are a senior designer at a boutique branding studio — the
kind hired by independent businesses who want to look like a real brand, not a
template. Build a complete, single-file HTML landing page for this business,
executing the marketing strategy below precisely and in the exact design system
provided.

BUSINESS: {shop['name']} — {shop['businessType']} in {shop['location']}
STRATEGY:
{json.dumps(strategy, indent=2)}

CTA_LINK (use this exact URL, do not invent your own): {cta_link}

{design_system}

{_images_block(images)}

STRUCTURE (in order):
1. Slim sticky nav: business name (or a simple monogram/wordmark) on the left,
   one or two nav links, and a compact CTA button on the right.
2. Hero: headline + subhead executing the positioning, primary CTA button, and
   a real focal point (a real photo per AVAILABLE PHOTOS above, or a large
   gradient/duotone panel if none) — not just centered text on a flat color.
3. A 3-column "why us" grid built from the key messages, each with a small
   abstract icon (inline SVG or a styled CSS shape) + a short headline + one
   line of copy. Avoid walls of text.
4. Atmosphere/about section: a short paragraph paired with a visual block in an
   asymmetric two-column layout.
5. A single-line "social proof" strip (a short italic quote, or 3 stat-style
   callouts) — invented but plausible, never fake review counts or star ratings.
6. Footer: address/neighbourhood, a final CTA button, minimal links.

DESIGN BAR (the part most AI pages get wrong — fix it):
- Execute the DESIGN SYSTEM above faithfully: its exact fonts, hex colors, type
  scale, radius and signature patterns are the brief, not a suggestion. Do not
  invent a different palette or font pairing.
- Use the accent color sparingly, exactly as the framer prescribes.
- Keep a consistent 8px-based spacing scale and generous whitespace.
- Buttons: one consistent style per the framer, with a visible hover state.
- Mobile-friendly: stack columns under ~700px.

RULES:
- ONE self-contained HTML file. All CSS in a <style> tag. No external JS
  frameworks. Load any freely-available framer fonts via a Google Fonts <link>;
  keep the exact font-family names from the DESIGN SYSTEM (proprietary brand
  fonts will fall back to the chain provided — never substitute a different font).
- EVERY CTA button (nav, hero, footer) must be a real anchor pointing at
  {cta_link}, styled as a button. Never use href="#".
- Follow AVAILABLE PHOTOS above for IMAGE_n tokens vs. gradients.
- Copy must execute the positioning, tone, and value proposition — specific to
  this business, never generic stock copy.

Return ONLY the raw HTML, starting with <!DOCTYPE html>. No markdown fences."""

    raw = call_model(prompt, 0.8, model, creds)
    template = raw.strip().replace("```html", "").replace("```", "").strip()
    template = open_links_in_new_tab(template)
    return template, inject_images(template, images)


def generator_node(state: PipelineState) -> dict:
    template, html = run_generator(
        state["plan"],
        state.get("images") or [],
        state.get("model"),
        state.get("creds"),
    )
    return {"html": html, "html_template": template}


# --------------------------------------------------------------------------- #
# Agent 3 — Editor (existing page + free-form instruction -> revised page)    #
# --------------------------------------------------------------------------- #
def run_editor(html_template: str, instruction: str, images: list, model=None, creds=None) -> tuple[str, str]:
    """Revise an already-built page based on a free-form change request.

    Operates on the IMAGE_n-token version of the page, never the version with
    real photos injected — sending megabytes of base64 through the prompt on
    every edit would be slow, costly, and risks the model corrupting the data
    URIs when it echoes the page back.
    """
    prompt = f"""You are a senior front-end designer making a revision to an
existing single-file HTML landing page based on the client's feedback.

CURRENT PAGE (IMAGE_1, IMAGE_2, ... are placeholder tokens for real photos —
keep each token exactly as-is, in place, unless the request says to add,
remove, or move a photo):
\"\"\"
{html_template}
\"\"\"

CLIENT'S CHANGE REQUEST:
\"\"\"
{instruction}
\"\"\"

Apply ONLY what was requested. Preserve everything else exactly: structure,
copy, design system (fonts, colors, spacing, radius), and IMAGE_n tokens,
unless the request explicitly says otherwise. Stay ONE self-contained HTML
file, all CSS in a <style> tag, no external JS frameworks. Every CTA anchor
must keep pointing at its existing href — never replace one with href="#".

Return ONLY the complete, raw, updated HTML, starting with <!DOCTYPE html>.
No markdown fences, no commentary."""

    raw = call_model(prompt, 0.5, model, creds)
    template = raw.strip().replace("```html", "").replace("```", "").strip()
    template = open_links_in_new_tab(template)
    return template, inject_images(template, images)
