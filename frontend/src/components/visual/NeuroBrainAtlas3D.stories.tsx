import type { Meta, StoryObj } from "@storybook/react-vite";
import { Leva, useControls } from "leva";

import {
  NeuroBrainAtlas3D,
  NeuroBrainAtlas3DLabTuningProvider,
  type BrainConnection,
  type BrainDomainRegion,
  type NeuroBrainAtlas3DProps,
  type NeuroBrainAtlas3DTuning,
} from "./NeuroBrainAtlas3D";

const atlasConnections: BrainConnection[] = [
  { source: "opening", target: "tactics", strength: 0.7 },
  { source: "tactics", target: "calculation", strength: 0.86 },
  { source: "calculation", target: "conversion", strength: 0.7 },
  { source: "defense", target: "planning", strength: 0.62 },
  { source: "planning", target: "conversion", strength: 0.66 },
  { source: "tactics", target: "defense", strength: 0.58 },
];

const balancedRegions: BrainDomainRegion[] = [
  { id: "opening", label: "Opening", performance: "strong", weight: 0.7, activity: 0.35, confidence: 0.88 },
  { id: "tactics", label: "Tactics", performance: "stable", weight: 0.76, activity: 0.42, confidence: 0.86 },
  { id: "calculation", label: "Calculation", performance: "strong", weight: 0.82, activity: 0.4, confidence: 0.9 },
  { id: "conversion", label: "Conversion", performance: "stable", weight: 0.66, activity: 0.3, confidence: 0.82 },
  { id: "defense", label: "Defense", performance: "stable", weight: 0.62, activity: 0.28, confidence: 0.8 },
  { id: "planning", label: "Planning", performance: "strong", weight: 0.68, activity: 0.36, confidence: 0.84 },
];

const tacticalWeaknessRegions: BrainDomainRegion[] = [
  { id: "opening", label: "Opening", performance: "stable", weight: 0.58, activity: 0.28, confidence: 0.76 },
  { id: "tactics", label: "Tactics", performance: "weak", weight: 0.88, activity: 0.94, confidence: 0.83 },
  { id: "calculation", label: "Calculation", performance: "fragile", weight: 0.82, activity: 0.72, confidence: 0.78 },
  { id: "conversion", label: "Conversion", performance: "stable", weight: 0.6, activity: 0.34, confidence: 0.72 },
  { id: "defense", label: "Defense", performance: "fragile", weight: 0.56, activity: 0.52, confidence: 0.7 },
  { id: "planning", label: "Planning", performance: "stable", weight: 0.52, activity: 0.26, confidence: 0.76 },
];

const strongOpeningWeakConversionRegions: BrainDomainRegion[] = [
  { id: "opening", label: "Opening", performance: "strong", weight: 0.94, activity: 0.44, confidence: 0.9 },
  { id: "tactics", label: "Tactics", performance: "stable", weight: 0.72, activity: 0.38, confidence: 0.82 },
  { id: "calculation", label: "Calculation", performance: "stable", weight: 0.7, activity: 0.34, confidence: 0.8 },
  { id: "conversion", label: "Conversion", performance: "weak", weight: 0.86, activity: 0.82, confidence: 0.78 },
  { id: "defense", label: "Defense", performance: "stable", weight: 0.5, activity: 0.24, confidence: 0.72 },
  { id: "planning", label: "Planning", performance: "fragile", weight: 0.58, activity: 0.48, confidence: 0.74 },
];

const defensiveAlertRegions: BrainDomainRegion[] = [
  { id: "opening", label: "Opening", performance: "stable", weight: 0.62, activity: 0.28, confidence: 0.78 },
  { id: "tactics", label: "Tactics", performance: "stable", weight: 0.68, activity: 0.38, confidence: 0.8 },
  { id: "calculation", label: "Calculation", performance: "stable", weight: 0.72, activity: 0.36, confidence: 0.82 },
  { id: "conversion", label: "Conversion", performance: "fragile", weight: 0.58, activity: 0.42, confidence: 0.72 },
  { id: "defense", label: "Defense", performance: "weak", weight: 0.9, activity: 0.88, confidence: 0.84 },
  { id: "planning", label: "Planning", performance: "stable", weight: 0.74, activity: 0.55, confidence: 0.82 },
];

const highActivityMixedRegions: BrainDomainRegion[] = [
  { id: "opening", label: "Opening", performance: "strong", weight: 0.7, activity: 0.62, confidence: 0.86 },
  { id: "tactics", label: "Tactics", performance: "fragile", weight: 0.84, activity: 0.92, confidence: 0.82 },
  { id: "calculation", label: "Calculation", performance: "stable", weight: 0.9, activity: 0.86, confidence: 0.86 },
  { id: "conversion", label: "Conversion", performance: "weak", weight: 0.76, activity: 0.8, confidence: 0.76 },
  { id: "defense", label: "Defense", performance: "fragile", weight: 0.68, activity: 0.66, confidence: 0.74 },
  { id: "planning", label: "Planning", performance: "strong", weight: 0.7, activity: 0.74, confidence: 0.82 },
];

const profileInConstructionRegions: BrainDomainRegion[] = [
  { id: "opening", label: "Opening", performance: "unknown", weight: 0.44, activity: 0.16, confidence: 0.36 },
  { id: "tactics", label: "Tactics", performance: "fragile", weight: 0.54, activity: 0.3, confidence: 0.48 },
  { id: "calculation", label: "Calculation", performance: "unknown", weight: 0.5, activity: 0.18, confidence: 0.32 },
  { id: "conversion", label: "Conversion", performance: "unknown", weight: 0.42, activity: 0.12, confidence: 0.28 },
  { id: "defense", label: "Defense", performance: "stable", weight: 0.46, activity: 0.22, confidence: 0.5 },
  { id: "planning", label: "Planning", performance: "unknown", weight: 0.48, activity: 0.16, confidence: 0.34 },
];

