export function TacticalCommandDirection() {
  return (
    <section className="rex-design-preview-panel rex-design-preview-panel--tactical" aria-label="Apercu Tactical Command Center">
      <div className="rex-tactical-grid" aria-hidden="true" />
      <div className="rex-tactical-scan" aria-hidden="true" />
      <div className="rex-preview-topbar">
        <span>Tactical Command Center</span>
        <em>précision froide</em>
      </div>
      <div className="rex-tactical-hero">
        <div>
          <p>Mission active</p>
          <h3>Transformer une decision critique en exercice</h3>
          <span>Prototype REX - données illustratives</span>
        </div>
        <strong>Décision jugée</strong>
      </div>
      <div className="rex-tactical-rail" aria-label="Rail de decision tactique">
        <span>Partie</span>
        <i />
        <span>Analyse</span>
        <i />
        <span>Moment critique</span>
        <i />
        <span>Exercice</span>
      </div>
      <div className="rex-tactical-verdicts">
        <article>
          <span>Signal de coup</span>
          <strong>Ce coup peut etre mauvais ; toi, tu es en apprentissage.</strong>
        </article>
        <article>
          <span>Règle produit</span>
          <strong>Le système juge la décision, pas le joueur.</strong>
        </article>
      </div>
    </section>
  );
}
