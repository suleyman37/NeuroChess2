import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import "./NeuroMonitorBrain3D.css";
import {
  buildBrainDomainVisuals,
  normalizeBrainData,
} from "./neuroBrainVisualModel";
import {
  demoNeuroMonitorBrainData,
  type BrainDomainKey,
  type BrainDomainVisual,
  type NeuroMonitorBrainData,
} from "./neuroBrainTypes";
import {
  NeuroBrainAtlas3D,
  type BrainConnection,
  type BrainDomainId,
  type BrainDomainRegion,
  type BrainPerformanceLevel,
} from "../visual/NeuroBrainAtlas3D";

type NeuroMonitorBrain3DProps = {
  data?: NeuroMonitorBrainData | null;
  compact?: boolean;
  className?: string;
  onDomainClick?: (domain: BrainDomainKey) => void;
};

const ATLAS_CONNECTIONS: BrainConnection[] = [
  { source: "opening", target: "tactics", strength: 0.72 },
  { source: "tactics", target: "calculation", strength: 0.84 },
  { source: "calculation", target: "conversion", strength: 0.68 },
  { source: "defense", target: "planning", strength: 0.66 },
  { source: "planning", target: "conversion", strength: 0.58 },
  { source: "tactics", target: "defense", strength: 0.48 },
];

export function NeuroMonitorBrain3D({
  data,
  compact = false,
  className = "",
  onDomainClick,
}: NeuroMonitorBrain3DProps) {
  const [hoveredDomain, setHoveredDomain] = useState<BrainDomainKey | null>(null);
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);
  const brainData = useMemo(() => normalizeBrainData(data), [data]);
  const visuals = useMemo(() => buildBrainDomainVisuals(brainData), [brainData]);
  const atlasRegions = useMemo(() => buildAtlasRegions(visuals), [visuals]);
  const priorityDomain =
    visuals.find((domain) => domain.key === brainData.priorityDomain) ??
    visuals.find((domain) => domain.priority) ??
    visuals.slice().sort((left, right) => left.score - right.score)[0];
  const activeDomain =
    visuals.find((domain) => domain.key === hoveredDomain) ?? priorityDomain ?? visuals[0];
  const atlasVariant = atlasVariantFor(priorityDomain, atlasRegions);

  useEffect(() => {
    setWebglAvailable(detectWebGlSupport());
  }, []);

  function handleDomainSelect(domain: BrainDomainKey) {
    onDomainClick?.(domain);
  }

  return (
    <section
      className={`neuro3d-shell ${compact ? "compact" : "large"} ${
        webglAvailable === false ? "webgl-fallback" : "webgl-ready"
      } ${className}`}
      data-neuro-monitor-brain3d="true"
      data-neuro3d-fallback={webglAvailable === false ? "true" : "false"}
      aria-label="NeuroMonitor Brain 3D"
    >
      <div className="neuro3d-header">
        <div>
          <span className="neuro3d-eyebrow">NEUROMONITOR</span>
          <strong>Carte cognitive</strong>
          <p>{brainData.summary}</p>
        </div>
        <div className="neuro3d-score">
          <span>Score coach</span>
          <strong>
            {brainData.overallLabel ?? "NeuroChess"} {brainData.overallScore} / 100
          </strong>
        </div>
      </div>

      <div className="neuro3d-body">
        {webglAvailable === false ? (
          <NeuroBrainFallbackMap
            domains={visuals}
            activeDomainKey={activeDomain?.key ?? null}
            onHover={setHoveredDomain}
            onSelect={handleDomainSelect}
          />
        ) : (
          <div className="neuro3d-stage neuro3d-atlas-stage" data-neuro-brain-atlas-monitor="true">
            <NeuroBrainAtlas3D
              regions={atlasRegions}
              connections={ATLAS_CONNECTIONS}
              height={compact ? 240 : 340}
              variant={atlasVariant}
              showLegend={!compact}
              interactive={false}
            />
          </div>
        )}

        <aside className="neuro3d-domain-panel" aria-label="Domaines cognitifs">
          {visuals.map((domain) => (
            <button
              key={domain.key}
              type="button"
              className={`neuro3d-domain-card ${
                activeDomain?.key === domain.key ? "active" : ""
              }`}
              style={domainStyle(domain)}
              onMouseEnter={() => setHoveredDomain(domain.key)}
              onMouseLeave={() => setHoveredDomain(null)}
              onFocus={() => setHoveredDomain(domain.key)}
              onBlur={() => setHoveredDomain(null)}
              onClick={() => handleDomainSelect(domain.key)}
            >
              <span>{domain.label}</span>
              <strong>{domain.status}</strong>
              <em>Indice heuristique</em>
              <i aria-hidden="true" />
            </button>
          ))}
        </aside>
      </div>

      <div className="neuro3d-action-band">
        <span>
          Priorité : <strong>{priorityDomain?.label ?? "À déterminer"}</strong>
        </span>
        <span>
          Exercice recommandé :{" "}
          <strong>{brainData.recommendedExerciseLabel ?? "session courte"}</strong>
        </span>
        <button
          type="button"
          onClick={() => {
            if (priorityDomain) {
              handleDomainSelect(priorityDomain.key);
            }
          }}
        >
          Voir la leçon
        </button>
      </div>

      <p className="neuro3d-note">
        Carte cognitive exploratoire — les domaines seront affinés avec plus de données. Elle ne mesure pas une activité neurologique réelle.
      </p>
    </section>
  );
}

