import type { MouseEvent } from "react";
import { NeuroChessLogo } from "./NeuroChessLogo";
import {
  NeuroMonitorBrain,
  type NeuroMonitorDomain,
  type NeuroMonitorSignal,
} from "./NeuroMonitorBrain";

type LandingPageProps = {
  onNavigateApp?: () => void;
  onNavigateHome?: () => void;
};

const featureCards = [
  {
    title: "Review Coach",
    text: "Une leçon guidée qui montre le moment où la partie bascule.",
  },
  {
    title: "NeuroScore",
    text: "Un score lisible qui relie qualité moyenne et impact réel.",
  },
  {
    title: "Practice Mode",
    text: "Transformez les erreurs de votre partie en exercices immédiats.",
  },
  {
    title: "Opening Reality",
    text: "Voyez où vous sortez du livre et ce qui arrive juste après.",
  },
  {
    title: "PV Contrast",
    text: "Comparez la ligne après votre coup et la ligne de la solution.",
  },
  {
    title: "Coach IA ready",
    text: "Préparé pour un futur coach basé sur preuves, sans hallucination libre.",
  },
];

const methodCards = [
  {
    title: "Win% plutôt que centipions",
    text: "NeuroChess raisonne en impact sur vos chances, pas seulement en centipions bruts.",
  },
  {
    title: "Transfer Gap",
    text: "Le but est de lire l'écart entre ce que vous trouvez à l'entraînement et ce qui sort en partie.",
  },
  {
    title: "Evidence JSON",
    text: "Chaque explication future peut s'ancrer dans la position, le coup joué, la solution, la ligne et votre tentative.",
  },
  {
    title: "Pas de magie noire",
    text: "Stockfish calcule. NeuroChess structure. Le coach explique.",
  },
];

const homeMonitorDomains: NeuroMonitorDomain[] = [
  {
    key: "opening",
    label: "Ouverture",
    tone: "analysis",
    intensity: 0.48,
    summary: "sortie du livre suivie",
  },
  {
    key: "tactical",
    label: "Tactique",
    tone: "watch",
    intensity: 0.72,
    summary: "charge active",
  },
  {
    key: "conversion",
    label: "Conversion",
    tone: "stable",
    intensity: 0.42,
    summary: "contrôle correct",
  },
  {
    key: "defense",
    label: "Défense",
    tone: "critical",
    intensity: 0.82,
    summary: "zone de vigilance",
  },
];

