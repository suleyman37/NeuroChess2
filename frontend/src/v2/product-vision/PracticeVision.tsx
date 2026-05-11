import type { Dispatch, SetStateAction } from "react";
import { VisionBoard } from "./VisionBoard";
import { VisionLinePlayer } from "./VisionLinePlayer";
import { visionMoments, visionPracticeItems } from "./visionMockData";
import { getBoardStageTone, getModeNarrativeCopy, shouldShowDecisionGuides, type VisionState } from "./visionState";

type PracticeVisionProps = {
  state: VisionState;
  setState: Dispatch<SetStateAction<VisionState>>;
  onBack: () => void;
};

export function PracticeVision({ state, setState, onBack }: PracticeVisionProps) {
  const item = visionPracticeItems[state.selectedPracticeIndex] ?? visionPracticeItems[0];
  const moment = visionMoments.find((candidate) => candidate.id === item.momentId) ?? visionMoments[0];
  const phase = state.practicePhase;
  const boardTone = getBoardStageTone({
    surface: "practice",
    practicePhase: phase,
    linePlayerOpen: state.linePlayerOpen,
  });
  const narrative = getModeNarrativeCopy({
    surface: "practice",
    practicePhase: phase,
    linePlayerOpen: state.linePlayerOpen,
  });
  const showDecisionGuides = shouldShowDecisionGuides({
    surface: "practice",
    practicePhase: phase,
    linePlayerOpen: state.linePlayerOpen,
  });

  const selectItem = (index: number) =>
    setState((current) => ({
      ...current,
      selectedPracticeIndex: index,
      selectedMomentId: visionPracticeItems[index]?.momentId ?? moment.id,
      practicePhase: "ready",
      linePlayerOpen: false,
    }));

  const setPhase = (practicePhase: VisionState["practicePhase"]) =>
    setState((current) => ({
      ...current,
      practicePhase,
      linePlayerOpen: false,
    }));

  const nextPosition = () => {
    const nextIndex = (state.selectedPracticeIndex + 1) % visionPracticeItems.length;
    setState((current) => ({
      ...current,
      selectedPracticeIndex: nextIndex,
      selectedMomentId: visionPracticeItems[nextIndex]?.momentId ?? moment.id,
      practicePhase: "ready",
      linePlayerOpen: false,
    }));
  };

  return (
    <section
      className={`v2-vision-focus v2-vision-practice-focus is-${phase}`}
      data-practice-phase={phase}
      data-stage-tone={boardTone}
      data-testid="v2-vision-practice"
    >
      <aside className="v2-vision-rail v2-vision-practice-queue">
        <span className="v2-vision-kicker">File de session</span>
        <h3>Position {state.selectedPracticeIndex + 1} / {visionPracticeItems.length}</h3>
        <div className="v2-vision-session-progress" aria-hidden="true">
          <span style={{ width: `${((state.selectedPracticeIndex + 1) / visionPracticeItems.length) * 100}%` }} />
        </div>
        <ol className="v2-vision-training-list">
          {visionPracticeItems.map((candidate, index) => (
            <li className={index === state.selectedPracticeIndex ? "is-active" : ""} key={candidate.id}>
              <button type="button" onClick={() => selectItem(index)}>
                <span>{index + 1}</span>
                <strong>{candidate.label} · {candidate.type}</strong>
                <em>{index === state.selectedPracticeIndex ? "actif" : candidate.status}</em>
              </button>
            </li>
          ))}
        </ol>
        <p className="v2-vision-path-note">Régularité : 4 jours actifs cette semaine.</p>
      </aside>

      <section className={`v2-vision-board-stage v2-vision-practice-stage is-${phase}`} data-tone={boardTone}>
        <header className="v2-vision-board-strip">
          <button className="v2-vision-ghost" type="button" onClick={onBack}>Retour</button>
          <span>S'entraîner · {item.label} · {item.source}</span>
          <strong className={`v2-vision-score is-${moment.neuroBand}`}>{getDecisionStateLabel(moment.neuroBand)}</strong>
          <em className="v2-vision-mode-cue" data-testid="v2-vision-practice-cue">{narrative}</em>
        </header>
        <VisionBoard
          moment={moment}
          interactive
          mood={boardTone}
          showGuides={showDecisionGuides}
          testId="v2-vision-practice-board"
        />
        {state.linePlayerOpen ? (
          <VisionLinePlayer
            moment={moment}
            onClose={() => setState((current) => ({ ...current, linePlayerOpen: false }))}
          />
        ) : (
          <PracticeDock
            phase={phase}
            onStart={() => setPhase("attempting")}
            onValidate={() => setPhase("feedback_success")}
            onWrong={() => setPhase("feedback_wrong")}
            onCorrection={() => setPhase("correction")}
            onNext={nextPosition}
            onLine={() => setState((current) => ({ ...current, linePlayerOpen: true }))}
          />
        )}
      </section>

      <aside className="v2-vision-card v2-vision-practice-card">
        <PracticePanel phase={phase} item={item} momentSan={moment.san} narrative={narrative} />
      </aside>
    </section>
  );
}

