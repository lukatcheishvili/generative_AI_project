/**
 * Framers — the design-system catalog the Generator builds pages in.
 *
 * A "framer" is one self-contained look (colors, fonts, sizes, radius, signature
 * patterns). The Strategist picks the closest framer for the business during the
 * plan step; if it can't decide, we fall back to a RANDOM one (see
 * `resolveFramerId`). The user can override the choice in the Plan card.
 *
 * Specs are distilled from VoltAgent's awesome-design-md collection
 * (github.com/VoltAgent/awesome-design-md, `design-md/<brand>/DESIGN.md`).
 * Brand fonts are kept VERBATIM as the primary family with a graceful generic
 * fallback — proprietary faces (FerrariSans, MarkForMC, Kraken-Brand, Vodafone,
 * SpotifyMixUI, …) simply degrade to the fallback rather than being swapped for a
 * different font.
 *
 * This catalog + its selection logic is documented in web/AGENT.md §8.
 */

export interface FramerColor {
  token: string;
  hex: string;
  usage: string;
}

export interface FramerType {
  role: string;
  size: string;
  weight: number;
  tracking: string;
}

export interface Framer {
  /** Stable id used in the Plan and the picker. */
  id: string;
  /** Display name shown in the Plan card. */
  name: string;
  /** One-line feel, shown next to the name and fed to the Strategist. */
  tagline: string;
  /** Light / dark / etc — the canvas mood in a few words. */
  mood: string;
  /** Keywords the Strategist matches the brief against. */
  bestFor: string;
  fonts: {
    /** Exact brand display family + fallback chain (kept verbatim). */
    display: string;
    /** Exact brand body family + fallback chain. */
    body: string;
    /** How to load: which faces are free on Google Fonts vs. proprietary. */
    loadNote: string;
  };
  palette: FramerColor[];
  type: FramerType[];
  radius: string;
  spacing: string;
  /** The handful of patterns that make a page unmistakably this look. */
  signatures: string[];
}

