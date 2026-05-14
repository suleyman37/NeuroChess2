import type { RexTruthChainStepStatus } from "../data/rexPartiesTypes";

type RexFlowRailProps = {
  steps: string[];
  statuses?: RexTruthChainStepStatus[];
  statusNotes?: string[];
};

const statusLabels: Record<RexTruthChainStepStatus, string> = {
  inactive: "À brancher",
  pending: "En attente",
  available: "Réel",
  unavailable: "Non disponible",
};

export function RexFlowRail({ steps, statuses, statusNotes }: RexFlowRailProps) {
  const shouldShowStatus = Boolean(statuses || statusNotes);

  return (
    <ol className="rex-flow-rail" aria-label="Flux prototype">
      {steps.map((step, index) => {
        const status = statuses?.[index] ?? "inactive";
        const note = statusNotes?.[index] ?? statusLabels[status];
        return (
          <li key={step} data-rex-step-status={status}>
            <span className="rex-flow-rail__index">{index + 1}</span>
            <span className="rex-flow-rail__step">{step}</span>
            {shouldShowStatus ? <span className="rex-flow-rail__status">{note}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