function PracticePanel({
  phase,
  item,
  momentSan,
  narrative,
}: {
  phase: VisionState["practicePhase"];
  item: typeof visionPracticeItems[number];
  momentSan: string;
  narrative: string;
}) {
  if (phase === "attempting") {
    return (
      <div className="v2-vision-mode-panel" data-testid="v2-vision-practice-panel">
        <span className="v2-vision-kicker">Effort actif</span>
        <h2>À toi de jouer</h2>
        <p className="v2-vision-practice-intent">{narrative}</p>
        <InfoRow label="Consigne" value="Joue ton coup sur l'échiquier." />
        <InfoRow label="Aides" value="Indice, correction et passer restent disponibles en retrait." />
        <InfoRow label="Source" value={item.whyReturns} />
      </div>
    );
  }

  if (phase === "feedback_success") {
    return (
      <div className="v2-vision-mode-panel" data-testid="v2-vision-practice-panel">
        <span className="v2-vision-kicker">Feedback compact</span>
        <h2>Bien joué</h2>
        <p className="v2-vision-practice-intent">{narrative}</p>
        <InfoRow label="Message" value="Tu as retrouvé le plan principal." />
        <InfoRow label="Pourquoi" value="Tu neutralises le contre-jeu avant de reprendre le matériel." />
        <InfoRow label="À retenir" value="La bonne décision réduit les ressources adverses avant le gain." />
      </div>
    );
  }

  if (phase === "feedback_wrong") {
    return (
      <div className="v2-vision-mode-panel" data-testid="v2-vision-practice-panel">
        <span className="v2-vision-kicker">Feedback compact</span>
        <h2>À revoir</h2>
        <p className="v2-vision-practice-intent">{narrative}</p>
        <InfoRow label="Message" value="Cette réponse rate la ressource principale." />
        <InfoRow label="Prochain pas" value="Demande la correction ou reprends avec un indice." />
        <InfoRow label="Ton rythme" value="Tu peux ralentir : l'objectif est d'apprendre." />
      </div>
    );
  }

  if (phase === "correction") {
    return (
      <div className="v2-vision-mode-panel" data-testid="v2-vision-practice-panel">
        <span className="v2-vision-kicker">Correction</span>
        <h2>Correction</h2>
        <p className="v2-vision-practice-intent">{narrative}</p>
        <InfoRow label="Coup recommandé" value={`${momentSan} puis consolidation avant le matériel.`} />
        <InfoRow label="Idée" value="Couper la ressource active avant de reprendre l'initiative." />
        <InfoRow label="Ligne" value="Rejoue la ligne pour ancrer le plan." />
      </div>
    );
  }

  return (
    <div className="v2-vision-mode-panel" data-testid="v2-vision-practice-panel">
      <span className="v2-vision-kicker">Rejouer</span>
      <h2>Rejoue cette décision sans aide</h2>
      <p className="v2-vision-practice-intent">{narrative}</p>
      <InfoRow label="Consigne" value={item.instruction} />
      <InfoRow label="Pourquoi elle revient" value={item.whyReturns} />
      <InfoRow label="Source" value={`${item.source} · ${item.type}`} />
    </div>
  );
}

