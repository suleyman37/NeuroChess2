import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  TubeGeometry,
  Vector3,
  type Group,
  type Mesh,
} from "three";

export type BrainDomainId =
  | "opening"
  | "tactics"
  | "calculation"
  | "conversion"
  | "defense"
  | "planning";

export type BrainPerformanceLevel = "strong" | "stable" | "fragile" | "weak" | "unknown";

export type BrainDomainRegion = {
  id: BrainDomainId;
  label: string;
  performance: BrainPerformanceLevel;
  weight: number;
  activity: number;
  confidence: number;
};

export type BrainConnection = {
  source: BrainDomainId;
  target: BrainDomainId;
  strength: number;
};

export type NeuroBrainAtlas3DProps = {
  regions: BrainDomainRegion[];
  connections: BrainConnection[];
  height?: number;
  variant?: "calm" | "analysis" | "high-risk" | "construction";
  showLegend?: boolean;
  interactive?: boolean;
};

export type NeuroBrainAtlas3DTuning = {
  brainOpacity: number;
  regionScale: number;
  glowIntensity: number;
  connectionOpacity: number;
  pulseSpeed: number;
  cameraDistance: number;
  particleDensity: number;
  rotationSpeed: number;
};

type Point3 = [number, number, number];

type PositionedRegion = BrainDomainRegion & {
  color: string;
  haloColor: string;
  position: Point3;
  radius: number;
  confidenceClamped: number;
  activityClamped: number;
};

type VariantConfig = {
  sceneBackground: string;
  panelBackground: string;
  fog: [string, number, number];
  shellColor: string;
  shellAccent: string;
  connectionColor: string;
  ambient: number;
  tension: number;
};

type BrainParticle = {
  position: Point3;
  radius: number;
  opacity: number;
  color: string;
};

type FoldCurve = {
  points: Point3[];
  color: string;
  opacity: number;
};

type ConnectionCurve = BrainConnection & {
  sourceRegion: PositionedRegion;
  targetRegion: PositionedRegion;
  curve: CatmullRomCurve3;
  color: string;
};

const DEFAULT_TUNING: NeuroBrainAtlas3DTuning = {
  brainOpacity: 0.68,
  regionScale: 1,
  glowIntensity: 1,
  connectionOpacity: 0.44,
  pulseSpeed: 0.82,
  cameraDistance: 7.25,
  particleDensity: 1,
  rotationSpeed: 0.022,
};

const TuningContext = createContext<NeuroBrainAtlas3DTuning>(DEFAULT_TUNING);

export function NeuroBrainAtlas3DLabTuningProvider({
  value,
  children,
}: {
  value: Partial<NeuroBrainAtlas3DTuning>;
  children: ReactNode;
}) {
  const mergedValue = useMemo(() => ({ ...DEFAULT_TUNING, ...value }), [value]);

  return <TuningContext.Provider value={mergedValue}>{children}</TuningContext.Provider>;
}

const PERFORMANCE_COLORS: Record<BrainPerformanceLevel, string> = {
  strong: "#72d9c4",
  stable: "#8fbfff",
  fragile: "#d9aa6a",
  weak: "#c86f89",
  unknown: "#7f91a8",
};

const REGION_LAYOUT: Record<BrainDomainId, Point3> = {
  opening: [-1.95, 0.46, 0.08],
  tactics: [-1.03, -0.04, 0.48],
  calculation: [0.0, 0.42, 0.66],
  conversion: [1.24, -0.54, 0.18],
  defense: [-1.24, -0.78, -0.2],
  planning: [1.64, 0.46, -0.04],
};

const REGION_LABEL_BIAS: Record<BrainDomainId, Point3> = {
  opening: [0, 1, 0],
  tactics: [0, 0.92, 0],
  calculation: [0, 1.05, 0],
  conversion: [0.22, 0.72, 0],
  defense: [-0.08, -1.1, 0],
  planning: [0, 0.98, 0],
};

