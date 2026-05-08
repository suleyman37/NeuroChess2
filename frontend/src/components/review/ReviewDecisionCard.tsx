import { fr } from "../../i18n";
import { MoveQualityBadge } from "./MoveQualityBadge";
import type { MoveQualityContext, MoveQualityGlyphId } from "./moveQualityGlyphs";

export type ReviewDecisionMoveRow = {
  label: string;
  move: string | null | undefined;
  qualityId?: MoveQualityGlyphId | null;
  qualityContext: MoveQualityContext;
  rowTestId: string;
  badgeTestId: string;
  legacyBadgeTestId?: string;
  detail?: string | null;
  showUnknownQuality?: boolean;
};

export type ReviewDecisionAction = {
  label: string;
  onClick: () => void;
  testId?: string;
  disabled?: boolean;
  title?: string;
};

export function ReviewDecisionCard({
  historical,
  bestIdea,
  attempt,
  why,
  whyLabel = fr.decisionCard.whyItMatters,
  momentLabel,
  microObservation = false,
  primaryAction,
  secondaryActions = [],
  actionRowTestId,
  className = "",
}: {
  historical: ReviewDecisionMoveRow;
  bestIdea?: ReviewDecisionMoveRow | null;
  attempt?: ReviewDecisionMoveRow | null;
  why?: string | null;
  whyLabel?: string;
  momentLabel?: string | null;
  microObservation?: boolean;
  primaryAction?: ReviewDecisionAction | null;
  secondaryActions?: ReviewDecisionAction[];
  actionRowTestId?: string;
  className?: string;
}) {
  const hasActions = Boolean(primaryAction) || secondaryActions.length > 0;
  return (
    <section
      className={["review-decision-card", className].filter(Boolean).join(" ")}
      aria-label={fr.decisionCard.title}
      data-testid="review-decision-card"
    >
      <div className="review-decision-card-head">
        <span>{fr.decisionCard.title}</span>
        {momentLabel && (
          <strong className="review-decision-moment-pill">
            {momentLabel}
          </strong>
        )}
        {microObservation && (
          <strong className="review-decision-micro">
            {fr.decisionCard.microGap}
          </strong>
        )}
      </div>
      <div className="review-decision-rows">
        <DecisionMoveRow row={historical} />
        {bestIdea && <DecisionMoveRow row={bestIdea} />}
        {attempt && <DecisionMoveRow row={attempt} />}
      </div>
      {(why || microObservation) && (
        <div className="review-decision-why">
          <span>{whyLabel}</span>
          <p>{why ?? fr.decisionCard.microGapDetail}</p>
        </div>
      )}
      {hasActions && (
        <div
          className="review-decision-actions review-action-row"
          data-testid={actionRowTestId}
        >
          <span>{fr.decisionCard.action}</span>
          <div>
            {primaryAction && (
              <span data-testid="review-decision-card-primary-action">
                <button
                  className="primary"
                  type="button"
                  onClick={primaryAction.onClick}
                  disabled={primaryAction.disabled}
                  title={primaryAction.title}
                  data-testid={primaryAction.testId}
                >
                  {primaryAction.label}
                </button>
              </span>
            )}
            {secondaryActions.map((action) => (
              <button
                key={`${action.label}-${action.testId ?? ""}`}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                title={action.title}
                data-testid={action.testId}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function DecisionMoveRow({ row }: { row: ReviewDecisionMoveRow }) {
  const qualityId = row.qualityId ?? (row.showUnknownQuality ? "unknown" : null);
  return (
    <div className="review-decision-row" data-testid={row.rowTestId}>
      <span>{row.label}</span>
      <strong>{row.move || fr.decisionCard.unavailableMove}</strong>
      {qualityId && (
        <span
          className="review-decision-badge-slot"
          data-testid={row.badgeTestId}
        >
          <MoveQualityBadge
            qualityId={qualityId}
            context={row.qualityContext}
            size="sm"
            testId={row.legacyBadgeTestId ?? `${row.badgeTestId}-inner`}
          />
        </span>
      )}
      {row.detail && <p>{row.detail}</p>}
    </div>
  );
}
