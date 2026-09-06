import { IKTARA_PROMPT } from "./prompts.js";

/** A page is a small product world: its agent, intent, and context are code. */
export const WORLDS = {
  reflection: {
    id: "reflection",
    agent: "iktara",
    label: "Reflect",
    description:
      "Make room for emotions, relationships, needs, and next steps.",
    prompt: `${IKTARA_PROMPT}\nThis is the reflection space. Start with the person's lived experience. Use chart context only if it helps their question; never force astrology into an ordinary conversation.`,
  },
  chart: {
    id: "chart",
    agent: "iktara-chart",
    label: "Explore my chart",
    description: "Explore a calculated birth chart as a symbolic lens.",
    prompt: `${IKTARA_PROMPT}\nThis is the chart space. Explain only the supplied calculated placements in plain language. Distinguish tropical from sidereal data. If the birth time is unknown, do not assert a rising sign or house placement. If no chart is supplied, invite the person to calculate one first; do not invent placements.`,
  },
} as const;

export type WorldID = keyof typeof WORLDS;
export function isWorld(value: unknown): value is WorldID {
  return typeof value === "string" && Object.hasOwn(WORLDS, value);
}

export function publicWorlds() {
  return Object.values(WORLDS).map(({ id, label, description }) => ({
    id,
    label,
    description,
  }));
}
