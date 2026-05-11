import type { Dispatch, SetStateAction } from "react";
import { VisionMiniBoard } from "./VisionMiniBoard";
import { todayBoardPreview } from "./visionMockData";
import type { VisionState } from "./visionState";
import { TodayHeroVisual } from "./visuals/TodayHeroVisual";

type TodayVisionProps = {
  setState: Dispatch<SetStateAction<VisionState>>;
};

export function TodayVision({ setState }: TodayVisionProps) {
  const decisionLoopSteps = ["Partie", "Décision", "Tentative", "Révision"];
  const focusItems = [
    { index: "01", title: "Revanche douce", meta: "sans aide", tone: "calm" },
    { index: "02", title: "Décision critique", meta: "Qxb7?", tone: "priority" },
    { index: "03", title: "Retour du motif", meta: "défense", tone: "review" },
  ];

  return (
    <section
      className="v2-vision-screen v2-vision-today"
      data-testid="v2-vision-today"
      data-storytelling="today"
    >
      <div
        className="v2-vision-hero v2-vision-today-cover"
        data-testid="v2-vision-today-hero"
        data-story-scene="today"
      >
        <TodayHeroVisual />
        <div className="v2-vision-hero-copy">
          <span className="v2-vision-kicker">Mission du jour</span>
          <strong className="v2-vision-north-star-label">Carnet de décisions</strong>
          <h2>Consolide ce qui revient vraiment dans tes parties.</h2>
          <p>12 minutes pour revoir une décision, tenter, puis revenir dessus.</p>
          <div className="v2-vision-hero-grid" aria-label="Résumé mission du jour">
            <strong><span>12</span> minutes</strong>
            <strong><span>4</span> positions à revoir</strong>
            <strong><span>1</span> décision critique</strong>
          </div>
          <div className="v2-vision-actions v2-vision-today-actions">
            <button
              className="v2-vision-primary v2-vision-start-cta"
              type="button"
              onClick={() => setState((current) => ({ ...current, overlay: "practice", practicePhase: "ready" }))}
              data-testid="v2-vision-today-start"
            >
              Commencer
            </button>
            <button
              className="v2-vision-secondary"
              type="button"
              onClick={() => setState((current) => ({ ...current, mainTab: "training", overlay: null }))}
            >
              Voir le plan du jour
            </button>
            <button
              className="v2-vision-secondary"
              type="button"
              onClick={() => setState((current) => ({ ...current, mainTab: "games", overlay: null }))}
            >
              Importer une partie
            </button>
          </div>
        </div>

        <aside
          className="v2-vision-today-visual v2-stage v2-vision-story-stage"
          aria-label="Aperçu mission"
          data-testid="v2-board-stage"
          data-tone="memory"
          data-board-state="memory"
          data-board-tone="memory"
          data-v2-stage="today-board"
          data-motion="subtle"
        >
          <div className="v2-stage__top">
            <span className="v2-stage__label">Décision du jour</span>
            <strong className="v2-stage__status">Qxb7? · Défense du roi</strong>
            <span className="v2-board-memory-token" aria-hidden="true">Mémoire</span>
          </div>
          <div className="v2-stage__board">
            <VisionMiniBoard
              fen={todayBoardPreview.fen}
              highlightSquare={todayBoardPreview.highlightSquare}
              arrow={todayBoardPreview.arrow}
              size="hero"
              mood="active"
              label={todayBoardPreview.label}
              testId="v2-vision-today-board-preview"
            />
          </div>
          <div className="v2-vision-flow-line v2-vision-decision-loop" data-testid="v2-vision-today-flow">
            <div
              className="v2-vision-loop-track"
              data-testid="v2-vision-today-decision-loop"
              data-storytelling="decision-loop"
              aria-label="Boucle de travail : partie, décision, tentative, révision"
            >
              {decisionLoopSteps.map((step, index) => (
                <span className="v2-vision-loop-node" key={step} data-step={index + 1}>
                  {step}
                </span>
              ))}
            </div>
          </div>
          <div
            className="v2-vision-memory-signal"
            data-testid="v2-vision-today-memory-signal"
            data-storytelling="review-signal"
            aria-label="Signal de révision du jour"
          >
            <span>3 à revoir</span>
            <i aria-hidden="true" />
            <span>2 consolidées</span>
            <i aria-hidden="true" />
            <span>1 revanche</span>
          </div>
          <p>Rejouer, vérifier, revenir.</p>
        </aside>

        <aside
          className="v2-vision-mission-stack v2-vision-today-rail v2-vision-focus-rail"
          data-testid="v2-vision-mission-stack"
          data-storytelling="session-focus-rail"
        >
          <div className="v2-vision-focus-rail-head" data-testid="v2-vision-today-focus-rail">
            <span className="v2-vision-kicker">File du jour</span>
            <strong>Priorité : défense du roi</strong>
          </div>
          {focusItems.map((item) => (
            <article
              className={`v2-vision-mission-item v2-vision-focus-card${item.tone === "priority" ? " is-priority" : ""}`}
              data-focus-tone={item.tone}
              key={item.index}
            >
              <span>{item.index}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.meta}</p>
              </div>
            </article>
          ))}
          <article className="v2-vision-panel v2-vision-progress-card" data-testid="v2-vision-today-progress">
            <span className="v2-vision-kicker">Progression compacte</span>
            <h3>18 décisions revues cette semaine</h3>
            <div className="v2-vision-progress-bars" aria-label="Domaines de progression">
              <div><span>Défense</span><strong>à consolider</strong></div>
              <div><span>Tactique</span><strong>en progrès</strong></div>
            </div>
          </article>
          <article className="v2-vision-panel v2-vision-xp-card" data-testid="v2-vision-today-regularity">
            <span className="v2-vision-kicker">Régularité</span>
            <h3>4 jours actifs</h3>
            <div className="v2-vision-regularity-pips" aria-label="Activité récente">
              <span data-level="3" />
              <span data-level="1" />
              <span data-level="2" />
              <span data-level="0" />
              <span data-level="3" />
              <span data-level="2" />
              <span data-level="1" />
            </div>
            <small>7 positions rejouées · 18 décisions revues</small>
          </article>
        </aside>
      </div>
    </section>
  );
}
