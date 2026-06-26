"""
BrewPage graph nodes — the two agents in the pipeline.

  1. strategist_node  -> makes the marketing decisions a strategist would:
        positioning, target customer, value proposition, tone, conversion goal.
  2. generator_node   -> turns that strategy (+ any uploaded photos) into a
        real, styled, single-file HTML landing page.
"""

import base64
import json
import re
import urllib.parse
from io import BytesIO

import google.generativeai as genai
from PIL import Image

from src.state import PipelineState

MODEL_NAME = "gemini-2.5-flash"


# ----------------------------------------------------------------------------
# LLM HELPERS
# ----------------------------------------------------------------------------
def call_model(prompt, temperature=0.7):
    model = genai.GenerativeModel(MODEL_NAME)
    resp = model.generate_content(prompt, generation_config={"temperature": temperature})
    return resp.text


def parse_json(raw):
    clean = raw.strip().replace("```json", "").replace("```html", "").replace("```", "").strip()
    return json.loads(clean)


def _open_links_in_new_tab(html):
    """The generated page is shown inside an embedded iframe — without this,
    clicking a CTA navigates the iframe itself instead of opening the
    destination, which looks like the click just bounces back to the app."""
    def add_target(m):
        attrs = m.group(1)
        if "target=" in attrs:
            return m.group(0)
        return f'<a{attrs} target="_blank" rel="noopener noreferrer"{m.group(2)}>'
    return re.sub(r"<a\b([^>]*?)(/?)>", add_target, html, flags=re.IGNORECASE)


def image_to_data_uri(raw_bytes, max_dim=1600, quality=82):
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


def _inject_images(html, images):
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


# ----------------------------------------------------------------------------
# NODE 1 — STRATEGIST  (the marketing brain)
# ----------------------------------------------------------------------------
def strategist_node(state: PipelineState) -> dict:
    shop = state["shop"]
    prompt = f"""You are a senior brand strategist for small hospitality businesses.
A coffee shop owner gives you raw notes. Turn them into a sharp marketing strategy.
Do NOT write website copy yet — make the strategic DECISIONS first.

COFFEE SHOP NOTES:
- Name: {shop['name']}
- Location / setting: {shop['location']}
- What makes it different: {shop['differentiator']}
- Vibe / atmosphere: {shop['vibe']}
- Target customer (owner's guess): {shop['target']}
- Main goal of the page: {shop['goal']}

Return ONLY a JSON object, no markdown:
{{
  "positioning": "one sentence: how this shop is positioned vs. generic cafes",
  "target_customer": "a crisp persona — who exactly we're talking to",
  "value_proposition": "the single most compelling reason to visit",
  "tone": "3-4 adjectives describing the voice",
  "conversion_goal": "the ONE action the page should drive",
  "key_messages": ["3 supporting points the page should make"]
}}"""
    strategy = parse_json(call_model(prompt, temperature=0.6))
    return {"strategy": strategy}


# ----------------------------------------------------------------------------
# NODE 2 — GENERATOR  (strategy -> real landing page)
# ----------------------------------------------------------------------------
def cta_link_for(shop):
    """A CTA needs a real destination or the button is dead. Map each
    conversion goal to something that actually does something on click."""
    address = shop.get("address", "").strip()
    query = address if address else f"{shop['name']} {shop['location']}"
    place = urllib.parse.quote(query)
    return {
        "Get people to visit in person":
            f"https://www.google.com/maps/search/?api=1&query={place}",
        "Drive online orders / pre-orders":
            "mailto:hello@example.com?subject=Order%20Inquiry",
        "Sign up for a loyalty program":
            "mailto:hello@example.com?subject=Loyalty%20Program%20Sign-up",
        "Book the space for events":
            "mailto:hello@example.com?subject=Event%20Booking%20Inquiry",
    }.get(shop["goal"], "mailto:hello@example.com")


