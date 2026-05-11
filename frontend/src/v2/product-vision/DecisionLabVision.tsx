import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { VisionBoard, type VisionBoardMood } from "./VisionBoard";
import { VisionLinePlayer } from "./VisionLinePlayer";
import { visionMoments, type VisionDecisionMode, type VisionMoment } from "./visionMockData";
import {
  canShowSolutionGuidesForBoardState,
  getBoardExperienceState,
  getBoardExperienceTone,
  getBoardStageTone,
  getBoardStateCopy,
  getExplorerLocalSignal,
  getModeNarrativeCopy,
  shouldDimContextForBoardState,
  shouldShowDecisionGuides,
  type VisionState,
} from "./visionState";

type DecisionLabVisionProps = {
  state: VisionState;
  setState: Dispatch<SetStateAction<VisionState>>;
  onBack: () => void;
};

type PathFilter = "priority" | "review" | "good" | "all";

const modeLabels: Array<{ mode: VisionDecisionMode; label: string; hint: string; icon: string; signature: string }> = [
  { mode: "summary", label: "Résumé", icon: "◐", signature: "Calme éditorial", hint: "Observe la bascule avant de rejouer." },
  { mode: "learn", label: "Apprendre", icon: "✦", signature: "Lecture guidée", hint: "Lis les repères, puis reviens au board." },
  { mode: "replay", label: "Rejouer", icon: "↻", signature: "Salle d'effort", hint: "Trouve le coup sans aide visible." },
  { mode: "explore", label: "Explorer", icon: "⤴", signature: "Atelier", hint: "Teste une branche sans modifier ton entraînement." },
];

const pathFilters: Array<{ id: PathFilter; label: string }> = [
  { id: "priority", label: "Prioritaires" },
  { id: "review", label: "À revoir" },
  { id: "good", label: "Bons coups" },
  { id: "all", label: "Tous" },
];

function filterMoments(filter: PathFilter): VisionMoment[] {
  if (filter === "priority") {
    return visionMoments.filter((moment) => moment.canReplay || moment.pathStatus === "à rejouer");
  }
  if (filter === "review") {
    return visionMoments.filter((moment) => moment.symbol.includes("?") || moment.pathStatus === "à revoir");
  }
  if (filter === "good") {
    return visionMoments.filter((moment) => moment.symbol === "!" || moment.symbol === "✓");
  }
  return visionMoments;
}

function getDecisionStateLabel(moment: VisionMoment): string {
  if (moment.neuroBand === "strong") return "Très solide";
  if (moment.neuroBand === "solid") return "Solide";
  if (moment.neuroBand === "watch") return "À consolider";
  return "À revoir";
}

function buildLearnCues(moment: VisionMoment): string[] {
  const base = [
    moment.shortCategory,
    ...moment.checklist,
    moment.canExplore ? "Explorer utile" : "Repère défensif",
  ];
  return [...new Set(base)].slice(0, 3);
}

