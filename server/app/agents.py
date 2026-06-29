"""The two agents in the pipeline (a 1:1 port of web/lib/agents.ts).

  1. run_strategist -> reads the user's free-form brief, EXTRACTS the business
       basics and MAKES the marketing decisions, returning a Plan to approve.
  2. run_generator  -> turns an APPROVED plan (+ any photos) into a real,
       styled, single-file HTML landing page.

Both accept an optional per-request model id (the UI's model picker) and optional
per-request credentials (the Settings panel).
"""

from __future__ import annotations

import json
import re
from typing import List, Optional
from urllib.parse import quote

from .framers import (
    framer_catalog_for_prompt,
    framer_prompt_block,
    resolve_framer_id,
)
from .llm import call_model
from .types import Credentials, Plan, Shop, Strategy


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
    """Generated page is shown in an iframe; make CTAs open in a new tab."""

    def repl(match: re.Match) -> str:
        attrs = match.group(1)
        if re.search(r"target=", attrs, re.IGNORECASE):
            return match.group(0)
        return f'<a{attrs} target="_blank" rel="noopener noreferrer">'

    return re.sub(r"<a\b([^>]*?)(/?)>", repl, html, flags=re.IGNORECASE)


def inject_images(html: str, images: List[str]) -> str:
    """Swap IMAGE_1, IMAGE_2, ... tokens for the real base64 data URIs."""
    if not images:
        return html

    def repl(match: re.Match) -> str:
        idx = int(match.group(1))
        if 1 <= idx <= len(images):
            return images[idx - 1]
        return match.group(0)

    return re.sub(r"IMAGE_(\d+)", repl, html)


def cta_link_for(shop: Shop) -> str:
    """Map the conversion goal to a real CTA destination."""
    address = (shop.address or "").strip()
    query = address or f"{shop.name} {shop.location}"
    place = quote(query, safe="")
    mapping = {
        "Get people to visit in person": f"https://www.google.com/maps/search/?api=1&query={place}",
        "Drive online orders / bookings": "mailto:hello@example.com?subject=Order%20or%20Booking%20Inquiry",
        "Generate leads / enquiries": "mailto:hello@example.com?subject=Enquiry",
        "Sign up / subscribe": "mailto:hello@example.com?subject=Sign-up",
        "Book a consultation / appointment": "mailto:hello@example.com?subject=Appointment%20Booking",
    }
    return mapping.get(shop.goal, "mailto:hello@example.com")


def _images_block(images: List[str]) -> str:
    if not images:
        return (
            "AVAILABLE PHOTOS: none were provided. Use placeholder gradient/duotone "
            "panels wherever a photo would go (see DESIGN BAR and RULES below)."
        )
    n = len(images)
    tokens = ", ".join(f'"IMAGE_{i + 1}"' for i in range(n))
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
def run_strategist(
    brief: str,
    model: Optional[str] = None,
    creds: Optional[Credentials] = None,
) -> Plan:
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
    # randomly (if it can't identify the pattern, go random).
    return Plan(
        business=Shop(**parsed["business"]),
        strategy=Strategy(**parsed["strategy"]),
        framerId=resolve_framer_id(parsed.get("design_system")),
    )


# --------------------------------------------------------------------------- #
# Agent 2 — Generator (approved plan -> landing page)                         #
# --------------------------------------------------------------------------- #
def run_generator(
    plan: Plan,
    images: List[str],
    model: Optional[str] = None,
    creds: Optional[Credentials] = None,
) -> str:
    shop = plan.business
    strategy = plan.strategy
    cta_link = cta_link_for(shop)
    # The framer dictates the look; fall back to a random valid one for older
    # plans that predate framer selection.
    design_system = framer_prompt_block(resolve_framer_id(plan.framerId))
    strategy_json = json.dumps(strategy.model_dump(), indent=2)
    prompt = f"""You are a senior designer at a boutique branding studio — the
kind hired by independent businesses who want to look like a real brand, not a
template. Build a complete, single-file HTML landing page for this business,
executing the marketing strategy below precisely and in the exact design system
provided.

BUSINESS: {shop.name} — {shop.businessType} in {shop.location}
STRATEGY:
{strategy_json}

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
    html = raw.strip().replace("```html", "").replace("```", "").strip()
    html = inject_images(html, images)
    return open_links_in_new_tab(html)
