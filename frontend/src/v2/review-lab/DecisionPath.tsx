import type {
  DecisionLabFilter,
  DecisionLabMode,
  DecisionLabMoment,
} from "./decisionLabMockData";
import { getDecisionFilterLabel, type DecisionLabExplorerResult, type DecisionLabReplayPhase } from "./decisionLabState";

type DecisionPathProps = {
  activeMode: DecisionLabMode;
  activeFilter: DecisionLabFilter;
  filters: Array<{ id: DecisionLabFilter; label: string; count: number }>;
  moments: DecisionLabMoment[];
  allMoments: DecisionLabMoment[];
  selectedMoment: DecisionLabMoment;
  selectedMomentId: string;
  filterCount: number;
  replayPhase: DecisionLabReplayPhase;
  explorerResult: DecisionLabExplorerResult;
  onSelectFilter: (filter: DecisionLabFilter) => void;
  onSelectMoment: (momentId: string) => void;
};

export function DecisionPath({
  activeMode,
  activeFilter,
  filters,
  moments,
  allMoments,
  selectedMoment,
  selectedMomentId,
  filterCount,
  replayPhase,
  explorerResult,
  onSelectFilter,
  onSelectMoment,
}: DecisionPathProps) {
  if (activeMode === "learn") {
    return (
      <aside className="decision-lab-path" data-testid="decision-lab-path" data-mode="learn">
        <PanelTitle kicker="Apprendre" title="Repères" />
        <div className="decision-lab-cue-list" data-testid="decision-lab-learn-cues">
          {selectedMoment.learnTags.slice(0, 5).map((tag) => (
            <span key={tag} className="decision-lab-cue-pill">
              {tag}
            </span>
          ))}
        </div>
        <p className="decision-lab-left-note">{selectedMoment.takeaway}</p>
      </aside>
    );
  }

  if (activeMode === "replay") {
    const replayableMoments = allMoments.filter((moment) => moment.canReplay || moment.canPractice).slice(0, 5);
    return (
      <aside className="decision-lab-path" data-testid="decision-lab-path" data-mode="replay">
        <PanelTitle kicker="Rejouer" title="File de reprise" />
        <div className="decision-lab-moment-list" data-testid="decision-lab-replay-queue">
          {replayableMoments.map((moment) => (
            <button
              key={moment.id}
              className={`decision-lab-moment-item ${selectedMomentId === moment.id ? "is-active" : ""}`}
              type="button"
              onClick={() => onSelectMoment(moment.id)}
              data-testid="decision-lab-replay-item"
            >
              <span className="decision-lab-move-ref">C{moment.moveNumber}</span>
              <span className="decision-lab-move-san">{moment.playedMoveSan}</span>
              <span className={`decision-lab-status-dot ${selectedMomentId === moment.id ? "is-current" : ""}`}>
                {getReplayStatus(moment.id === selectedMomentId, replayPhase)}
              </span>
              <span className="decision-lab-moment-type">{moment.category}</span>
            </button>
          ))}
        </div>
      </aside>
    );
  }

  if (activeMode === "explore") {
    return (
      <aside className="decision-lab-path" data-testid="decision-lab-path" data-mode="explore">
        <PanelTitle kicker="Explorer" title="Branche locale" />
        {selectedMoment.branchMock.length === 0 ? (
          <p className="decision-lab-empty">Joue un coup sur le board.</p>
        ) : (
          <div className="decision-lab-branch-list" data-testid="decision-lab-branch-list">
            {selectedMoment.branchMock.map((move, index) => {
              const isActive = index === selectedMoment.branchMock.length - 1;
              const badge = explorerResult === "line" || explorerResult === "move" ? move.badge : "◌";
              return (
                <button
                  key={`${move.san}-${index}`}
                  className={`decision-lab-branch-item ${isActive ? "is-active" : ""}`}
                  type="button"
                  data-testid="decision-lab-branch-item"
                >
                  <span>{index + 1}</span>
                  <strong>{move.san}</strong>
                  <span className={`decision-lab-badge ${getBadgeToneClass(badge)}`}>{badge}</span>
                  <small>{isActive ? "actif" : move.note}</small>
                </button>
              );
            })}
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="decision-lab-path" data-testid="decision-lab-path" data-mode="summary">
      <PanelTitle kicker="Chemin" title="Moments clés" />
      <div className="decision-lab-filter-row" aria-label="Filtres de moments">
        {filters.map((filter) => (
          <button
            key={filter.id}
            className={activeFilter === filter.id ? "is-active" : ""}
            type="button"
            onClick={() => onSelectFilter(filter.id)}
            data-testid={`decision-lab-filter-${filter.id}`}
          >
            <span>{filter.label}</span>
            <strong>{filter.count}</strong>
          </button>
        ))}
      </div>
      <p className="decision-lab-filter-summary" data-testid="decision-lab-filter-summary">
        {buildFilterSummary(activeFilter, filterCount)}
      </p>
      <div className="decision-lab-moment-list">
        {moments.length === 0 ? (
          <p className="decision-lab-empty">Aucun moment dans ce filtre.</p>
        ) : (
          moments.map((moment) => (
            <button
              key={moment.id}
              className={`decision-lab-moment-item ${selectedMomentId === moment.id ? "is-active" : ""}`}
              type="button"
              onClick={() => onSelectMoment(moment.id)}
              data-testid="decision-lab-moment-item"
            >
              <span className="decision-lab-move-ref">C{moment.moveNumber}</span>
              <span className="decision-lab-move-san">{moment.playedMoveSan}</span>
              <span className={`decision-lab-badge ${getBadgeToneClass(moment.badge)}`}>
                {moment.badge}
              </span>
              <span className="decision-lab-moment-type">{moment.category}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

function PanelTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="decision-lab-panel-heading" data-testid="decision-lab-left-heading">
      <span className="decision-lab-kicker">{kicker}</span>
      <h2 data-testid="decision-lab-left-title">{title}</h2>
    </div>
  );
}

function getReplayStatus(isActive: boolean, phase: DecisionLabReplayPhase): string {
  if (!isActive) {
    return "prêt";
  }
  if (phase === "feedback") {
    return "réussi";
  }
  if (phase === "attempting") {
    return "tenté";
  }
  return "prêt";
}

function buildFilterSummary(filter: DecisionLabFilter, count: number): string {
  const label = getDecisionFilterLabel(filter).toLocaleLowerCase("fr-FR");
  if (count <= 0) {
    return `Aucun moment ${label}.`;
  }
  if (count === 1) {
    return `1 moment ${label}.`;
  }
  return `${count} moments ${label}.`;
}

function getBadgeToneClass(badge: string): string {
  if (badge === "✓" || badge === "!") return "decision-lab-badge-good";
  if (badge === "?" || badge === "?!") return "decision-lab-badge-warning";
  if (badge === "↻") return "decision-lab-badge-refresh";
  return "decision-lab-badge-neutral";
}
