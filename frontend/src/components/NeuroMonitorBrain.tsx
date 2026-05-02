import type { CSSProperties, KeyboardEvent } from "react";

export type NeuroMonitorDomainKey =
  | "opening"
  | "tactical"
  | "conversion"
  | "defense";

export type NeuroMonitorTone =
  | "stable"
  | "watch"
  | "critical"
  | "analysis"
  | "neutral";

export type NeuroMonitorDomain = {
  key: NeuroMonitorDomainKey;
  label: string;
  tone: NeuroMonitorTone;
  intensity: number;
  summary: string;
};

export type NeuroMonitorSignal = {
  key: string;
  label: string;
  value: string;
  tone: NeuroMonitorTone;
  intensity: number;
};

export type NeuroMonitorBranch = {
  available: boolean;
  visible?: boolean;
  label: string;
  preview?: string;
  tone: NeuroMonitorTone;
  intensity: number;
  onSelect?: () => void;
};

export type NeuroMonitorOpeningAction = {
  available: boolean;
  label: string;
  tone: NeuroMonitorTone;
  onSelect?: () => void;
};

type NeuroMonitorBrainProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  modeLabel?: string;
  domains: NeuroMonitorDomain[];
  signals: NeuroMonitorSignal[];
  activeDomainKey?: NeuroMonitorDomainKey | null;
  concept?: boolean;
  compact?: boolean;
  onDomainSelect?: (domain: NeuroMonitorDomainKey) => void;
  playedBranch?: NeuroMonitorBranch;
  solutionBranch?: NeuroMonitorBranch;
  openingExit?: NeuroMonitorOpeningAction;
  openingLinkedMoment?: NeuroMonitorOpeningAction;
};

const DOMAIN_POINTS: Record<NeuroMonitorDomainKey, { x: number; y: number }> = {
  opening: { x: 134, y: 104 },
  tactical: { x: 270, y: 62 },
  conversion: { x: 418, y: 112 },
  defense: { x: 260, y: 202 },
};

const BRAIN_NODES = [
  [122, 178],
  [166, 102],
  [220, 226],
  [276, 86],
  [342, 176],
  [404, 78],
  [476, 178],
  [530, 124],
] as const;

