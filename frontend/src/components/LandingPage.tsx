import type { MouseEvent } from "react";
import { NeuroChessLogo } from "./NeuroChessLogo";

type LandingPageProps = {
  onNavigateApp?: () => void;
  onNavigateHome?: () => void;
};

const featureCards = [
  {
    title: "Review coach",
    text: "Un resume clair, trois moments cles et une suite d'apprentissage.",
  },
  {
    title: "NeuroScore",
    text: "Un score coach lisible, separe de la precision de reference.",
  },
  {
    title: "Practice Review",
    text: "Les erreurs de tes parties deviennent des positions a rejouer.",
  },
  {
    title: "Import PGN",
    text: "Colle une partie ou importe tes PGN pour lancer une Review.",
  },
  {
    title: "Stockfish local",
    text: "Le moteur calcule, l'interface traduit l'analyse en action.",
  },
];

const methodCards = [
  {
    title: "Win% plutot que centipions",
    text: "NeuroChess raisonne en chances perdues pour garder le diagnostic lisible.",
  },
  {
    title: "Moments prioritaires",
    text: "La Review met en avant ce qui explique vraiment la partie.",
  },
  {
    title: "Essayer avant de voir",
    text: "L'entrainement privilegie la tentative, puis le feedback utile.",
  },
  {
    title: "Progression sobre",
    text: "Le produit garde les signaux avances hors de l'interface normale.",
  },
];