const homeMonitorSignals: NeuroMonitorSignal[] = [
  {
    key: "stability",
    label: "Stabilité",
    value: "élevée",
    tone: "stable",
    intensity: 0.68,
  },
  {
    key: "tension",
    label: "Tension",
    value: "moyenne",
    tone: "watch",
    intensity: 0.58,
  },
  {
    key: "tactical",
    label: "Focus tactique",
    value: "fort",
    tone: "critical",
    intensity: 0.78,
  },
  {
    key: "sync",
    label: "Synchronisation",
    value: "78 %",
    tone: "analysis",
    intensity: 0.78,
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
            <a href="#features">Fonctionnalités</a>
            <a href="#how-it-works">Comment ça marche</a>
            <a href="#science">Méthode</a>
          </div>
          <div className="landing-nav-actions">
            <a className="landing-link-button" href="/app" onClick={handleAppClick}>
              Ouvrir l'app
            </a>
            <a className="landing-button landing-button-primary" href="/app" onClick={handleAppClick}>
              Commencer - Gratuit
            </a>
          </div>
        </div>
      </nav>

      <section className="landing-hero home-hero">
        <NeuralHeroVisual />
        <div className="landing-hero-content home-hero-content">
          <div className="landing-monitor-pill">
            <span className="landing-monitor-dot" aria-hidden="true" />
            Neuro-Monitor actif · 4 axes décisionnels
          </div>
          <h1>
            Jouez aux échecs
            <br />
            avec votre{" "}
            <span className="landing-gradient-text">cerveau entier</span>
          </h1>
          <p className="landing-hero-copy">
            NeuroChess cartographie vos décisions et transforme vos vraies
            parties en diagnostic d'entraînement : détectez vos failles, rejouez
            vos moments clés et progressez avec un coach basé sur preuves.
          </p>
          <div className="landing-hero-actions">
            <a className="landing-button landing-button-primary" href="/app" onClick={handleAppClick}>
              Essayer gratuitement
            </a>
            <a className="landing-button landing-button-secondary" href="#how-it-works">
              Voir comment ça marche
            </a>
          </div>
          <div className="landing-stat-grid" aria-label="Capacités produit">
            <article>
              <strong>4 axes</strong>
              <span>Ouverture · Tactique · Conversion · Défense</span>
            </article>
            <article>
              <strong>3-5 moments</strong>
              <span>extraits de vos parties</span>
            </article>
            <article>
              <strong>Moteur local</strong>
              <span>Stockfish sur votre machine</span>
            </article>
            <article>
              <strong>Practice</strong>
              <span>entraînement depuis vos erreurs</span>
            </article>
          </div>
          <HomeNeuroMonitor />
        </div>
        <a className="landing-scroll-cue" href="#how-it-works">
          Découvrir
          <span aria-hidden="true" />
        </a>
      </section>

      <div className="home-continuum">
      <section className="landing-section landing-steps home-section" id="how-it-works">
        <p className="landing-kicker">Comment ça marche</p>
        <h2>Quatre étapes vers la maîtrise de vos décisions</h2>
        <div className="landing-step-grid">
          <article>
            <span>01</span>
            <h3>Importez ou jouez</h3>
            <p>Importez vos PGN Chess.com/Lichess ou jouez localement.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Analysez</h3>
            <p>NeuroChess construit une Review fiable avec Stockfish local.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Comprenez</h3>
            <p>Le coach identifie vos moments critiques par domaine.</p>
          </article>
          <article>
            <span>04</span>
            <h3>Entraînez-vous</h3>
            <p>Rejouez les positions clés, tentez le bon coup, puis recommencez.</p>
          </article>
        </div>
      </section>

      <section className="landing-section home-section" id="features">
        <p className="landing-kicker">Fonctionnalités</p>
        <h2>Pas une autre accuracy. Un diagnostic d'entraînement.</h2>
        <div className="landing-card-grid">
          {featureCards.map(card => (
            <article className="landing-card" key={card.title}>
              <span className="landing-card-node" aria-hidden="true" />
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-method home-section" id="science">
        <p className="landing-kicker">Méthode</p>
        <h2>La méthode : transformer chaque partie en preuve</h2>
        <div className="landing-method-grid">
          {methodCards.map(card => (
            <article className="landing-card" key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final-cta home-section">
        <h2>Vos parties contiennent déjà votre programme d'entraînement.</h2>
        <p>NeuroChess vous aide à l'extraire.</p>
        <div className="landing-hero-actions">
          <a className="landing-button landing-button-primary" href="/app" onClick={handleAppClick}>
            Commencer gratuitement
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
          <a href="#features">Fonctionnalités</a>
          <a href="#how-it-works">Comment ça marche</a>
          <a href="#science">Méthode</a>
          <a href="/app" onClick={handleAppClick}>Application</a>
        </nav>
        <p>
          NeuroChess est un outil d'entraînement échiquéen basé sur analyse
          moteur et données de jeu. Il ne fournit pas de mesure médicale ou
          neurologique.
        </p>
      </footer>
    </main>
  );
}

function HomeNeuroMonitor() {
  return (
    <div className="home-neuro-monitor" aria-label="Aperçu du Neuro-Monitor">
      <NeuroMonitorBrain
        concept
        eyebrow="Neuro-Monitor"
        title="Cerveau connecté à la partie"
        subtitle="Aperçu visuel : les signaux s'activent autour des décisions clés."
        modeLabel="Aperçu produit"
        domains={homeMonitorDomains}
        signals={homeMonitorSignals}
        activeDomainKey="defense"
        playedBranch={{
          available: true,
          label: "Coup joué",
          preview: "ligne sous tension",
          tone: "watch",
          intensity: 0.64,
        }}
        solutionBranch={{
          available: true,
          visible: true,
          label: "Solution",
          preview: "ligne stabilisée",
          tone: "stable",
          intensity: 0.58,
        }}
      />
    </div>
  );
}

export function NeuralHeroVisual() {
  return (
    <div className="neural-visual" aria-hidden="true">
      <div className="neural-visual-halo" />
      <div className="neural-visual-orbit neural-visual-orbit-one" />
      <div className="neural-visual-orbit neural-visual-orbit-two" />
      <svg className="neural-visual-map" viewBox="0 0 900 620" role="img">
        <defs>
          <radialGradient id="neuralCore" cx="50%" cy="45%" r="56%">
            <stop offset="0%" stopColor="#69f5ff" stopOpacity="0.78" />
            <stop offset="42%" stopColor="#336dff" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#050713" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="neuralStroke" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#00e5ff" />
            <stop offset="55%" stopColor="#3480ff" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <path
          className="neural-brain-mass"
          d="M186 330C156 222 242 128 354 146c42-58 155-58 207 2 118-8 196 86 174 194-19 92-112 148-220 124-50 54-157 52-204-2-70 12-111-34-125-134Z"
          fill="url(#neuralCore)"
        />
        <path
          className="neural-brain-grid"
          d="M250 252h104v-76M354 252h122v-84M476 252h114v-66M250 252v108h104m0-108v146m122-146v142m114-142v104M250 360h226m0 34h114"
        />
        <path
          className="neural-thread neural-thread-slow"
          d="M174 320C250 188 372 136 511 162c119 22 197 92 244 204"
        />
        <path
          className="neural-thread"
          d="M160 378c106-70 206-95 301-74 108 24 188 8 282-92"
        />
        <path
          className="neural-thread neural-thread-soft"
          d="M218 220c80 104 174 150 282 136 92-12 151 12 202 72"
        />
        <path
          className="neural-thread neural-thread-slow"
          d="M244 456c45-124 124-198 236-222 118-24 198-8 240 48"
        />
        {[
          [214, 318],
          [252, 236],
          [304, 412],
          [358, 178],
          [416, 326],
          [486, 230],
          [544, 398],
          [614, 190],
          [666, 310],
          [722, 426],
        ].map(([cx, cy], index) => (
          <circle
            className="neural-node"
            cx={cx}
            cy={cy}
            key={`${cx}-${cy}`}
            r={index % 3 === 0 ? 7 : 5}
          />
        ))}
      </svg>
      <div className="neural-visual-grid" />
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
