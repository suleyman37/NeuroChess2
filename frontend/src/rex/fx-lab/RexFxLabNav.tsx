export type RexFxEffectId = "vortex" | "aurora" | "wind-lanes";

export type RexFxEffectMeta = {
  id: RexFxEffectId;
  navLabel: string;
  title: string;
  meaning: string;
  risk: string;
  score: string;
  testId: string;
};

export const REX_FX_EFFECTS: RexFxEffectMeta[] = [
  {
    id: "vortex",
    navLabel: "Truth Chain Vortex",
    title: "Truth Chain Vortex",
    meaning: "La partie brute est condensee en decision exploitable, sans declencher d'analyse.",
    risk: "Peut devenir trop spectaculaire si le flux ressemble a une tornade.",
    score: "Potentiel 8/10",
    testId: "rex-fx-vortex",
  },
  {
    id: "aurora",
    navLabel: "Opening Aurora",
    title: "Opening Aurora",
    meaning: "Le repertoire devient une carte vivante, avec Najdorf comme branche lisible.",
    risk: "Peut tomber en wallpaper cosmique si les noeuds ne portent pas une action.",
    score: "Potentiel 8.5/10",
    testId: "rex-fx-aurora",
  },
  {
    id: "wind-lanes",
    navLabel: "Pressure Wind Lanes",
    title: "Pressure Wind Lanes",
    meaning: "La pression varie par cadence et rend le transfert plus tangible.",
    risk: "Peut devenir anxiogene si les lanes ressemblent a un score brutal.",
    score: "Potentiel 7.5/10",
    testId: "rex-fx-wind-lanes",
  },
];

type RexFxLabNavProps = {
  activeEffect: RexFxEffectId;
  onSelect: (effectId: RexFxEffectId) => void;
};

export function RexFxLabNav({ activeEffect, onSelect }: RexFxLabNavProps) {
  return (
    <nav className="rex-fx-lab-nav" data-testid="rex-fx-lab-nav" aria-label="Effets visuels REX">
      {REX_FX_EFFECTS.map((effect) => (
        <button
          aria-current={activeEffect === effect.id ? "page" : undefined}
          className="rex-fx-lab-nav__button"
          data-state={activeEffect === effect.id ? "active" : "idle"}
          data-testid={effect.testId}
          key={effect.id}
          onClick={() => onSelect(effect.id)}
          type="button"
        >
          <span>{effect.navLabel}</span>
          <small>{effect.score}</small>
        </button>
      ))}
    </nav>
  );
}
