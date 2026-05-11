import type { DecisionLabMode, DecisionLabMoment } from "./decisionLabMockData";
import type { DecisionLabExplorerResult, DecisionLabReplayPhase } from "./decisionLabState";

type DecisionCardProps = {
  activeMode: DecisionLabMode;
  moment: DecisionLabMoment;
  explorerResult: DecisionLabExplorerResult;
  replayPhase: DecisionLabReplayPhase;
  onOpenDetails: () => void;
};

type DecisionCardSection = {
  label: string;
  value: string;
};

export function DecisionCard({
  activeMode,
  moment,
  explorerResult,
  replayPhase,
  onOpenDetails,
}: DecisionCardProps) {
  const content = buildModeContent(activeMode, moment, explorerResult, replayPhase);
  return (
    <aside className="decision-lab-card" data-testid="decision-lab-card" data-mode={activeMode}>
      <div className="decision-lab-panel-heading">
        <span className="decision-lab-kicker">{content.kicker}</span>
        <h2>{content.title}</h2>
      </div>
      <div className="decision-lab-verdict">
        <span className={`decision-lab-badge ${getBadgeToneClass(content.badge)}`}>{content.badge}</span>
        <strong>{content.verdict}</strong>
      </div>
      <div className="decision-lab-card-sections">
        {content.sections.map((section) => (
          <article key={section.label} className="decision-lab-card-section">
            <span>{section.label}</span>
            <p>{section.value}</p>
          </article>
        ))}
      </div>
      <button
        className="decision-lab-ghost-button"
        type="button"
        onClick={onOpenDetails}
        data-testid="decision-lab-card-details"
      >
        Détails avancés
      </button>
    </aside>
  );
}

function getBadgeToneClass(badge: string): string {
  if (badge === "✓" || badge === "!") return "decision-lab-badge-good";
  if (badge === "?" || badge === "?!") return "decision-lab-badge-warning";
  if (badge === "↻") return "decision-lab-badge-refresh";
  return "decision-lab-badge-neutral";
}

function buildModeContent(
  mode: DecisionLabMode,
  moment: DecisionLabMoment,
  explorerResult: DecisionLabExplorerResult,
  replayPhase: DecisionLabReplayPhase,
) {
  if (mode === "learn") {
    return {
      kicker: "Apprendre",
      title: "Mini-leçon",
      verdict: moment.learnKeyIdea,
      badge: moment.verdictSymbol,
      sections: [
        { label: "Idée clé", value: moment.learnKeyIdea },
        { label: "Pourquoi", value: moment.learnWhy },
        { label: "Checklist", value: moment.learnChecklist.join(" → ") },
        { label: "À retenir", value: moment.learnTakeaway },
        { label: "Mini-ligne", value: moment.miniLine.join(" ") },
      ],
    };
  }

  if (mode === "replay") {
    if (replayPhase === "feedback") {
      return {
        kicker: "Rejouer",
        title: "Feedback",
        verdict: "Bien joué",
        badge: "✓",
        sections: [
          { label: "Résultat", value: moment.replayFeedbackGood },
          { label: "Pourquoi", value: moment.betterIdea },
          { label: "À retenir", value: moment.learnTakeaway },
        ],
      };
    }
    if (replayPhase === "attempting") {
      return {
        kicker: "Rejouer",
        title: "À toi de jouer",
        verdict: "Tentative en cours",
        badge: "◌",
        sections: [
          { label: "Consigne", value: "Joue ton coup sur l'échiquier ou valide la tentative." },
          { label: "Aide", value: "Indice · Correction · Passer." },
          { label: "Indice disponible", value: moment.replayHint },
        ],
      };
    }
    return {
      kicker: "Rejouer",
      title: "Effort actif",
      verdict: moment.canReplay ? "Prêt à rejouer" : "Pas de reprise",
      badge: moment.canReplay ? "!" : "◌",
      sections: [
        { label: "Objectif", value: moment.replayGoal },
        { label: "Consigne", value: moment.replayInstruction },
        { label: "Aide disponible", value: "Indice · Correction · Ligne après tentative." },
        { label: "Ensuite", value: "Ta tentative sera comparée à la ligne de référence." },
      ],
    };
  }

  if (mode === "explore") {
    const analyzed = explorerResult === "line" || explorerResult === "move";
    return {
      kicker: "Explorer",
      title: "Laboratoire local",
      verdict: analyzed ? moment.explorerResultAfterAnalysis : "Local · hors entraînement",
      badge: analyzed ? "=" : "↻",
      sections: [
        { label: "Branche", value: moment.explorerBranchSummary },
        { label: "Dernier coup", value: moment.explorerLastMove },
        { label: "Résultat", value: analyzed ? moment.explorerResultAfterAnalysis : moment.explorerResultBeforeAnalysis },
        {
          label: "À retenir",
          value: analyzed
            ? `${moment.explorerTakeaway} Cette exploration ne crée pas d'exercice.`
            : "Teste une ligne, puis analyse-la sans créer d'exercice.",
        },
      ],
    };
  }

  return {
    kicker: "Résumé",
    title: "Décision du moment",
    verdict: `${moment.playedMoveSan} · ${moment.verdictLabel}`,
    badge: moment.verdictSymbol,
    sections: [
      { label: "Pourquoi ce moment compte", value: moment.whyItMatters },
      { label: "Impact pratique", value: moment.practicalImpact },
      { label: "Meilleure idée", value: moment.betterIdea },
      { label: "Action recommandée", value: moment.recommendedAction },
    ],
  };
}