export function DecisionLabVision({ state, setState, onBack }: DecisionLabVisionProps) {
  const [pathFilter, setPathFilter] = useState<PathFilter>("priority");
  const selectedMoment = visionMoments.find((item) => item.id === state.selectedMomentId) ?? visionMoments[0];
  const activeMode = modeLabels.find((item) => item.mode === state.decisionMode) ?? modeLabels[0];
  const filteredMoments = useMemo(() => filterMoments(pathFilter), [pathFilter]);
  const boardTone = getBoardStageTone({
    surface: "decisionLab",
    decisionMode: state.decisionMode,
    replayPhase: state.replayPhase,
    explorerAnalyzed: state.explorerAnalyzed,
    linePlayerOpen: state.linePlayerOpen,
  });
  const boardExperienceState = getBoardExperienceState({
    view: "decision-lab",
    reviewMode: state.decisionMode,
    feedbackKind: state.decisionMode === "replay" && state.replayPhase === "feedback" ? "success" : "neutral",
    explorerState: state.explorerAnalyzed ? "analysis" : "empty",
    noSpoiler: state.decisionMode === "replay" && state.replayPhase !== "feedback",
  });
  const boardExperienceTone = getBoardExperienceTone(boardExperienceState);
  const boardStateCopy = getBoardStateCopy(boardExperienceState);
  const dimContext = shouldDimContextForBoardState(boardExperienceState);
  const modeNarrative = getModeNarrativeCopy({
    surface: "decisionLab",
    decisionMode: state.decisionMode,
    replayPhase: state.replayPhase,
    explorerAnalyzed: state.explorerAnalyzed,
    linePlayerOpen: state.linePlayerOpen,
  });
  const showDecisionGuides =
    canShowSolutionGuidesForBoardState(boardExperienceState) &&
    shouldShowDecisionGuides({
      surface: "decisionLab",
      decisionMode: state.decisionMode,
      replayPhase: state.replayPhase,
      explorerAnalyzed: state.explorerAnalyzed,
      linePlayerOpen: state.linePlayerOpen,
    });

  const selectMoment = (momentId: string) =>
    setState((current) => ({
      ...current,
      selectedMomentId: momentId,
      replayPhase: "idle",
      explorerAnalyzed: false,
      linePlayerOpen: false,
      detailsOpen: false,
    }));

  const setMode = (mode: VisionDecisionMode) => {
    const fallbackMoment =
      mode === "replay" && !selectedMoment.canReplay
        ? (visionMoments.find((moment) => moment.canReplay) ?? selectedMoment)
        : mode === "explore" && !selectedMoment.canExplore
          ? (visionMoments.find((moment) => moment.canExplore) ?? selectedMoment)
          : selectedMoment;

    setState((current) => ({
      ...current,
      selectedMomentId: fallbackMoment.id,
      decisionMode: mode,
      replayPhase: mode === "replay" ? current.replayPhase : "idle",
      explorerAnalyzed: mode === "explore" ? current.explorerAnalyzed : false,
      linePlayerOpen: false,
      detailsOpen: false,
    }));
  };

  const setFilter = (filter: PathFilter) => {
    const nextMoments = filterMoments(filter);
    setPathFilter(filter);
    if (nextMoments.length > 0 && !nextMoments.some((moment) => moment.id === selectedMoment.id)) {
      selectMoment(nextMoments[0].id);
    }
  };

  const goToNextMoment = () => {
    const currentIndex = visionMoments.findIndex((moment) => moment.id === selectedMoment.id);
    const next = visionMoments[(currentIndex + 1) % visionMoments.length] ?? visionMoments[0];
    selectMoment(next.id);
  };

  return (
    <section
      className={`v2-vision-lab is-${state.decisionMode} v2-vision-mode-signature`}
      data-active-mode={state.decisionMode}
      data-stage-tone={boardExperienceTone}
      data-board-state={boardExperienceState}
      data-testid="v2-vision-decision-lab"
    >
      <aside
        className={`v2-vision-rail v2-vision-decision-path is-${state.decisionMode}${dimContext ? " v2-context-dimmed" : ""}`}
        data-testid="v2-vision-lab-left"
      >
        <DecisionPath
          mode={state.decisionMode}
          selectedMoment={selectedMoment}
          selectedMomentId={selectedMoment.id}
          filter={pathFilter}
          filteredMoments={filteredMoments}
          analyzed={state.explorerAnalyzed}
          onFilter={setFilter}
          onSelectMoment={selectMoment}
        />
      </aside>

      <section
        className={`v2-vision-board-stage v2-vision-decision-board-stage is-${state.decisionMode}`}
        data-board-stage-mode={state.decisionMode}
        data-tone={boardExperienceTone}
        data-board-state={boardExperienceState}
        data-board-tone={boardExperienceTone}
        data-testid="v2-vision-board-stage"
      >
        <header className="v2-vision-board-strip v2-vision-decision-strip">
          <button className="v2-vision-ghost" type="button" onClick={onBack}>Retour</button>
          <span>
            Coup {selectedMoment.moveNumber} · {selectedMoment.san} · {selectedMoment.sideToMove} au trait
          </span>
          <strong className={`v2-vision-score is-${selectedMoment.neuroBand}`}>
            {getDecisionStateLabel(selectedMoment)}
          </strong>
          <span
            className="v2-stage__meta"
            data-testid="v2-vision-board-state-meta"
            data-state-copy={boardStateCopy.microcopy}
            aria-label={`${boardStateCopy.label}. ${boardStateCopy.microcopy}`}
          >
            <span className="v2-stage__state-pill v2-vision-mode-cue" data-testid="v2-vision-mode-cue">
              {boardStateCopy.label}
            </span>
          </span>
        </header>

        <div className="v2-vision-board-stage-shell">
          <VisionBoard
            moment={selectedMoment}
            interactive={state.decisionMode === "replay" || state.decisionMode === "explore"}
            mood={boardExperienceTone as VisionBoardMood}
            experienceState={boardExperienceState}
            showGuides={showDecisionGuides}
            testId="v2-vision-lab-board"
          />
        </div>

        <div className="v2-vision-board-caption v2-vision-decision-caption">
          <span>Position issue d'une vraie décision.</span>
          <button className="v2-vision-ghost" type="button" onClick={goToNextMoment} data-testid="v2-vision-next-moment">
            Moment suivant
          </button>
        </div>

        {state.linePlayerOpen ? (
          <VisionLinePlayer
            moment={selectedMoment}
            onClose={() => setState((current) => ({ ...current, linePlayerOpen: false }))}
          />
        ) : (
          <DecisionActions moment={selectedMoment} state={state} setState={setState} />
        )}
      </section>

      <aside
        className={`v2-vision-card v2-vision-decision-card is-${state.decisionMode}${dimContext ? " v2-context-dimmed" : ""}`}
        data-testid="v2-vision-decision-card"
      >
        <nav className="v2-vision-mode-tabs v2-vision-mode-segmented" aria-label="Modes Decision Lab">
          {modeLabels.map((item) => (
            <button
              key={item.mode}
              className={state.decisionMode === item.mode ? "is-active" : ""}
              type="button"
              onClick={() => setMode(item.mode)}
              data-mode={item.mode}
              data-testid={`v2-vision-mode-${item.mode}`}
            >
              <span aria-hidden="true">{item.icon}</span>
              <strong>{item.label}</strong>
            </button>
          ))}
        </nav>
        <p className="v2-vision-mode-hint" data-testid="v2-vision-mode-hint">
          <strong>{activeMode.signature}</strong>
          <span>{modeNarrative || activeMode.hint}</span>
        </p>
        <DecisionModePanel moment={selectedMoment} state={state} setState={setState} />
      </aside>
    </section>
  );
}