function NeuroBrainStage({
  domains,
  activeDomainKey,
  gradientId,
  onHover,
  onSelect,
}: {
  domains: BrainDomainVisual[];
  activeDomainKey: BrainDomainKey | null;
  gradientId: string;
  onHover: (domain: BrainDomainKey | null) => void;
  onSelect: (domain: BrainDomainKey) => void;
}) {
  return (
    <div className="neuro3d-stage" aria-label="Cerveau pseudo-3D interactif">
      <svg className="neuro3d-visual" viewBox="0 0 660 360" role="img">
        <defs>
          <filter id={`${gradientId}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={`${gradientId}-core`} cx="45%" cy="42%" r="64%">
            <stop offset="0%" stopColor="#102758" />
            <stop offset="56%" stopColor="#07132d" />
            <stop offset="100%" stopColor="#020610" />
          </radialGradient>
        </defs>

        <ellipse className="neuro3d-aura" cx="326" cy="178" rx="276" ry="142" />
        <path
          className="neuro3d-brain-shell"
          d="M78 182C80 78 186 42 270 68c50-45 164-34 196 28 83 2 142 57 132 124-13 91-126 105-218 60-75 46-188 39-254 4-36-19-50-54-48-102Z"
          fill={`url(#${gradientId}-core)`}
        />

        <path className="neuro3d-synapse main" d="M112 190C182 86 248 254 326 146s148-42 222 48" />
        <path className="neuro3d-synapse secondary" d="M136 118C226 42 306 232 414 138c48-42 80-48 126-22" />
        <path className="neuro3d-synapse tertiary" d="M134 252C220 176 260 68 374 92s104 168 202 126" />

        {domains.map((domain) => (
          <BrainDomainNode
            key={domain.key}
            domain={domain}
            active={activeDomainKey === domain.key}
            onHover={onHover}
            onSelect={onSelect}
          />
        ))}

        <g className="neuro3d-mesh" aria-hidden="true">
          {domains.map((domain, index) => {
            const next = domains[(index + 1) % domains.length];
            return (
              <path
                key={`${domain.key}-${next.key}`}
                d={`M${domain.position.x} ${domain.position.y} C318 176, 342 174, ${next.position.x} ${next.position.y}`}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function BrainDomainNode({
  domain,
  active,
  onHover,
  onSelect,
}: {
  domain: BrainDomainVisual;
  active: boolean;
  onHover: (domain: BrainDomainKey | null) => void;
  onSelect: (domain: BrainDomainKey) => void;
}) {
  const { x, y, rx, ry, rotate } = domain.position;
  return (
    <g
      className={`neuro3d-domain-node ${active ? "active" : ""}`}
      style={domainStyle(domain)}
      role="button"
      tabIndex={0}
      aria-label={`${domain.label} : ${domain.status}, indice heuristique`}
      onMouseEnter={() => onHover(domain.key)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(domain.key)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(domain.key)}
      onKeyDown={(event) => handleNodeKey(event, () => onSelect(domain.key))}
    >
      <ellipse
        cx={x}
        cy={y}
        rx={rx}
        ry={ry}
        transform={`rotate(${rotate} ${x} ${y})`}
      />
      <circle cx={x} cy={y} r={9 + (100 - domain.score) * 0.06} />
      <text x={x} y={y + ry + 24} textAnchor="middle">
        {domain.label}
      </text>
      <text className="neuro3d-node-score" x={x} y={y + ry + 42} textAnchor="middle">
        {compactDomainStatus(domain.status)}
      </text>
    </g>
  );
}

function NeuroBrainFallbackMap({
  domains,
  activeDomainKey,
  onHover,
  onSelect,
}: {
  domains: BrainDomainVisual[];
  activeDomainKey: BrainDomainKey | null;
  onHover: (domain: BrainDomainKey | null) => void;
  onSelect: (domain: BrainDomainKey) => void;
}) {
  return (
    <div className="neuro3d-fallback-map" aria-label="Fallback NeuroMonitor 2D">
      {domains.map((domain) => (
        <button
          key={domain.key}
          type="button"
          className={`neuro3d-fallback-node ${
            activeDomainKey === domain.key ? "active" : ""
          }`}
          style={domainStyle(domain)}
          onMouseEnter={() => onHover(domain.key)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(domain.key)}
          onBlur={() => onHover(null)}
          onClick={() => onSelect(domain.key)}
        >
          <span>{domain.label}</span>
          <strong>{domain.status}</strong>
        </button>
      ))}
    </div>
  );
}

function domainStyle(domain: BrainDomainVisual): CSSProperties {
  return {
    "--neuro3d-color": domain.color,
    "--neuro3d-fill": domain.fill,
    "--neuro3d-glow": domain.glow,
    "--neuro3d-pulse": `${domain.pulse}s`,
    "--neuro3d-activity": domain.activity,
  } as CSSProperties;
}

function compactDomainStatus(status: string): string {
  return status === "Profil en construction" ? "Profil" : status;
}

function handleNodeKey(event: KeyboardEvent<SVGGElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function detectWebGlSupport(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

function buildAtlasRegions(domains: BrainDomainVisual[]): BrainDomainRegion[] {
  const byKey = new Map(domains.map((domain) => [domain.key, domain]));
  const opening = byKey.get("opening");
  const tactics = byKey.get("tactical");
  const conversion = byKey.get("conversion");
  const defense = byKey.get("defense");
  const planning = byKey.get("plan");
  const calculation = blendAtlasRegion("calculation", "Calculation", [
    [tactics, 0.62],
    [conversion, 0.24],
    [planning, 0.14],
  ]);

  return [
    domainToAtlasRegion(opening, "opening", "Opening"),
    domainToAtlasRegion(tactics, "tactics", "Tactics"),
    calculation,
    domainToAtlasRegion(conversion, "conversion", "Conversion"),
    domainToAtlasRegion(defense, "defense", "Defense"),
    domainToAtlasRegion(planning, "planning", "Planning"),
  ];
}

function domainToAtlasRegion(
  domain: BrainDomainVisual | undefined,
  id: BrainDomainId,
  label: string,
): BrainDomainRegion {
  if (!domain) {
    return {
      id,
      label,
      performance: "unknown",
      weight: 0.42,
      activity: 0.16,
      confidence: 0.34,
    };
  }

  const performance = atlasPerformanceFromDomain(domain);
  const priorityBoost = domain.priority ? 0.2 : 0;
  const weaknessBoost = (100 - domain.score) / 100 * 0.18;
  return {
    id,
    label,
    performance,
    weight: clampAtlas01(0.42 + priorityBoost + weaknessBoost),
    activity:
      performance === "unknown"
        ? 0.18
        : clampAtlas01(0.2 + domain.activity * 0.58 + priorityBoost),
    confidence: atlasConfidence(domain, performance),
  };
}

function blendAtlasRegion(
  id: BrainDomainId,
  label: string,
  sources: Array<[BrainDomainVisual | undefined, number]>,
): BrainDomainRegion {
  const available = sources.filter(
    (source): source is [BrainDomainVisual, number] => Boolean(source[0]),
  );
  if (available.length === 0) {
    return domainToAtlasRegion(undefined, id, label);
  }

  const totalWeight = available.reduce((sum, [, weight]) => sum + weight, 0);
  const blendedScore = available.reduce(
    (sum, [domain, weight]) => sum + domain.score * weight,
    0,
  ) / totalWeight;
  const activity = available.reduce(
    (max, [domain]) => Math.max(max, domain.activity),
    0,
  );
  const priority = available.some(([domain]) => domain.priority);
  const synthetic: BrainDomainVisual = {
    ...available[0][0],
    key: available[0][0].key,
    label,
    score: Math.round(blendedScore),
    priority,
    activity,
    statusLabel: undefined,
    status: "",
  };

  return domainToAtlasRegion(synthetic, id, label);
}

function atlasPerformanceFromDomain(domain: BrainDomainVisual): BrainPerformanceLevel {
  const status = domain.status.toLowerCase();
  if (status.includes("construction") || status.includes("preciser")) {
    return "unknown";
  }
  if (domain.score >= 78) {
    return "strong";
  }
  if (domain.score >= 60) {
    return "stable";
  }
  if (domain.score >= 36) {
    return "fragile";
  }
  return "weak";
}

function atlasConfidence(
  domain: BrainDomainVisual,
  performance: BrainPerformanceLevel,
): number {
  if (performance === "unknown") {
    return 0.38;
  }
  return clampAtlas01(0.54 + domain.score / 240);
}

function atlasVariantFor(
  priorityDomain: BrainDomainVisual | undefined,
  regions: BrainDomainRegion[],
): "calm" | "analysis" | "high-risk" | "construction" {
  if (regions.filter((region) => region.performance === "unknown").length >= 3) {
    return "construction";
  }
  if (regions.some((region) => region.performance === "weak" && region.activity > 0.55)) {
    return "high-risk";
  }
  if ((priorityDomain?.activity ?? 0) > 0.58) {
    return "analysis";
  }
  return "calm";
}

function clampAtlas01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

export { demoNeuroMonitorBrainData };
export type { BrainDomainKey, NeuroMonitorBrainData };

export default NeuroMonitorBrain3D;
