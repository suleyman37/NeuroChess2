import type { CSSProperties } from "react";

export function TruthChainVortexEffect() {
  const particles = Array.from({ length: 18 }, (_, index) => index);

  return (
    <section className="rex-fx-panel rex-fx-panel--vortex" aria-label="Truth Chain Vortex preview">
      <div className="rex-fx-panel__topbar">
        <span>Truth Chain Vortex</span>
        <em>{"PGN -> Analyse -> Review -> Exercice"}</em>
      </div>

      <div className="rex-vortex-source">
        <span>PGN lu</span>
        <strong>bahij vs ClubRival</strong>
        <em>0-1 / Najdorf</em>
      </div>

      <svg className="rex-vortex-field" viewBox="0 0 720 360" role="img" aria-label="Flux de transformation Truth Chain">
        <defs>
          <linearGradient id="rex-vortex-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(120,232,255,0)" />
            <stop offset="46%" stopColor="rgba(120,232,255,0.92)" />
            <stop offset="100%" stopColor="rgba(220,248,255,0)" />
          </linearGradient>
        </defs>
        <path className="rex-vortex-curve rex-vortex-curve--a" d="M84 168 C210 56 334 84 430 168 S590 292 660 164" />
        <path className="rex-vortex-curve rex-vortex-curve--b" d="M92 206 C238 318 344 280 442 204 S582 72 664 206" />
        <path className="rex-vortex-curve rex-vortex-curve--c" d="M118 186 C238 128 330 142 420 184 S556 230 636 184" />
      </svg>

      <div className="rex-vortex-core" aria-hidden="true">
        <span />
      </div>

      <div className="rex-vortex-particles" aria-hidden="true">
        {particles.map((particle) => (
          <i key={particle} style={{ "--particle-index": particle } as CSSProperties} />
        ))}
      </div>

      <div className="rex-vortex-steps" aria-label="Etats de la chaine">
        <span>Analyse</span>
        <span>Review prete</span>
        <span>A brancher</span>
      </div>
    </section>
  );
}
