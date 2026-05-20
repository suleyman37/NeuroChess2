import type { AntigravitySpikeDefinition } from "./antigravitySpikeTypes";

export const antigravitySpikeRegistry = {
  critical_moment_sigil: {
    id: "critical_moment_sigil",
    routeParam: "critical_moment_sigil",
    title: "Critical Moment Sigil",
    description:
      "Reserved DEV-only mount for Antigravity visual variants around the moment when a chess decision becomes teachable.",
    status: "accepted_dev_only",
    objective: "critical_moment_sigil visual variant spike",
    allowedPaths: [
      "frontend/src/dev/antigravity-spikes/**",
      "scripts/browser_antigravity_*_smoke.mjs",
      "docs/autopilot/A20ANTIGRAVITY*_REPORT.md",
    ],
    expectedOutputs: [
      "Premium Clarity variant",
      "Signature Identity variant",
      "Radical but Board-Safe variant",
    ],
    componentLoader: () => import("./CriticalMomentSigilSpike"),
  },
} satisfies Record<string, AntigravitySpikeDefinition>;

export type AntigravitySpikeId = keyof typeof antigravitySpikeRegistry;

export function getAntigravitySpikeDefinition(
  spikeId: string | null | undefined,
): AntigravitySpikeDefinition | null {
  if (!spikeId) {
    return null;
  }
  return antigravitySpikeRegistry[spikeId as AntigravitySpikeId] ?? null;
}

export const antigravitySpikeIds = Object.keys(antigravitySpikeRegistry) as AntigravitySpikeId[];
