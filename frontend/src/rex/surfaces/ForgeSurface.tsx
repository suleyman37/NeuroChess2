import { useEffect, useMemo, useState } from "react";
import { RexMiniBoard } from "../components/RexMiniBoard";
import type { RexForgeOpportunity, RexForgeSnapshot } from "../data/rexForgeTypes";
import { useRexForgeSnapshot } from "../data/useRexForgeSnapshot";
import { getRexSurfaceCopy } from "../rexCopy";

const copy = getRexSurfaceCopy("forge");

export function ForgeSurface() {
  const snapshot = useRexForgeSnapshot();
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | undefined>();
  const selectedOpportunity = useMemo(
    () =>
      snapshot.opportunities.find((opportunity) => opportunity.id === selectedOpportunityId) ??
      snapshot.opportunities[0],
    [selectedOpportunityId, snapshot.opportunities],
  );

  useEffect(() => {
    setSelectedOpportunityId(snapshot.opportunities[0]?.id);
  }, [snapshot.opportunities]);

  return (
    <section
      className={`rex-surface rex-surface--${copy.id}`}
      data-testid={copy.testId}
      data-rex-surface={copy.id}
      data-rex-tone={copy.tone}
    >
      <ForgeHero snapshot={snapshot} />

      <div className="rex-forge-preview-shell">
        <ForgeCorePreview
          snapshot={snapshot}
          selectedOpportunity={selectedOpportunity}
          onAction={() => handleOpportunityAction(selectedOpportunity)}
        />
        <ForgeOpportunityPanel
          opportunities={snapshot.opportunities}
          selectedOpportunityId={selectedOpportunity?.id}
          onSelectOpportunity={setSelectedOpportunityId}
        />
      </div>
    </section>
  );
}

function ForgeHero({ snapshot }: { snapshot: RexForgeSnapshot }) {
  return (
    <header className="rex-forge-hero">
      <div>
        <p className="rex-eyebrow">Atelier d'entraînement</p>
        <h1>Comment transformer cette matière en entraînement ?</h1>
        <p className="rex-surface__promise">
          Forge lit les moments existants et montre une preview. Aucun exercice n'est créé.
        </p>
      </div>

      <div className="rex-forge-hero__proof" aria-label="Contrat Forge read-only">
        <span>Preview read-only</span>
        <span>{sourceLabel(snapshot)}</span>
        <span>GET only</span>
        <span>0 write</span>
      </div>
    </header>
  );
}

function ForgeCorePreview({
  snapshot,
  selectedOpportunity,
  onAction,
}: {
  snapshot: RexForgeSnapshot;
  selectedOpportunity?: RexForgeOpportunity;
  onAction: () => void;
}) {
  const state = stateCopy(snapshot, selectedOpportunity);
  const selectedFen = selectedOpportunity?.fenBefore ?? selectedOpportunity?.fenAfter;
  const actionDisabled = !selectedOpportunity || selectedOpportunity.actionStatus === "disabled";

  return (
    <article
      className="rex-forge-core-preview"
      data-testid="rex-forge-core"
      data-forge-source={snapshot.source}
      data-backend-status={snapshot.backendStatus}
    >
      <div className="rex-forge-core-preview__header">
        <span>Forge Core</span>
        <strong>{state.badge}</strong>
      </div>

      <div className="rex-forge-core-preview__body">
        <div className="rex-forge-core-preview__position">
          <RexMiniBoard
            fen={selectedFen}
            label={selectedOpportunity ? `Position Forge ${selectedOpportunity.title}` : "Position Forge non disponible"}
          />
        </div>

        <div className="rex-forge-core-preview__copy">
          <p className="rex-forge-core-preview__proofline">Preview read-only</p>
          <h2 data-testid="rex-forge-title">{state.title}</h2>
          <p className="rex-forge-core-preview__subtitle" data-testid="rex-forge-subtitle">
            {state.body}
          </p>

          {selectedOpportunity ? (
            <div className="rex-forge-core-preview__selected" data-testid="rex-forge-selected-opportunity">
              <span>{opportunityKindLabel(selectedOpportunity)}</span>
              <strong>{selectedOpportunity.subtitle ?? selectedOpportunity.title}</strong>
              <em>{selectedOpportunity.uci ? `UCI ${selectedOpportunity.uci}` : "Position lue"}</em>
            </div>
          ) : null}

          <div className="rex-forge-core-preview__actions">
            <button
              type="button"
              className="rex-forge-action"
              data-testid="rex-forge-primary-action"
              data-action-status={selectedOpportunity?.actionStatus ?? "disabled"}
              disabled={actionDisabled}
              onClick={onAction}
            >
              {selectedOpportunity?.actionLabel ?? "Indisponible"}
            </button>
            <span className="rex-forge-action-badge">{state.actionStatus}</span>
          </div>
        </div>
      </div>

      <div className="rex-forge-core-preview__strip" aria-label="Garanties Forge">
        <span>Aucune création</span>
        <span>Aucun planning</span>
        <span>No Practice route</span>
        <span>No write</span>
      </div>

      <details className="rex-forge-core-preview__details" data-testid="rex-forge-technical-details">
        <summary>Détails read-only</summary>
        <div className="rex-forge-proof-grid">
          <ProofItem label="Routes lues" value={snapshot.readOnlyProof.routesUsed.join(", ") || "Aucune"} />
          <ProofItem label="Méthodes" value={snapshot.readOnlyProof.methodsObserved.join(", ") || "GET"} />
          <ProofItem label="Écriture" value={snapshot.readOnlyProof.writesObserved ? "Observée" : "Aucune"} />
          <ProofItem label="Planning" value={snapshot.readOnlyProof.dailyPlanTouched ? "Touché" : "Non touché"} />
        </div>
      </details>
    </article>
  );
}

