import type { Dispatch, SetStateAction } from "react";
import { VisionMiniBoard } from "./VisionMiniBoard";
import { visionMoments, visionPracticeItems } from "./visionMockData";
import type { VisionState } from "./visionState";

type TrainingVisionProps = {
  setState: Dispatch<SetStateAction<VisionState>>;
};

const dojoStats = [
  { label: "8 minutes", value: "session courte" },
  { label: "5 positions", value: "file du jour" },
  { label: "2 revanches", value: "sans aide" },
  { label: "1 défense", value: "à consolider" },
];

const dojoLanes = [
  {
    title: "Révision du jour",
    tag: "À revoir",
    copy: "Les décisions qui reviennent maintenant, sans surcharge.",
    meta: "5 positions",
  },
  {
    title: "Revanche contre toi-même",
    tag: "Revanche",
    copy: "Une position ratée hier, à rejouer sans aide visible.",
    meta: "2 revanches",
  },
  {
    title: "Erreurs à revoir",
    tag: "Erreur récurrente",
    copy: "Reprends le motif, puis compare avec la ligne.",
    meta: "3 décisions",
  },
];

export function TrainingVision({ setState }: TrainingVisionProps) {
  const previewMoment = visionMoments.find((moment) => moment.id === visionPracticeItems[0].momentId) ?? visionMoments[0];

  const openPractice = (index = 0) =>
    setState((current) => ({
      ...current,
      overlay: "practice",
      selectedPracticeIndex: index,
      selectedMomentId: visionPracticeItems[index]?.momentId ?? previewMoment.id,
      practicePhase: "ready",
      linePlayerOpen: false,
    }));

  return (
    <section className="v2-vision-screen v2-vision-training v2-vision-dojo" data-testid="v2-vision-training">
      <header className="v2-vision-dojo-hero">
        <div>
          <span className="v2-vision-kicker">Atelier personnel</span>
          <h2>Entraînement</h2>
          <p>Rejoue les décisions qui comptent vraiment.</p>
          <p className="v2-vision-dojo-brief">File du jour, revanches douces et positions issues de tes parties.</p>
          <div className="v2-vision-dojo-actions">
            <button
              className="v2-vision-primary"
              type="button"
              onClick={() => openPractice(0)}
              data-testid="v2-vision-training-start"
            >
              Commencer la session
            </button>
            <button className="v2-vision-secondary" type="button" onClick={() => document.querySelector('[data-testid="v2-vision-training-queue"]')?.scrollIntoView({ block: "center" })}>
              Voir la file du jour
            </button>
          </div>
        </div>
        <aside className="v2-vision-session-card" aria-label="Session du jour">
          <span className="v2-vision-kicker">Session du jour</span>
          <h3>File du jour</h3>
          <div className="v2-vision-dojo-stats">
            {dojoStats.map((stat) => (
              <div key={stat.label}>
                <strong>{stat.label}</strong>
                <span>{stat.value}</span>
              </div>
            ))}
          </div>
        </aside>
      </header>

      <div className="v2-vision-dojo-layout">
        <section className="v2-vision-dojo-main">
          <div className="v2-vision-dojo-lanes" data-testid="v2-vision-training-lanes">
            {dojoLanes.map((lane) => (
              <article className="v2-vision-panel v2-vision-dojo-lane" key={lane.title} data-lane-kind={lane.tag}>
                <span>{lane.tag}</span>
                <h3>{lane.title}</h3>
                <p>{lane.copy}</p>
                <em>{lane.meta}</em>
              </article>
            ))}
          </div>

          <article className="v2-vision-panel v2-vision-training-queue" data-testid="v2-vision-training-queue">
            <div className="v2-vision-section-head">
              <div>
                <span className="v2-vision-kicker">File de session</span>
                <h3>Position 1 / {visionPracticeItems.length}</h3>
              </div>
              <span className="v2-vision-effort-label">Engagement régulier</span>
            </div>
            <div className="v2-vision-session-progress" aria-hidden="true">
              <span style={{ width: "20%" }} />
            </div>
            <ol className="v2-vision-training-list">
              {visionPracticeItems.map((item, index) => (
                <li className={index === 0 ? "is-active" : ""} key={item.id}>
                  <button type="button" onClick={() => openPractice(index)}>
                    <span>{index + 1}</span>
                    <strong>{item.label} · {item.type}</strong>
                    <em>{item.status}</em>
                  </button>
                </li>
              ))}
            </ol>
          </article>

          <article className="v2-vision-panel v2-vision-revenge-card">
            <span className="v2-vision-kicker">Revanche douce</span>
            <h3>Tu as raté cette décision hier.</h3>
            <p>Rejoue-la sans aide, puis compare avec la ligne. Tu peux ralentir : l'objectif est d'apprendre.</p>
            <button className="v2-vision-secondary" type="button" onClick={() => openPractice(0)}>
              Rejouer cette position
            </button>
          </article>
        </section>

        <aside className="v2-vision-panel v2-vision-training-preview">
          <span className="v2-vision-kicker">Aperçu position</span>
          <h3>{previewMoment.san} · {visionPracticeItems[0].type}</h3>
          <VisionMiniBoard
            fen={previewMoment.fen}
            highlightSquare={previewMoment.highlights[0]}
            arrow={{ from: previewMoment.arrow[0], to: previewMoment.arrow[1] }}
            size="lg"
            mood="active"
            label={`Position d'entraînement · ${previewMoment.san}`}
            testId="v2-vision-training-preview-board"
          />
          <p>Issue de ta partie · défense à consolider.</p>
        </aside>
      </div>
    </section>
  );
}
