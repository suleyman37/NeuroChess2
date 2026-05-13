import type { RexSignalPreview } from "../rexTypes";

type RexSignalPillProps = {
  signal: RexSignalPreview;
};

export function RexSignalPill({ signal }: RexSignalPillProps) {
  return (
    <span className="rex-signal-pill">
      <span>{signal.label}</span>
      <strong>{signal.value}</strong>
    </span>
  );
}