const VARIANT_CONFIG: Record<Required<NeuroBrainAtlas3DProps>["variant"], VariantConfig> = {
  calm: {
    sceneBackground: "#050812",
    panelBackground:
      "radial-gradient(circle at 26% 18%, rgba(98, 140, 220, 0.20), transparent 34%), radial-gradient(circle at 72% 72%, rgba(98, 212, 194, 0.10), transparent 31%), linear-gradient(145deg, #05070d 0%, #07111f 58%, #04060c 100%)",
    fog: ["#050812", 6.8, 14.6],
    shellColor: "#6d87d8",
    shellAccent: "#82d6cf",
    connectionColor: "#a8cfff",
    ambient: 0.36,
    tension: 0.9,
  },
  analysis: {
    sceneBackground: "#050916",
    panelBackground:
      "radial-gradient(circle at 35% 22%, rgba(94, 146, 255, 0.23), transparent 36%), radial-gradient(circle at 78% 64%, rgba(116, 217, 196, 0.12), transparent 30%), linear-gradient(145deg, #050710 0%, #081529 58%, #05070e 100%)",
    fog: ["#050916", 6.6, 14.2],
    shellColor: "#708ce6",
    shellAccent: "#83dcd4",
    connectionColor: "#b5d7ff",
    ambient: 0.38,
    tension: 1,
  },
  "high-risk": {
    sceneBackground: "#0b070f",
    panelBackground:
      "radial-gradient(circle at 32% 20%, rgba(198, 111, 137, 0.21), transparent 35%), radial-gradient(circle at 76% 68%, rgba(217, 170, 106, 0.13), transparent 31%), linear-gradient(145deg, #07060d 0%, #130a14 58%, #05060b 100%)",
    fog: ["#0b070f", 6.4, 14],
    shellColor: "#7762c8",
    shellAccent: "#d6a060",
    connectionColor: "#ffd0a5",
    ambient: 0.34,
    tension: 1.16,
  },
  construction: {
    sceneBackground: "#05080d",
    panelBackground:
      "radial-gradient(circle at 30% 22%, rgba(127, 145, 168, 0.17), transparent 35%), radial-gradient(circle at 76% 70%, rgba(98, 140, 220, 0.08), transparent 31%), linear-gradient(145deg, #05070b 0%, #0a1018 58%, #05070b 100%)",
    fog: ["#05080d", 6.8, 14.8],
    shellColor: "#64758f",
    shellAccent: "#7ea7c4",
    connectionColor: "#9db5cc",
    ambient: 0.32,
    tension: 0.76,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function seeded(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function toPoint3(vector: Vector3): Point3 {
  return [vector.x, vector.y, vector.z];
}

function buildPositionedRegions(
  regions: BrainDomainRegion[],
  regionScale: number,
): PositionedRegion[] {
  return regions.map((region, index) => {
    const fallbackAngle = (index / Math.max(1, regions.length)) * Math.PI * 2 - Math.PI * 0.7;
    const fallback: Point3 = [
      Math.cos(fallbackAngle) * 1.55,
      Math.sin(fallbackAngle) * 0.66,
      Math.sin(fallbackAngle * 1.3) * 0.32,
    ];
    const weight = clamp(Number.isFinite(region.weight) ? region.weight : 0.45, 0, 1);
    const activity = clamp(Number.isFinite(region.activity) ? region.activity : 0.35, 0, 1);
    const confidence = clamp(Number.isFinite(region.confidence) ? region.confidence : 0.5, 0, 1);
    const color = PERFORMANCE_COLORS[region.performance] ?? PERFORMANCE_COLORS.unknown;
    const radius = (0.28 + weight * 0.24) * regionScale * (region.performance === "unknown" ? 0.9 : 1);
    const position = REGION_LAYOUT[region.id] ?? fallback;

    return {
      ...region,
      color,
      haloColor: new Color(color).lerp(new Color("#d8eeff"), 0.22).getStyle(),
      position,
      radius,
      confidenceClamped: confidence,
      activityClamped: activity,
    };
  });
}

function makeBrainParticles(count: number): BrainParticle[] {
  const particles: BrainParticle[] = [];

  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const lobeIndex = Math.floor(i / 2);
    const u = seeded(i, 1);
    const v = seeded(i, 2);
    const w = seeded(i, 3);
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const radius = Math.pow(w, 0.36);
    const asymmetry = side < 0 ? 0.94 : 1.03;
    const shellBias = 0.82 + seeded(i, 4) * 0.18;

    let x = side * (0.78 + seeded(i, 5) * 0.08) + Math.sin(phi) * Math.cos(theta) * 1.04 * asymmetry * radius;
    const y = 0.04 + Math.cos(phi) * 0.96 * radius - Math.max(0, Math.abs(x) - 1.6) * 0.16;
    const z = Math.sin(phi) * Math.sin(theta) * 0.58 * radius + (side < 0 ? -0.04 : 0.04);

    if (Math.abs(x) < 0.22 && y > -0.62) {
      x += side * 0.16;
    }

    if (y < -0.92 || y > 1.18 || Math.abs(x) > 2.55 || Math.abs(z) > 0.82) {
      continue;
    }

    particles.push({
      position: [x, y, z],
      radius: (0.012 + seeded(i, 6) * 0.018) * shellBias,
      opacity: 0.16 + seeded(i, 7) * 0.18,
      color: lobeIndex % 5 === 0 ? "#8fd8d0" : "#7ea4ff",
    });
  }

  return particles;
}

function makeSignalParticles(count: number): BrainParticle[] {
  const particles: BrainParticle[] = [];

  for (let i = 0; i < count; i += 1) {
    const x = (seeded(i, 11) - 0.5) * 4.7;
    const y = (seeded(i, 12) - 0.5) * 2.15;
    const z = (seeded(i, 13) - 0.5) * 1.6;
    const lobePull = Math.abs(x) < 0.28 && y > -0.7 ? Math.sign(seeded(i, 14) - 0.5 || 1) * 0.36 : 0;

    particles.push({
      position: [x + lobePull, y, z],
      radius: 0.008 + seeded(i, 15) * 0.016,
      opacity: 0.12 + seeded(i, 16) * 0.2,
      color: seeded(i, 17) > 0.72 ? "#c8d8ff" : "#89cbc6",
    });
  }

  return particles;
}

function makeFoldCurves(): FoldCurve[] {
  const curves: FoldCurve[] = [];
  const yBands = [0.9, 0.58, 0.24, -0.12, -0.46];

  [-1, 1].forEach((side) => {
    yBands.forEach((y, bandIndex) => {
      const points: Point3[] = [];
      for (let step = 0; step < 6; step += 1) {
        const t = step / 5;
        const localX = side * (0.42 + t * 1.62);
        const wave = Math.sin(t * Math.PI * 2 + bandIndex * 0.7) * 0.12;
        points.push([
          localX,
          y + wave - Math.abs(t - 0.5) * 0.18,
          -0.42 + Math.sin(t * Math.PI + bandIndex) * 0.42,
        ]);
      }
      curves.push({
        points,
        color: bandIndex % 2 === 0 ? "#87baff" : "#82d6cf",
        opacity: bandIndex === 0 ? 0.34 : 0.26,
      });
    });
  });

  curves.push({
    points: [
      [-0.1, 1.08, -0.22],
      [-0.05, 0.56, 0.12],
      [0.02, 0.04, 0.22],
      [0.04, -0.54, 0.02],
      [0.08, -0.96, -0.24],
    ],
    color: "#58658a",
    opacity: 0.36,
  });

  return curves;
}

function makeConnectionCurve(source: PositionedRegion, target: PositionedRegion, index: number): CatmullRomCurve3 {
  const start = new Vector3(...source.position);
  const end = new Vector3(...target.position);
  const middle = start.clone().lerp(end, 0.5);
  const sideBend = (seeded(index, 21) - 0.5) * 0.8;
  const lift = 0.26 + Math.abs(start.x - end.x) * 0.08 + seeded(index, 22) * 0.2;
  const depth = 0.24 + seeded(index, 23) * 0.26;
  const controlOne = middle
    .clone()
    .lerp(start, 0.36)
    .add(new Vector3(sideBend * 0.34, lift * 0.72, depth));
  const controlTwo = middle
    .clone()
    .lerp(end, 0.34)
    .add(new Vector3(-sideBend * 0.28, lift, depth * 0.64));

  return new CatmullRomCurve3([start, controlOne, controlTwo, end]);
}

function buildConnectionCurves(
  connections: BrainConnection[],
  regionsById: Map<BrainDomainId, PositionedRegion>,
  config: VariantConfig,
): ConnectionCurve[] {
  return connections
    .map((connection, index) => {
      const sourceRegion = regionsById.get(connection.source);
      const targetRegion = regionsById.get(connection.target);

      if (!sourceRegion || !targetRegion) {
        return null;
      }

      return {
        ...connection,
        sourceRegion,
        targetRegion,
        curve: makeConnectionCurve(sourceRegion, targetRegion, index),
        color: new Color(config.connectionColor)
          .lerp(new Color(sourceRegion.color), 0.16)
          .lerp(new Color(targetRegion.color), 0.16)
          .getStyle(),
      };
    })
    .filter((connection): connection is ConnectionCurve => Boolean(connection));
}

function NeuroBrainAtlasScene({
  regions,
  connections,
  variant,
  interactive,
}: {
  regions: BrainDomainRegion[];
  connections: BrainConnection[];
  variant: Required<NeuroBrainAtlas3DProps>["variant"];
  interactive: boolean;
}) {
  const tuning = useContext(TuningContext);
  const config = VARIANT_CONFIG[variant];
  const atlasRef = useRef<Group | null>(null);
  const positionedRegions = useMemo(
    () => buildPositionedRegions(regions, tuning.regionScale),
    [regions, tuning.regionScale],
  );
  const regionsById = useMemo(
    () => new Map(positionedRegions.map((region) => [region.id, region])),
    [positionedRegions],
  );
  const connectionCurves = useMemo(
    () => buildConnectionCurves(connections, regionsById, config),
    [connections, config, regionsById],
  );
  const shellParticles = useMemo(() => makeBrainParticles(260), []);
  const signalParticles = useMemo(
    () => makeSignalParticles(Math.round(60 * clamp(tuning.particleDensity, 0, 1.8))),
    [tuning.particleDensity],
  );
  const foldCurves = useMemo(() => makeFoldCurves(), []);

  useFrame(({ clock }, delta) => {
    if (!atlasRef.current) {
      return;
    }
    const breath = 1 + Math.sin(clock.elapsedTime * 0.38) * 0.012 * config.tension;
    atlasRef.current.scale.setScalar(breath);
    atlasRef.current.rotation.y += delta * tuning.rotationSpeed;
    atlasRef.current.rotation.x = -0.08 + Math.sin(clock.elapsedTime * 0.16) * 0.014;
    atlasRef.current.position.y = Math.sin(clock.elapsedTime * 0.22) * 0.025;
  });

  return (
    <>
      <color attach="background" args={[config.sceneBackground]} />
      <fog attach="fog" args={config.fog} />
      <ambientLight intensity={config.ambient} />
      <pointLight position={[-3.3, 2.8, 3.5]} intensity={0.9} color={config.shellAccent} />
      <pointLight position={[2.8, 1.4, 3.2]} intensity={0.62} color="#95bdff" />
      <pointLight position={[0, -2.4, 2.4]} intensity={0.28} color="#d9aa6a" />

      <group ref={atlasRef} scale={1}>
        <BrainSilhouette
          particles={shellParticles}
          folds={foldCurves}
          config={config}
          brainOpacity={tuning.brainOpacity}
          glowIntensity={tuning.glowIntensity}
        />

        <SignalField
          particles={signalParticles}
          pulseSpeed={tuning.pulseSpeed}
          particleDensity={tuning.particleDensity}
        />

        {connectionCurves.map((connection, index) => (
          <NeuralConnection
            key={`${connection.source}-${connection.target}`}
            connection={connection}
            index={index}
            opacity={tuning.connectionOpacity}
            pulseSpeed={tuning.pulseSpeed}
          />
        ))}

        {positionedRegions.map((region, index) => (
          <CognitiveRegion
            key={region.id}
            region={region}
            index={index}
            glowIntensity={tuning.glowIntensity}
            pulseSpeed={tuning.pulseSpeed}
          />
        ))}
      </group>

      {interactive && (
        <OrbitControls
          enableDamping
          enablePan={false}
          minDistance={5.8}
          maxDistance={9.2}
          rotateSpeed={0.34}
          zoomSpeed={0.48}
        />
      )}
    </>
  );
}

function BrainSilhouette({
  particles,
  folds,
  config,
  brainOpacity,
  glowIntensity,
}: {
  particles: BrainParticle[];
  folds: FoldCurve[];
  config: VariantConfig;
  brainOpacity: number;
  glowIntensity: number;
}) {
  const safeOpacity = clamp(brainOpacity, 0, 1.4);

  return (
    <group>
      {[
        { position: [-0.82, 0.05, -0.12] as Point3, scale: [1.72, 1.05, 0.58] as Point3, rotation: [0.02, -0.18, 0.07] as Point3 },
        { position: [0.86, 0.04, -0.1] as Point3, scale: [1.82, 1.08, 0.6] as Point3, rotation: [0.01, 0.14, -0.06] as Point3 },
        { position: [0.04, -0.62, -0.22] as Point3, scale: [1.42, 0.42, 0.34] as Point3, rotation: [0.02, 0, 0] as Point3 },
      ].map((lobe, index) => (
        <mesh key={index} position={lobe.position} scale={lobe.scale} rotation={lobe.rotation}>
          <sphereGeometry args={[1, 56, 32]} />
          <meshBasicMaterial
            color={index === 2 ? config.shellAccent : config.shellColor}
            transparent
            opacity={(index === 2 ? 0.025 : 0.044) * safeOpacity * glowIntensity}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {particles.map((particle, index) => (
        <mesh key={index} position={particle.position}>
          <sphereGeometry args={[particle.radius, 10, 8]} />
          <meshBasicMaterial
            color={particle.color}
            transparent
            opacity={particle.opacity * 0.34 * safeOpacity}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {folds.map((fold, index) => (
        <Line
          key={index}
          points={fold.points}
          color={fold.color}
          transparent
          opacity={fold.opacity * safeOpacity}
          lineWidth={0.62}
        />
      ))}

      <group rotation={[Math.PI / 2, 0, 0]} position={[0, -1.02, -0.24]}>
        {[1.55, 2.18, 2.78].map((radius, index) => (
          <mesh key={radius}>
            <ringGeometry args={[radius, radius + 0.01, 160]} />
            <meshBasicMaterial
              color={index === 0 ? config.shellAccent : config.shellColor}
              transparent
              opacity={(0.042 - index * 0.009) * safeOpacity}
              side={DoubleSide}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function SignalField({
  particles,
  pulseSpeed,
  particleDensity,
}: {
  particles: BrainParticle[];
  pulseSpeed: number;
  particleDensity: number;
}) {
  const signalRef = useRef<Group | null>(null);

  useFrame(({ clock }) => {
    if (!signalRef.current) {
      return;
    }
    signalRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.1) * 0.035;
    signalRef.current.position.y = Math.sin(clock.elapsedTime * 0.18) * 0.035;
  });

  if (particleDensity <= 0) {
    return null;
  }

  return (
    <group ref={signalRef}>
      {particles.map((particle, index) => (
        <SignalParticle key={index} particle={particle} index={index} pulseSpeed={pulseSpeed} />
      ))}
    </group>
  );
}

function SignalParticle({
  particle,
  index,
  pulseSpeed,
}: {
  particle: BrainParticle;
  index: number;
  pulseSpeed: number;
}) {
  const meshRef = useRef<Mesh | null>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) {
      return;
    }
    const pulse = 0.68 + Math.sin(clock.elapsedTime * pulseSpeed * 0.9 + index * 1.7) * 0.18;
    meshRef.current.scale.setScalar(clamp(pulse, 0.35, 1.1));
  });

  return (
    <mesh ref={meshRef} position={particle.position}>
      <sphereGeometry args={[particle.radius, 8, 6]} />
      <meshBasicMaterial
        color={particle.color}
        transparent
        opacity={particle.opacity * 0.46}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function NeuralConnection({
  connection,
  index,
  opacity,
  pulseSpeed,
}: {
  connection: ConnectionCurve;
  index: number;
  opacity: number;
  pulseSpeed: number;
}) {
  const strength = clamp(connection.strength, 0, 1);
  const geometry = useMemo(
    () => new TubeGeometry(connection.curve, 56, 0.008 + strength * 0.006, 8, false),
    [connection.curve, strength],
  );
  const ghostPoints = useMemo(
    () => connection.curve.getPoints(22).map((point) => toPoint3(point)),
    [connection.curve],
  );

  return (
    <group>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color={connection.color}
          transparent
          opacity={(0.16 + strength * 0.22) * clamp(opacity, 0, 1.2)}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <Line
        points={ghostPoints}
        color={connection.color}
        transparent
        opacity={(0.08 + strength * 0.16) * clamp(opacity, 0, 1.2)}
        lineWidth={0.42}
      />
      {strength > 0.28 && (
        <ConnectionPulse
          curve={connection.curve}
          color={connection.color}
          index={index}
          strength={strength}
          pulseSpeed={pulseSpeed}
          opacity={opacity}
        />
      )}
    </group>
  );
}

function ConnectionPulse({
  curve,
  color,
  index,
  strength,
  pulseSpeed,
  opacity,
}: {
  curve: CatmullRomCurve3;
  color: string;
  index: number;
  strength: number;
  pulseSpeed: number;
  opacity: number;
}) {
  const pulseRef = useRef<Mesh | null>(null);

  useFrame(({ clock }) => {
    if (!pulseRef.current) {
      return;
    }
    const t = (clock.elapsedTime * pulseSpeed * (0.035 + strength * 0.03) + index * 0.21) % 1;
    pulseRef.current.position.copy(curve.getPointAt(t));
    pulseRef.current.scale.setScalar(0.82 + Math.sin(t * Math.PI) * 0.4);
  });

  return (
    <mesh ref={pulseRef}>
      <sphereGeometry args={[0.034 + strength * 0.018, 14, 10]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.48 * strength * clamp(opacity, 0, 1.2)}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function CognitiveRegion({
  region,
  index,
  glowIntensity,
  pulseSpeed,
}: {
  region: PositionedRegion;
  index: number;
  glowIntensity: number;
  pulseSpeed: number;
}) {
  const regionRef = useRef<Group | null>(null);
  const microNeurons = useMemo(() => buildMicroNeurons(region, index), [region, index]);
  const confidence = region.confidenceClamped;
  const activity = region.activityClamped;
  const haloOpacity = (0.035 + activity * 0.06) * confidence * glowIntensity;
  const coreOpacity = 0.58 + confidence * 0.34;
  const labelBias = REGION_LABEL_BIAS[region.id] ?? [0, 1, 0];
  const labelPosition: Point3 = [
    labelBias[0],
    labelBias[1] > 0
      ? region.radius * (1.2 + labelBias[1] * 0.3) + 0.28
      : region.radius * labelBias[1] - 0.24,
    labelBias[2],
  ];

  useFrame(({ clock }) => {
    if (!regionRef.current) {
      return;
    }
    const pulse = 1 + Math.sin(clock.elapsedTime * pulseSpeed * (0.58 + activity * 0.72) + index * 0.78) * (0.012 + activity * 0.052);
    regionRef.current.scale.setScalar(pulse);
  });

  return (
    <group ref={regionRef} position={region.position}>
      <mesh>
        <sphereGeometry args={[region.radius * (2.15 + activity * 0.82), 40, 28]} />
        <meshBasicMaterial
          color={region.haloColor}
          transparent
          opacity={haloOpacity}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={[1.34, 0.88, 0.72]}>
        <sphereGeometry args={[region.radius * 1.16, 44, 28]} />
        <meshStandardMaterial
          color={region.color}
          emissive={region.color}
          emissiveIntensity={(0.2 + activity * 0.36) * glowIntensity}
          roughness={0.44 + (1 - confidence) * 0.28}
          metalness={0.1}
          transparent
          opacity={coreOpacity}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[region.radius * 0.32, 24, 18]} />
        <meshBasicMaterial
          color="#f2fbff"
          transparent
          opacity={(0.16 + activity * 0.18) * confidence}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {microNeurons.map((neuron, neuronIndex) => (
        <mesh key={neuronIndex} position={neuron.position}>
          <sphereGeometry args={[neuron.radius, 8, 6]} />
          <meshBasicMaterial
            color={neuron.color}
            transparent
            opacity={neuron.opacity * confidence}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      <Html
        position={labelPosition}
        center
        distanceFactor={8.2}
        style={{
          color: region.performance === "unknown" ? "#d6e0ea" : "#eef8ff",
          fontSize: 12,
          lineHeight: "14px",
          letterSpacing: 0,
          whiteSpace: "nowrap",
          textShadow: "0 1px 10px rgba(0, 0, 0, 0.92), 0 0 12px rgba(143, 191, 255, 0.35)",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <span
          style={{
            padding: "1px 4px",
            borderRadius: 4,
            background: "rgba(2, 5, 11, 0.18)",
          }}
        >
          {region.label}
        </span>
      </Html>
    </group>
  );
}

function buildMicroNeurons(region: PositionedRegion, regionIndex: number): BrainParticle[] {
  const count = Math.round(8 + region.weight * 10 + region.activityClamped * 6);
  const neurons: BrainParticle[] = [];

  for (let i = 0; i < count; i += 1) {
    const theta = seeded(i + regionIndex * 41, 31) * Math.PI * 2;
    const phi = Math.acos(2 * seeded(i + regionIndex * 41, 32) - 1);
    const distance = region.radius * (1.05 + seeded(i + regionIndex * 41, 33) * 0.78);
    neurons.push({
      position: [
        Math.sin(phi) * Math.cos(theta) * distance * 1.34,
        Math.cos(phi) * distance * 0.88,
        Math.sin(phi) * Math.sin(theta) * distance * 0.72,
      ],
      radius: region.radius * (0.036 + seeded(i + regionIndex * 41, 34) * 0.03),
      opacity: 0.22 + seeded(i + regionIndex * 41, 35) * 0.32,
      color: new Color(region.color).lerp(new Color("#f3fbff"), 0.24 + seeded(i, 36) * 0.18).getStyle(),
    });
  }

  return neurons;
}

function BrainLegend() {
  const items = [
    { color: PERFORMANCE_COLORS.strong, label: "Couleur = performance" },
    { color: "#dce8ff", label: "Taille = importance" },
    { color: PERFORMANCE_COLORS.fragile, label: "Pulsation = priorite" },
    { color: "#a8cfff", label: "Lien = relation" },
  ];

  return (
    <div
      style={{
        position: "absolute",
        left: 18,
        bottom: 16,
        display: "grid",
        gap: 7,
        padding: "11px 12px",
        color: "rgba(232, 243, 255, 0.82)",
        fontSize: 11,
        letterSpacing: 0,
        background: "rgba(3, 7, 14, 0.46)",
        border: "1px solid rgba(190, 220, 255, 0.12)",
        borderRadius: 8,
        backdropFilter: "blur(10px)",
        pointerEvents: "none",
      }}
    >
      {items.map((item) => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: item.color,
              boxShadow: `0 0 12px ${item.color}`,
            }}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyAtlas({ height, config }: { height: number; config: VariantConfig }) {
  return (
    <div
      style={{
        ...containerStyle(height, config),
        display: "grid",
        placeItems: "center",
        color: "#d7e4f2",
      }}
      role="img"
      aria-label="Profil cognitif indisponible"
    >
      <div style={{ textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 14, letterSpacing: 0, opacity: 0.9 }}>Profil cognitif indisponible</div>
        <div style={{ marginTop: 10, fontSize: 12, letterSpacing: 0, opacity: 0.54 }}>
          Atlas mental en attente de signaux qualitatifs.
        </div>
      </div>
    </div>
  );
}

function containerStyle(height: number, config: VariantConfig): CSSProperties {
  return {
    width: "100%",
    height,
    minHeight: 320,
    overflow: "hidden",
    position: "relative",
    borderRadius: 18,
    background: config.panelBackground,
    boxShadow:
      "inset 0 0 0 1px rgba(190, 220, 255, 0.11), inset 0 -90px 120px rgba(0, 0, 0, 0.28), 0 34px 94px rgba(0, 0, 0, 0.42)",
  };
}

export function NeuroBrainAtlas3D({
  regions,
  connections,
  height = 520,
  variant = "calm",
  showLegend = true,
  interactive = false,
}: NeuroBrainAtlas3DProps) {
  const tuning = useContext(TuningContext);
  const safeVariant = VARIANT_CONFIG[variant] ? variant : "calm";
  const config = VARIANT_CONFIG[safeVariant];
  const safeRegions = Array.isArray(regions)
    ? regions.filter((region) => region.id && region.label)
    : [];
  const safeConnections = Array.isArray(connections) ? connections : [];

  if (safeRegions.length === 0) {
    return <EmptyAtlas height={height} config={config} />;
  }

  return (
    <div style={containerStyle(height, config)} role="img" aria-label="Atlas cognitif cerebral 3D NeuroChess">
      <Canvas
        camera={{ position: [0, 0.58, tuning.cameraDistance], fov: 38 }}
        dpr={[1, 1.65]}
        fallback={<div style={{ color: "#d7e4f2", padding: 24 }}>Rendu 3D indisponible</div>}
      >
        <NeuroBrainAtlasScene
          regions={safeRegions}
          connections={safeConnections}
          variant={safeVariant}
          interactive={interactive}
        />
      </Canvas>
      {showLegend && <BrainLegend />}
    </div>
  );
}
