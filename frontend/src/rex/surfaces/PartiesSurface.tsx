import { RexArtifactStage } from "../components/RexArtifactStage";
import { RexMetricPlaceholder } from "../components/RexMetricPlaceholder";
import { RexSurfaceCard } from "../components/RexSurfaceCard";
import { RexSurfaceHero } from "../components/RexSurfaceHero";
import { REX_PARTIES_ROUTE_SOURCES, type RexPartiesSnapshot } from "../data/rexPartiesTypes";
import { useRexPartiesSnapshot } from "../data/useRexPartiesSnapshot";
import { getRexSurfaceCopy } from "../rexCopy";
import type { RexMetricPreview, RexPreviewCard } from "../rexTypes";

const copy = getRexSurfaceCopy("parties");

export function PartiesSurface() {
  const snapshot = useRexPartiesSnapshot();
  const metrics = buildMetrics(snapshot);
  const cards = buildCards(snapshot);
  const truthChainNotes = buildTruthChainNotes(snapshot);

  return (
    <section
      className={`rex-surface rex-surface--${copy.id}`}
      data-testid={copy.testId}
      data-rex-surface={copy.id}
      data-rex-tone={copy.tone}
    >
      <RexSurfaceHero copy={copy} ctaNote="Import REX non branché dans cette mission." />

      <div className="rex-surface__instrument">
        <RexArtifactStage copy={copy} truthChain={snapshot.truthChain} truthChainNotes={truthChainNotes} />
        <RexPartiesReadOnlyPanel snapshot={snapshot} />
      </div>

      <div className="rex-surface__support">
        <div className="rex-metric-grid">
          {metrics.map((metric) => (
            <RexMetricPlaceholder key={metric.label} metric={metric} />
          ))}
        </div>
        <div className="rex-card-grid">
          {cards.map((card) => (
            <RexSurfaceCard key={card.title} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RexPartiesReadOnlyPanel({ snapshot }: { snapshot: RexPartiesSnapshot }) {
  const latest = snapshot.latestGame;
  const routeText = snapshot.routesUsed.join(", ");
  const basePath = routeText.includes("/games/history") ? "API_BASE_URL + /games/history" : "API_BASE_URL";

  return (
    <aside
      className="rex-instrument-brief rex-parties-readonly"
      aria-label="Connexion backend Parties en lecture seule"
      data-testid="rex-parties-readonly-panel"
      data-backend-status={snapshot.backendStatus}
    >
      <span className="rex-command-card__label">Etat de lecture</span>
      <h2 data-testid="rex-parties-backend-state">{backendStatusLabel(snapshot)}</h2>
      <p>{backendStatusBody(snapshot)}</p>

      <div className="rex-readonly-pill-row" aria-label="Garanties read-only">
        <span>Lecture seule</span>
        <span>Aucune ecriture</span>
        <span>Aucun effet planning</span>
      </div>

      <div className="rex-parties-latest">
        <span>Derniere partie</span>
        <strong>{latest ? latestGameLabel(latest) : "Non disponible"}</strong>
      </div>

      <details className="rex-parties-readonly__technical" data-testid="rex-parties-technical-details">
        <summary>Details techniques</summary>
        <div className="rex-parties-readonly__facts">
          <div>
            <span>Route appelee</span>
            <strong>{routeText}</strong>
          </div>
          <div>
            <span>Methode</span>
            <strong>GET uniquement</strong>
          </div>
          <div>
            <span>Base path</span>
            <strong>{basePath}</strong>
          </div>
          <div>
          <span>Écriture observée</span>
          <strong>Aucune</strong>
          </div>
        </div>
        <div className="rex-parties-readonly__evidence">
          <span>Source de verite des routes</span>
          <ul>
            {REX_PARTIES_ROUTE_SOURCES.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </div>
      </details>

      <ul className="rex-parties-readonly__limits">
        {snapshot.limitations.map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
      </ul>
    </aside>
  );
}

function backendStatusLabel(snapshot: RexPartiesSnapshot): string {
  if (snapshot.backendStatus === "loading") {
    return "Chargement des parties...";
  }
  if (snapshot.backendStatus === "unavailable") {
    return "Lecture backend indisponible";
  }
  if (snapshot.backendStatus === "empty") {
    return "Aucune partie réelle trouvée";
  }
  return "Données réelles détectées";
}

function backendStatusBody(snapshot: RexPartiesSnapshot): string {
  if (snapshot.backendStatus === "loading") {
    return "La Truth Chain interroge l'historique existant sans lancer d'analyse.";
  }
  if (snapshot.backendStatus === "unavailable") {
    return "Le shell reste en mode prototype. Aucune analyse, aucun import, aucun Daily Plan.";
  }
  if (snapshot.backendStatus === "empty") {
    return "Le CTA reste un repère de navigation : l'import REX n'est pas branché dans R2B.";
  }
  return "Les parties viennent de l'historique existant. L'exercice reste à brancher plus tard.";
}

function latestGameLabel(game: NonNullable<RexPartiesSnapshot["latestGame"]>): string {
  const players = [game.white, game.black].filter(Boolean).join(" - ");
  return [players || `Partie ${game.id}`, game.result, game.openingName].filter(Boolean).join(" - ");
}

function buildTruthChainNotes(snapshot: RexPartiesSnapshot): string[] {
  if (snapshot.backendStatus === "loading") {
    return ["source recherchée", "non disponible", "en attente de Review", "à brancher plus tard"];
  }
  if (snapshot.backendStatus === "unavailable") {
    return ["backend indisponible", "non disponible", "en attente de Review", "à brancher plus tard"];
  }
  if (snapshot.backendStatus === "empty") {
    return ["aucune partie chargée", "non disponible", "en attente de Review", "à brancher plus tard"];
  }
  return [
    "source détectée",
    snapshot.truthChain.analysis === "available" ? "disponible" : "non disponible",
    snapshot.truthChain.criticalMoment === "available" ? "Review prête" : "en attente de Review",
    "à brancher plus tard",
  ];
}

function buildMetrics(snapshot: RexPartiesSnapshot): RexMetricPreview[] {
  const reviewReadyCount = snapshot.reviewReadyCount ?? 0;

  return [
    {
      label: "Parties reelles",
      value: snapshot.backendStatus === "loading" ? "Chargement" : String(snapshot.totalGames),
      note:
        snapshot.backendStatus === "ready"
          ? "Nombre retourne par l'historique read-only."
          : "Aucune donnee inventee.",
    },
    {
      label: "Review",
      value:
        snapshot.backendStatus === "ready"
          ? reviewReadyCount > 0
            ? `${reviewReadyCount} prete(s)`
            : "Non disponible"
          : "Non disponible",
      note: "Statut lu depuis l'historique, sans appeler Review direct.",
    },
    {
      label: "Exercice",
      value: "A brancher",
      note: "Aucune session ni training item cree en R2B.",
    },
  ];
}

function buildCards(snapshot: RexPartiesSnapshot): RexPreviewCard[] {
  const latest = snapshot.latestGame;

  if (snapshot.backendStatus === "unavailable") {
    return [
      {
        title: "Mode degrade",
        body: "Backend indisponible - affichage prototype conserve sans crash.",
        status: "Fallback",
      },
      {
        title: "Lecture seule",
        body: "La surface ne declenche ni import, ni analyse, ni Daily Plan.",
        status: "Contrat",
      },
      copy.cards[2],
    ];
  }

  if (snapshot.backendStatus === "empty") {
    return [
      {
        title: "Historique vide",
        body: "Aucune partie reelle n'est retournee par la route existante.",
        status: "Empty",
      },
      {
        title: "Import non branche",
        body: "Le CTA reste placeholder tant qu'une mission dediee ne connecte pas l'import.",
        status: "Safe",
      },
      copy.cards[2],
    ];
  }

  return [
    {
      title: "Derniere partie",
      body: latest ? latestGameLabel(latest) : "En attente de donnees d'historique.",
      status: snapshot.backendStatus === "loading" ? "Loading" : "Reel",
    },
    {
      title: "Review franche",
      body:
        latest?.reviewStatus === "ready"
          ? "Review prete dans l'historique. Aucun payload Review direct n'est appele ici."
          : "Review non disponible ou non prete dans l'historique.",
      status: latest?.reviewStatus === "ready" ? "Prete" : "A brancher",
    },
    {
      title: "Decision rejouable",
      body: "Les exercices restent hors scope : aucun training item n'est cree par R2B.",
      status: "Read-only",
    },
  ];
}