// --------------------------------------------------------------------------- //
// The catalog — five distinct looks                                           //
// --------------------------------------------------------------------------- //
export const FRAMERS: Framer[] = [
  {
    id: "ferrari",
    name: "Ferrari",
    tagline: "Cinematic luxury, near-black with one racing red",
    mood: "Dark, editorial, refined",
    bestFor:
      "luxury & automotive, fine dining, jewelry/watches, premium real estate, " +
      "high-end fashion, motorsport — anything luxury, premium, exclusive, cinematic or refined",
    fonts: {
      display: '"FerrariSans", -apple-system, system-ui, sans-serif',
      body: '"FerrariSans", -apple-system, system-ui, sans-serif',
      loadNote: "FerrariSans is proprietary — the system fallback applies.",
    },
    palette: [
      { token: "primary", hex: "#da291c", usage: "Rosso Corsa — primary CTA & mark only" },
      { token: "primary-active", hex: "#b01e0a", usage: "hover / press" },
      { token: "ink", hex: "#ffffff", usage: "display & strong text" },
      { token: "body", hex: "#969696", usage: "body text on dark" },
      { token: "canvas", hex: "#181818", usage: "near-black background" },
      { token: "canvas-elevated", hex: "#303030", usage: "cards / raised" },
      { token: "hairline", hex: "#303030", usage: "borders" },
      { token: "canvas-light", hex: "#ffffff", usage: "editorial white band" },
    ],
    type: [
      { role: "display", size: "56–80px", weight: 500, tracking: "-1.6px, line-height 1.05" },
      { role: "title", size: "18px", weight: 700, tracking: "0" },
      { role: "body", size: "14px", weight: 400, tracking: "0, line-height 1.5" },
      { role: "button", size: "14px", weight: 700, tracking: "+1.4px, UPPERCASE" },
    ],
    radius: "very tight & sharp: none / 2px / 4px",
    spacing: "8px ladder (4px → 128px); generous, cinematic editorial pacing",
    signatures: [
      "Open with a full-bleed cinematic hero photograph filling the viewport top.",
      "Hold a near-black canvas (#181818) with pure white display type — modest weights, never bombastic.",
      "Use Rosso Corsa (#da291c) scarcely: the primary CTA and the brand mark, nothing more.",
      "Set buttons and nav in UPPERCASE with wide letter-spacing; keep corners tight and sharp.",
      "Drop into a white editorial band only for detail/pricing content below the hero.",
    ],
  },
  {
    id: "mastercard",
    name: "Mastercard",
    tagline: "Warm cream editorial with pill shapes and orbital circles",
    mood: "Light, warm, institutional-editorial",
    bestFor:
      "payments & finance, corporate & B2B, professional services, consultancies, " +
      "established institutions — anything warm-corporate, editorial, trustworthy or premium-institutional",
    fonts: {
      display: '"MarkForMC", "Sofia Sans", Arial, sans-serif',
      body: '"MarkForMC", "Sofia Sans", Arial, sans-serif',
      loadNote:
        "MarkForMC is proprietary — Sofia Sans (its declared fallback) is on Google Fonts; load it. Keep body weight 450 and -2% heading tracking.",
    },
    palette: [
      { token: "canvas", hex: "#f3f0ee", usage: "warm putty-cream page background (never white)" },
      { token: "lifted-cream", hex: "#fcfbfa", usage: "raised 'paper on paper' sections" },
      { token: "white", hex: "#ffffff", usage: "floating nav pill, cards, satellite CTAs" },
      { token: "ink", hex: "#141413", usage: "headlines, black pill CTAs, footer" },
      { token: "slate-gray", hex: "#696969", usage: "muted secondary text" },
      { token: "signal-orange", hex: "#cf4500", usage: "consent CTAs & eyebrow dots ONLY (sparingly)" },
      { token: "light-orange", hex: "#f37338", usage: "decorative orbital arcs / active indicators" },
      { token: "link-blue", hex: "#3860be", usage: "inline links" },
    ],
    type: [
      { role: "hero", size: "64px", weight: 500, tracking: "-1.28px (-2%), line-height 1:1" },
      { role: "section", size: "36px", weight: 500, tracking: "-0.72px" },
      { role: "card-title", size: "24px", weight: 500, tracking: "-0.48px" },
      { role: "eyebrow", size: "14px", weight: 700, tracking: "+0.56px, UPPERCASE with a dot" },
      { role: "body", size: "16px", weight: 450, tracking: "0 (the signature 450 weight)" },
    ],
    radius: "oversized: heroes ~40px, cards/nav fully pill (99–1000px), body buttons 20px, portraits 50%",
    spacing: "8px base, generous editorial; every surface tinted, almost no sharp corners",
    signatures: [
      "Use a warm putty-cream canvas (#f3f0ee) everywhere — never plain white; surfaces are tinted paper.",
      "Make everything rounded: stadium/pill cards, circular photo portraits, 40px hero corners, 20px black pill buttons.",
      "Connect circular portraits with thin traced orange orbital arcs, each carrying a small white 'satellite' arrow micro-CTA on its edge.",
      "Primary CTAs are black (#141413) pills with cream text; reserve signal orange strictly for consent/eyebrow dots — never marketing CTAs.",
      "Eyebrow labels are UPPERCASE with a tiny accent dot ('• SERVICES'); it's a one-font system — contrast from weight/scale, not a second typeface.",
      "Close with a dark warm-black footer (#141413), four link columns and a large conversational headline.",
    ],
  },
  {
    id: "kraken",
    name: "Kraken",
    tagline: "Clean white crypto exchange commanded by purple",
    mood: "Light, professional, trustworthy",
    bestFor:
      "crypto & fintech, exchanges/trading, B2B SaaS, tech products, financial " +
      "tools — anything trustworthy, professional, modern-tech or data-driven",
    fonts: {
      display: '"Kraken-Brand", "IBM Plex Sans", Helvetica, Arial, sans-serif',
      body: '"Kraken-Product", "Helvetica Neue", Helvetica, Arial, sans-serif',
      loadNote:
        "Kraken's faces are proprietary — IBM Plex Sans (the declared display fallback) is on Google Fonts; load it. Body falls back to Helvetica.",
    },
    palette: [
      { token: "primary", hex: "#7132f5", usage: "Kraken Purple — primary CTA, brand, links" },
      { token: "primary-dark", hex: "#5741d8", usage: "outlined-button borders / hover" },
      { token: "primary-subtle", hex: "rgba(133,91,251,0.16)", usage: "subtle purple button bg" },
      { token: "ink", hex: "#101114", usage: "primary near-black text" },
      { token: "cool-gray", hex: "#686b82", usage: "neutral, borders at low opacity" },
      { token: "silver-blue", hex: "#9497a9", usage: "secondary / muted text" },
      { token: "canvas", hex: "#ffffff", usage: "page background / surfaces" },
      { token: "border-gray", hex: "#dedee5", usage: "divider borders" },
      { token: "green", hex: "#149e61", usage: "success / positive states only" },
    ],
    type: [
      { role: "display", size: "48px", weight: 700, tracking: "-1px, line-height 1.17" },
      { role: "section", size: "36px", weight: 700, tracking: "-0.5px" },
      { role: "feature-title", size: "22px", weight: 600, tracking: "0" },
      { role: "body", size: "16px", weight: 400, tracking: "0, line-height 1.38" },
      { role: "button", size: "16px", weight: 500, tracking: "0" },
    ],
    radius: "12px on all buttons (rounded, NOT pill — 12px is the max); cards 8–16px; badges 6–8px",
    spacing: "compact ladder (4/8/12/16/24); whisper-level shadows only",
    signatures: [
      "Build on clean white backgrounds; Kraken Purple (#7132f5) commands every CTA, link and brand accent.",
      "Buttons use a 12px radius — rounded but NEVER pill (12px is the hard cap).",
      "Dual font: Kraken-Brand bold (700) with negative tracking for display, Kraken-Product for UI/body.",
      "Near-black (#101114) text on a cool blue-gray neutral scale; stay strictly within the defined purple scale.",
      "Keep shadows whisper-level (rgba(0,0,0,0.03) 0 4px 24px); use green (#149e61) only for positive/success badges.",
    ],
  },
  {
    id: "vodafone",
    name: "Vodafone",
    tagline: "Telecom super-brand: huge uppercase display, scarlet CTA",
    mood: "Light, bold, photographic",
    bestFor:
      "telecom, big consumer & retail brands, services, events, mass-market " +
      "campaigns — anything bold, confident, energetic or large-scale",
    fonts: {
      display: 'Vodafone, "Vodafone Rg", "Helvetica Neue", Arial, sans-serif',
      body: 'Vodafone, "Vodafone Rg", "Helvetica Neue", Arial, sans-serif',
      loadNote: "Vodafone's display sans is proprietary — the Helvetica Neue / Arial fallback applies.",
    },
    palette: [
      { token: "primary", hex: "#e60000", usage: "scarlet red — every primary CTA & brand" },
      { token: "on-primary", hex: "#ffffff", usage: "text on red / on dark" },
      { token: "ink", hex: "#25282b", usage: "headlines, dark nav bar" },
      { token: "body", hex: "#7e7e7e", usage: "body / secondary text" },
      { token: "mute", hex: "#bebebe", usage: "muted text / disabled" },
      { token: "canvas", hex: "#ffffff", usage: "content-band background" },
      { token: "canvas-soft", hex: "#f2f2f2", usage: "alternating soft band" },
    ],
    type: [
      { role: "display-hero", size: "90–144px", weight: 800, tracking: "-1px, very tight line-height (UPPERCASE)" },
      { role: "display-light", size: "40–48px", weight: 300, tracking: "0 (light contrast heading)" },
      { role: "eyebrow", size: "16px", weight: 800, tracking: "0, UPPERCASE" },
      { role: "body", size: "18px", weight: 400, tracking: "0, line-height 1.55" },
      { role: "button", size: "18px", weight: 400, tracking: "0" },
    ],
    radius: "scarlet pill buttons (pill-md 32px · pill-lg 60px); cards small (6px); full 9999px",
    spacing: "8px ladder (2/4/8/12/16/20/24/32)",
    signatures: [
      "Alternate full-bleed editorial photography hero bands (with massive UPPERCASE display headlines) and clean white content bands.",
      "Set the hero display impossibly heavy — weight 800 at huge sizes (up to ~144px) with tight line-height.",
      "Use the signature scarlet red (#e60000) for every primary CTA, as a rounded pill (radius ~60px).",
      "Dark ink (#25282b) nav bar; body text muted gray (#7e7e7e) on white.",
      "Play heavy 800 display against the occasional light 300 large heading for contrast; eyebrows are UPPERCASE 800.",
    ],
  },
  {
    id: "spotify",
    name: "Spotify",
    tagline: "Immersive near-black, content-first, one green accent",
    mood: "Dark, immersive, theater-like",
    bestFor:
      "music & audio, entertainment, media & streaming, creative, events, " +
      "nightlife, apps and youth brands — anything immersive, modern, energetic or content-forward",
    fonts: {
      display: '"SpotifyMixUITitle", "Helvetica Neue", Helvetica, Arial, sans-serif',
      body: '"SpotifyMixUI", "Helvetica Neue", Helvetica, Arial, sans-serif',
      loadNote:
        "Spotify's CircularSp / SpotifyMixUI faces are proprietary — the Helvetica / Arial fallback applies.",
    },
    palette: [
      { token: "canvas", hex: "#121212", usage: "deepest near-black background" },
      { token: "surface-1", hex: "#181818", usage: "cards / containers" },
      { token: "surface-2", hex: "#1f1f1f", usage: "buttons / interactive surfaces" },
      { token: "green", hex: "#1ed760", usage: "the single brand accent — play, active, CTA" },
      { token: "ink", hex: "#ffffff", usage: "primary text" },
      { token: "silver", hex: "#b3b3b3", usage: "secondary / muted text, inactive nav" },
      { token: "border", hex: "#7c7c7c", usage: "outlined-button borders, muted links" },
      { token: "negative", hex: "#f3727f", usage: "error states" },
    ],
    type: [
      { role: "section-title", size: "24px", weight: 700, tracking: "0" },
      { role: "feature-heading", size: "18px", weight: 600, tracking: "0, line-height 1.3" },
      { role: "body", size: "16px", weight: 400, tracking: "0" },
      { role: "button", size: "14px", weight: 700, tracking: "+1.4–2px, UPPERCASE" },
    ],
    radius: "pill-and-circle: full-pill buttons (9999px), circular controls (50%), pill search inputs; cards 6–8px",
    spacing: "compact; heavy shadows (rgba(0,0,0,0.5) 0 8px 24px) on elevated elements",
    signatures: [
      "Wrap the page in a near-black cocoon (#121212 / #181818 / #1f1f1f); let the UI recede so imagery/content provides the color.",
      "Spotify Green (#1ed760) is the single accent — always functional (play, active, CTA), never decorative.",
      "Use pill-and-circle geometry: full-pill buttons (radius 9999px), circular play controls (50%), pill search inputs.",
      "Button labels are UPPERCASE with wide letter-spacing (1.4–2px) — a systematic 'label' voice.",
      "Drive hierarchy with a bold/regular weight binary (700 vs 400); keep type compact and functional.",
      "Add heavy shadows on elevated cards/menus (rgba(0,0,0,0.5) 0 8px 24px); surfaces stay achromatic by design.",
    ],
  },
];

