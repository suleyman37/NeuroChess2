const lanes = [
  { label: "Blitz", state: "tension", note: "pression haute" },
  { label: "Rapide", state: "target", note: "preuve utile" },
  { label: "Classique", state: "steady", note: "controle long" },
];

export function PressureWindLanesEffect() {
  return (
    <section className="rex-fx-panel rex-fx-panel--wind" aria-label="Pressure Wind Lanes preview">
      <div className="rex-fx-panel__topbar">
        <span>Pressure Wind Lanes</span>
        <em>Conditions reelles sans score brut</em>
      </div>

      <div className="rex-wind-field" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>

      <div className="rex-wind-lanes">
        {lanes.map((lane) => (
          <article className="rex-wind-lane" data-lane-state={lane.state} key={lane.label}>
            <span>{lane.label}</span>
            <div className="rex-wind-lane__track">
              <i />
            </div>
            <strong>{lane.note}</strong>
          </article>
        ))}
      </div>

      <div className="rex-wind-proof">
        <span>Entrainement</span>
        <i aria-hidden="true" />
        <span>Pression</span>
        <i aria-hidden="true" />
        <span>Vraie partie</span>
        <i aria-hidden="true" />
        <span>Preuve</span>
      </div>
    </section>
  );
}
