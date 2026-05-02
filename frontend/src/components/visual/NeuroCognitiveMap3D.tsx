import { useMemo, useRef, type CSSProperties } from "react";
import { Billboard, Line, Sparkles, Stars, Text } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, DoubleSide, type Group } from "three";

export type NeuroCognitiveRiskLevel = "low" | "medium" | "high";

export type NeuroCognitiveNode = {
  id: string;
  label: string;
  value: number;
  riskLevel: NeuroCognitiveRiskLevel;
};

export type NeuroCognitiveLink = {
  source: string;
  target: string;
  strength: number;
};

export type NeuroCognitiveMapVariant = "calm" | "focused" | "high-risk";

type Point3 = [number, number, number];

type PositionedNode = NeuroCognitiveNode & {
  color: string;
  glowColor: string;
  position: Point3;
  radius: number;
  emphasis: number;
};

type VariantConfig = {
  accent: string;
  accentSoft: string;
  link: string;
  sceneBackground: string;
  background: string;
  fog: [string, number, number];
  riskColors: Record<NeuroCognitiveRiskLevel, string>;
  stars: number;
  sparkles: number;
};

export type NeuroCognitiveMap3DProps = {
  nodes?: NeuroCognitiveNode[];
  links?: NeuroCognitiveLink[];
  height?: number;
  variant?: NeuroCognitiveMapVariant;
  nodeSize?: number;
  linkOpacity?: number;
  glowIntensity?: number;
  cameraDistance?: number;
  rotationSpeed?: number;
  particleDensity?: number;
};

const DOMAIN_LAYOUT: Record<string, Point3> = {
  opening: [-2.55, -0.28, -0.72],
  tactical: [-1.12, 0.62, 0.38],
  calculation: [0.18, 0.18, 0.94],
  conversion: [1.38, 0.54, -0.08],
  defense: [-0.62, -0.98, 0.12],
  plan: [2.28, -0.42, 0.58],
};

