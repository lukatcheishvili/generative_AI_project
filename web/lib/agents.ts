/**
 * The two agents in the pipeline (web/AGENT.md §1).
 *
 *   1. runStrategist -> reads the user's free-form brief, EXTRACTS the business
 *        basics and MAKES the marketing decisions, returning a Plan to approve.
 *   2. runGenerator  -> turns an APPROVED plan (+ any photos) into a real,
 *        styled, single-file HTML landing page.
 *
 * Both accept an optional per-request model id (the UI's model picker).
 */

import { callModel, type Credentials } from "./llm";
import type { Plan, Shop, Strategy } from "./types";

// --------------------------------------------------------------------------- //
// Helpers                                                                     //
// --------------------------------------------------------------------------- //
export function parseJson(raw: string): unknown {
  const clean = raw
    .trim()
    .replace(/```json/g, "")
    .replace(/```html/g, "")
    .replace(/```/g, "")
    .trim();
  return JSON.parse(clean);
}

/** Generated page is shown in an iframe; make CTAs open in a new tab. */
export function openLinksInNewTab(html: string): string {
  return html.replace(/<a\b([^>]*?)(\/?)>/gi, (match, attrs: string) => {
    if (/target=/i.test(attrs)) return match;
    return `<a${attrs} target="_blank" rel="noopener noreferrer">`;
  });
}

/** Swap IMAGE_1, IMAGE_2, ... tokens for the real base64 data URIs. */
export function injectImages(html: string, images: string[]): string {
  if (!images || images.length === 0) return html;
  return html.replace(/IMAGE_(\d+)/g, (full, digits: string) => {
    const idx = parseInt(digits, 10);
    if (idx >= 1 && idx <= images.length) return images[idx - 1];
    return full;
  });
}

/** Map the conversion goal to a real CTA destination. */
export function ctaLinkFor(shop: Shop): string {
  const address = (shop.address || "").trim();
  const query = address || `${shop.name} ${shop.location}`;
  const place = encodeURIComponent(query);
  const map: Record<string, string> = {
    "Get people to visit in person": `https://www.google.com/maps/search/?api=1&query=${place}`,
    "Drive online orders / bookings": "mailto:hello@example.com?subject=Order%20or%20Booking%20Inquiry",
    "Generate leads / enquiries": "mailto:hello@example.com?subject=Enquiry",
    "Sign up / subscribe": "mailto:hello@example.com?subject=Sign-up",
    "Book a consultation / appointment": "mailto:hello@example.com?subject=Appointment%20Booking",
  };
  return map[shop.goal] || "mailto:hello@example.com";
}

function imagesBlock(images: string[]): string {
  if (!images || images.length === 0) {
    return (
      "AVAILABLE PHOTOS: none were provided. Use placeholder gradient/duotone " +
      "panels wherever a photo would go (see DESIGN BAR and RULES below)."
    );
  }
  const n = images.length;
  const tokens = Array.from({ length: n }, (_, i) => `"IMAGE_${i + 1}"`).join(", ");
  return `AVAILABLE PHOTOS: ${n} real photo(s) of this business were provided.
Reference them ONLY as <img src="IMAGE_1">, <img src="IMAGE_2">, ... up to
IMAGE_${n} — these are exact placeholder tokens (one of: ${tokens}) that get
swapped for the real photo afterwards. Do not alter them, do not invent
IMAGE_n tokens beyond ${n}, and never put the same IMAGE_n token in two
different places on the page.
- Use these REAL photos (not gradients) for every photo-shaped slot the
  structure below calls for, distributing them across different sections.
- If there are fewer photos than photo-shaped sections, fall back to a
  placeholder gradient panel for the remaining sections — never reuse the
  same photo twice.
- Style every <img> like a real photo: width/height via CSS, object-fit:
  cover, consistent rounded corners — never a tiny inline icon.`;
}

// --------------------------------------------------------------------------- //
// Agent 1 — Strategist (brief -> editable plan)                               //
// --------------------------------------------------------------------------- //
export async function runStrategist(
  brief: string,
  model?: string,
  creds?: Credentials,
): Promise<Plan> {
  const prompt = `You are a senior brand strategist for small and medium businesses.
A business owner describes their business and what they want, in their own words.
First EXTRACT the business basics, then MAKE the marketing decisions.
Do NOT write any website copy yet.

OWNER'S BRIEF:
"""
${brief}
"""

For "goal", choose the single closest option from this list:
- "Get people to visit in person"
- "Drive online orders / bookings"
- "Generate leads / enquiries"
- "Sign up / subscribe"
- "Book a consultation / appointment"

Return ONLY a JSON object, no markdown:
{
  "business": {
    "name": "the business name (invent a tasteful one ONLY if none is given)",
    "businessType": "e.g. coffee shop, gym, law firm, bakery",
    "location": "city / neighbourhood / setting if mentioned, else a sensible placeholder",
    "address": "street address if explicitly given, else empty string",
    "goal": "one of the exact options above"
  },
  "strategy": {
    "positioning": "one sentence: how this business is positioned vs. generic competitors",
    "target_customer": "a crisp persona — who exactly we're talking to",
    "value_proposition": "the single most compelling reason to choose this business",
    "tone": "3-4 adjectives describing the voice",
    "conversion_goal": "the ONE action the page should drive",
    "key_messages": ["3 supporting points the page should make"]
  }
}`;
  return parseJson(await callModel(prompt, 0.6, model, creds)) as Plan;
}

// --------------------------------------------------------------------------- //
// Agent 2 — Generator (approved plan -> landing page)                         //
// --------------------------------------------------------------------------- //
export async function runGenerator(
  plan: Plan,
  images: string[],
  model?: string,
  creds?: Credentials,
): Promise<string> {
  const shop = plan.business;
  const strategy: Strategy = plan.strategy;
  const ctaLink = ctaLinkFor(shop);
  const prompt = `You are a senior designer at a boutique branding studio — the
kind hired by independent businesses who want to look like a real brand, not a
template. Build a complete, single-file HTML landing page for this business,
executing the marketing strategy below precisely.

BUSINESS: ${shop.name} — ${shop.businessType} in ${shop.location}
STRATEGY:
${JSON.stringify(strategy, null, 2)}

CTA_LINK (use this exact URL, do not invent your own): ${ctaLink}

${imagesBlock(images)}

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
- Pick ONE deliberate color story from the brand's tone (a calm dominant tone +
  one accent), not a rainbow gradient. Use the accent sparingly.
- Pair a distinctive display serif or slab for headlines with a clean sans for
  body (load via Google Fonts <link>). No default system-font look.
- Consistent 8px-based spacing scale and generous whitespace.
- Buttons: one consistent style, rounded, with a visible hover state.
- Subtle details only: soft shadows, thin borders, rounded corners. No neon, no
  more than one gradient on the whole page.
- Mobile-friendly: stack columns under ~700px.

RULES:
- ONE self-contained HTML file. All CSS in a <style> tag. No external JS
  frameworks. Google Fonts <link> is allowed.
- EVERY CTA button (nav, hero, footer) must be a real anchor pointing at
  ${ctaLink}, styled as a button. Never use href="#".
- Follow AVAILABLE PHOTOS above for IMAGE_n tokens vs. gradients.
- Copy must execute the positioning, tone, and value proposition — specific to
  this business, never generic stock copy.

Return ONLY the raw HTML, starting with <!DOCTYPE html>. No markdown fences.`;

  const raw = await callModel(prompt, 0.8, model, creds);
  let html = raw.trim().replace(/```html/g, "").replace(/```/g, "").trim();
  html = injectImages(html, images);
  return openLinksInNewTab(html);
}
