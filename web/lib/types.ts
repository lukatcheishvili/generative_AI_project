// Shared types for the strategy -> landing-page pipeline.

export const BUSINESS_TYPES = [
  "Café / Coffee shop",
  "Restaurant / Bar",
  "Gym / Fitness studio",
  "Salon / Spa / Barber",
  "Retail / Boutique",
  "Professional services / Agency",
  "Clinic / Health practice",
  "Hotel / B&B",
  "Other / Custom",
] as const;

export const BUSINESS_GOALS = [
  "Get people to visit in person",
  "Drive online orders / bookings",
  "Generate leads / enquiries",
  "Sign up / subscribe",
  "Book a consultation / appointment",
] as const;

export type BusinessGoal = (typeof BUSINESS_GOALS)[number];

export interface Shop {
  businessType: string;
  name: string;
  location: string;
  address?: string;
  differentiator: string;
  vibe: string;
  target: string;
  goal: string;
}

export interface Strategy {
  positioning: string;
  target_customer: string;
  value_proposition: string;
  tone: string;
  conversion_goal: string;
  key_messages: string[];
}

export interface PipelineResult {
  strategy: Strategy;
  html: string;
}

// Human-readable progress labels, streamed to the UI as each node finishes.
export const STEP_LABELS: Record<string, string> = {
  strategist: "1/2 — Strategist is making the marketing decisions",
  generator: "2/2 — Generator is building the landing page",
};
