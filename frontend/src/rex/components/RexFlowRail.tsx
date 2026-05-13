type RexFlowRailProps = {
  steps: string[];
};

export function RexFlowRail({ steps }: RexFlowRailProps) {
  return (
    <ol className="rex-flow-rail" aria-label="Flux prototype">
      {steps.map((step, index) => (
        <li key={step}>
          <span className="rex-flow-rail__index">{index + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