const VARIANT_CONFIG: Record<NeuroCognitiveMapVariant, VariantConfig> = {
  calm: {
    accent: "#8cc8ff",
    accentSoft: "#6f7dff",
    link: "#b8d7ff",
    sceneBackground: "#060811",
    background:
      "radial-gradient(circle at 24% 22%, rgba(107, 125, 255, 0.18), transparent 34%), radial-gradient(circle at 78% 72%, rgba(92, 220, 210, 0.12), transparent 32%), linear-gradient(145deg, #05070d 0%, #08101d 56%, #05070d 100%)",
    fog: ["#060811", 6.5, 14.5],
    riskColors: {
      low: "#8ce6e0",
      medium: "#b7b8ff",
      high: "#f2c27a",
    },
    stars: 85,
    sparkles: 20,
  },
  focused: {
    accent: "#6fa8ff",
    accentSoft: "#65e1ff",
    link: "#9bc4ff",
    sceneBackground: "#050916",
    background:
      "radial-gradient(circle at 42% 24%, rgba(91, 140, 255, 0.24), transparent 34%), radial-gradient(circle at 78% 66%, rgba(99, 225, 255, 0.10), transparent 32%), linear-gradient(145deg, #050712 0%, #091229 58%, #050712 100%)",
    fog: ["#050916", 6, 14],
    riskColors: {
      low: "#72e9d5",
      medium: "#8ea8ff",
      high: "#ffc56e",
    },
    stars: 105,
    sparkles: 28,
  },
  "high-risk": {
    accent: "#ffb56a",
    accentSoft: "#ff6f8e",
    link: "#ffd4a3",
    sceneBackground: "#10070c",
    background:
      "radial-gradient(circle at 32% 22%, rgba(255, 111, 142, 0.20), transparent 34%), radial-gradient(circle at 70% 70%, rgba(255, 181, 106, 0.13), transparent 32%), linear-gradient(145deg, #09060b 0%, #170b13 58%, #06060a 100%)",
    fog: ["#10070c", 6.2, 14.2],
    riskColors: {
      low: "#7bd8c7",
      medium: "#f0bd69",
      high: "#ff7f92",
    },
    stars: 95,
    sparkles: 34,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildPositionedNodes(
  nodes: NeuroCognitiveNode[],
  nodeSize: number,
  config: VariantConfig,
): PositionedNode[] {
  const count = Math.max(nodes.length, 1);

  return nodes.map((node, index) => {
    const fallbackAngle = (index / count) * Math.PI * 2 - Math.PI * 0.72;
    const fallbackRadius = 2.25 + (index % 2) * 0.26;
    const value = clamp(Number.isFinite(node.value) ? node.value : 0.5, 0, 1);
    const layout = DOMAIN_LAYOUT[node.id] ?? [
      Math.cos(fallbackAngle) * fallbackRadius,
      (value - 0.5) * 1.5,
      Math.sin(fallbackAngle) * fallbackRadius * 0.58,
    ];
    const depthLift = (index % 3 - 1) * 0.08;
    const color = config.riskColors[node.riskLevel] ?? config.riskColors.medium;

    return {
      ...node,
      color,
      glowColor: new Color(color).lerp(new Color(config.accent), 0.34).getStyle(),
      position: [layout[0], layout[1], layout[2] + depthLift],
      radius: nodeSize * (0.82 + value * 0.72),
      emphasis: 0.65 + value * 0.55,
    };
  });
}

function NeuroCognitiveMapScene({
  nodes,
  links,
  variant,
  nodeSize,
  linkOpacity,
  glowIntensity,
  rotationSpeed,
  particleDensity,
}: Required<Omit<NeuroCognitiveMap3DProps, "height" | "cameraDistance">>) {
  const groupRef = useRef<Group | null>(null);
  const config = VARIANT_CONFIG[variant];
  const positionedNodes = useMemo(
    () => buildPositionedNodes(nodes, nodeSize, config),
    [config, nodes, nodeSize],
  );
  const nodesById = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes],
  );
  const visibleLinks = useMemo(
    () =>
      links
        .map((link) => {
          const source = nodesById.get(link.source);
          const target = nodesById.get(link.target);
          return source && target ? { ...link, source, target } : null;
        })
        .filter((link): link is NeuroCognitiveLink & { source: PositionedNode; target: PositionedNode } => Boolean(link)),
    [links, nodesById],
  );
  const density = clamp(particleDensity, 0, 2);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) {
      return;
    }
    groupRef.current.rotation.y += delta * rotationSpeed;
    groupRef.current.rotation.x = -0.08 + Math.sin(clock.elapsedTime * 0.18) * 0.018;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.24) * 0.035;
  });

  return (
    <>
      <color attach="background" args={[config.sceneBackground]} />
      <fog attach="fog" args={config.fog} />
      <ambientLight intensity={0.34} />
      <pointLight position={[0, 3.8, 4.2]} intensity={1.05} color={config.accent} />
      <pointLight position={[-3.8, -1.2, -2.4]} intensity={0.58} color={config.accentSoft} />
      <pointLight position={[3.8, 0.2, 2.4]} intensity={0.42} color="#ffffff" />
      <Stars
        radius={18}
        depth={9}
        count={Math.round(config.stars * density)}
        factor={1.05}
        saturation={0.1}
        fade
        speed={0.08}
      />
      <Sparkles
        count={Math.round(config.sparkles * density)}
        scale={[7.4, 2.8, 5.2]}
        size={1.15}
        speed={0.14}
        opacity={0.36}
        color={config.accent}
      />

      <group ref={groupRef} scale={0.98}>
        <CognitiveHorizon config={config} glowIntensity={glowIntensity} />

        {visibleLinks.map((link) => (
          <Line
            key={`${link.source.id}-${link.target.id}`}
            points={[link.source.position, link.target.position]}
            color={config.link}
            transparent
            opacity={clamp(link.strength, 0.1, 1) * linkOpacity * 0.62}
            lineWidth={0.62}
          />
        ))}

        {positionedNodes.map((node, index) => (
          <CognitiveNode key={node.id} node={node} index={index} glowIntensity={glowIntensity} />
        ))}
      </group>
    </>
  );
}