type AtlasControls = NeuroBrainAtlas3DTuning;

type VisualLabFrameProps = NeuroBrainAtlas3DProps & {
  controls?: Partial<AtlasControls>;
};

function VisualLabFrame({ controls, ...props }: VisualLabFrameProps) {
  const atlasControls = useControls("Brain atlas tuning", {
    brainOpacity: { value: controls?.brainOpacity ?? 0.68, min: 0.18, max: 1.2, step: 0.02 },
    regionScale: { value: controls?.regionScale ?? 1, min: 0.7, max: 1.35, step: 0.02 },
    glowIntensity: { value: controls?.glowIntensity ?? 1, min: 0.45, max: 1.75, step: 0.05 },
    connectionOpacity: { value: controls?.connectionOpacity ?? 0.44, min: 0.08, max: 0.9, step: 0.02 },
    pulseSpeed: { value: controls?.pulseSpeed ?? 0.82, min: 0.2, max: 1.8, step: 0.05 },
    cameraDistance: { value: controls?.cameraDistance ?? 7.25, min: 5.8, max: 9.4, step: 0.1 },
    particleDensity: { value: controls?.particleDensity ?? 1, min: 0, max: 1.8, step: 0.05 },
    rotationSpeed: { value: controls?.rotationSpeed ?? 0.022, min: 0, max: 0.08, step: 0.002 },
  });

  return (
    <div style={{ minHeight: "100vh", padding: 28, background: "#04060b" }}>
      <NeuroBrainAtlas3DLabTuningProvider value={atlasControls}>
        <NeuroBrainAtlas3D {...props} />
      </NeuroBrainAtlas3DLabTuningProvider>
      <Leva collapsed />
    </div>
  );
}

const meta = {
  title: "Visual/NeuroBrainAtlas3D",
  component: NeuroBrainAtlas3D,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof NeuroBrainAtlas3D>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BalancedProfile: Story = {
  render: () => (
    <VisualLabFrame
      regions={balancedRegions}
      connections={atlasConnections}
      variant="calm"
      height={560}
      controls={{
        brainOpacity: 0.68,
        connectionOpacity: 0.4,
        glowIntensity: 0.92,
        pulseSpeed: 0.68,
        particleDensity: 0.84,
        rotationSpeed: 0.017,
      }}
    />
  ),
};

export const TacticalWeakness: Story = {
  render: () => (
    <VisualLabFrame
      regions={tacticalWeaknessRegions}
      connections={atlasConnections.map((connection) =>
        connection.source === "tactics" || connection.target === "tactics"
          ? { ...connection, strength: Math.min(1, connection.strength + 0.1) }
          : connection,
      )}
      variant="high-risk"
      height={560}
      controls={{
        brainOpacity: 0.62,
        connectionOpacity: 0.52,
        glowIntensity: 1.16,
        pulseSpeed: 1.12,
        particleDensity: 1,
        rotationSpeed: 0.022,
      }}
    />
  ),
};

export const StrongOpeningWeakConversion: Story = {
  render: () => (
    <VisualLabFrame
      regions={strongOpeningWeakConversionRegions}
      connections={atlasConnections.map((connection) =>
        connection.source === "opening" && connection.target === "tactics"
          ? { ...connection, strength: 0.9 }
          : connection,
      )}
      variant="analysis"
      height={560}
      controls={{
        brainOpacity: 0.66,
        connectionOpacity: 0.46,
        glowIntensity: 1.04,
        pulseSpeed: 0.92,
        particleDensity: 0.9,
        rotationSpeed: 0.019,
      }}
    />
  ),
};

export const DefensiveAlert: Story = {
  render: () => (
    <VisualLabFrame
      regions={defensiveAlertRegions}
      connections={atlasConnections.map((connection) =>
        connection.source === "defense" && connection.target === "planning"
          ? { ...connection, strength: 0.92 }
          : connection,
      )}
      variant="high-risk"
      height={560}
      controls={{
        brainOpacity: 0.6,
        connectionOpacity: 0.58,
        glowIntensity: 1.08,
        pulseSpeed: 0.98,
        particleDensity: 0.92,
        rotationSpeed: 0.018,
      }}
    />
  ),
};

export const HighActivityMixedProfile: Story = {
  render: () => (
    <VisualLabFrame
      regions={highActivityMixedRegions}
      connections={atlasConnections.map((connection) => ({ ...connection, strength: Math.min(1, connection.strength + 0.12) }))}
      variant="analysis"
      height={560}
      controls={{
        brainOpacity: 0.74,
        connectionOpacity: 0.62,
        glowIntensity: 1.22,
        pulseSpeed: 1.28,
        particleDensity: 1.24,
        rotationSpeed: 0.026,
      }}
    />
  ),
};

export const ProfileInConstruction: Story = {
  render: () => (
    <VisualLabFrame
      regions={profileInConstructionRegions}
      connections={atlasConnections.map((connection) => ({ ...connection, strength: Math.max(0.22, connection.strength * 0.48) }))}
      variant="construction"
      height={560}
      controls={{
        brainOpacity: 0.46,
        regionScale: 0.92,
        connectionOpacity: 0.22,
        glowIntensity: 0.7,
        pulseSpeed: 0.52,
        particleDensity: 0.56,
        rotationSpeed: 0.012,
      }}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <VisualLabFrame
      regions={[]}
      connections={[]}
      variant="construction"
      height={520}
      controls={{
        brainOpacity: 0.42,
        connectionOpacity: 0.18,
        glowIntensity: 0.7,
        particleDensity: 0.2,
        rotationSpeed: 0,
      }}
    />
  ),
};
