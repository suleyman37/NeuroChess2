import type { Dispatch, SetStateAction } from "react";
import { VisionBoard } from "./VisionBoard";
import { VisionLinePlayer } from "./VisionLinePlayer";
import { visionMoments } from "./visionMockData";
import {
  canShowSolutionGuidesForBoardState,
  getBoardExperienceState,
  getBoardExperienceTone,
  getBoardStateCopy,
  getExplorerLocalSignal,
  shouldShowDecisionGuides,
  type VisionState,
} from "./visionState";

type ExplorerVisionProps = {
  state: VisionState;
  setState: Dispatch<SetStateAction<VisionState>>;
  onBack: () => void;
};

export function ExplorerVision({ state, setState, onBack }: ExplorerVisionProps) {
  const moment = visionMoments.find((candidate) => candidate.id === state.selectedMomentId) ?? visionMoments[0];
  const phase = state.explorerAnalyzed ? "analyzed" : state.explorerPhase;
  const hasBranch = phase !== "initial";
  const analyzed = phase === "analyzed";
  const analyzing = phase === "analyzing";
  const localSignal = getExplorerLocalSignal();
  const boardExperienceState = getBoardExperienceState({
    view: "explorer",
    explorerState: analyzed ? "analysis" : phase === "initial" ? "empty" : "branch",
  });
  const boardTone = getBoardExperienceTone(boardExperienceState);
  const boardStateCopy = getBoardStateCopy(boardExperienceState);
  const showDecisionGuides =
    canShowSolutionGuidesForBoardState(boardExperienceState) &&
    shouldShowDecisionGuides({
      surface: "explorer",
      explorerPhase: phase,
      explorerAnalyzed: analyzed,
      linePlayerOpen: state.linePlayerOpen,
    });

  const createBranch = () =>
    setState((current) => ({
      ...current,
      explorerPhase: "branch",
      explorerAnalyzed: false,
      linePlayerOpen: false,
    }));

  const analyzeLine = () => {
    setState((current) => ({
      ...current,
      explorerPhase: "analyzing",
      explorerAnalyzed: false,
      linePlayerOpen: false,
    }));
    window.setTimeout(() => {
      setState((current) => ({
        ...current,
        explorerPhase: "analyzed",
        explorerAnalyzed: true,
      }));
    }, 420);
  };

  const editBranch = () =>
    setState((current) => ({
      ...current,
      explorerPhase: "branch",
      explorerAnalyzed: false,
      linePlayerOpen: false,
    }));

  return (
    <section
      className={`v2-vision-focus v2-vision-explorer-lab is-${phase}`}
      data-stage-tone={boardTone}
      data-board-state={boardExperienceState}
      data-testid="v2-vision-explorer"
    >
      <aside className="v2-vision-rail v2-vision-explorer-rail">
        <span className="v2-vision-kicker">Atelier</span>
        <h3>Branche</h3>
        {hasBranch ? (
          <ol className="v2-vision-branch-list" data-testid="v2-vision-explorer-branch">
            {moment.branch.map((move, index) => (
              <li className={index === moment.branch.length - 1 ? "is-active" : ""} key={`${move.san}-${index}`}>
                <span>{index + 1}. {move.san}</span>
                <strong>{analyzed ? move.badge : "◌"}</strong>
                <em>{index === moment.branch.length - 1 ? "actif" : move.note}</em>
              </li>
            ))}
          </ol>
        ) : (
          <p className="v2-vision-empty" data-testid="v2-vision-explorer-empty">
            Joue une idée sur l'échiquier.
          </p>
        )}
      </aside>

      <section
        className={`v2-vision-board-stage v2-vision-explorer-stage is-${phase}`}
        data-tone={boardTone}
        data-board-state={boardExperienceState}
        data-board-tone={boardTone}
      >
        <header className="v2-vision-board-strip">
          <button className="v2-vision-ghost" type="button" onClick={onBack}>Retour</button>
          <span>Explorer · idée testée</span>
          <strong className="v2-vision-local-chip">{localSignal.chip}</strong>
          <span
            className="v2-stage__meta"
            data-testid="v2-vision-explorer-state-meta"
            data-state-copy={boardStateCopy.microcopy}
            aria-label={`${boardStateCopy.label}. ${boardStateCopy.microcopy}`}
          >
            <span className="v2-stage__state-pill v2-vision-mode-cue" data-testid="v2-vision-explorer-cue">
              {boardStateCopy.label}
            </span>
          </span>
        </header>
        <VisionBoard
          moment={moment}
          interactive
          mood={boardTone}
          experienceState={boardExperienceState}
          showGuides={showDecisionGuides}
          testId="v2-vision-explorer-board"
        />
        {state.linePlayerOpen ? (
          <VisionLinePlayer
            moment={moment}
            label="Branche"
            onClose={() => setState((current) => ({ ...current, linePlayerOpen: false }))}
          />
        ) : (
          <ExplorerDock
            phase={phase}
            branchLength={moment.branch.length}
            activeMove={moment.branch[moment.branch.length - 1]?.san ?? moment.san}
            onCreateBranch={createBranch}
            onAnalyzeLine={analyzeLine}
            onEditBranch={editBranch}
            onLine={() => setState((current) => ({ ...current, linePlayerOpen: true }))}
            onBack={onBack}
          />
        )}
      </section>

      <aside className="v2-vision-card v2-vision-explorer-result">
        <span className="v2-vision-kicker">Résultat</span>
        <h2>Est-ce que mon idée tient ?</h2>
        <p className="v2-vision-panel-note">{localSignal.subtitle}</p>
        <InfoRow label="Statut" value={analyzing ? "Évaluation de la ligne..." : analyzed ? "Ligne jouable" : hasBranch ? "Branche prête" : "En attente d'une branche"} />
        <InfoRow label="Dernier coup" value={hasBranch ? moment.branch[moment.branch.length - 1]?.san ?? moment.san : "Aucun coup"} />
        <InfoRow
          label="À retenir"
          value={
            analyzed
              ? "Le dernier coup donne une ressource, mais la ligne reste défendable."
              : "Teste une branche, puis analyse-la ici."
          }
        />
      </aside>
    </section>
  );
}