function ForgeOpportunityPanel({
  opportunities,
  selectedOpportunityId,
  onSelectOpportunity,
}: {
  opportunities: RexForgeOpportunity[];
  selectedOpportunityId?: string;
  onSelectOpportunity: (id: string) => void;
}) {
  return (
    <aside
      className="rex-forge-opportunities"
      data-testid="rex-forge-opportunity-panel"
      aria-label="Opportunités Forge preview"
    >
      <span className="rex-command-card__label">Opportunités</span>
      <h2>Maximum 3 positions</h2>
      <p>Chaque carte vient d'une lecture existante. Forge montre le pont possible, sans le construire.</p>

      <div className="rex-forge-opportunity-list">
        {opportunities.slice(0, 3).map((opportunity) => (
          <button
            key={opportunity.id}
            type="button"
            className="rex-forge-opportunity"
            data-testid="rex-forge-opportunity"
            data-selected={opportunity.id === selectedOpportunityId ? "true" : "false"}
            data-action-status={opportunity.actionStatus}
            data-source={opportunity.source}
            onClick={() => onSelectOpportunity(opportunity.id)}
          >
            <span>{opportunityStatusLabel(opportunity)}</span>
            <strong>{opportunity.title}</strong>
            <em>{opportunity.subtitle ?? "Position lue"}</em>
          </button>
        ))}
      </div>

      <div className="rex-forge-limitations" aria-label="Limites Forge R3E">
        <span>Lecture seule</span>
        <span>Aucune création</span>
        <span>Preview uniquement</span>
      </div>
    </aside>
  );
}

function ProofItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function stateCopy(snapshot: RexForgeSnapshot, selectedOpportunity?: RexForgeOpportunity) {
  if (snapshot.backendStatus === "loading") {
    return {
      title: "Lecture des opportunités Forge",
      body: "Forge cherche une matière existante sans créer de contenu.",
      badge: "Chargement",
      actionStatus: "Aucune action lancée",
    };
  }

  if (snapshot.backendStatus === "unavailable") {
    return {
      title: "Lecture indisponible",
      body: "Forge reste lisible et ne tente aucun raccourci réseau.",
      badge: "Degraded",
      actionStatus: "Désactivé",
    };
  }

  if (snapshot.source === "empty") {
    return {
      title: "Importer une partie",
      body: "Le CTA est un prototype non-mutating. Aucune donnée n'est créée depuis REX.",
      badge: "Empty",
      actionStatus: "Prototype",
    };
  }

  if (snapshot.source === "moves_only") {
    return {
      title: "Partie lue · Forge non disponible",
      body: "Les coups sont disponibles, mais aucun moment Review persisté n'est prêt pour Forge.",
      badge: "Moves-only",
      actionStatus: "Navigation safe",
    };
  }

  if (selectedOpportunity?.exerciseAvailable) {
    return {
      title: "Exercice existant détecté",
      body: "Forge signale seulement une disponibilité déjà lue. R3E reste strictement sans Practice route.",
      badge: "Existant",
      actionStatus: "Position seulement",
    };
  }

  return {
    title: "Transformer un moment en entraînement",
    body: "Forge lit les moments existants. Aucun exercice n'est créé.",
    badge: "Truth Chain",
    actionStatus: "Preview read-only",
  };
}

function sourceLabel(snapshot: RexForgeSnapshot): string {
  switch (snapshot.source) {
    case "truth_chain_moments":
      return "Truth Chain";
    case "moves_only":
      return "Moves-only";
    case "existing_training_items":
      return "Existant";
    case "empty":
      return "Aucune partie";
    case "unavailable":
      return "Indisponible";
    default:
      return "Preview";
  }
}

function opportunityKindLabel(opportunity: RexForgeOpportunity): string {
  if (opportunity.exerciseAvailable) {
    return "Exercice existant détecté";
  }
  if (opportunity.source === "moves_only") {
    return "Forge non disponible";
  }
  return "Moment à transformer";
}

function opportunityStatusLabel(opportunity: RexForgeOpportunity): string {
  if (opportunity.exerciseAvailable) {
    return "Existant";
  }
  if (opportunity.source === "moves_only") {
    return "Moves-only";
  }
  if (opportunity.actionStatus === "prototype") {
    return "Prototype";
  }
  return "Preview";
}

function handleOpportunityAction(opportunity?: RexForgeOpportunity) {
  if (!opportunity) {
    return;
  }

  if (opportunity.actionLabel === "Voir la Truth Chain") {
    const partiesButton = document.querySelector<HTMLButtonElement>('[data-testid="rex-nav-parties"]');
    partiesButton?.click();
  }
}