def _images_block(images):
    if not images:
        return (
            "AVAILABLE PHOTOS: none were provided. Use placeholder "
            "gradient/duotone panels wherever a photo would go (see DESIGN "
            "BAR and RULES below)."
        )
    n = len(images)
    tokens = ", ".join(f'"IMAGE_{i}"' for i in range(1, n + 1))
    return f"""AVAILABLE PHOTOS: {n} real photo(s) of this shop were provided.
Reference them ONLY as <img src="IMAGE_1">, <img src="IMAGE_2">, ... up to
IMAGE_{n} — these are exact placeholder tokens (one of: {tokens}) that get
swapped for the real photo afterwards. Do not alter them, do not invent
IMAGE_n tokens beyond {n}, and never put the same IMAGE_n token in two
different places on the page.
- Use these REAL photos (not gradients) for every photo-shaped slot the
  structure below calls for, distributing them across different sections
  (hero focal point first, then atmosphere/about sections, then small
  thumbnails in the grid if you still have leftover photos).
- If there are fewer photos than photo-shaped sections, fall back to a
  placeholder gradient panel for the remaining sections — never reuse the
  same photo twice.
- Style every <img> like a real photo: width/height set via CSS,
  object-fit: cover, the same rounded-corner/border treatment as the rest
  of the design — never a tiny inline icon."""


def generator_node(state: PipelineState) -> dict:
    shop = state["shop"]
    strategy = state["strategy"]
    images = state.get("images") or []
    cta_link = cta_link_for(shop)
    prompt = f"""You are a senior designer at a boutique branding studio — the
kind hired by independent cafes who want to look like a real brand, not a
template. Build a complete, single-file HTML landing page for this coffee
shop, executing the marketing strategy below precisely.

SHOP: {shop['name']} — {shop['location']}
STRATEGY:
{json.dumps(strategy, indent=2)}

CTA_LINK (use this exact URL, do not invent your own): {cta_link}

{_images_block(images)}

STRUCTURE (in order):
1. Slim sticky nav: shop name (or a simple monogram/wordmark) on the left,
   one nav link or two, and a compact CTA button on the right.
2. Hero: headline + subhead executing the positioning, primary CTA button.
   Give it a real focal point (a real photo per AVAILABLE PHOTOS above, or
   a large gradient/duotone panel if none were provided) — not just
   centered text on a flat color.
3. A 3-column "why us" grid built from the key messages, each with a small
   abstract icon (inline SVG or a styled CSS shape/emoji-free glyph) + a
   short headline + one line of copy. Avoid walls of text.
4. Atmosphere/about section: pairs a short paragraph with a visual block
   (a real photo per AVAILABLE PHOTOS above, or a placeholder gradient if
   none were provided) in an asymmetric two-column layout — alternate
   image-left/image-right if there's more than one such section.
5. A single-line "social proof" strip (e.g. a short quote in italics, or
   3 stat-style callouts like "Locally roasted" / "Open since ..." /
   neighborhood name) — keep this invented but plausible, never fake review
   counts or star ratings.
6. Footer: address/neighborhood, a final CTA button, minimal links.

DESIGN BAR (this is the part most AI-generated pages get wrong — fix it):
- Pick ONE deliberate color story from the vibe (e.g. a deep warm neutral +
  one accent), not a rainbow gradient. Background should mostly be a single
  calm tone; use the accent sparingly (CTA, small details).
- Pair a distinctive display serif or slab for headlines with a clean
  sans-serif for body text (load via Google Fonts <link>). No default
  system-font look.
- Use a consistent spacing scale (e.g. multiples of 8px) and generous
  whitespace — most amateur pages are too cramped.
- Buttons: one consistent style, rounded, with a visible hover state
  (transform/opacity transition) — not a flat unstyled <a>.
- Subtle details only: soft shadows, thin 1px borders, occasional rounded
  corners. No heavy drop-shadows, no neon, no more than one gradient on the
  whole page.
- Mobile-friendly: stack the grid/columns under ~700px.

RULES:
- ONE self-contained HTML file. All CSS in a <style> tag. No external JS
  frameworks. Google Fonts <link> is allowed.
- EVERY CTA button (nav, hero, footer) must be a real `<a href="{cta_link}">`
  styled as a button. Never use href="#" — it must actually navigate or
  open mail/maps when clicked.
- Follow AVAILABLE PHOTOS above: use the IMAGE_n tokens where photos were
  provided, placeholder gradients/duotone panels otherwise.
- Copy must execute the positioning, tone, and value proposition above —
  specific to this shop, never generic stock-cafe copy.

Return ONLY the raw HTML, starting with <!DOCTYPE html>. No markdown fences."""
    raw = call_model(prompt, temperature=0.8)
    html = raw.strip().replace("```html", "").replace("```", "").strip()
    html = _inject_images(html, images)
    return {"html": _open_links_in_new_tab(html)}
