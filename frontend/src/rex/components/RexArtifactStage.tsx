import type { RexSurfaceCopy } from "../rexTypes";
import type { RexTruthChainStatuses } from "../data/rexPartiesTypes";
import { RexConstellationPreview } from "./RexConstellationPreview";
import { RexFlowRail } from "./RexFlowRail";
import { RexProgressRing } from "./RexProgressRing";

type RexArtifactStageProps = {
  copy: RexSurfaceCopy;
  truthChain?: RexTruthChainStatuses;
  truthChainNotes?: string[];
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

function TruthChain({ copy, truthChain, truthChainNotes }: RexArtifactStageProps) {
  const statuses = truthChain
    ? [truthChain.pgn, truthChain.analysis, truthChain.criticalMoment, truthChain.exercise]
    : undefined;
  const hasRealPgn = truthChain?.pgn === "available";

  return (
    <div className="rex-artifact rex-artifact--truth" data-testid="rex-artifact-truth-chain">
      <div className="rex-artifact__header">
        <span>Truth Chain</span>
        <strong>PGN vers decision entrainable</strong>
      </div>
      <RexFlowRail steps={copy.flow} statuses={statuses} statusNotes={truthChainNotes} />
      <div className="rex-truth-chain__verdict">
        <span>{hasRealPgn ? "Donnees reelles detectees" : "Lecture seule"}</span>
        <strong>
          {hasRealPgn
            ? "La décision peut être jugée ; aucune action backend n'est déclenchée."
            : "La chaîne tente une lecture des parties, sans écriture ni analyse."}
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

export function RexArtifactStage({ copy, truthChain, truthChainNotes }: RexArtifactStageProps) {
  switch (copy.id) {
    case "parties":
      return <TruthChain copy={copy} truthChain={truthChain} truthChainNotes={truthChainNotes} />;
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
