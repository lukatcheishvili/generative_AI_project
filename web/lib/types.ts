// Shared types for the brief -> plan -> landing-page flow.

/** Business basics the Strategist extracts from the user's free-form brief. */
export interface Shop {
  name: string;
  businessType: string;
  location: string;
  address?: string;
  goal: string;
}

/** The marketing decisions the Strategist makes. */
export interface Strategy {
  positioning: string;
  target_customer: string;
  value_proposition: string;
  tone: string;
  conversion_goal: string;
  key_messages: string[];
}

/** What Plan Mode shows the user to approve before anything is generated. */
export interface Plan {
  business: Shop;
  strategy: Strategy;
  /** The chosen design system (web/lib/framers.ts). Picked by the Strategist
   *  from the brief, with a random fallback; editable in the Plan card. */
  framerId: string;
}

export const BUSINESS_GOALS = [
  "Get people to visit in person",
  "Drive online orders / bookings",
  "Generate leads / enquiries",
  "Sign up / subscribe",
  "Book a consultation / appointment",
] as const;

export interface ModelOption {
  id: string;
  label: string;
}

/** Google/Vertex models offered in the picker (web/AGENT.md §6). */
export const MODELS: ModelOption[] = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
];

/** Default selected model — the latest Flash. */
export const DEFAULT_MODEL = "gemini-2.5-flash";

export const PLAN_STEP = "Strategist is analysing your business and planning the strategy…";
export const BUILD_STEP = "Generator is building your landing page…";
export const EDIT_STEP = "Applying your change to the page…";
