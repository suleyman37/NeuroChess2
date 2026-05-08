import { fr } from "../../i18n";
import {
  getMoveQualityGlyphDefinition,
  type MoveQualityContext,
  type MoveQualityGlyphId,
} from "./moveQualityGlyphs";

export function MoveQualityBadge({
  qualityId,
  context = "attempt",
  size = "md",
  showLabel = true,
  showDescription = false,
  testId = "move-quality-badge",
  className = "",
}: {
  qualityId: MoveQualityGlyphId | null | undefined;
  context?: MoveQualityContext;
  size?: "sm" | "md";
  showLabel?: boolean;
  showDescription?: boolean;
  testId?: string;
  className?: string;
}) {
  const definition = getMoveQualityGlyphDefinition(qualityId);
  const contextLabel = fr.moveQuality.contexts[context];
  const ariaLabel = `${contextLabel} : ${definition.label}. ${definition.shortDescription}`;
  return (
    <span
      className={[
        "nc-move-quality-badge",
        `nc-move-quality-badge--${definition.tone}`,
        `nc-move-quality-badge--${size}`,
        className,
      ].filter(Boolean).join(" ")}
      data-testid={testId}
      data-quality-id={definition.id}
      data-quality-context={context}
      aria-label={ariaLabel}
    >
      <span className="nc-move-quality-glyph" data-testid="move-quality-badge-glyph">
        {definition.glyph}
      </span>
      {showLabel && (
        <span className="nc-move-quality-label" data-testid="move-quality-badge-label">
          {definition.label}
        </span>
      )}
      {showDescription && (
        <span className="nc-move-quality-description">
          {definition.shortDescription}
        </span>
      )}
    </span>
  );
}