export function NeuroMonitorBrain({
  eyebrow = "Neuro-Monitor",
  title,
  subtitle,
  modeLabel,
  domains,
  signals,
  activeDomainKey,
  concept = false,
  compact = false,
  onDomainSelect,
  playedBranch,
  solutionBranch,
  openingExit,
  openingLinkedMoment,
}: NeuroMonitorBrainProps) {
  const normalizedSignals = signals.slice(0, 4);
  const normalizedDomains = domains.length ? domains : fallbackDomains();
  const strongest = normalizedDomains
    .slice()
    .sort((left, right) => right.intensity - left.intensity)[0];
  const activeDomain =
    normalizedDomains.find((domain) => domain.key === activeDomainKey) ??
    strongest ??
    null;
  const brainTone = activeDomain?.tone ?? "analysis";

  return (
    <section
      className={`neuro-monitor-brain neuro-monitor-${brainTone} ${
        compact ? "compact" : ""
      }`}
      data-neuro-monitor-brain="true"
      data-neuro-monitor-concept={concept ? "true" : "false"}
      aria-label={`${title}. ${subtitle}`}
    >
      <div className="neuro-monitor-copy">
        <span className="neuro-monitor-eyebrow">{eyebrow}</span>
        <strong>{title}</strong>
        <p>{subtitle}</p>
        {modeLabel && <span className="neuro-monitor-mode">{modeLabel}</span>}
      </div>

      <div className="neuro-monitor-stage">
        <svg
          className="neuro-brain-visual"
          viewBox="0 0 680 320"
          role="img"
          aria-label="Cerveau neuronal connecté à la partie"
        >
          <defs>
            <filter id="neuro-monitor-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="neuro-monitor-stroke" x1="0%" x2="100%">
              <stop offset="0%" stopColor="#00e5ff" />
              <stop offset="55%" stopColor="#30f2a4" />
              <stop offset="100%" stopColor="#7b61ff" />
            </linearGradient>
            <linearGradient id="neuro-monitor-risk" x1="0%" x2="100%">
              <stop offset="0%" stopColor="#f9b44c" />
              <stop offset="100%" stopColor="#ff4c78" />
            </linearGradient>
          </defs>

          <path
            className="neuro-brain-aura"
            d="M78 170C82 65 186 36 270 62c48-44 158-32 190 28 90 5 142 70 122 142-28 102-160 82-214 52-82 52-282 26-290-114Z"
          />
          <path
            className="neuro-brain-shell"
            d="M96 166C103 75 192 56 258 78c40-44 139-31 164 22 78 2 128 59 112 118-23 84-128 68-178 42-70 44-250 21-260-94Z"
          />
          <path
            className="neuro-brain-link primary"
            d="M118 170C178 96 238 226 304 132S410 88 526 184"
          />
          <path
            className="neuro-brain-link secondary"
            d="M146 108C238 54 302 246 404 166C456 126 486 102 548 132"
          />
          <path
            className="neuro-brain-link tertiary"
            d="M138 222C226 154 250 72 356 92S454 228 536 210"
          />

          {BRAIN_NODES.map(([cx, cy], index) => (
            <circle
              className="neuro-brain-node"
              cx={cx}
              cy={cy}
              key={`${cx}-${cy}`}
              r={index % 3 === 0 ? 5.5 : 4}
            />
          ))}

          {normalizedDomains.map((domain) => {
            const point = DOMAIN_POINTS[domain.key];
            const active = activeDomain?.key === domain.key;
            const radius = 10 + Math.max(0.1, domain.intensity) * 10;
            return (
              <g key={domain.key}>
                <path
                  className={`neuro-brain-domain-link neuro-tone-${domain.tone}`}
                  d={`M330 158 C${point.x + 20} ${point.y + 28}, ${point.x} ${point.y}, ${point.x} ${point.y}`}
                />
                <g
                  className={`neuro-brain-domain ${
                    active ? "active" : ""
                  } neuro-tone-${domain.tone}`}
                  role={onDomainSelect ? "button" : "img"}
                  tabIndex={onDomainSelect ? 0 : -1}
                  aria-label={`${domain.label} : ${domain.summary}`}
                  onClick={() => onDomainSelect?.(domain.key)}
                  onKeyDown={(event) =>
                    handleSvgKey(event, () => onDomainSelect?.(domain.key))
                  }
                >
                  <circle cx={point.x} cy={point.y} r={radius} />
                  <text x={point.x} y={point.y + 31} textAnchor="middle">
                    {domain.label}
                  </text>
                </g>
              </g>
            );
          })}

          <g className="neuro-brain-board" aria-hidden="true">
            <path className="neuro-brain-board-link" d="M524 160C570 144 590 144 622 160" />
            <rect x="598" y="108" width="58" height="58" rx="8" />
            <path d="M612.5 108v58M627 108v58M641.5 108v58M598 122.5h58M598 137h58M598 151.5h58" />
            <circle cx="612.5" cy="122.5" r="3.8" />
            <circle cx="641.5" cy="151.5" r="3.8" />
          </g>

          <NeuroMonitorBranchPath
            branch={playedBranch}
            d="M346 160C414 132 496 112 600 74"
            nodeX={604}
            nodeY={74}
            labelY={53}
          />
          <NeuroMonitorBranchPath
            branch={solutionBranch}
            d="M346 172C422 226 496 236 612 214"
            nodeX={616}
            nodeY={214}
            labelY={246}
          />

          {openingExit?.available && (
            <NeuroMonitorActionNode
              action={openingExit}
              x={584}
              y={154}
              labelY={184}
            />
          )}
          {openingLinkedMoment?.available && (
            <NeuroMonitorActionNode
              action={openingLinkedMoment}
              x={628}
              y={190}
              labelY={220}
            />
          )}
        </svg>
      </div>

      <div className="neuro-monitor-stats" aria-label="Indicateurs Neuro-Monitor">
        {normalizedSignals.map((signal) => (
          <div
            className={`neuro-monitor-stat neuro-tone-${signal.tone}`}
            key={signal.key}
            style={
              {
                "--signal-level": Math.max(0, Math.min(1, signal.intensity)),
              } as CSSProperties
            }
          >
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function NeuroMonitorBranchPath({
  branch,
  d,
  nodeX,
  nodeY,
  labelY,
}: {
  branch?: NeuroMonitorBranch;
  d: string;
  nodeX: number;
  nodeY: number;
  labelY: number;
}) {
  if (!branch?.available) {
    return null;
  }
  const visible = branch.visible ?? true;
  return (
    <g
      className={`neuro-brain-branch neuro-tone-${branch.tone} ${
        visible ? "" : "hidden"
      }`}
      role={branch.onSelect && visible ? "button" : "img"}
      tabIndex={branch.onSelect && visible ? 0 : -1}
      aria-label={`${branch.label}${branch.preview ? ` : ${branch.preview}` : ""}`}
      onClick={() => {
        if (visible) {
          branch.onSelect?.();
        }
      }}
      onKeyDown={(event) =>
        visible ? handleSvgKey(event, () => branch.onSelect?.()) : undefined
      }
    >
      <path d={d} style={{ strokeWidth: 2 + branch.intensity * 4 }} />
      <circle cx={nodeX} cy={nodeY} r={visible ? 11 : 8} />
      <text x={nodeX} y={labelY} textAnchor="middle">
        {branch.label}
      </text>
    </g>
  );
}

function NeuroMonitorActionNode({
  action,
  x,
  y,
  labelY,
}: {
  action: NeuroMonitorOpeningAction;
  x: number;
  y: number;
  labelY: number;
}) {
  return (
    <g
      className={`neuro-brain-action neuro-tone-${action.tone}`}
      role={action.onSelect ? "button" : "img"}
      tabIndex={action.onSelect ? 0 : -1}
      aria-label={action.label}
      onClick={() => action.onSelect?.()}
      onKeyDown={(event) => handleSvgKey(event, () => action.onSelect?.())}
    >
      <circle cx={x} cy={y} r="10" />
      <text x={x} y={labelY} textAnchor="middle">
        {action.label}
      </text>
    </g>
  );
}

function handleSvgKey(event: KeyboardEvent<SVGGElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function fallbackDomains(): NeuroMonitorDomain[] {
  return [
    {
      key: "opening",
      label: "Ouverture",
      tone: "neutral",
      intensity: 0.18,
      summary: "en attente",
    },
    {
      key: "tactical",
      label: "Tactique",
      tone: "neutral",
      intensity: 0.18,
      summary: "en attente",
    },
    {
      key: "conversion",
      label: "Conversion",
      tone: "neutral",
      intensity: 0.18,
      summary: "en attente",
    },
    {
      key: "defense",
      label: "Défense",
      tone: "neutral",
      intensity: 0.18,
      summary: "en attente",
    },
  ];
}
