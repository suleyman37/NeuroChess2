import { useMemo, useRef, type CSSProperties } from "react";
import { Billboard, Line, Sparkles, Stars, Text } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, type Group } from "three";

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
};

const NODE_COLORS: Record<NeuroCognitiveRiskLevel, string> = {
  low: "#52f3bd",
  medium: "#ffd166",
  high: "#ff5f7e",
};

const VARIANT_CONFIG: Record<
  NeuroCognitiveMapVariant,
  {
    accent: string;
    background: string;
    sceneBackground: string;
    starCount: number;
    sparkles: number;
  }
> = {
  calm: {
    accent: "#5fd7ff",
    background:
      "radial-gradient(circle at 28% 20%, rgba(83, 216, 255, 0.20), transparent 32%), radial-gradient(circle at 74% 76%, rgba(82, 243, 189, 0.16), transparent 34%), #060a12",
    sceneBackground: "#060a12",
    starCount: 70,
    sparkles: 18,
  },
  focused: {
    accent: "#8ea7ff",
    background:
      "radial-gradient(circle at 42% 28%, rgba(142, 167, 255, 0.22), transparent 34%), radial-gradient(circle at 78% 70%, rgba(95, 215, 255, 0.13), transparent 30%), #070815",
    sceneBackground: "#070815",
    starCount: 95,
    sparkles: 26,
  },
  "high-risk": {
    accent: "#ff7a9b",
    background:
      "radial-gradient(circle at 32% 24%, rgba(255, 95, 126, 0.25), transparent 34%), radial-gradient(circle at 72% 72%, rgba(255, 209, 102, 0.14), transparent 32%), #100711",
    sceneBackground: "#100711",
    starCount: 115,
    sparkles: 34,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildPositionedNodes(nodes: NeuroCognitiveNode[], nodeSize: number): PositionedNode[] {
  const count = Math.max(nodes.length, 1);

  return nodes.map((node, index) => {
    const angle = (index / count) * Math.PI * 2;
    const value = clamp(Number.isFinite(node.value) ? node.value : 0.5, 0, 1);
    const radius = 2.35 + value * 0.9;
    const position: Point3 = [
      Math.cos(angle) * radius,
      (value - 0.5) * 1.8 + Math.sin(angle * 2) * 0.24,
      Math.sin(angle) * radius * 0.72,
    ];
    const color = NODE_COLORS[node.riskLevel] ?? NODE_COLORS.medium;

    return {
      ...node,
      color,
      glowColor: new Color(color).lerp(new Color("#ffffff"), 0.2).getStyle(),
      position,
      radius: nodeSize * (0.7 + value * 0.85),
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
}: Required<Omit<NeuroCognitiveMap3DProps, "height" | "cameraDistance">>) {
  const groupRef = useRef<Group | null>(null);
  const config = VARIANT_CONFIG[variant];
  const positionedNodes = useMemo(() => buildPositionedNodes(nodes, nodeSize), [nodes, nodeSize]);
  const nodesById = useMemo(() => new Map(positionedNodes.map((node) => [node.id, node])), [positionedNodes]);
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

  useFrame((_, delta) => {
    if (groupRef.current && rotationSpeed > 0) {
      groupRef.current.rotation.y += delta * rotationSpeed;
    }
  });

  return (
    <>
      <color attach="background" args={[config.sceneBackground]} />
      <fog attach="fog" args={[config.sceneBackground, 7, 15]} />
      <ambientLight intensity={0.45} />
      <pointLight position={[0, 3.5, 4]} intensity={1.2} color={config.accent} />
      <pointLight position={[-3.5, -1.5, -2]} intensity={0.7} color="#52f3bd" />
      <Stars radius={18} depth={8} count={config.starCount} factor={1.4} saturation={0.2} fade speed={0.18} />
      <Sparkles
        count={config.sparkles}
        scale={[6.8, 2.6, 4.8]}
        size={1.5}
        speed={0.22}
        opacity={0.5}
        color={config.accent}
      />
      <group ref={groupRef}>
        {visibleLinks.map((link) => (
          <Line
            key={`${link.source.id}-${link.target.id}`}
            points={[link.source.position, link.target.position]}
            color={config.accent}
            transparent
            opacity={clamp(link.strength, 0.1, 1) * linkOpacity}
            lineWidth={1.15}
          />
        ))}

        {positionedNodes.map((node) => (
          <group key={node.id} position={node.position}>
            <mesh>
              <sphereGeometry args={[node.radius * 2.25 * glowIntensity, 32, 32]} />
              <meshBasicMaterial
                color={node.glowColor}
                transparent
                opacity={0.13}
                blending={AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            <mesh>
              <sphereGeometry args={[node.radius, 32, 32]} />
              <meshStandardMaterial
                color={node.color}
                emissive={node.color}
                emissiveIntensity={0.9 + glowIntensity * 0.25}
                roughness={0.34}
                metalness={0.18}
              />
            </mesh>
            <Billboard position={[0, node.radius + 0.34, 0]}>
              <Text
                color="#e8f9ff"
                fontSize={0.13}
                maxWidth={1.4}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.006}
                outlineColor="#07101c"
              >
                {node.label}
              </Text>
            </Billboard>
          </group>
        ))}
      </group>
    </>
  );
}

export function NeuroCognitiveMap3D({
  nodes = [],
  links = [],
  height = 420,
  variant = "calm",
  nodeSize = 0.16,
  linkOpacity = 0.34,
  glowIntensity = 1,
  cameraDistance = 7.2,
  rotationSpeed = 0.07,
}: NeuroCognitiveMap3DProps) {
  const safeNodes = Array.isArray(nodes) ? nodes.filter((node) => node.id && node.label) : [];
  const safeLinks = Array.isArray(links) ? links : [];
  const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.calm;

  const containerStyle: CSSProperties = {
    width: "100%",
    height,
    minHeight: 280,
    overflow: "hidden",
    borderRadius: 18,
    background: config.background,
    boxShadow: "inset 0 0 0 1px rgba(184, 221, 255, 0.12), 0 28px 80px rgba(0, 0, 0, 0.35)",
  };

  if (safeNodes.length === 0) {
    return (
      <div style={{ ...containerStyle, display: "grid", placeItems: "center" }} role="img" aria-label="Carte cognitive vide">
        <div style={{ color: "#c7d7e8", fontSize: 14, letterSpacing: 0, opacity: 0.82 }}>Carte cognitive indisponible</div>
      </div>
    );
  }

  return (
    <div style={containerStyle} role="img" aria-label="Carte cognitive 3D NeuroChess">
      <Canvas
        camera={{ position: [0, 0.8, cameraDistance], fov: 43 }}
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
        />
      </Canvas>
    </div>
  );
}