function CognitiveHorizon({
  config,
  glowIntensity,
}: {
  config: VariantConfig;
  glowIntensity: number;
}) {
  return (
    <group rotation={[Math.PI / 2, 0, 0]} position={[0, -0.84, -0.08]}>
      {[1.75, 2.55, 3.35].map((radius, index) => (
        <mesh key={radius}>
          <ringGeometry args={[radius, radius + 0.012, 144]} />
          <meshBasicMaterial
            color={index === 0 ? config.accentSoft : config.accent}
            transparent
            opacity={(0.06 - index * 0.012) * glowIntensity}
            side={DoubleSide}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function CognitiveNode({
  node,
  index,
  glowIntensity,
}: {
  node: PositionedNode;
  index: number;
  glowIntensity: number;
}) {
  const nodeRef = useRef<Group | null>(null);

  useFrame(({ clock }) => {
    if (!nodeRef.current) {
      return;
    }
    const pulse = 1 + Math.sin(clock.elapsedTime * (0.44 + index * 0.035) + index * 0.82) * 0.028;
    nodeRef.current.scale.setScalar(pulse);
  });

  return (
    <group ref={nodeRef} position={node.position}>
      <mesh>
        <sphereGeometry args={[node.radius * 3.05 * glowIntensity, 36, 36]} />
        <meshBasicMaterial
          color={node.glowColor}
          transparent
          opacity={0.075 * node.emphasis}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[node.radius * 1.74, 32, 32]} />
        <meshBasicMaterial
          color={node.color}
          transparent
          opacity={0.12}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[node.radius, 40, 40]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={0.42 + glowIntensity * 0.18}
          roughness={0.42}
          metalness={0.12}
        />
      </mesh>
      <Billboard position={[0, node.radius + 0.32, 0]}>
        <Text
          color="#edf7ff"
          fontSize={0.12}
          maxWidth={1.3}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.004}
          outlineColor="#050810"
        >
          {node.label}
        </Text>
      </Billboard>
    </group>
  );
}

export function NeuroCognitiveMap3D({
  nodes = [],
  links = [],
  height = 440,
  variant = "calm",
  nodeSize = 0.16,
  linkOpacity = 0.28,
  glowIntensity = 1,
  cameraDistance = 7.6,
  rotationSpeed = 0.035,
  particleDensity = 1,
}: NeuroCognitiveMap3DProps) {
  const safeNodes = Array.isArray(nodes) ? nodes.filter((node) => node.id && node.label) : [];
  const safeLinks = Array.isArray(links) ? links : [];
  const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.calm;

  const containerStyle: CSSProperties = {
    width: "100%",
    height,
    minHeight: 300,
    overflow: "hidden",
    borderRadius: 20,
    background: config.background,
    boxShadow:
      "inset 0 0 0 1px rgba(190, 220, 255, 0.11), inset 0 -80px 110px rgba(0, 0, 0, 0.24), 0 32px 90px rgba(0, 0, 0, 0.42)",
  };

  if (safeNodes.length === 0) {
    return (
      <div
        style={{
          ...containerStyle,
          display: "grid",
          placeItems: "center",
          color: "#c7d7e8",
        }}
        role="img"
        aria-label="Carte cognitive vide"
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, letterSpacing: 0, opacity: 0.86 }}>Carte cognitive indisponible</div>
          <div style={{ marginTop: 10, fontSize: 12, letterSpacing: 0, opacity: 0.52 }}>
            Donnees qualitatives en attente.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle} role="img" aria-label="Carte cognitive 3D NeuroChess">
      <Canvas
        camera={{ position: [0, 0.9, cameraDistance], fov: 39 }}
        dpr={[1, 1.7]}
        fallback={<div style={{ color: "#c7d7e8", padding: 24 }}>Rendu 3D indisponible</div>}
      >
        <NeuroCognitiveMapScene
          nodes={safeNodes}
          links={safeLinks}
          variant={variant}
          nodeSize={nodeSize}
          linkOpacity={linkOpacity}
          glowIntensity={glowIntensity}
          rotationSpeed={rotationSpeed}
          particleDensity={particleDensity}
        />
      </Canvas>
    </div>
  );
}