function PracticeDock({
  phase,
  onStart,
  onValidate,
  onWrong,
  onCorrection,
  onNext,
  onLine,
}: {
  phase: VisionState["practicePhase"];
  onStart: () => void;
  onValidate: () => void;
  onWrong: () => void;
  onCorrection: () => void;
  onNext: () => void;
  onLine: () => void;
}) {
  if (phase === "attempting") {
    return (
      <section className="v2-vision-action-dock" data-testid="v2-vision-practice-dock">
        <span>À toi de jouer · tentative active</span>
        <div className="v2-vision-actions">
          <button className="v2-vision-primary" type="button" onClick={onValidate} data-testid="v2-vision-practice-primary">
            Valider le coup
          </button>
          <button className="v2-vision-secondary" type="button">Indice</button>
          <button className="v2-vision-compact-button" type="button" onClick={onCorrection}>Voir correction</button>
          <button className="v2-vision-compact-button" type="button" onClick={onWrong}>Passer</button>
        </div>
      </section>
    );
  }

  if (phase === "feedback_success") {
    return (
      <section className="v2-vision-action-dock" data-testid="v2-vision-practice-dock">
        <span>Bien joué · ligne disponible</span>
        <div className="v2-vision-actions">
          <button className="v2-vision-primary" type="button" onClick={onNext} data-testid="v2-vision-practice-primary">
            Position suivante
          </button>
          <button className="v2-vision-secondary" type="button" onClick={onLine} data-testid="v2-vision-practice-open-line">Revoir la ligne</button>
          <button className="v2-vision-secondary" type="button" onClick={onStart}>Réessayer</button>
        </div>
      </section>
    );
  }

  if (phase === "feedback_wrong") {
    return (
      <section className="v2-vision-action-dock" data-testid="v2-vision-practice-dock">
        <span>À revoir · correction disponible</span>
        <div className="v2-vision-actions">
          <button className="v2-vision-primary" type="button" onClick={onCorrection} data-testid="v2-vision-practice-primary">
            Voir correction
          </button>
          <button className="v2-vision-secondary" type="button">Indice</button>
          <button className="v2-vision-secondary" type="button" onClick={onNext}>Passer</button>
        </div>
      </section>
    );
  }

  if (phase === "correction") {
    return (
      <section className="v2-vision-action-dock" data-testid="v2-vision-practice-dock">
        <span>Correction · compare avec la ligne</span>
        <div className="v2-vision-actions">
          <button className="v2-vision-primary" type="button" onClick={onNext} data-testid="v2-vision-practice-primary">
            Position suivante
          </button>
          <button className="v2-vision-secondary" type="button" onClick={onLine} data-testid="v2-vision-practice-open-line">Rejouer la ligne</button>
        </div>
      </section>
    );
  }

  return (
    <section className="v2-vision-action-dock" data-testid="v2-vision-practice-dock">
      <span>Prêt à commencer · retrouve le plan sans aide</span>
      <div className="v2-vision-actions">
        <button className="v2-vision-primary" type="button" onClick={onStart} data-testid="v2-vision-practice-primary">
          Commencer
        </button>
        <button className="v2-vision-compact-button" type="button" disabled>Ligne après tentative</button>
        <button className="v2-vision-secondary" type="button" onClick={onNext}>Passer</button>
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

function getDecisionStateLabel(band: string): string {
  if (band === "strong") return "Très solide";
  if (band === "solid") return "Solide";
  if (band === "watch") return "À consolider";
  return "À revoir";
}