function DecisionPath({
  mode,
  selectedMoment,
  selectedMomentId,
  filter,
  filteredMoments,
  analyzed,
  onFilter,
  onSelectMoment,
}: {
  mode: VisionDecisionMode;
  selectedMoment: VisionMoment;
  selectedMomentId: string;
  filter: PathFilter;
  filteredMoments: VisionMoment[];
  analyzed: boolean;
  onFilter: (filter: PathFilter) => void;
  onSelectMoment: (momentId: string) => void;
}) {
  if (mode === "learn") {
    return (
      <div className="v2-vision-path-mode is-learn" data-testid="v2-vision-left-learn">
        <span className="v2-vision-kicker">Repères de leçon</span>
        <h3>Repères</h3>
        <div className="v2-vision-tag-list">
          {buildLearnCues(selectedMoment).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <p className="v2-vision-path-note">Ces repères isolent l'idée du moment actif.</p>
      </div>
    );
  }

  if (mode === "replay") {
    const replayMoments = visionMoments.filter((moment) => moment.canReplay).slice(0, 5);
    return (
      <div className="v2-vision-path-mode is-replay" data-testid="v2-vision-left-replay">
        <span className="v2-vision-kicker">Effort sans aide</span>
        <h3>File de reprise</h3>
        <ol className="v2-vision-moment-list">
          {replayMoments.map((moment) => (
            <li className={moment.id === selectedMomentId ? "is-active" : ""} key={moment.id}>
              <button type="button" onClick={() => onSelectMoment(moment.id)}>
                <span>C{moment.moveNumber}</span>
                <strong>{moment.san}</strong>
                <em>{moment.pathStatus}</em>
              </button>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (mode === "explore") {
    return (
      <div className="v2-vision-path-mode is-explore" data-testid="v2-vision-left-branch">
        <span className="v2-vision-kicker">Atelier</span>
        <h3>Branche</h3>
        {selectedMoment.branch.length > 0 ? (
          <ol className="v2-vision-branch-list">
            {selectedMoment.branch.map((move, index) => (
              <li className={index === selectedMoment.branch.length - 1 ? "is-active" : ""} key={`${move.san}-${index}`}>
                <span>{index + 1}. {move.san}</span>
                <strong>{analyzed ? move.badge : "◌"}</strong>
                <em>{index === selectedMoment.branch.length - 1 ? "actif" : move.note}</em>
              </li>
            ))}
          </ol>
        ) : (
          <p className="v2-vision-empty">Joue une idée sur l'échiquier.</p>
        )}
      </div>
    );
  }

  const activeFilter = pathFilters.find((item) => item.id === filter) ?? pathFilters[0];
  return (
    <div data-testid="v2-vision-left-moments">
      <span className="v2-vision-kicker">Chemin de décision</span>
      <h3>Moments clés</h3>
      <p className="v2-vision-summary-frieze" data-testid="v2-vision-summary-frieze">
        Moment {Math.max(1, visionMoments.findIndex((moment) => moment.id === selectedMomentId) + 1)} / {visionMoments.length} · Décision critique
      </p>
      <div className="v2-vision-filter-row" data-testid="v2-vision-summary-filters">
        {pathFilters.map((item) => {
          const count = filterMoments(item.id).length;
          return (
            <button
              className={filter === item.id ? "is-active" : ""}
              type="button"
              key={item.id}
              onClick={() => onFilter(item.id)}
              data-testid={`v2-vision-filter-${item.id}`}
            >
              {item.label} {count}
            </button>
          );
        })}
      </div>
      <p className="v2-vision-path-filter-summary" data-testid="v2-vision-path-filter-summary">
        {filteredMoments.length} {activeFilter.label.toLowerCase()} dans cette partie
      </p>
      <ol className="v2-vision-moment-list">
        {filteredMoments.slice(0, 5).map((moment) => (
          <li className={moment.id === selectedMomentId ? "is-active" : ""} key={moment.id}>
            <button
              type="button"
              onClick={() => onSelectMoment(moment.id)}
              data-testid={`v2-vision-path-moment-${moment.id}`}
            >
              <span>C{moment.moveNumber}</span>
              <strong>{moment.san} · {moment.shortCategory}</strong>
              <em>{moment.symbol} · {moment.pathStatus}</em>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DecisionModePanel({
  moment,
  state,
  setState,
}: {
  moment: VisionMoment;
  state: VisionState;
  setState: Dispatch<SetStateAction<VisionState>>;
}) {
  const openDetails = () => setState((current) => ({ ...current, detailsOpen: true }));

  if (state.decisionMode === "learn") {
    return (
      <div className="v2-vision-mode-panel v2-vision-learn-panel" data-testid="v2-vision-learn-panel">
        <span className="v2-vision-kicker">Mini-leçon</span>
        <h2>Apprendre l'idée</h2>
        <InfoRow label="Idée clé" value={moment.learnIdea} />
        <InfoRow label="Pourquoi" value={moment.learnWhy} />
        <div className="v2-vision-learn-checklist" data-testid="v2-vision-learn-checklist">
          <span>Checklist</span>
          <div>{moment.checklist.map((item) => <strong key={item}>{item}</strong>)}</div>
        </div>
        <InfoRow label="À retenir" value={moment.takeaway} />
        <InfoRow label="Mini-ligne" value={moment.line.join("  ")} />
        <button className="v2-vision-ghost" type="button" onClick={openDetails} data-testid="v2-vision-details-open">
          Détails avancés
        </button>
      </div>
    );
  }

  if (state.decisionMode === "replay") {
    const isActive = state.replayPhase === "active";
    const isFeedback = state.replayPhase === "feedback";
    return (
      <div className="v2-vision-mode-panel v2-vision-replay-panel" data-testid="v2-vision-replay-panel" data-replay-phase={state.replayPhase}>
        <span className="v2-vision-kicker">Effort actif</span>
        <h2>{isFeedback ? "Feedback" : isActive ? "À toi de jouer" : "Rejouer la décision"}</h2>
        <InfoRow label="Objectif" value="Retrouve le meilleur plan sans afficher la correction." />
        <InfoRow
          label="Consigne"
          value={
            isFeedback
              ? "Bien joué : tu neutralises le contre-jeu avant de reprendre le matériel."
              : isActive
                ? "Joue ton coup sur l'échiquier, ou demande une aide si tu bloques."
                : "Joue pour neutraliser le contre-jeu adverse."
          }
        />
        <InfoRow label="Aide disponible" value="Indice · Correction · Ligne après tentative." />
        <div className="v2-vision-replay-aids" data-testid="v2-vision-replay-aids">
          <span>Indice</span>
          <span>Correction</span>
          <span>Ligne après tentative</span>
        </div>
        <InfoRow
          label="Ensuite"
          value={isFeedback ? "Passe au prochain moment clé." : "Ta tentative sera comparée à la ligne de référence."}
        />
        <button className="v2-vision-ghost" type="button" onClick={openDetails} data-testid="v2-vision-details-open">
          Détails avancés
        </button>
      </div>
    );
  }

  if (state.decisionMode === "explore") {
    const lastMove = moment.branch[moment.branch.length - 1]?.san ?? "Aucun";
    const localSignal = getExplorerLocalSignal();
    return (
      <div className="v2-vision-mode-panel v2-vision-explore-panel" data-testid="v2-vision-explore-panel">
        <span className="v2-vision-local-watermark" aria-hidden="true">ATELIER</span>
        <span className="v2-vision-local-chip">{localSignal.chip}</span>
        <h2>Tester une alternative</h2>
        <p className="v2-vision-panel-note">{localSignal.subtitle}</p>
        <InfoRow label="Branche" value={`${moment.branch.length} coups`} />
        <InfoRow label="Dernier coup" value={lastMove} />
        <InfoRow label="Résultat" value={state.explorerAnalyzed ? "Ligne analysée · Jouable" : "Non analysé"} />
        <InfoRow
          label="À retenir"
          value={
            state.explorerAnalyzed
              ? "Le dernier coup reste défendable, mais donne une ressource."
              : "Teste une ligne, puis analyse-la ici."
          }
        />
        <div className="v2-vision-actions">
          <button className="v2-vision-ghost" type="button" onClick={openDetails} data-testid="v2-vision-details-open">
            Détails avancés
          </button>
          <button
            className="v2-vision-secondary"
            type="button"
            onClick={() => setState((current) => ({ ...current, overlay: "explorer" }))}
            data-testid="v2-vision-open-explorer"
          >
            Ouvrir Explorer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="v2-vision-mode-panel v2-vision-summary-panel" data-testid="v2-vision-summary-panel">
      <span className="v2-vision-kicker">Décision du moment</span>
      <h2>{moment.san} · {moment.verdict}</h2>
      <p className="v2-vision-summary-intent">Cette décision a changé le plan de la partie.</p>
      <InfoRow label="Pourquoi" value={moment.why} />
      <InfoRow label="Impact pratique" value={moment.impact} />
      <InfoRow label="Meilleure idée" value={moment.betterIdea} />
      <InfoRow label="Action recommandée" value={moment.action} />
      <button className="v2-vision-ghost" type="button" onClick={openDetails} data-testid="v2-vision-details-open">
        Détails avancés
      </button>
    </div>
  );
}

function DecisionActions({
  moment,
  state,
  setState,
}: {
  moment: VisionMoment;
  state: VisionState;
  setState: Dispatch<SetStateAction<VisionState>>;
}) {
  const openLine = () => setState((current) => ({ ...current, linePlayerOpen: true }));
  const setMode = (decisionMode: VisionDecisionMode) =>
    setState((current) => ({
      ...current,
      decisionMode,
      linePlayerOpen: false,
      detailsOpen: false,
      explorerAnalyzed: decisionMode === "explore" ? current.explorerAnalyzed : false,
    }));

  if (state.decisionMode === "learn") {
    return (
      <section className="v2-vision-action-dock" data-testid="v2-vision-action-dock">
        <span>Apprendre · ligne de référence disponible</span>
        <div className="v2-vision-actions">
          <button className="v2-vision-primary" type="button" onClick={openLine}>
            Voir la ligne
          </button>
          {moment.canReplay ? <button className="v2-vision-secondary" type="button" onClick={() => setMode("replay")}>Rejouer ce moment</button> : null}
          {moment.canExplore ? <button className="v2-vision-secondary" type="button" onClick={() => setMode("explore")}>Explorer depuis ici</button> : null}
        </div>
      </section>
    );
  }

  if (state.decisionMode === "replay") {
    const isActive = state.replayPhase === "active";
    const isFeedback = state.replayPhase === "feedback";
    const showFeedback = () => setState((current) => ({ ...current, replayPhase: "feedback" }));
    return (
      <section className="v2-vision-action-dock" data-testid="v2-vision-action-dock">
        <span>{isFeedback ? "Feedback affiché" : isActive ? "À toi de jouer" : "Prêt à rejouer"}</span>
        <div className="v2-vision-actions">
          <button
            className="v2-vision-primary"
            type="button"
            onClick={() =>
              setState((current) => ({
                ...current,
                replayPhase: isFeedback ? "idle" : isActive ? "feedback" : "active",
              }))
            }
            data-testid="v2-vision-replay-primary"
          >
            {isFeedback ? "Position suivante" : isActive ? "Valider le coup" : "Commencer la tentative"}
          </button>
          {isFeedback ? (
            <>
              <button className="v2-vision-secondary" type="button" onClick={openLine}>Revoir la ligne</button>
              <button className="v2-vision-secondary" type="button" onClick={() => setState((current) => ({ ...current, replayPhase: "idle" }))}>
                Réessayer
              </button>
            </>
          ) : isActive ? (
            <>
              <button className="v2-vision-secondary" type="button">Indice</button>
              <button className="v2-vision-secondary" type="button" onClick={showFeedback}>Voir correction</button>
              <button className="v2-vision-compact-button" type="button" onClick={showFeedback}>Passer</button>
            </>
          ) : (
            <button className="v2-vision-compact-button" type="button" disabled>
              Ligne après tentative
            </button>
          )}
        </div>
      </section>
    );
  }

  if (state.decisionMode === "explore") {
    const branchLength = moment.branch.length;
    const primaryLabel = branchLength >= 2 ? "Analyser la ligne" : "Analyser ce coup";
    return (
      <section className="v2-vision-action-dock v2-vision-explore-dock" data-testid="v2-vision-action-dock">
        <span>Atelier · {branchLength} coups · actif {moment.branch[branchLength - 1]?.san ?? moment.san}</span>
        <div className="v2-vision-segmented" role="group" aria-label="Préréglage analyse">
          <button type="button">Rapide</button>
          <button className="is-active" type="button">Standard</button>
          <button type="button">Précise</button>
        </div>
        <div className="v2-vision-actions">
          <button
            className="v2-vision-primary"
            type="button"
            onClick={() => setState((current) => ({ ...current, explorerAnalyzed: true }))}
            data-testid="v2-vision-analyze-line"
          >
            {primaryLabel}
          </button>
          {branchLength >= 2 ? <button className="v2-vision-secondary" type="button">Analyser ce coup</button> : null}
          <button className="v2-vision-compact-button" type="button">Annuler</button>
          <button className="v2-vision-compact-button" type="button">Tourner</button>
          <button className="v2-vision-secondary" type="button" onClick={() => setState((current) => ({ ...current, decisionMode: "summary", explorerAnalyzed: false }))}>
            Retour à la partie
          </button>
        </div>
      </section>
    );
  }

  const primaryLabel = moment.canReplay ? "Rejouer ce moment" : "Explorer depuis ici";
  return (
    <section className="v2-vision-action-dock" data-testid="v2-vision-action-dock">
      <span>{moment.pathStatus} · comprendre puis agir</span>
      <div className="v2-vision-actions">
        <button
          className="v2-vision-primary"
          type="button"
          onClick={() => setMode(moment.canReplay ? "replay" : "explore")}
        >
          {primaryLabel}
        </button>
        {moment.canReplay && moment.canExplore ? (
          <button className="v2-vision-secondary" type="button" onClick={() => setMode("explore")}>Explorer depuis ici</button>
        ) : null}
        <button className="v2-vision-secondary" type="button" onClick={openLine}>Voir la ligne</button>
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="v2-vision-info-row">
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}
