import type { RexSurfaceCopy } from "../rexTypes";
import type { RexPartiesSnapshot, RexTruthChainStatuses } from "../data/rexPartiesTypes";
import { RexConstellationPreview } from "./RexConstellationPreview";
import { RexFlowRail } from "./RexFlowRail";
import { RexProgressRing } from "./RexProgressRing";

type RexArtifactStageProps = {
  copy: RexSurfaceCopy;
  truthChain?: RexTruthChainStatuses;
  truthChainNotes?: string[];
  partiesSnapshot?: RexPartiesSnapshot;
};

function MissionCore({ copy }: RexArtifactStageProps) {
  return (
    <div className="rex-artifact rex-artifact--mission" data-testid="rex-artifact-mission-core">
      <div className="rex-artifact__header">
        <span>Mission Core</span>
        <strong>Priorite unique</strong>
      </div>
      <div className="rex-mission-core">
        <div className="rex-mission-core__orb" aria-hidden="true">
          <span />
        </div>
        <div className="rex-mission-core__copy">
          <p>Signal du jour</p>
          <h2>{copy.commandTitle}</h2>
          <span>{copy.commandBody}</span>
        </div>
      </div>
      <RexFlowRail steps={copy.flow} />
    </div>
  );
}

type RexLatestGame = NonNullable<RexPartiesSnapshot["latestGame"]>;

function gamePlayers(game: RexLatestGame): string {
  const players = [game.white, game.black].filter(Boolean).join(" vs ");
  return players || `Partie ${game.id}`;
}

function gameLine(game: RexLatestGame): string {
  return [game.result, game.openingName].filter(Boolean).join(" - ") || "Resultat non disponible";
}

function TruthChainLoadedStory({ snapshot }: { snapshot: RexPartiesSnapshot }) {
  const latest = snapshot.latestGame;
  if (!latest) {
    return null;
  }

  const reviewReady = latest.reviewStatus === "ready";
  const trainingAvailable = latest.trainingAvailable === true;
  const openingName = latest.openingName ?? "Ouverture non disponible";
  const transformSteps = [
    {
      label: "Analyse",
      status: snapshot.truthChain.analysis === "available" ? "Statut lu" : "Non disponible",
      state: snapshot.truthChain.analysis,
    },
    {
      label: "Decision",
      status: reviewReady ? "Review prete" : "En attente",
      state: reviewReady ? "available" : "pending",
    },
    {
      label: "Exercice",
      status: trainingAvailable ? "Lu" : "A brancher",
      state: trainingAvailable ? "available" : "unavailable",
    },
  ];

  return (
    <div className="rex-truth-chain__loaded-story" data-testid="rex-parties-loaded-story">
      <div className="rex-truth-chain__raw-game">
        <span>Matiere brute</span>
        <strong>{gamePlayers(latest)}</strong>
        <em>{gameLine(latest)}</em>
        <div className="rex-truth-chain__source-chips" aria-label="Preuves source">
          <span>PGN lu</span>
          <span>{snapshot.totalGames} parties</span>
          <span>0 write</span>
        </div>
      </div>

      <div className="rex-truth-chain__transform" aria-label="Transformation PGN vers entrainement read-only">
        <div className="rex-truth-chain__transform-line" aria-hidden="true" />
        {transformSteps.map((step, index) => (
          <div className="rex-truth-chain__node" data-node-status={step.state} key={step.label}>
            <span>{step.label}</span>
            <strong>{step.status}</strong>
            <i aria-hidden="true">{index + 2}</i>
          </div>
        ))}
      </div>

      <div className="rex-truth-chain__opening-signal">
        <span>Ouverture detectee</span>
        <strong>{openingName}</strong>
        <em>Plan post-ouverture plus tard</em>
      </div>

      <div className="rex-truth-chain__readonly-strip" aria-label="Contrat read-only Parties">
        <span>Lecture seule</span>
        <span>Aucun write</span>
        <span>Aucun effet planning</span>
      </div>
    </div>
  );
}