function ExplorerDock({
  phase,
  branchLength,
  activeMove,
  onCreateBranch,
  onAnalyzeLine,
  onEditBranch,
  onLine,
  onBack,
}: {
  phase: VisionState["explorerPhase"] | "analyzed";
  branchLength: number;
  activeMove: string;
  onCreateBranch: () => void;
  onAnalyzeLine: () => void;
  onEditBranch: () => void;
  onLine: () => void;
  onBack: () => void;
}) {
  if (phase === "initial") {
    return (
      <section className="v2-vision-action-dock" data-testid="v2-vision-explorer-dock">
        <span>Branche vide · joue une idée</span>
        <div className="v2-vision-actions">
          <button className="v2-vision-primary" type="button" onClick={onCreateBranch} data-testid="v2-vision-explorer-create-branch">
            Créer une branche
          </button>
          <button className="v2-vision-secondary" type="button" onClick={onBack}>Retour à la partie</button>
        </div>
      </section>
    );
  }

  if (phase === "analyzing") {
    return (
      <section className="v2-vision-action-dock" data-testid="v2-vision-explorer-dock">
        <span>Évaluation de la ligne... · échiquier stable</span>
        <div className="v2-vision-actions">
          <button className="v2-vision-primary" type="button" disabled>
            Analyse en cours
          </button>
          <button className="v2-vision-secondary" type="button" onClick={onBack}>Retour à la partie</button>
        </div>
      </section>
    );
  }

  if (phase === "analyzed") {
    return (
      <section className="v2-vision-action-dock" data-testid="v2-vision-explorer-dock">
        <span>Branche · {branchLength} coups · résultat disponible</span>
        <div className="v2-vision-actions">
          <button className="v2-vision-primary" type="button" onClick={onEditBranch}>
            Modifier la branche
          </button>
          <button className="v2-vision-secondary" type="button" onClick={onLine} data-testid="v2-vision-explorer-open-line">Rejouer la branche</button>
          <button className="v2-vision-secondary" type="button" onClick={onBack}>Retour à la partie</button>
        </div>
      </section>
    );
  }

  return (
    <section className="v2-vision-action-dock v2-vision-explore-dock" data-testid="v2-vision-explorer-dock">
      <span>Atelier · {branchLength} coups · actif {activeMove}</span>
      <div className="v2-vision-segmented" role="group" aria-label="Préréglage analyse">
        <button type="button">Rapide</button>
        <button className="is-active" type="button">Standard</button>
        <button type="button">Précise</button>
      </div>
      <div className="v2-vision-actions">
        <button
          className="v2-vision-primary"
          type="button"
          onClick={onAnalyzeLine}
          data-testid="v2-vision-explorer-analyze-line"
        >
          Analyser la ligne
        </button>
        <button className="v2-vision-secondary" type="button">Analyser ce coup</button>
        <button className="v2-vision-compact-button" type="button">Annuler</button>
        <button className="v2-vision-compact-button" type="button">Tourner</button>
        <button className="v2-vision-secondary" type="button" onClick={onBack}>Retour à la partie</button>
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
