import { RexSurfaceHero } from "../components/RexSurfaceHero";
import type { RexQGMissionSnapshot, RexQGMissionSource } from "../data/rexQGMissionTypes";
import { useRexQGMissionSnapshot } from "../data/useRexQGMissionSnapshot";
import { getRexSurfaceCopy } from "../rexCopy";

const copy = getRexSurfaceCopy("qg");

export function QGSurface() {
  const snapshot = useRexQGMissionSnapshot();
  const mission = snapshot.mission;

  return (
    <section
      className={`rex-surface rex-surface--${copy.id}`}
      data-testid={copy.testId}
      data-rex-surface={copy.id}
      data-rex-tone={copy.tone}
    >
      <RexSurfaceHero
        copy={copy}
        ctaNote="Action secondaire prototype : le Mission Core reste prioritaire."
        ctaVariant="secondary"
      />

      <div className="rex-qg-mission-shell">
        <article
          className="rex-qg-mission-core"
          data-testid="rex-qg-mission-core"
          data-qg-source={snapshot.source}
          data-backend-status={snapshot.backendStatus}
        >
          <header className="rex-qg-mission-core__header">
            <span>Mission Core</span>
            <strong>{sourceLabel(snapshot.source)}</strong>
          </header>

          <div className="rex-qg-mission-core__body">
            <div className="rex-qg-mission-core__signal" aria-hidden="true">
              <span />
            </div>

            <div className="rex-qg-mission-core__copy">
              <p className="rex-qg-mission-core__proofline" data-testid="rex-qg-existing-data-proof">
                Mission proposée depuis données existantes
              </p>
              <h2 data-testid="rex-qg-mission-title">{mission?.title ?? "Lecture indisponible"}</h2>
              {mission?.subtitle ? <p className="rex-qg-mission-core__subtitle">{mission.subtitle}</p> : null}

              <div className="rex-qg-mission-core__actions">
                <button
                  type="button"
                  className="rex-qg-primary-action"
                  data-testid="rex-qg-primary-action"
                  data-action-status={mission?.primaryActionStatus ?? "disabled"}
                  disabled={mission?.primaryActionStatus !== "available"}
                  onClick={navigateToParties}
                >
                  {mission?.primaryActionLabel ?? "Indisponible"}
                </button>
                {mission?.primaryActionStatus === "prototype" ? (
                  <span className="rex-qg-action-badge">Prototype non-mutating</span>
                ) : null}
                {mission?.primaryActionStatus === "disabled" ? (
                  <span className="rex-qg-action-badge">Aucune action lancée</span>
                ) : null}
              </div>
            </div>
          </div>
        </article>

        <RexQGMissionPanel snapshot={snapshot} />
      </div>
    </section>
  );
}

function RexQGMissionPanel({ snapshot }: { snapshot: RexQGMissionSnapshot }) {
  const mission = snapshot.mission;
  return (
    <aside
      className="rex-instrument-brief rex-qg-readonly-panel"
      data-testid="rex-qg-readonly-panel"
      data-qg-source={snapshot.source}
      data-backend-status={snapshot.backendStatus}
      aria-label="Preuve read-only du QG"
    >
      <span className="rex-command-card__label">Source de mission</span>
      <h2>{sourceTitle(snapshot)}</h2>
      <p>{sourceBody(snapshot)}</p>

      <div className="rex-readonly-pill-row" aria-label="Garanties QG read-only">
        <span>Lecture seule</span>
        <span>Aucun write</span>
        <span>Aucun planning</span>
        <span>Aucun due_at</span>
      </div>

      <div className="rex-qg-evidence-grid" data-testid="rex-qg-mission-evidence">
        <EvidenceItem label="Source" value={sourceLabel(snapshot.source)} />
        <EvidenceItem label="Partie" value={mission?.evidence.gameLabel ?? "Non disponible"} />
        <EvidenceItem label="Ouverture" value={mission?.evidence.openingName ?? "Non disponible"} />
        <EvidenceItem label="Review" value={mission?.evidence.reviewStatus ?? "Non disponible"} />
        <EvidenceItem label="Moments" value={formatCount(mission?.evidence.momentCount)} />
        <EvidenceItem label="Coups lus" value={formatCount(mission?.evidence.movesCount)} />
      </div>

      <details className="rex-parties-readonly__technical" data-testid="rex-qg-technical-details">
        <summary>Détails techniques</summary>
        <div className="rex-parties-readonly__facts">
          <div>
            <span>Routes lues</span>
            <strong>{snapshot.readOnlyProof.routesUsed.join(", ") || "Aucune"}</strong>
          </div>
          <div>
            <span>Méthodes</span>
            <strong>{snapshot.readOnlyProof.methodsObserved.join(", ") || "GET"}</strong>
          </div>
          <div>
            <span>Écriture</span>
            <strong>{snapshot.readOnlyProof.writesObserved ? "Observée" : "Aucune"}</strong>
          </div>
          <div>
            <span>Planning</span>
            <strong>{snapshot.readOnlyProof.dailyPlanTouched ? "Touché" : "Non touché"}</strong>
          </div>
        </div>
      </details>

      <ul className="rex-parties-readonly__limits">
        {panelLimitations(snapshot).map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
      </ul>
    </aside>
  );
}

function EvidenceItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function navigateToParties() {
  const partiesButton = document.querySelector<HTMLButtonElement>('[data-testid="rex-nav-parties"]');
  partiesButton?.click();
}

function formatCount(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "Non disponible";
}

function sourceLabel(source: RexQGMissionSource): string {
  switch (source) {
    case "truth_chain_moments":
      return "Truth Chain moments";
    case "moves_only":
      return "Moves-only";
    case "latest_game":
      return "Dernière partie";
    case "empty":
      return "Aucune partie";
    case "unavailable":
      return "Lecture indisponible";
    default:
      return "Prototype";
  }
}

function sourceTitle(snapshot: RexQGMissionSnapshot): string {
  if (snapshot.backendStatus === "loading") {
    return "Lecture en cours";
  }
  if (snapshot.source === "truth_chain_moments") {
    return "Moments Review lus";
  }
  if (snapshot.source === "moves_only" || snapshot.source === "latest_game") {
    return "Historique lu · moments absents";
  }
  if (snapshot.source === "empty") {
    return "Aucune partie lue";
  }
  return "Lecture backend indisponible";
}

function sourceBody(snapshot: RexQGMissionSnapshot): string {
  if (snapshot.backendStatus === "loading") {
    return "Le QG cherche une priorité existante sans créer de plan.";
  }
  if (snapshot.source === "truth_chain_moments") {
    return "La mission utilise des moments persistés lus depuis la Truth Chain read-only.";
  }
  if (snapshot.source === "moves_only" || snapshot.source === "latest_game") {
    return "La dernière partie est lisible, mais aucun moment Review persisté n'est disponible.";
  }
  if (snapshot.source === "empty") {
    return "Le CTA Importer une partie reste un repère prototype et ne lance aucun import.";
  }
  return "Le shell reste propre en mode prototype.";
}

function panelLimitations(snapshot: RexQGMissionSnapshot): string[] {
  const missionLimitations = snapshot.mission?.limitations ?? [];
  return Array.from(new Set([...missionLimitations, ...snapshot.limitations])).slice(0, 5);
}
