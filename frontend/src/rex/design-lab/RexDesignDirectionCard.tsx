import type { RexDesignDirection } from "./designDirections";

interface RexDesignDirectionCardProps {
  direction: RexDesignDirection;
}

export function RexDesignDirectionCard({ direction }: RexDesignDirectionCardProps) {
  return (
    <article className="rex-design-direction-card" aria-label={`Direction ${direction.title}`}>
      <div className="rex-design-direction-card__topline">
        <span>Direction candidate</span>
        <em>{direction.navLabel}</em>
      </div>
      <h2>{direction.title}</h2>
      <p className="rex-design-direction-card__intent">{direction.intent}</p>
      <p className="rex-design-direction-card__vibe">{direction.vibe}</p>
      <div className="rex-design-direction-card__columns">
        <section>
          <h3>Forces</h3>
          <ul>
            {direction.strengths.map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>Risques</h3>
          <ul>
            {direction.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  );
}

