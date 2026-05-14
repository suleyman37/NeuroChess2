import { useState } from "react";
import type { RexSurfaceCopy } from "../rexTypes";
import type {
  RexPartiesSnapshot,
  RexTruthChainMoment,
  RexTruthChainSnapshot,
  RexTruthChainStatuses,
} from "../data/rexPartiesTypes";
import { RexConstellationPreview } from "./RexConstellationPreview";
import { RexFlowRail } from "./RexFlowRail";
import { RexMiniBoard } from "./RexMiniBoard";
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

function truthChainPlayers(chain: RexTruthChainSnapshot, latest: RexLatestGame): string {
  const game = chain.game;
  const players = [game?.white ?? latest.white, game?.black ?? latest.black].filter(Boolean).join(" vs ");
  return players || `Partie ${game?.id ?? latest.id}`;
}

function truthChainGameLine(chain: RexTruthChainSnapshot, latest: RexLatestGame): string {
  const game = chain.game;
  return [game?.result ?? latest.result, game?.openingName ?? latest.openingName, game?.eco]
    .filter(Boolean)
    .join(" - ") || "Resultat non disponible";
}

function momentCompactLabel(moment: RexTruthChainMoment): string {
  const move = moment.san ?? moment.uci ?? "coup";
  if (moment.moveNumber) {
    return moment.sideToMove === "black" ? `${moment.moveNumber}...${move}` : `${moment.moveNumber}.${move}`;
  }
  return `Ply ${moment.ply}`;
}

function momentStatus(moment: RexTruthChainMoment): string {
  if (moment.exerciseAvailable) {
    return "Exercice";
  }
  if (moment.source === "review_moment" || moment.source === "training_item") {
    return moment.reviewAvailable ? "Review lue" : "Moment lu";
  }
  if (moment.source === "moves_only") {
    return "Coup lu";
  }
  if (moment.reviewAvailable) {
    return "Statut lu";
  }
  return "Lu";
}

function momentSeverityLabel(moment: RexTruthChainMoment): string {
  if (moment.visualSeverity === "unknown") {
    return "Gravite a brancher";
  }
  return moment.visualSeverity;
}

function hasPersistedReviewMoments(moments: RexTruthChainMoment[]): boolean {
  return moments.some((moment) => moment.source === "review_moment" || moment.source === "training_item");
}

function TruthChainRealMovesStory({
  chain,
  snapshot,
}: {
  chain: RexTruthChainSnapshot;
  snapshot: RexPartiesSnapshot;
}) {
  const latest = snapshot.latestGame;
  const moments = chain.moments.slice(0, 5);
  const [selectedMomentId, setSelectedMomentId] = useState<string | undefined>();
  const selected = moments.find((moment) => moment.id === selectedMomentId) ?? moments[0];
  const hasPersistedMoments = hasPersistedReviewMoments(moments);
  const sourceLabel = hasPersistedMoments ? "MOMENTS REVIEW" : "MOVES-ONLY";
  const sourceChip = hasPersistedMoments ? "Review moments" : "Moves-only";
  const statusChip = hasPersistedMoments ? "Review lue" : "Statut lu";
  const countLabel = hasPersistedMoments ? `${moments.length} moments` : `${moments.length} coups`;
  const railLabel = hasPersistedMoments
    ? "Moments Review lus depuis la route Truth Chain"
    : "Cinq coups lus sans detection critique";

  if (!latest || moments.length === 0) {
    return null;
  }

  return (
    <div
      className="rex-real-chain"
      data-testid="rex-truth-chain-real"
      data-selected-node={selected.id}
      data-chain-source={hasPersistedMoments ? "moments-review" : "moves-only"}
    >
      <div className="rex-real-chain__source">
        <span>{sourceLabel}</span>
        <strong>{truthChainPlayers(chain, latest)}</strong>
        <em>{truthChainGameLine(chain, latest)}</em>
        <div className="rex-real-chain__chips" aria-label="Preuves read-only">
          <span>{sourceChip}</span>
          <span>{countLabel}</span>
          <span>{statusChip}</span>
          <span>GET only</span>
        </div>
      </div>

      <ol className="rex-real-chain__rail" aria-label={railLabel}>
        {moments.map((moment) => {
          const isSelected = selected.id === moment.id;
          return (
            <li key={moment.id}>
              <button
                className="rex-real-chain__node"
                data-testid="rex-truth-chain-node"
                data-selected={isSelected ? "true" : "false"}
                data-severity={moment.visualSeverity}
                data-chain-source={hasPersistedMoments ? "moments-review" : "moves-only"}
                onClick={() => setSelectedMomentId(moment.id)}
                onFocus={() => setSelectedMomentId(moment.id)}
                onMouseEnter={() => setSelectedMomentId(moment.id)}
                type="button"
              >
                <strong>{momentCompactLabel(moment)}</strong>
                <em>{momentStatus(moment)}</em>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="rex-position-lens" data-testid="rex-position-lens">
        <RexMiniBoard fen={selected.fenBefore} label={`Position lue avant ${momentCompactLabel(selected)}`} />
        <div className="rex-real-chain__focus-copy">
          <span>Position lue</span>
          <strong>{momentCompactLabel(selected)}</strong>
          <em>{selected.uci ? `UCI ${selected.uci}` : "UCI non disponible"}</em>
          <div className="rex-real-chain__chips" aria-label="Statuts du coup selectionne">
            <span>{momentSeverityLabel(selected)}</span>
            <span>Read-only</span>
            <span>No write</span>
            <span>No analyse</span>
            <span>{hasPersistedMoments ? "Source Review" : "Source moves"}</span>
          </div>
        </div>
      </div>

      <div className="rex-real-chain__proof" aria-label="Contrat read-only R2H">
        <span>Lecture seule</span>
        <span>Aucun write</span>
        <span>Aucun planning</span>
        <span>Review non appelee</span>
      </div>
    </div>
  );
}

function TruthChainLoadedStory({ snapshot }: { snapshot: RexPartiesSnapshot }) {
  const latest = snapshot.latestGame;
  if (!latest) {
    return null;
  }

  const realChain = snapshot.truthChainSnapshot;
  if (realChain && realChain.moments.length > 0) {
    return <TruthChainRealMovesStory chain={realChain} snapshot={snapshot} />;
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
