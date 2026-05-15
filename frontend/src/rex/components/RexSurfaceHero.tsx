import { RexPrototypeBadge } from "./RexPrototypeBadge";
import { RexSignalPill } from "./RexSignalPill";
import type { RexSurfaceCopy } from "../rexTypes";

type RexSurfaceHeroProps = {
  copy: RexSurfaceCopy;
  ctaNote?: string;
  ctaVariant?: "primary" | "secondary";
};

export function RexSurfaceHero({ copy, ctaNote, ctaVariant = "primary" }: RexSurfaceHeroProps) {
  return (
    <div className="rex-surface__hero">
      <div>
        <RexPrototypeBadge />
        <p className="rex-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.question}</h1>
        <p className="rex-surface__promise">{copy.promise}</p>
        <div className="rex-signal-row" aria-label="Signaux prototype">
          {copy.signals.map((signal) => (
            <RexSignalPill key={signal.label} signal={signal} />
          ))}
        </div>
      </div>
      <div className="rex-cta-stack">
        <button
          className={ctaVariant === "secondary" ? "rex-primary-cta rex-primary-cta--secondary" : "rex-primary-cta"}
          type="button"
          data-placeholder-action="true"
          data-cta-variant={ctaVariant}
        >
          {copy.ctaLabel}
        </button>
        {ctaNote ? <span className="rex-cta-note">{ctaNote}</span> : null}
      </div>
    </div>
  );
}