function TruthChain({ copy, truthChain, truthChainNotes, partiesSnapshot }: RexArtifactStageProps) {
  const statuses = truthChain
    ? [truthChain.pgn, truthChain.analysis, truthChain.criticalMoment, truthChain.exercise]
    : undefined;
  const hasRealPgn = truthChain?.pgn === "available";
  const isLoaded = partiesSnapshot?.backendStatus === "ready";

  return (
    <div
      className="rex-artifact rex-artifact--truth"
      data-testid="rex-artifact-truth-chain"
      data-truth-state={isLoaded ? "loaded" : hasRealPgn ? "partial" : "fallback"}
    >
      <div className="rex-artifact__header">
        <span>Truth Chain</span>
        <strong>PGN vers decision entrainable</strong>
      </div>
      {isLoaded ? <TruthChainLoadedStory snapshot={partiesSnapshot} /> : null}
      <RexFlowRail steps={copy.flow} statuses={statuses} statusNotes={truthChainNotes} />
      <div className="rex-truth-chain__verdict">
        <span>{hasRealPgn ? "Donnees reelles detectees" : "Lecture seule"}</span>
        <strong>
          {hasRealPgn
            ? "Decision lue, joueur respecte, aucune action backend."
            : "Lecture sans ecriture ni analyse."}
        </strong>
      </div>
    </div>
  );
}

function ForgeCore({ copy }: RexArtifactStageProps) {
  return (
    <div className="rex-artifact rex-artifact--forge" data-testid="rex-artifact-forge-core">
      <div className="rex-artifact__header">
        <span>Forge Core</span>
        <strong>Erreur vers drill puis rappel</strong>
      </div>
      <div className="rex-forge-core">
        <RexProgressRing label="Drill" tone="forge" />
        <div className="rex-forge-core__anvil" aria-hidden="true">
          <span />
        </div>
        <RexProgressRing label="Ligne" tone="forge" />
      </div>
      <RexFlowRail steps={copy.flow} />
    </div>
  );
}

function TransferLanes({ copy }: RexArtifactStageProps) {
  return (
    <div className="rex-artifact rex-artifact--transfer" data-testid="rex-artifact-transfer-lanes">
      <div className="rex-artifact__header">
        <span>Transfer Lanes</span>
        <strong>Entrainement vers vraie partie</strong>
      </div>
      <div className="rex-transfer-lanes" aria-label="Paliers de transfert prototype">
        {["Blitz", "Rapide", "Classique"].map((lane) => (
          <div className="rex-transfer-lane" key={lane}>
            <span>{lane}</span>
            <i aria-hidden="true" />
            <strong>palier prototype</strong>
          </div>
        ))}
      </div>
      <RexFlowRail steps={copy.flow} />
    </div>
  );
}

function ProgressionMap({ copy }: RexArtifactStageProps) {
  return (
    <div className="rex-artifact rex-artifact--profile" data-testid="rex-artifact-progression-map">
      <div className="rex-artifact__header">
        <span>Progression Map</span>
        <strong>Repertoire, rang, habitudes</strong>
      </div>
      <div className="rex-progression-map">
        <RexConstellationPreview />
        <div className="rex-rank-totem" aria-label="Rang prototype">
          <span>Rank Totem</span>
          <strong>Calculateur III</strong>
          <em>Prototype</em>
        </div>
        <div className="rex-habit-signal">
          <span>Habit Signal</span>
          <strong>Exemples observables seulement</strong>
        </div>
      </div>
      <RexFlowRail steps={copy.flow} />
    </div>
  );
}

export function RexArtifactStage({ copy, truthChain, truthChainNotes, partiesSnapshot }: RexArtifactStageProps) {
  switch (copy.id) {
    case "parties":
      return (
        <TruthChain
          copy={copy}
          truthChain={truthChain}
          truthChainNotes={truthChainNotes}
          partiesSnapshot={partiesSnapshot}
        />
      );
    case "forge":
      return <ForgeCore copy={copy} />;
    case "arene":
      return <TransferLanes copy={copy} />;
    case "profil":
      return <ProgressionMap copy={copy} />;
    case "qg":
    default:
      return <MissionCore copy={copy} />;
  }
}
