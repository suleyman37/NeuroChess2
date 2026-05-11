import { VisionMiniBoard } from "./VisionMiniBoard";
import {
  visionConsolidatedDecisions,
  visionProgressDays,
  visionProgressDomains,
  visionProgressPlan30,
  visionWeeklyEffort,
} from "./visionMockData";

type ProgressionVisionProps = {
  onBack: () => void;
};

export function ProgressionVision({ onBack }: ProgressionVisionProps) {
  const maxWeeklyDecision = Math.max(...visionWeeklyEffort.map((day) => day.decisions), 1);

  return (
    <section className="v2-vision-screen v2-vision-progression" data-testid="v2-vision-progression">
      <header className="v2-vision-section-head">
        <div>
          <span className="v2-vision-kicker">Progression</span>
          <h2>Tu reviens, tu rejoues, tu consolides</h2>
          <p className="v2-vision-section-subtitle">
            Cette semaine, tu as revu 18 décisions issues de 4 parties.
          </p>
        </div>
        <button className="v2-vision-ghost" type="button" onClick={onBack}>Retour</button>
      </header>

      <section className="v2-vision-panel v2-vision-progress-hero" data-testid="v2-vision-progression-narrative">
        <div>
          <span className="v2-vision-kicker">Régularité</span>
          <h3>18 décisions revues · 7 positions rejouées · 4 jours actifs</h3>
          <p>Ces indicateurs suivent ton effort et ta régularité, pas un niveau absolu.</p>
        </div>
        <div className="v2-vision-progress-hero-strip" aria-label="Résumé de progression">
          <span><strong>18</strong> décisions revues</span>
          <span><strong>7</strong> positions rejouées</span>
          <span><strong>4</strong> jours actifs</span>
        </div>
      </section>

      <div className="v2-vision-progress-layout">
        <article className="v2-vision-panel v2-vision-progress-heatmap-panel">
          <span className="v2-vision-kicker">Régularité 30 jours</span>
          <h3>Des retours courts, mais visibles</h3>
          <p>Chaque case représente un jour où tu as travaillé des décisions issues de tes parties.</p>
          <div className="v2-vision-heatmap" data-testid="v2-vision-progress-heatmap" aria-label="Régularité 30 jours">
            {visionProgressDays.map((day) => (
              <span
                key={day.day}
                title={`${day.label} · ${day.decisions} décisions · ${day.positions} positions`}
                data-intensity={day.intensity}
                data-decisions={day.decisions}
                aria-label={`${day.label}: ${day.decisions} décisions revues`}
              />
            ))}
          </div>
          <div className="v2-vision-heatmap-legend" aria-hidden="true">
            <span>moins</span>
            <i data-intensity="0" />
            <i data-intensity="1" />
            <i data-intensity="2" />
            <i data-intensity="3" />
            <i data-intensity="4" />
            <span>plus</span>
          </div>
        </article>

        <article className="v2-vision-panel v2-vision-weekly-effort-panel">
          <span className="v2-vision-kicker">Effort cette semaine</span>
          <h3>Revenir régulièrement</h3>
          <p>L'objectif est de revenir régulièrement, pas de tout faire en une fois.</p>
          <div className="v2-vision-weekly-chart" data-testid="v2-vision-weekly-effort" aria-label="Effort cette semaine">
            {visionWeeklyEffort.map((day) => (
              <div key={day.day} className="v2-vision-weekly-bar">
                <div className="v2-vision-weekly-track">
                  <span
                    style={{ height: `${Math.max(10, (day.decisions / maxWeeklyDecision) * 100)}%` }}
                    title={`${day.day}: ${day.decisions} décisions, ${day.positions} positions`}
                  />
                </div>
                <strong>{day.day}</strong>
                <small>{day.decisions}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="v2-vision-panel v2-vision-consolidated-panel" data-testid="v2-vision-consolidated-decisions">
          <span className="v2-vision-kicker">Décisions consolidées</span>
          <h3>Ce que tu as vraiment travaillé</h3>
          <div className="v2-vision-decision-review-list">
            {visionConsolidatedDecisions.map((decision) => (
              <div className={`v2-vision-reviewed-decision is-${decision.status.replace(/\s/g, "-")}`} key={decision.id}>
                <VisionMiniBoard
                  fen={decision.boardPreview.fen}
                  highlightSquare={decision.boardPreview.highlightSquare}
                  arrow={decision.boardPreview.arrow}
                  size="xs"
                  label={decision.boardPreview.label}
                  testId={`v2-vision-progress-board-${decision.id}`}
                />
                <div>
                  <strong>{decision.san}</strong>
                  <span>{decision.category} · {decision.dateLabel}</span>
                </div>
                <em>{decision.status}</em>
              </div>
            ))}
          </div>
        </article>

        <article className="v2-vision-panel v2-vision-domains-panel" data-testid="v2-vision-progress-domains">
          <span className="v2-vision-kicker">Domaines à consolider</span>
          <h3>Des repères qualitatifs</h3>
          <div className="v2-vision-domain-list">
            {visionProgressDomains.map((domain) => (
              <div className={`v2-vision-domain-row is-${domain.tone}`} key={domain.label}>
                <div>
                  <strong>{domain.label}</strong>
                  <span>{domain.decisions} décisions revues · {domain.state}</span>
                </div>
                <div className="v2-vision-domain-dots" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <i key={index} className={index < Math.min(domain.decisions, 5) ? "is-filled" : ""} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="v2-vision-panel v2-vision-plan30-panel" data-testid="v2-vision-progress-plan30">
          <span className="v2-vision-kicker">Plan 30 jours</span>
          <h3>Un plan d'activité, pas une promesse de niveau</h3>
          <div className="v2-vision-plan30-grid">
            {visionProgressPlan30.map((item) => (
              <span key={item.label}>
                <strong>{item.value}</strong>
                {item.label}
              </span>
            ))}
          </div>
          <p>Des sessions courtes pour revoir les décisions qui reviennent dans tes parties.</p>
        </article>
      </div>
    </section>
  );
}
