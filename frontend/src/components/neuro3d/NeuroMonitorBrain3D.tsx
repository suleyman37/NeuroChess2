import { useEffect, useId, useMemo, useState } from "react";
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

type NeuroMonitorBrain3DProps = {
  data?: NeuroMonitorBrainData | null;
  compact?: boolean;
  className?: string;
  onDomainClick?: (domain: BrainDomainKey) => void;
};

export function NeuroMonitorBrain3D({
  data,
  compact = false,
  className = "",
  onDomainClick,
}: NeuroMonitorBrain3DProps) {
  const gradientId = useId().replace(/:/g, "");
  const [hoveredDomain, setHoveredDomain] = useState<BrainDomainKey | null>(null);
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);
  const brainData = useMemo(() => normalizeBrainData(data), [data]);
  const visuals = useMemo(() => buildBrainDomainVisuals(brainData), [brainData]);
  const priorityDomain =
    visuals.find((domain) => domain.key === brainData.priorityDomain) ??
    visuals.find((domain) => domain.priority) ??
    visuals.slice().sort((left, right) => left.score - right.score)[0];
  const activeDomain =
    visuals.find((domain) => domain.key === hoveredDomain) ?? priorityDomain ?? visuals[0];

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
          <NeuroBrainStage
            domains={visuals}
            activeDomainKey={activeDomain?.key ?? null}
            gradientId={gradientId}
            onHover={setHoveredDomain}
            onSelect={handleDomainSelect}
          />
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

export { demoNeuroMonitorBrainData };
export type { BrainDomainKey, NeuroMonitorBrainData };

export default NeuroMonitorBrain3D;
