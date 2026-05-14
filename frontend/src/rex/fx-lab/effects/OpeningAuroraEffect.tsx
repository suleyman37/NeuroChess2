export function OpeningAuroraEffect() {
  return (
    <section className="rex-fx-panel rex-fx-panel--aurora" aria-label="Opening Aurora preview">
      <div className="rex-fx-panel__topbar">
        <span>Opening Aurora</span>
        <em>Repertoire comme carte calme</em>
      </div>

      <div className="rex-aurora-bands" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      <svg className="rex-aurora-map" viewBox="0 0 720 360" role="img" aria-label="Carte de repertoire Najdorf">
        <path className="rex-aurora-link rex-aurora-link--main" d="M352 176 C286 116 222 110 154 142" />
        <path className="rex-aurora-link" d="M352 176 C428 120 502 108 588 146" />
        <path className="rex-aurora-link" d="M352 176 C300 232 244 270 170 282" />
        <path className="rex-aurora-link" d="M352 176 C430 226 496 262 606 252" />
      </svg>

      <div className="rex-aurora-node rex-aurora-node--root">
        <span>Sicilian Defense</span>
      </div>
      <div className="rex-aurora-node rex-aurora-node--najdorf">
        <span>Najdorf</span>
        <strong>stable</strong>
      </div>
      <div className="rex-aurora-node rex-aurora-node--branch-a">
        <span>e5 plan</span>
      </div>
      <div className="rex-aurora-node rex-aurora-node--branch-b">
        <span>fragile line</span>
      </div>
      <div className="rex-aurora-node rex-aurora-node--branch-c">
        <span>future review</span>
      </div>
    </section>
  );
}