// --------------------------------------------------------------------------- //
// Lookup + selection helpers                                                  //
// --------------------------------------------------------------------------- //
export const FRAMER_IDS = FRAMERS.map((f) => f.id);

export function getFramer(id: string | undefined | null): Framer | undefined {
  if (!id) return undefined;
  return FRAMERS.find((f) => f.id === id);
}

/** A random valid framer id — the fallback when the model can't decide. */
export function randomFramerId(): string {
  return FRAMER_IDS[Math.floor(Math.random() * FRAMER_IDS.length)];
}

/** Return `id` if it names a real framer, otherwise pick one at random. */
export function resolveFramerId(id: string | undefined | null): string {
  return getFramer(id) ? (id as string) : randomFramerId();
}

/** Compact menu fed to the Strategist so it can choose a framer from the brief. */
export function framerCatalogForPrompt(): string {
  return FRAMERS.map(
    (f) => `- ${f.id}: ${f.name} — ${f.tagline}. Best for: ${f.bestFor}.`,
  ).join("\n");
}

/** Full design spec for one framer, rendered into the Generator prompt. */
export function framerPromptBlock(id: string): string {
  const f = getFramer(id) ?? FRAMERS[0];
  const palette = f.palette
    .map((c) => `  - ${c.token} ${c.hex} — ${c.usage}`)
    .join("\n");
  const type = f.type
    .map((t) => `  - ${t.role}: ${t.size}, weight ${t.weight}, ${t.tracking}`)
    .join("\n");
  const signatures = f.signatures.map((s) => `  - ${s}`).join("\n");

  return `DESIGN SYSTEM — build this page in the "${f.name}" framer (${f.mood}).
Feel: ${f.tagline}.

FONTS (use these EXACT font-family declarations — do not swap in a different font):
  - Display / headings: ${f.fonts.display}
  - Body / UI: ${f.fonts.body}
  - Loading: ${f.fonts.loadNote}

COLOR PALETTE (use these exact hex values; do not introduce colors outside this set):
${palette}

TYPE SCALE (match these sizes / weights / letter-spacing as closely as the content allows):
${type}

RADIUS: ${f.radius}
SPACING: ${f.spacing}

SIGNATURE PATTERNS (this is what makes the page read as ${f.name} — follow them):
${signatures}`;
}
