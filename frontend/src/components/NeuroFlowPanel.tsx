import { useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import type {
  OpeningRealityEvidence,
  ReviewMoveAnnotation,
  ReviewPracticeItem,
  ReviewResponse,
} from "../api/client";
import {
  NeuroMonitorBrain,
  type NeuroMonitorDomain,
  type NeuroMonitorSignal,
  type NeuroMonitorTone,
} from "./NeuroMonitorBrain";
import type { ReviewPvLineMode } from "./ReviewPanel";

type NeuroFlowMode = "summary" | "learn" | "lab" | "practice" | "compare";
type NeuroFlowDomainKey = "opening" | "tactical" | "conversion" | "defense";
type NeuroFlowDomainStatus =
  | "stable"
  | "fragile"
  | "critical"
  | "unknown"
  | "not_applicable";
type NeuroFlowRevealState =
  | "hidden"
  | "hint_shown"
  | "attempted"
  | "played_move_shown"
  | "solution_revealed"
  | "pv_line"
  | string;

export type NeuroFlowState = {
  mode: NeuroFlowMode;
  activeDomain: NeuroFlowDomainKey | null;
  domains: Record<
    NeuroFlowDomainKey,
    {
      label: string;
      status: NeuroFlowDomainStatus;
      severity: number;
      count: number;
      summary: string;
    }
  >;
  currentMoment: {
    ply: number | null;
    errorType: string | null;
    impact: number;
    impactLabel: string;
    revealState: NeuroFlowRevealState;
    solutionVisible: boolean;
  };
  branches: {
    played: {
      available: boolean;
      label: string;
      movesPreview: string;
      severity: number;
      colorToken: "warning" | "critical";
    };
    solution: {
      available: boolean;
      label: string;
      movesPreview: string;
      strength: number;
      colorToken: "solution";
    };
  };
  opening: {
    available: boolean;
    lastBookPly: number | null;
    exitPly: number | null;
    exitMoveSan: string | null;
    hasLinkedMoment: boolean;
    linkedMomentSeverity: number;
  };
};

type NeuroFlowSolutionRevealState = {
  ply: number | null;
  state: NeuroFlowRevealState;
} | null;

type NeuroFlowTryMoveState = {
  active: boolean;
  annotationPly: number | null;
  feedback: { result: string; message: string; show_best_move?: boolean } | null;
  solutionRevealed: boolean;
} | null;

type NeuroFlowPracticeState = {
  active: boolean;
  status: "starting" | "running" | "completed" | string;
  itemState: string;
  items: ReviewPracticeItem[];
  currentIndex: number;
  feedback: { result: string; message: string } | null;
  solutionRevealed: boolean;
  summary?: {
    result_by_ply?: Record<string, string>;
  } | null;
} | null;

type NeuroFlowPanelProps = {
  review: ReviewResponse | null;
  focusKey: string;
  selectedAnnotation: ReviewMoveAnnotation | null;
  selectedAnnotationIndex: number | null;
  solutionRevealState: NeuroFlowSolutionRevealState;
  tryMoveState: NeuroFlowTryMoveState;
  practiceState: NeuroFlowPracticeState;
  onFocusChange: (focus: string) => void;
  onShowAnnotation: (
    annotation: ReviewMoveAnnotation,
    index: number,
    mode?: "before" | "played" | "best",
  ) => void;
  onShowOpeningExit: (evidence: OpeningRealityEvidence) => void;
  onShowOpeningLinkedMoment: (ply: number, evidence?: OpeningRealityEvidence) => void;
  onShowPvLineAnnotation: (
    annotation: ReviewMoveAnnotation,
    index: number,
    lineMode?: ReviewPvLineMode,
  ) => void;
};

const DOMAIN_ORDER: NeuroFlowDomainKey[] = [
  "opening",
  "tactical",
  "conversion",
  "defense",
];

const DOMAIN_LAYOUT: Record<
  NeuroFlowDomainKey,
  { x: number; y: number; ax: number; ay: number }
> = {
  opening: { x: 150, y: 62, ax: 108, ay: 36 },
  tactical: { x: 288, y: 38, ax: 258, ay: 24 },
  conversion: { x: 390, y: 96, ax: 435, ay: 72 },
  defense: { x: 250, y: 128, ax: 206, ay: 146 },
};

const TOPOLOGY_NODES = [
  [128, 92],
  [176, 48],
  [216, 132],
  [258, 62],
  [306, 112],
  [354, 42],
  [404, 124],
  [456, 76],
  [496, 142],
] as const;

function handleSvgKey(event: KeyboardEvent<SVGGElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

export function NeuroFlowPanel({
  review,
  focusKey,
  selectedAnnotation,
  selectedAnnotationIndex,
  solutionRevealState,
  tryMoveState,
  practiceState,
  onFocusChange,
  onShowAnnotation,
  onShowOpeningExit,
  onShowOpeningLinkedMoment,
  onShowPvLineAnnotation,
}: NeuroFlowPanelProps) {
  const [hoverText, setHoverText] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const neuroFlowState = useMemo(
    () =>
      buildNeuroFlowState({
        review,
        focusKey,
        selectedAnnotation,
        solutionRevealState,
        tryMoveState,
        practiceState,
      }),
    [focusKey, practiceState, review, selectedAnnotation, solutionRevealState, tryMoveState],
  );

  const title = "Carte cognitive";
  const subtitle = neuroFlowSubtitle(neuroFlowState);
  const fallbackRows = DOMAIN_ORDER.map((key) => neuroFlowState.domains[key]);
  const openingEvidence = review?.opening_reality_evidence ?? null;
  const activeDomain = neuroFlowState.activeDomain
    ? neuroFlowState.domains[neuroFlowState.activeDomain]
    : null;
  const monitorView = buildNeuroMonitorSignals(neuroFlowState, review);

  function resetView() {
    setTilt({ x: 0, y: 0 });
    setHoverText(null);
  }

  function handlePointerMove(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    setTilt({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
  }

  function selectDomain(domain: NeuroFlowDomainKey) {
    if (domain === "opening") {
      onFocusChange("lab");
      return;
    }
    const annotation = firstAnnotationForDomain(review, domain);
    if (annotation) {
      onFocusChange("learn");
      onShowAnnotation(annotation, annotationIndex(review, annotation), "before");
      return;
    }
    onFocusChange("lab");
  }

  function showOpeningExit() {
    if (!openingEvidence) {
      return;
    }
    onFocusChange("lab");
    onShowOpeningExit(openingEvidence);
  }

  function showOpeningLinkedMoment() {
    const linkedPly = openingEvidence?.critical_moment_after_exit?.ply ?? null;
    if (typeof linkedPly !== "number") {
      return;
    }
    onFocusChange("lab");
    onShowOpeningLinkedMoment(linkedPly, openingEvidence ?? undefined);
  }

  function showBranch(lineMode: ReviewPvLineMode) {
    if (!selectedAnnotation) {
      return;
    }
    onShowPvLineAnnotation(
      selectedAnnotation,
      selectedAnnotationIndex ?? annotationIndex(review, selectedAnnotation),
      lineMode,
    );
  }

  return (
    <section
      className={`neuroflow-panel ${expanded ? "expanded" : ""}`}
      aria-label="Carte cognitive NeuroFlow"
      data-neuroflow-panel="true"
    >
      <div className="neuroflow-head">
        <div className="neuroflow-head-copy">
          <span className="neuroflow-eyebrow">Neuro-Monitor</span>
          <strong>{title}</strong>
          <p>{hoverText ?? subtitle}</p>
        </div>
        <div className="neuroflow-signal-row" aria-label="État NeuroFlow">
          <span>{modeLabel(neuroFlowState.mode)}</span>
          <span>{activeDomain ? activeDomain.label : "Global"}</span>
        </div>
        <div className="neuroflow-actions">
          <button type="button" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Réduire" : "Agrandir"}
          </button>
          <button type="button" onClick={resetView}>
            Réinitialiser
          </button>
        </div>
      </div>

      <div
        className="neuroflow-stage neuroflow-brain-stage"
        style={
          {
            "--nf-tilt-x": `${tilt.x * 5}deg`,
            "--nf-tilt-y": `${tilt.y * -7}deg`,
          } as CSSProperties
        }
        onMouseMove={handlePointerMove}
        onMouseLeave={resetView}
      >
        <NeuroMonitorBrain
          compact={!expanded}
          title={title}
          subtitle={hoverText ?? subtitle}
          modeLabel={modeLabel(neuroFlowState.mode)}
          domains={monitorView.domains}
          signals={monitorView.signals}
          activeDomainKey={neuroFlowState.activeDomain}
          onDomainSelect={selectDomain}
          playedBranch={{
            available:
              neuroFlowState.mode !== "summary" &&
              neuroFlowState.branches.played.available,
            label: "Après ton coup",
            preview: neuroFlowState.branches.played.movesPreview,
            tone:
              neuroFlowState.branches.played.colorToken === "critical"
                ? "critical"
                : "watch",
            intensity: neuroFlowState.branches.played.severity,
            onSelect: () => showBranch("played"),
          }}
          solutionBranch={{
            available:
              neuroFlowState.mode !== "summary" &&
              (neuroFlowState.branches.solution.available ||
                (neuroFlowState.mode === "learn" &&
                  !neuroFlowState.currentMoment.solutionVisible)),
            visible: neuroFlowState.currentMoment.solutionVisible,
            label: neuroFlowState.currentMoment.solutionVisible
              ? "Solution"
              : "Solution cachée",
            preview: neuroFlowState.branches.solution.movesPreview,
            tone: "stable",
            intensity: neuroFlowState.branches.solution.strength,
            onSelect: () => showBranch("solution"),
          }}
          openingExit={{
            available: neuroFlowState.mode === "lab" && Boolean(openingEvidence),
            label: "Sortie",
            tone: "watch",
            onSelect: showOpeningExit,
          }}
          openingLinkedMoment={{
            available:
              neuroFlowState.mode === "lab" &&
              Boolean(openingEvidence?.critical_moment_after_exit),
            label: "Moment lié",
            tone:
              neuroFlowState.opening.linkedMomentSeverity >= 0.5
                ? "critical"
                : "watch",
            onSelect: showOpeningLinkedMoment,
          }}
        />
      </div>

      <div className="neuroflow-fallback" data-neuroflow-fallback="true">
        {fallbackRows.map((domain) => (
          <span key={domain.label}>
            {domain.label} : {statusLabel(domain.status)}
          </span>
        ))}
      </div>
    </section>
  );
}

function NeuroFlowTopology({ state }: { state: NeuroFlowState }) {
  const intensity = Math.max(
    0.18,
    ...DOMAIN_ORDER.map((key) => state.domains[key].severity),
  );
  return (
    <g className="neuroflow-topology" filter="url(#neuroflow-glow)">
      <ellipse className="neuroflow-aura" cx="312" cy="92" rx="226" ry="74" />
      <ellipse className="neuroflow-aura secondary" cx="314" cy="92" rx="172" ry="94" />
      <path
        className="neuroflow-shell"
        d="M96 94 C112 30 192 18 252 44 C298 4 402 24 430 72 C506 84 520 148 462 164 C390 190 314 154 256 168 C180 184 92 154 96 94 Z"
      />
      <path
        className="neuroflow-synapse"
        d="M128 92 C176 48 216 132 258 62 S354 42 404 124 S456 76 496 142"
      />
      <path
        className="neuroflow-synapse quiet"
        d="M176 48 C246 18 318 152 404 124 C446 110 462 74 496 142"
      />
      <path
        className="neuroflow-thread"
        style={{ opacity: 0.25 + intensity * 0.45 }}
        d="M116 98 C184 54 210 140 280 84 S400 40 480 116"
      />
      <path
        className="neuroflow-thread"
        style={{ opacity: 0.18 + intensity * 0.35 }}
        d="M150 56 C226 88 256 116 330 96 S410 122 470 84"
      />
      <path
        className="neuroflow-thread"
        style={{ opacity: 0.16 + intensity * 0.3 }}
        d="M138 138 C224 108 260 32 344 56 S410 138 480 134"
      />
      {TOPOLOGY_NODES.map(([cx, cy], index) => (
        <circle
          className="neuroflow-topology-node"
          cx={cx}
          cy={cy}
          key={`${cx}-${cy}`}
          r={index % 3 === 0 ? 4.2 : 3.2}
        />
      ))}
    </g>
  );
}

function NeuroFlowDomainMap({
  state,
  onHover,
  onSelectDomain,
}: {
  state: NeuroFlowState;
  onHover: (text: string | null) => void;
  onSelectDomain: (domain: NeuroFlowDomainKey) => void;
}) {
  return (
    <g className="neuroflow-domains">
      {DOMAIN_ORDER.map((key) => {
        const domain = state.domains[key];
        const layout = DOMAIN_LAYOUT[key];
        return (
          <g key={key}>
            <path
              className={`neuroflow-domain-link neuroflow-domain-${domain.status}`}
              d={`M312 92 C${layout.ax} ${layout.ay}, ${layout.x} ${layout.y}, ${layout.x} ${layout.y}`}
            />
            <g
              role="button"
              tabIndex={0}
              className="neuroflow-svg-button"
              aria-label={`${domain.label} ${statusLabel(domain.status)}`}
              onClick={() => onSelectDomain(key)}
              onKeyDown={(event) => handleSvgKey(event, () => onSelectDomain(key))}
              onMouseEnter={() =>
                onHover(
                  `${domain.label} : ${statusLabel(domain.status)} · ${domain.summary}`,
                )
              }
              onMouseLeave={() => onHover(null)}
            >
              <circle
                className={`neuroflow-domain-node neuroflow-domain-${domain.status} ${
                  state.activeDomain === key ? "active" : ""
                }`}
                cx={layout.x}
                cy={layout.y}
                r={14 + domain.severity * 8}
              />
              <text x={layout.x} y={layout.y + 34} textAnchor="middle">
                {domain.label}
              </text>
            </g>
          </g>
        );
      })}
      <circle className="neuroflow-core" cx="312" cy="92" r="22" />
      <text className="neuroflow-core-label" x="312" y="98" textAnchor="middle">
        décision
      </text>
    </g>
  );
}

function NeuroFlowLessonBranches({
  state,
  onHover,
  onShowBranch,
}: {
  state: NeuroFlowState;
  onHover: (text: string | null) => void;
  onShowBranch: (lineMode: ReviewPvLineMode) => void;
}) {
  const showPlayed = state.branches.played.available;
  const showSolution =
    state.branches.solution.available && state.currentMoment.solutionVisible;
  const hiddenSolution =
    state.mode === "learn" && !state.currentMoment.solutionVisible;

  return (
    <g className="neuroflow-branches">
      <circle className="neuroflow-critical-node" cx="312" cy="92" r="16" />
      <text className="neuroflow-branch-label" x="312" y="72" textAnchor="middle">
        position critique
      </text>
      {showPlayed && (
        <g
          role="button"
          tabIndex={0}
          className="neuroflow-svg-button"
          onClick={() => onShowBranch("played")}
          onKeyDown={(event) => handleSvgKey(event, () => onShowBranch("played"))}
          onMouseEnter={() =>
            onHover(
              `${state.branches.played.label} · ${
                state.branches.played.movesPreview || "ligne à ouvrir"
              }`,
            )
          }
          onMouseLeave={() => onHover(null)}
        >
          <path
            className={`neuroflow-branch neuroflow-branch-${state.branches.played.colorToken}`}
            d="M328 92 C376 62 428 58 496 74"
            style={{ strokeWidth: 2 + state.branches.played.severity * 4 }}
          />
          <circle className="neuroflow-branch-node risk" cx="500" cy="74" r="12" />
          <text className="neuroflow-branch-label" x="500" y="54" textAnchor="middle">
            Après ton coup
          </text>
        </g>
      )}
      {showSolution && (
        <g
          role="button"
          tabIndex={0}
          className="neuroflow-svg-button"
          onClick={() => onShowBranch("solution")}
          onKeyDown={(event) => handleSvgKey(event, () => onShowBranch("solution"))}
          onMouseEnter={() =>
            onHover(
              `${state.branches.solution.label} · ${
                state.branches.solution.movesPreview || "ligne à ouvrir"
              }`,
            )
          }
          onMouseLeave={() => onHover(null)}
        >
          <path
            className="neuroflow-branch neuroflow-branch-solution"
            d="M326 102 C376 132 430 132 510 112"
            style={{ strokeWidth: 2 + state.branches.solution.strength * 3 }}
          />
          <circle className="neuroflow-branch-node solution" cx="512" cy="112" r="12" />
          <text className="neuroflow-branch-label" x="512" y="143" textAnchor="middle">
            Solution
          </text>
        </g>
      )}
      {hiddenSolution && (
        <g className="neuroflow-hidden-solution">
          <path d="M326 102 C376 132 430 132 510 112" />
          <circle cx="512" cy="112" r="10" />
          <text x="512" y="143" textAnchor="middle">
            solution cachée
          </text>
        </g>
      )}
    </g>
  );
}

function NeuroFlowOpeningMap({
  state,
  evidence,
  onHover,
  onShowExit,
  onShowLinkedMoment,
}: {
  state: NeuroFlowState;
  evidence: OpeningRealityEvidence | null;
  onHover: (text: string | null) => void;
  onShowExit: () => void;
  onShowLinkedMoment: () => void;
}) {
  if (evidence?.status === "not_applicable_from_position") {
    return (
      <g className="neuroflow-opening">
        <circle className="neuroflow-opening-node muted" cx="312" cy="92" r="24" />
        <text className="neuroflow-branch-label" x="312" y="98" textAnchor="middle">
          position spéciale
        </text>
      </g>
    );
  }

  return (
    <g className="neuroflow-opening">
      <path className="neuroflow-opening-path book" d="M120 92 C190 66 230 66 286 92" />
      <path className="neuroflow-opening-path exit" d="M286 92 C336 122 382 118 424 92" />
      <path
        className={`neuroflow-opening-path ${
          state.opening.hasLinkedMoment ? "linked" : "quiet"
        }`}
        d="M424 92 C466 68 512 70 552 92"
      />
      <circle className="neuroflow-opening-node book" cx="120" cy="92" r="13" />
      <text className="neuroflow-branch-label" x="120" y="124" textAnchor="middle">
        livre
      </text>
      <g
        role="button"
        tabIndex={0}
        className="neuroflow-svg-button"
        onClick={onShowExit}
        onKeyDown={(event) => handleSvgKey(event, onShowExit)}
        onMouseEnter={() =>
          onHover(`Sortie du livre : ${state.opening.exitMoveSan ?? "coup inconnu"}`)
        }
        onMouseLeave={() => onHover(null)}
      >
        <circle className="neuroflow-opening-node exit" cx="424" cy="92" r="15" />
        <text className="neuroflow-branch-label" x="424" y="124" textAnchor="middle">
          sortie
        </text>
      </g>
      <g
        role="button"
        tabIndex={state.opening.hasLinkedMoment ? 0 : -1}
        className="neuroflow-svg-button"
        aria-disabled={!state.opening.hasLinkedMoment}
        onClick={() => {
          if (state.opening.hasLinkedMoment) {
            onShowLinkedMoment();
          }
        }}
        onKeyDown={(event) => {
          if (state.opening.hasLinkedMoment) {
            handleSvgKey(event, onShowLinkedMoment);
          }
        }}
        onMouseEnter={() =>
          onHover(
            state.opening.hasLinkedMoment
              ? "Moment lié après la sortie"
              : "Pas de gros problème détecté après la sortie",
          )
        }
        onMouseLeave={() => onHover(null)}
      >
        <circle
          className={`neuroflow-opening-node ${
            state.opening.hasLinkedMoment ? "linked" : "quiet"
          }`}
          cx="552"
          cy="92"
          r={12 + state.opening.linkedMomentSeverity * 8}
        />
        <text className="neuroflow-branch-label" x="552" y="124" textAnchor="middle">
          après sortie
        </text>
      </g>
    </g>
  );
}

function NeuroFlowPracticeMap({
  practiceState,
  onHover,
}: {
  practiceState: NeuroFlowPracticeState;
  onHover: (text: string | null) => void;
}) {
  const items = practiceState?.items ?? [];
  if (!practiceState?.active || items.length === 0) {
    return (
      <g className="neuroflow-practice">
        <circle className="neuroflow-core" cx="312" cy="92" r="24" />
        <text className="neuroflow-core-label" x="312" y="98" textAnchor="middle">
          prêt
        </text>
      </g>
    );
  }

  const visibleItems = items.slice(0, 7);
  const spacing = visibleItems.length > 1 ? 420 / (visibleItems.length - 1) : 0;
  return (
    <g className="neuroflow-practice">
      <path className="neuroflow-practice-path" d="M110 92 C220 54 420 130 530 92" />
      {visibleItems.map((item, index) => {
        const x = visibleItems.length === 1 ? 320 : 110 + index * spacing;
        const y = 92 + Math.sin(index * 1.15) * 22;
        const result = practiceNodeResult(practiceState, item, index);
        const current = index === practiceState.currentIndex;
        return (
          <g
            key={`${item.ply}-${index}`}
            role="button"
            tabIndex={0}
            className="neuroflow-svg-button"
            onClick={() =>
              onHover(
                `Position ${index + 1}/${items.length} · ${practiceResultLabel(result)}`,
              )
            }
            onKeyDown={(event) =>
              handleSvgKey(event, () =>
                onHover(
                  `Position ${index + 1}/${items.length} · ${practiceResultLabel(result)}`,
                ),
              )
            }
            onMouseEnter={() =>
              onHover(
                `Position ${index + 1}/${items.length} · ${practiceResultLabel(result)}`,
              )
            }
            onMouseLeave={() => onHover(null)}
          >
            <circle
              className={`neuroflow-practice-node neuroflow-practice-${result} ${
                current ? "current" : ""
              }`}
              cx={x}
              cy={y}
              r={current ? 16 : 12}
            />
            <text className="neuroflow-branch-label" x={x} y={y + 32} textAnchor="middle">
              {index + 1}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function buildNeuroFlowState({
  review,
  focusKey,
  selectedAnnotation,
  solutionRevealState,
  tryMoveState,
  practiceState,
}: {
  review: ReviewResponse | null;
  focusKey: string;
  selectedAnnotation: ReviewMoveAnnotation | null;
  solutionRevealState: NeuroFlowSolutionRevealState;
  tryMoveState: NeuroFlowTryMoveState;
  practiceState: NeuroFlowPracticeState;
}): NeuroFlowState {
  const domains = buildNeuroFlowDomains(review);
  const currentMoment = buildCurrentMoment(
    selectedAnnotation,
    solutionRevealState,
    tryMoveState,
  );
  const activeDomain =
    focusKey === "lab"
      ? "opening"
      : focusKey === "summary"
        ? strongestDomain(domains)
        : domainForAnnotation(selectedAnnotation);
  const mode: NeuroFlowMode = practiceState?.active
    ? "practice"
    : focusKey === "lab"
      ? "lab"
      : currentMoment.solutionVisible || focusKey === "compare"
        ? "compare"
        : focusKey === "learn"
          ? "learn"
          : "summary";

  return {
    mode,
    activeDomain,
    domains,
    currentMoment,
    branches: buildNeuroFlowBranches(selectedAnnotation, currentMoment),
    opening: buildNeuroFlowOpening(review?.opening_reality_evidence ?? null),
  };
}

export function buildNeuroMonitorSignals(
  state: NeuroFlowState,
  review: ReviewResponse | null,
): { domains: NeuroMonitorDomain[]; signals: NeuroMonitorSignal[] } {
  const hasReview = Boolean(review);
  const domains: NeuroMonitorDomain[] = DOMAIN_ORDER.map((key) => {
    const domain = state.domains[key];
    return {
      key,
      label: domain.label,
      tone: monitorToneFromStatus(domain.status),
      intensity: clampMonitorLevel(domain.severity),
      summary: domain.summary,
    };
  });
  if (!hasReview) {
    return {
      domains,
      signals: [
        {
          key: "stability",
          label: "Stabilité",
          value: "en attente",
          tone: "neutral",
          intensity: 0.18,
        },
        {
          key: "tension",
          label: "Tension",
          value: "en attente",
          tone: "neutral",
          intensity: 0.18,
        },
        {
          key: "tactical",
          label: "Focus tactique",
          value: "en attente",
          tone: "neutral",
          intensity: 0.18,
        },
        {
          key: "sync",
          label: "Synchronisation",
          value: "en attente",
          tone: "analysis",
          intensity: 0.24,
        },
      ],
    };
  }

  const riskLevel = Math.max(...domains.map((domain) => domain.intensity));
  const currentImpact = severityFromLoss(state.currentMoment.impact);
  const tensionLevel = Math.max(riskLevel * 0.72, currentImpact);
  const stabilityLevel = clampMonitorLevel(1 - tensionLevel * 0.78);
  const tacticalLevel = clampMonitorLevel(state.domains.tactical.severity);
  const syncScore = Math.round(
    Math.max(
      48,
      Math.min(
        94,
        88 - tensionLevel * 32 + (state.currentMoment.solutionVisible ? 4 : 0),
      ),
    ),
  );

  return {
    domains,
    signals: [
      {
        key: "stability",
        label: "Stabilité",
        value:
          stabilityLevel >= 0.72
            ? "élevée"
            : stabilityLevel >= 0.48
              ? "moyenne"
              : "fragile",
        tone:
          stabilityLevel >= 0.72
            ? "stable"
            : stabilityLevel >= 0.48
              ? "watch"
              : "critical",
        intensity: stabilityLevel,
      },
      {
        key: "tension",
        label: "Tension",
        value:
          tensionLevel >= 0.68
            ? "forte"
            : tensionLevel >= 0.34
              ? "moyenne"
              : "faible",
        tone:
          tensionLevel >= 0.68
            ? "critical"
            : tensionLevel >= 0.34
              ? "watch"
              : "stable",
        intensity: tensionLevel,
      },
      {
        key: "tactical",
        label: "Focus tactique",
        value:
          tacticalLevel >= 0.62
            ? "fort"
            : tacticalLevel >= 0.28
              ? "modéré"
              : "calme",
        tone:
          tacticalLevel >= 0.62
            ? "critical"
            : tacticalLevel >= 0.28
              ? "watch"
              : "stable",
        intensity: tacticalLevel,
      },
      {
        key: "sync",
        label: "Synchronisation",
        value: `${syncScore} %`,
        tone: syncScore >= 76 ? "analysis" : syncScore >= 62 ? "watch" : "critical",
        intensity: syncScore / 100,
      },
    ],
  };
}

function buildNeuroFlowDomains(
  review: ReviewResponse | null,
): NeuroFlowState["domains"] {
  const annotations = reviewAnnotations(review);
  const tactical = annotations.filter(isTacticalMoment);
  const conversion = annotations.filter(isConversionMoment);
  const defense = annotations.filter(isDefenseMoment);
  return {
    opening: openingDomain(review?.opening_reality_evidence ?? null),
    tactical: countDomain("Tactique", tactical, 3, "opportunités tactiques"),
    conversion: countDomain("Conversion", conversion, 2, "positions favorables"),
    defense: countDomain("Défense", defense, 2, "ressources défensives"),
  };
}

function openingDomain(
  evidence: OpeningRealityEvidence | null,
): NeuroFlowState["domains"]["opening"] {
  if (!evidence) {
    return {
      label: "Ouverture",
      status: "unknown",
      severity: 0.18,
      count: 0,
      summary: "données absentes",
    };
  }
  if (evidence.status === "not_applicable_from_position") {
    return {
      label: "Ouverture",
      status: "not_applicable",
      severity: 0.1,
      count: 0,
      summary: "position spéciale",
    };
  }
  const linkedLoss = Number(evidence.critical_moment_after_exit?.win_loss ?? 0);
  if (evidence.critical_moment_after_exit) {
    return {
      label: "Ouverture",
      status: linkedLoss >= 12 ? "fragile" : "stable",
      severity: severityFromLoss(linkedLoss),
      count: 1,
      summary: `sortie liée à ${impactLabel(linkedLoss)}`,
    };
  }
  const exitPly = evidence.exit_ply ?? evidence.out_of_book_ply ?? null;
  if (typeof exitPly === "number") {
    return {
      label: "Ouverture",
      status: "stable",
      severity: 0.24,
      count: 1,
      summary: `sortie au coup ${Math.ceil(exitPly / 2)}`,
    };
  }
  return {
    label: "Ouverture",
    status: evidence.available ? "stable" : "unknown",
    severity: evidence.available ? 0.2 : 0.12,
    count: 0,
    summary: evidence.summary ?? "diagnostic léger",
  };
}

function countDomain(
  label: string,
  annotations: ReviewMoveAnnotation[],
  criticalAt: number,
  noun: string,
): NeuroFlowState["domains"][NeuroFlowDomainKey] {
  const count = annotations.length;
  const maxLoss = Math.max(0, ...annotations.map((annotation) => Number(annotation.win_loss ?? 0)));
  const status =
    count <= 0
      ? "stable"
      : count >= criticalAt || maxLoss >= 25
        ? "critical"
        : "fragile";
  return {
    label,
    status,
    severity: count <= 0 ? 0.16 : Math.max(count / criticalAt, severityFromLoss(maxLoss)),
    count,
    summary: count <= 0 ? "stable" : `${count} ${noun} à revoir`,
  };
}

function buildCurrentMoment(
  annotation: ReviewMoveAnnotation | null,
  solutionRevealState: NeuroFlowSolutionRevealState,
  tryMoveState: NeuroFlowTryMoveState,
): NeuroFlowState["currentMoment"] {
  const revealState =
    annotation && solutionRevealState?.ply === annotation.ply
      ? solutionRevealState.state
      : tryMoveState?.active && tryMoveState.annotationPly === annotation?.ply
        ? tryMoveState.solutionRevealed
          ? "solution_revealed"
          : tryMoveState.feedback
            ? "attempted"
            : "hidden"
        : "hidden";
  const solutionVisible =
    revealState === "attempted" ||
    revealState === "solution_revealed" ||
    revealState === "pv_line";
  const impact = Number(annotation?.win_loss ?? 0);
  return {
    ply: annotation?.ply ?? null,
    errorType: annotation?.pedagogical_explanation?.error_type ?? null,
    impact,
    impactLabel: annotation?.impact_label ?? impactLabel(impact),
    revealState,
    solutionVisible,
  };
}

function buildNeuroFlowBranches(
  annotation: ReviewMoveAnnotation | null,
  currentMoment: NeuroFlowState["currentMoment"],
): NeuroFlowState["branches"] {
  const evidence = annotation?.pv_contrast_evidence ?? null;
  const playedAvailable =
    Boolean(annotation) &&
    (currentMoment.revealState === "played_move_shown" ||
      currentMoment.revealState === "attempted" ||
      currentMoment.solutionVisible);
  const solutionBranchVisible =
    currentMoment.solutionVisible &&
    Boolean(annotation?.pv_line?.length || evidence?.best_branch?.pv?.length);
  return {
    played: {
      available: playedAvailable,
      label: "Après ton coup",
      movesPreview: pvPreview(evidence?.played_branch?.pv),
      severity: severityFromLoss(annotation?.win_loss ?? 0),
      colorToken: Number(annotation?.win_loss ?? 0) >= 15 ? "critical" : "warning",
    },
    solution: {
      available: solutionBranchVisible,
      label: "Solution",
      movesPreview: pvPreview(evidence?.best_branch?.pv ?? annotation?.pv_line),
      strength: Math.max(0.35, 1 - severityFromLoss(annotation?.win_loss ?? 0) * 0.45),
      colorToken: "solution",
    },
  };
}

function buildNeuroFlowOpening(
  evidence: OpeningRealityEvidence | null,
): NeuroFlowState["opening"] {
  const linkedLoss = Number(evidence?.critical_moment_after_exit?.win_loss ?? 0);
  return {
    available: Boolean(evidence?.available),
    lastBookPly: evidence?.last_book_ply ?? evidence?.book_until_ply ?? null,
    exitPly: evidence?.exit_ply ?? evidence?.out_of_book_ply ?? null,
    exitMoveSan: evidence?.exit_move_san ?? evidence?.out_of_book_move_san ?? null,
    hasLinkedMoment: Boolean(evidence?.critical_moment_after_exit),
    linkedMomentSeverity: severityFromLoss(linkedLoss),
  };
}

function neuroFlowSubtitle(state: NeuroFlowState): string {
  if (state.mode === "practice") {
    return "Mode entraînement : progression des positions.";
  }
  if (state.mode === "lab") {
    if (state.opening.exitPly) {
      return `Sortie du livre au coup ${Math.ceil(state.opening.exitPly / 2)}.`;
    }
    return "Explorer : détails avancés de la Review.";
  }
  if (state.mode === "compare") {
    return "Compare les deux lignes.";
  }
  if (state.mode === "learn") {
    if (state.currentMoment.revealState === "played_move_shown") {
      return "Ton coup révèle un risque.";
    }
    return "Défi : trouve le meilleur coup.";
  }
  const active = state.activeDomain ? state.domains[state.activeDomain] : null;
  return active
    ? `Focus : ${active.label} ${statusLabel(active.status).toLowerCase()}.`
    : "Dynamique de la partie.";
}

function modeLabel(mode: NeuroFlowMode): string {
  if (mode === "summary") {
    return "Résumé";
  }
  if (mode === "learn") {
    return "Apprendre";
  }
  if (mode === "lab") {
    return "Explorer";
  }
  if (mode === "practice") {
    return "S'entraîner";
  }
  return "Comparaison";
}

function firstAnnotationForDomain(
  review: ReviewResponse | null,
  domain: NeuroFlowDomainKey,
): ReviewMoveAnnotation | null {
  const annotations = reviewAnnotations(review);
  if (domain === "tactical") {
    return annotations.find(isTacticalMoment) ?? null;
  }
  if (domain === "conversion") {
    return annotations.find(isConversionMoment) ?? null;
  }
  if (domain === "defense") {
    return annotations.find(isDefenseMoment) ?? null;
  }
  return null;
}

function annotationIndex(
  review: ReviewResponse | null,
  annotation: ReviewMoveAnnotation | null,
): number {
  if (!review || !annotation) {
    return 0;
  }
  const index = (review.move_annotations ?? []).findIndex(
    (candidate) => candidate.ply === annotation.ply && candidate.uci === annotation.uci,
  );
  return index >= 0 ? index : 0;
}

function reviewAnnotations(review: ReviewResponse | null): ReviewMoveAnnotation[] {
  return review?.review_sections?.all ?? review?.move_annotations ?? [];
}

function strongestDomain(
  domains: NeuroFlowState["domains"],
): NeuroFlowDomainKey | null {
  return DOMAIN_ORDER.slice().sort(
    (left, right) => domains[right].severity - domains[left].severity,
  )[0] ?? null;
}

function domainForAnnotation(
  annotation: ReviewMoveAnnotation | null,
): NeuroFlowDomainKey | null {
  if (!annotation) {
    return null;
  }
  if (isTacticalMoment(annotation)) {
    return "tactical";
  }
  if (isConversionMoment(annotation)) {
    return "conversion";
  }
  if (isDefenseMoment(annotation)) {
    return "defense";
  }
  if (annotation.pedagogical_explanation?.error_type === "opening_transition") {
    return "opening";
  }
  return null;
}

function isTacticalMoment(annotation: ReviewMoveAnnotation): boolean {
  const tags = new Set(annotation.tags ?? []);
  return (
    annotation.pedagogical_explanation?.error_type === "tactical" ||
    tags.has("missed_opportunity") ||
    annotation.primary_category === "critical" ||
    annotation.primary_category === "decisive"
  );
}

function isConversionMoment(annotation: ReviewMoveAnnotation): boolean {
  const tags = new Set(annotation.tags ?? []);
  const before =
    annotation.player_win_percent_before ?? annotation.player_percent_before ?? null;
  return (
    annotation.pedagogical_explanation?.error_type === "conversion" ||
    tags.has("conversion_issue") ||
    (Number(before ?? 0) >= 75 && Number(annotation.win_loss ?? 0) >= 10)
  );
}

function isDefenseMoment(annotation: ReviewMoveAnnotation): boolean {
  const tags = new Set(annotation.tags ?? []);
  const before =
    annotation.player_win_percent_before ?? annotation.player_percent_before ?? null;
  return (
    annotation.pedagogical_explanation?.error_type === "defensive" ||
    tags.has("defensive_resource_missed") ||
    (Number(before ?? 100) <= 35 &&
      (Number(annotation.missed_gain ?? 0) >= 8 || Number(annotation.win_loss ?? 0) >= 8))
  );
}

function practiceNodeResult(
  practiceState: NeuroFlowPracticeState,
  item: ReviewPracticeItem,
  index: number,
): string {
  const storedResult = practiceState?.summary?.result_by_ply?.[String(item.ply)];
  if (storedResult) {
    return storedResult;
  }
  if (index === practiceState?.currentIndex) {
    if (practiceState.feedback?.result) {
      return practiceState.feedback.result;
    }
    if (practiceState.solutionRevealed || practiceState.itemState === "solution_revealed") {
      return "revealed";
    }
    return "current";
  }
  if (practiceState && index < practiceState.currentIndex) {
    return "completed";
  }
  return "pending";
}

function practiceResultLabel(result: string): string {
  if (result === "best") {
    return "meilleur coup";
  }
  if (result === "very_good") {
    return "très bon";
  }
  if (result === "acceptable") {
    return "acceptable";
  }
  if (result === "wrong" || result === "illegal") {
    return "à revoir";
  }
  if (result === "revealed") {
    return "solution révélée";
  }
  if (result === "skipped") {
    return "passée";
  }
  if (result === "current") {
    return "à résoudre";
  }
  return result === "completed" ? "traitée" : "à venir";
}

function pvPreview(line: ReviewMoveAnnotation["pv_line"]): string {
  return (line ?? [])
    .slice(0, 6)
    .map((move) => move.san ?? move.uci)
    .filter(Boolean)
    .join(" ");
}

function severityFromLoss(value: number | null | undefined): number {
  const loss = Number(value ?? 0);
  if (!Number.isFinite(loss)) {
    return 0;
  }
  return Math.max(0, Math.min(1, loss / 30));
}

function monitorToneFromStatus(status: NeuroFlowDomainStatus): NeuroMonitorTone {
  if (status === "stable") {
    return "stable";
  }
  if (status === "fragile") {
    return "watch";
  }
  if (status === "critical") {
    return "critical";
  }
  if (status === "unknown") {
    return "analysis";
  }
  return "neutral";
}

function clampMonitorLevel(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function impactLabel(value: number | null | undefined): string {
  const loss = Number(value ?? 0);
  if (loss >= 25) {
    return "critique";
  }
  if (loss >= 12) {
    return "fort";
  }
  if (loss >= 6) {
    return "modéré";
  }
  if (loss > 0) {
    return "léger";
  }
  return "stable";
}

function statusLabel(status: NeuroFlowDomainStatus): string {
  if (status === "stable") {
    return "Stable";
  }
  if (status === "fragile") {
    return "Fragile";
  }
  if (status === "critical") {
    return "Critique";
  }
  if (status === "not_applicable") {
    return "Non applicable";
  }
  return "Inconnue";
}
