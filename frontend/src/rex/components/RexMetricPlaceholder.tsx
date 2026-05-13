import type { RexMetricPreview } from "../rexTypes";

type RexMetricPlaceholderProps = {
  metric: RexMetricPreview;
};

export function RexMetricPlaceholder({ metric }: RexMetricPlaceholderProps) {
  return (
    <div className="rex-metric-placeholder">
      <span className="rex-metric-placeholder__label">{metric.label}</span>
      <strong>{metric.value}</strong>
      <span className="rex-metric-placeholder__note">{metric.note}</span>
    </div>
  );
}
