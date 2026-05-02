import type { Meta, StoryObj } from "@storybook/react-vite";
import { Leva, useControls } from "leva";

import {
  NeuroCognitiveMap3D,
  type NeuroCognitiveLink,
  type NeuroCognitiveMap3DProps,
  type NeuroCognitiveNode,
} from "./NeuroCognitiveMap3D";

const calmNodes: NeuroCognitiveNode[] = [
  { id: "opening", label: "Ouverture", value: 0.62, riskLevel: "low" },
  { id: "tactical", label: "Tactique", value: 0.58, riskLevel: "medium" },
  { id: "calculation", label: "Calcul", value: 0.64, riskLevel: "low" },
  { id: "conversion", label: "Conversion", value: 0.54, riskLevel: "medium" },
  { id: "defense", label: "Défense", value: 0.6, riskLevel: "low" },
  { id: "plan", label: "Plan", value: 0.56, riskLevel: "medium" },
];

const focusedNodes: NeuroCognitiveNode[] = [
  { id: "opening", label: "Ouverture", value: 0.5, riskLevel: "medium" },
  { id: "tactical", label: "Tactique", value: 0.78, riskLevel: "medium" },
  { id: "calculation", label: "Calcul", value: 0.82, riskLevel: "low" },
  { id: "conversion", label: "Conversion", value: 0.66, riskLevel: "medium" },
  { id: "defense", label: "Défense", value: 0.48, riskLevel: "medium" },
  { id: "plan", label: "Plan", value: 0.7, riskLevel: "low" },
];

const highRiskNodes: NeuroCognitiveNode[] = [
  { id: "opening", label: "Ouverture", value: 0.42, riskLevel: "medium" },
  { id: "tactical", label: "Tactique", value: 0.88, riskLevel: "high" },
  { id: "calculation", label: "Calcul", value: 0.76, riskLevel: "high" },
  { id: "conversion", label: "Conversion", value: 0.68, riskLevel: "medium" },
  { id: "defense", label: "Défense", value: 0.72, riskLevel: "medium" },
  { id: "plan", label: "Plan", value: 0.58, riskLevel: "high" },
];

const constructionNodes: NeuroCognitiveNode[] = [
  { id: "opening", label: "Ouverture", value: 0.44, riskLevel: "medium" },
  { id: "tactical", label: "Tactique", value: 0.48, riskLevel: "medium" },
  { id: "calculation", label: "Calcul", value: 0.46, riskLevel: "medium" },
  { id: "conversion", label: "Conversion", value: 0.4, riskLevel: "medium" },
  { id: "defense", label: "Défense", value: 0.42, riskLevel: "medium" },
  { id: "plan", label: "Plan", value: 0.36, riskLevel: "medium" },
];

const cognitiveLinks: NeuroCognitiveLink[] = [
  { source: "opening", target: "tactical", strength: 0.58 },
  { source: "tactical", target: "calculation", strength: 0.84 },
  { source: "calculation", target: "conversion", strength: 0.64 },
  { source: "defense", target: "plan", strength: 0.48 },
  { source: "conversion", target: "plan", strength: 0.56 },
];

const highRiskLinks: NeuroCognitiveLink[] = [
  { source: "opening", target: "tactical", strength: 0.62 },
  { source: "tactical", target: "calculation", strength: 0.92 },
  { source: "calculation", target: "conversion", strength: 0.72 },
  { source: "defense", target: "plan", strength: 0.7 },
  { source: "conversion", target: "plan", strength: 0.66 },
];

const constructionLinks: NeuroCognitiveLink[] = cognitiveLinks.map((link) => ({
  ...link,
  strength: Math.max(0.22, link.strength * 0.52),
}));

type VisualControls = Pick<
  Required<NeuroCognitiveMap3DProps>,
  "nodeSize" | "linkOpacity" | "glowIntensity" | "cameraDistance" | "rotationSpeed" | "particleDensity"
>;

type VisualLabFrameProps = NeuroCognitiveMap3DProps & {
  controls?: Partial<VisualControls>;
};

function VisualLabFrame({ controls, ...props }: VisualLabFrameProps) {
  const visualControls = useControls("Visual tuning", {
    nodeSize: { value: controls?.nodeSize ?? 0.16, min: 0.08, max: 0.28, step: 0.01 },
    linkOpacity: { value: controls?.linkOpacity ?? 0.28, min: 0.06, max: 0.7, step: 0.01 },
    glowIntensity: { value: controls?.glowIntensity ?? 1, min: 0.4, max: 1.7, step: 0.05 },
    cameraDistance: { value: controls?.cameraDistance ?? 7.6, min: 5.6, max: 10, step: 0.1 },
    rotationSpeed: { value: controls?.rotationSpeed ?? 0.035, min: 0, max: 0.14, step: 0.005 },
    particleDensity: { value: controls?.particleDensity ?? 1, min: 0, max: 1.7, step: 0.05 },
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
  render: () => (
    <VisualLabFrame
      nodes={calmNodes}
      links={cognitiveLinks}
      variant="calm"
      controls={{ rotationSpeed: 0.026, particleDensity: 0.82, glowIntensity: 0.9 }}
    />
  ),
};

export const Focused: Story = {
  render: () => (
    <VisualLabFrame
      nodes={focusedNodes}
      links={cognitiveLinks}
      variant="focused"
      controls={{ rotationSpeed: 0.042, particleDensity: 1.12, glowIntensity: 1.08 }}
    />
  ),
};

export const HighRisk: Story = {
  render: () => (
    <VisualLabFrame
      nodes={highRiskNodes}
      links={highRiskLinks}
      variant="high-risk"
      controls={{ linkOpacity: 0.32, rotationSpeed: 0.038, particleDensity: 1.08, glowIntensity: 1.12 }}
    />
  ),
};

export const Empty: Story = {
  render: () => <VisualLabFrame nodes={[]} links={[]} variant="calm" controls={{ particleDensity: 0.45 }} />,
};

export const ProfileInConstruction: Story = {
  render: () => (
    <VisualLabFrame
      nodes={constructionNodes}
      links={constructionLinks}
      variant="calm"
      controls={{ nodeSize: 0.13, linkOpacity: 0.16, glowIntensity: 0.72, rotationSpeed: 0.018, particleDensity: 0.62 }}
    />
  ),
};
