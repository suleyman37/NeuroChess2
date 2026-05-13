import { rexPrototypeLabel } from "../rexCopy";

type RexPrototypeBadgeProps = {
  compact?: boolean;
};

export function RexPrototypeBadge({ compact = false }: RexPrototypeBadgeProps) {
  return (
    <span className={compact ? "rex-prototype-badge compact" : "rex-prototype-badge"}>
      {rexPrototypeLabel}
    </span>
  );
}