export function LandingPage({
  onNavigateApp,
  onNavigateHome,
}: LandingPageProps) {
  const handleAppClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!shouldHandleSpaClick(event) || !onNavigateApp) {
      return;
    }
    event.preventDefault();
    onNavigateApp();
  };

  const handleHomeClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!shouldHandleSpaClick(event) || !onNavigateHome) {
      return;
    }
    event.preventDefault();
    onNavigateHome();
  };

  return (
    <main className="landing-page home-shell">
      <nav className="landing-nav app-header home-header" aria-label="Navigation principale">
        <div className="landing-nav-inner app-header-inner">
          <div className="app-brand">
            <NeuroChessLogo
              href="/"
              onClick={handleHomeClick}
              variant="header"
              className="app-brand-logo"
            />
          </div>
          <div className="landing-nav-links" aria-label="Sections">
            <a href="#features">Fonctionnalites</a>
            <a href="#how-it-works">Parcours</a>
            <a href="#science">Methode</a>
          </div>
          <div className="landing-nav-actions">
            <a className="landing-link-button" href="/app" onClick={handleAppClick}>
              Ouvrir l'app
            </a>
            <a className="landing-button landing-button-primary" href="/app" onClick={handleAppClick}>
              Commencer
            </a>
          </div>
        </div>
      </nav>

      <section className="landing-hero home-hero">
        <DecisionHeroVisual />
        <div className="landing-hero-content home-hero-content">
          <div className="landing-monitor-pill">
            <span className="landing-monitor-dot" aria-hidden="true" />
            Review guidee - entrainement depuis tes parties
          </div>
          <h1>
            Comprends ta partie.
            <br />
            Travaille le <span className="landing-gradient-text">prochain coup utile</span>.
          </h1>
          <p className="landing-hero-copy">
            NeuroChess transforme une vraie partie en Review calme, en moments
            cles et en session Practice. Pas de tableau technique permanent :
            une action utile a chaque etape.
          </p>
          <div className="landing-hero-actions">
            <a className="landing-button landing-button-primary" href="/app" onClick={handleAppClick}>
              Importer une partie
            </a>
            <a className="landing-button landing-button-secondary" href="#how-it-works">
              Voir le parcours
            </a>
          </div>
          <div className="landing-stat-grid" aria-label="Capacites produit">
            <article>
              <strong>3 moments</strong>
              <span>maximum dans le resume</span>
            </article>
            <article>
              <strong>3 min</strong>
              <span>lecture rapide cible</span>
            </article>
            <article>
              <strong>8-12 min</strong>
              <span>session Practice</span>
            </article>
            <article>
              <strong>Local</strong>
              <span>analyse Stockfish controlee</span>
            </article>
          </div>
        </div>
        <a className="landing-scroll-cue" href="#how-it-works">
          Decouvrir
          <span aria-hidden="true" />
        </a>
      </section>

      <div className="home-continuum">
        <section className="landing-section landing-steps home-section" id="how-it-works">
          <p className="landing-kicker">Parcours V1</p>
          <h2>Une boucle courte : importer, comprendre, pratiquer.</h2>
          <div className="landing-step-grid">
            <article>
              <span>01</span>
              <h3>Importer</h3>
              <p>Colle une partie PGN ou ouvre une partie deja enregistree.</p>
            </article>
            <article>
              <span>02</span>
              <h3>Analyser</h3>
              <p>Stockfish construit une Review fiable et versionnee.</p>
            </article>
            <article>
              <span>03</span>
              <h3>Comprendre</h3>
              <p>Le resume explique la partie avec trois moments maximum.</p>
            </article>
            <article>
              <span>04</span>
              <h3>Pratiquer</h3>
              <p>Les positions utiles deviennent une session d'entrainement.</p>
            </article>
          </div>
        </section>

        <section className="landing-section home-section" id="features">
          <p className="landing-kicker">Fonctionnalites V1</p>
          <h2>Une Review lisible avant tout.</h2>
          <div className="landing-card-grid">
            {featureCards.map((card) => (
              <article className="landing-card" key={card.title}>
                <span className="landing-card-node" aria-hidden="true" />
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-method home-section" id="science">
          <p className="landing-kicker">Methode</p>
          <h2>Le moteur dit vrai. Le coach rend l'action claire.</h2>
          <div className="landing-method-grid">
            {methodCards.map((card) => (
              <article className="landing-card" key={card.title}>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-final-cta home-section">
          <h2>Tes parties contiennent deja ton prochain entrainement.</h2>
          <p>NeuroChess t'aide a l'extraire sans t'ecraser sous les details.</p>
          <div className="landing-hero-actions">
            <a className="landing-button landing-button-primary" href="/app" onClick={handleAppClick}>
              Commencer
            </a>
            <a className="landing-button landing-button-secondary" href="/app" onClick={handleAppClick}>
              Ouvrir l'application
            </a>
          </div>
        </section>
      </div>

      <footer className="landing-footer home-footer">
        <NeuroChessLogo href="/" onClick={handleHomeClick} variant="compact" />
        <nav aria-label="Navigation de pied de page">
          <a href="#features">Fonctionnalites</a>
          <a href="#how-it-works">Parcours</a>
          <a href="#science">Methode</a>
          <a href="/app" onClick={handleAppClick}>Application</a>
        </nav>
        <p>
          NeuroChess analyse des decisions et des parties d'echecs. Le nom est
          une metaphore produit, pas une mesure medicale ou biologique.
        </p>
      </footer>
    </main>
  );
}

function DecisionHeroVisual() {
  return (
    <div className="decision-visual" aria-hidden="true">
      <div className="decision-visual-halo" />
      <svg className="decision-visual-map" viewBox="0 0 900 620" role="img">
        <defs>
          <linearGradient id="decisionLine" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#00e5ff" />
            <stop offset="55%" stopColor="#3480ff" />
            <stop offset="100%" stopColor="#30f2a4" />
          </linearGradient>
        </defs>
        <g className="decision-board">
          {Array.from({ length: 16 }).map((_, index) => {
            const x = 292 + (index % 4) * 72;
            const y = 178 + Math.floor(index / 4) * 72;
            return <rect key={index} x={x} y={y} width="72" height="72" />;
          })}
        </g>
        <path
          className="decision-path decision-path-main"
          d="M184 438 C268 326 320 374 364 286 S492 166 620 236 S700 374 748 210"
        />
        <path
          className="decision-path decision-path-soft"
          d="M164 256 C262 214 320 232 390 298 S536 406 706 348"
        />
        {[
          [184, 438],
          [304, 348],
          [390, 270],
          [520, 210],
          [620, 236],
          [748, 210],
        ].map(([cx, cy], index) => (
          <circle
            className={index === 3 ? "decision-node decision-node-active" : "decision-node"}
            cx={cx}
            cy={cy}
            key={`${cx}-${cy}`}
            r={index === 3 ? 10 : 7}
          />
        ))}
        <g className="decision-card decision-card-score">
          <rect x="142" y="150" width="170" height="74" rx="12" />
          <text x="164" y="180">NeuroScore</text>
          <text x="164" y="206">78 / 100</text>
        </g>
        <g className="decision-card decision-card-practice">
          <rect x="594" y="414" width="176" height="78" rx="12" />
          <text x="616" y="444">Practice</text>
          <text x="616" y="470">5 positions</text>
        </g>
      </svg>
      <div className="decision-visual-grid" />
    </div>
  );
}

function shouldHandleSpaClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey
  );
}
