/**
 * The two agents in the pipeline.
 *
 *   1. runStrategist -> makes the marketing decisions a strategist would:
 *        positioning, target customer, value proposition, tone, conversion goal.
 *   2. runGenerator  -> turns that strategy (+ any uploaded photos) into a
 *        real, styled, single-file HTML landing page.
 *
 * Ported from the original Python BrewPage, generalized from "coffee shop" to
 * any small / medium business via the `businessType` field.
 */

import { callModel } from "./llm";
import type { Shop, Strategy } from "./types";

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

/**
 * The generated page is shown inside an iframe — without this, clicking a CTA
 * navigates the iframe itself instead of opening the destination.
 */
export function openLinksInNewTab(html: string): string {
  return html.replace(/<a\b([^>]*?)(\/?)>/gi, (match, attrs: string) => {
    if (/target=/i.test(attrs)) return match;
    return `<a${attrs} target="_blank" rel="noopener noreferrer">`;
  });
}

/**
 * The generator references photos as the placeholder tokens IMAGE_1, IMAGE_2,
 * ... so the model never has to see/repeat base64. Swap them for real data URIs.
 */
export function injectImages(html: string, images: string[]): string {
  if (!images || images.length === 0) return html;
  return html.replace(/IMAGE_(\d+)/g, (full, digits: string) => {
    const idx = parseInt(digits, 10);
    if (idx >= 1 && idx <= images.length) return images[idx - 1];
    return full;
  });
}

/**
 * A CTA needs a real destination or the button is dead. Map each conversion
 * goal to something that actually does something on click.
 */
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
  structure below calls for, distributing them across different sections
  (hero focal point first, then atmosphere/about sections, then small
  thumbnails in the grid if you still have leftover photos).
- If there are fewer photos than photo-shaped sections, fall back to a
  placeholder gradient panel for the remaining sections — never reuse the
  same photo twice.
- Style every <img> like a real photo: width/height set via CSS,
  object-fit: cover, the same rounded-corner/border treatment as the rest
  of the design — never a tiny inline icon.`;
}

// --------------------------------------------------------------------------- //
// Node 1 — Strategist (the marketing brain)                                   //
// --------------------------------------------------------------------------- //
export async function runStrategist(shop: Shop): Promise<Strategy> {
  const prompt = `You are a senior brand strategist for small and medium businesses.
A business owner gives you raw notes. Turn them into a sharp marketing strategy.
Do NOT write website copy yet — make the strategic DECISIONS first.

BUSINESS NOTES:
- Type of business: ${shop.businessType}
- Name: ${shop.name}
- Location / setting: ${shop.location}
- What makes it different: ${shop.differentiator}
- Vibe / atmosphere / brand feel: ${shop.vibe}
- Target customer (owner's guess): ${shop.target}
- Main goal of the page: ${shop.goal}

Return ONLY a JSON object, no markdown:
{
  "positioning": "one sentence: how this business is positioned vs. generic competitors",
  "target_customer": "a crisp persona — who exactly we're talking to",
  "value_proposition": "the single most compelling reason to choose this business",
  "tone": "3-4 adjectives describing the voice",
  "conversion_goal": "the ONE action the page should drive",
  "key_messages": ["3 supporting points the page should make"]
}`;
  return parseJson(await callModel(prompt, 0.6)) as Strategy;
}

// --------------------------------------------------------------------------- //
// Node 2 — Generator (strategy -> real landing page)                          //
// --------------------------------------------------------------------------- //
export async function runGenerator(
  shop: Shop,
  strategy: Strategy,
  images: string[],
): Promise<string> {
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
   3 stat-style callouts) — keep this invented but plausible, never fake
   review counts or star ratings.
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
  (transform/opacity transition) — not a flat unstyled link.
- Subtle details only: soft shadows, thin 1px borders, occasional rounded
  corners. No heavy drop-shadows, no neon, no more than one gradient on the
  whole page.
- Mobile-friendly: stack the grid/columns under ~700px.

RULES:
- ONE self-contained HTML file. All CSS in a <style> tag. No external JS
  frameworks. Google Fonts <link> is allowed.
- EVERY CTA button (nav, hero, footer) must be a real anchor pointing at
  ${ctaLink}, styled as a button. Never use href="#" — it must actually
  navigate or open mail/maps when clicked.
- Follow AVAILABLE PHOTOS above: use the IMAGE_n tokens where photos were
  provided, placeholder gradients/duotone panels otherwise.
- Copy must execute the positioning, tone, and value proposition above —
  specific to this business, never generic stock copy.

Return ONLY the raw HTML, starting with <!DOCTYPE html>. No markdown fences.`;

  const raw = await callModel(prompt, 0.8);
  let html = raw.trim().replace(/```html/g, "").replace(/```/g, "").trim();
  html = injectImages(html, images);
  return openLinksInNewTab(html);
}
