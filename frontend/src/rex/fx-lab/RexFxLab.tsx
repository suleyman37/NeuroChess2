import { useMemo, useState } from "react";
import { OpeningAuroraEffect } from "./effects/OpeningAuroraEffect";
import { PressureWindLanesEffect } from "./effects/PressureWindLanesEffect";
import { TruthChainVortexEffect } from "./effects/TruthChainVortexEffect";
import { REX_FX_EFFECTS, RexFxLabNav, type RexFxEffectId } from "./RexFxLabNav";
import "./fxLabStyles.css";

function renderEffect(effectId: RexFxEffectId) {
  switch (effectId) {
    case "aurora":
      return <OpeningAuroraEffect />;
    case "wind-lanes":
      return <PressureWindLanesEffect />;
    case "vortex":
    default:
      return <TruthChainVortexEffect />;
  }
}

export function RexFxLab() {
  const [activeEffect, setActiveEffect] = useState<RexFxEffectId>("vortex");
  const effect = REX_FX_EFFECTS.find((candidate) => candidate.id === activeEffect) ?? REX_FX_EFFECTS[0];
  const preview = useMemo(() => renderEffect(activeEffect), [activeEffect]);

  return (
    <main className="rex-fx-lab" data-testid="rex-fx-lab" data-effect={activeEffect}>
      <div className="rex-fx-lab__aura" aria-hidden="true" />
      <section className="rex-fx-lab__header" aria-labelledby="rex-fx-lab-title">
        <div>
          <p className="rex-fx-lab__eyebrow">DEV only - effets non valides</p>
          <h1 id="rex-fx-lab-title">REX Visual FX Lab</h1>
          <p className="rex-fx-lab__lead">
            Trois effets signature candidats pour rendre NeuroChess plus intuitif, moins textuel, et plus proprietaire.
          </p>
        </div>
        <aside className="rex-fx-lab__contract" aria-label="Contrat du FX Lab">
          <span>Pas de backend</span>
          <span>Pas de vraie donnee</span>
          <span>Pas de Spline ni WebGL</span>
        </aside>
      </section>

      <RexFxLabNav activeEffect={activeEffect} onSelect={setActiveEffect} />

      <section className="rex-fx-lab__stage" aria-label="Comparaison des effets signature">
        <article className="rex-fx-lab__brief">
          <p>Effet actif</p>
          <h2>{effect.title}</h2>
          <dl>
            <div>
              <dt>Signifie</dt>
              <dd>{effect.meaning}</dd>
            </div>
            <div>
              <dt>Risque</dt>
              <dd>{effect.risk}</dd>
            </div>
            <div>
              <dt>Score manuel</dt>
              <dd>{effect.score}</dd>
            </div>
          </dl>
        </article>

        <div className="rex-fx-preview" data-testid="rex-fx-preview" data-active-effect={activeEffect}>
          {preview}
        </div>
      </section>
    </main>
  );
}
