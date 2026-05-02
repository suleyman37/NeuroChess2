import type { Meta, StoryObj } from "@storybook/react-vite";
import { Leva, useControls } from "leva";

import {
  NeuroCognitiveMap3D,
  type NeuroCognitiveLink,
  type NeuroCognitiveMap3DProps,
  type NeuroCognitiveNode,
} from "./NeuroCognitiveMap3D";

const calmNodes: NeuroCognitiveNode[] = [
  { id: "calculation", label: "Calcul", value: 0.74, riskLevel: "low" },
  { id: "attention", label: "Attention", value: 0.68, riskLevel: "low" },
  { id: "timing", label: "Tempo", value: 0.48, riskLevel: "medium" },
  { id: "conversion", label: "Conversion", value: 0.58, riskLevel: "medium" },
  { id: "pattern", label: "Patterns", value: 0.81, riskLevel: "low" },
];

const focusedNodes: NeuroCognitiveNode[] = [
  { id: "threats", label: "Menaces", value: 0.79, riskLevel: "low" },
  { id: "candidate", label: "Candidats", value: 0.63, riskLevel: "medium" },
  { id: "tactics", label: "Tactique", value: 0.72, riskLevel: "low" },
  { id: "king", label: "Roi", value: 0.42, riskLevel: "medium" },
  { id: "endgame", label: "Finale", value: 0.51, riskLevel: "medium" },
  { id: "memory", label: "Mémoire", value: 0.67, riskLevel: "low" },
];

const highRiskNodes: NeuroCognitiveNode[] = [
  { id: "blunder", label: "Gaffe", value: 0.32, riskLevel: "high" },
  { id: "tunnel", label: "Tunnel", value: 0.24, riskLevel: "high" },
  { id: "clock", label: "Temps", value: 0.38, riskLevel: "high" },
  { id: "forcing", label: "Forcing", value: 0.55, riskLevel: "medium" },
  { id: "defense", label: "Défense", value: 0.44, riskLevel: "medium" },
];

const standardLinks: NeuroCognitiveLink[] = [
  { source: "calculation", target: "attention", strength: 0.8 },
  { source: "attention", target: "timing", strength: 0.52 },
  { source: "timing", target: "conversion", strength: 0.44 },
  { source: "conversion", target: "pattern", strength: 0.62 },
  { source: "pattern", target: "calculation", strength: 0.72 },
];

const focusedLinks: NeuroCognitiveLink[] = [
  { source: "threats", target: "candidate", strength: 0.78 },
  { source: "candidate", target: "tactics", strength: 0.88 },
  { source: "tactics", target: "king", strength: 0.66 },
  { source: "king", target: "endgame", strength: 0.42 },
  { source: "memory", target: "candidate", strength: 0.7 },
  { source: "memory", target: "threats", strength: 0.5 },
];

const highRiskLinks: NeuroCognitiveLink[] = [
  { source: "blunder", target: "tunnel", strength: 0.9 },
  { source: "tunnel", target: "clock", strength: 0.76 },
  { source: "clock", target: "forcing", strength: 0.54 },
  { source: "forcing", target: "defense", strength: 0.58 },
  { source: "defense", target: "blunder", strength: 0.64 },
];

function VisualLabFrame(props: NeuroCognitiveMap3DProps) {
  const visualControls = useControls("Visual tuning", {
    nodeSize: { value: 0.16, min: 0.08, max: 0.3, step: 0.01 },
    linkOpacity: { value: 0.34, min: 0.08, max: 0.85, step: 0.01 },
    glowIntensity: { value: 1, min: 0.45, max: 1.8, step: 0.05 },
    cameraDistance: { value: 7.2, min: 4.8, max: 10, step: 0.1 },
    rotationSpeed: { value: 0.07, min: 0, max: 0.22, step: 0.01 },
  });

  return (
    <div style={{ minHeight: "100vh", padding: 32, background: "#05070d" }}>
      <NeuroCognitiveMap3D {...props} {...visualControls} />
      <Leva collapsed />
    </div>
  );
}

const meta = {
  title: "Visual/NeuroCognitiveMap3D",
  component: NeuroCognitiveMap3D,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof NeuroCognitiveMap3D>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Calm: Story = {
  render: () => <VisualLabFrame nodes={calmNodes} links={standardLinks} variant="calm" />,
};

export const Focused: Story = {
  render: () => <VisualLabFrame nodes={focusedNodes} links={focusedLinks} variant="focused" />,
};

export const HighRisk: Story = {
  render: () => <VisualLabFrame nodes={highRiskNodes} links={highRiskLinks} variant="high-risk" />,
};

export const Empty: Story = {
  render: () => <VisualLabFrame nodes={[]} links={[]} variant="calm" />,
};
