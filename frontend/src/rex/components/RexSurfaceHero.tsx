import { RexPrototypeBadge } from "./RexPrototypeBadge";
import { RexSignalPill } from "./RexSignalPill";
import type { RexSurfaceCopy } from "../rexTypes";

type RexSurfaceHeroProps = {
  copy: RexSurfaceCopy;
};

export function RexSurfaceHero({ copy }: RexSurfaceHeroProps) {
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
      <button className="rex-primary-cta" type="button" data-placeholder-action="true">
        {copy.ctaLabel}
      </button>
    </div>
  );
}
