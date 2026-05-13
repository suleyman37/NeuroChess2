import { useMemo, useState } from "react";
import { rexDesignDirections, type RexDesignDirectionId } from "./designDirections";
import { RexDesignDirectionCard } from "./RexDesignDirectionCard";
import { RexDesignLabNav } from "./RexDesignLabNav";
import { ForgeArenaRpgDirection } from "./directions/ForgeArenaRpgDirection";
import { ProgressionConstellationDirection } from "./directions/ProgressionConstellationDirection";
import { TacticalCommandDirection } from "./directions/TacticalCommandDirection";
import "./designLabStyles.css";

function renderDirectionPreview(directionId: RexDesignDirectionId) {
  switch (directionId) {
    case "constellation":
      return <ProgressionConstellationDirection />;
    case "rpg":
      return <ForgeArenaRpgDirection />;
    case "tactical":
    default:
      return <TacticalCommandDirection />;
  }
}

function formatScoreRead(read: string) {
  return read === "a surveiller" ? "à surveiller" : read;
}

export function RexDesignLab() {
  const [activeDirection, setActiveDirection] = useState<RexDesignDirectionId>("tactical");
  const direction = rexDesignDirections[activeDirection];
  const preview = useMemo(() => renderDirectionPreview(activeDirection), [activeDirection]);

  return (
    <main className="rex-design-lab" data-testid="rex-design-lab" data-direction={activeDirection}>
      <div className="rex-design-lab__ambient" aria-hidden="true" />
      <section className="rex-design-lab__header" aria-labelledby="rex-design-lab-title">
        <div>
          <p className="rex-design-lab__eyebrow">DEV only - directions visuelles non validées</p>
          <h1 id="rex-design-lab-title">REX Design Lab</h1>
          <p className="rex-design-lab__lead">
            Trois langages visuels concurrents pour choisir la prochaine identité NeuroChess sans toucher au shell REX stable.
          </p>
        </div>
        <div className="rex-design-lab__doctrine" aria-label="Doctrine du lab">
          <span>Pas de backend</span>
          <span>Pas de vraies données</span>
          <span>Juger le coup, jamais la personne</span>
        </div>
      </section>

      <RexDesignLabNav activeDirection={activeDirection} onSelect={setActiveDirection} />

      <section className="rex-design-lab__grid" aria-label="Comparaison visuelle REX">
        <RexDesignDirectionCard direction={direction} />
        <div className="rex-design-preview" data-testid="rex-design-preview" data-active-direction={activeDirection}>
          {preview}
        </div>
        <aside className="rex-design-scorecard" data-testid="rex-design-scorecard" aria-label="Grille d'evaluation">
          <div className="rex-design-scorecard__header">
            <p>Scorecard produit</p>
            <span>Comparaison qualitative</span>
          </div>
          <div className="rex-design-scorecard__items">
            {direction.scores.map((score) => (
              <article className="rex-design-scorecard__item" data-read={score.read} key={score.criterion}>
                <div>
                  <strong>{score.criterion}</strong>
                  <span>{score.note}</span>
                </div>
                <em>{formatScoreRead(score.read)}</em>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
