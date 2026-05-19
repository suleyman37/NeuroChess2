import "./fullNightPixelRehearsalStyles.css";
import {
  fullNightIterations,
  fullNightPixelRehearsalData,
  getFullNightIteration,
  type FullNightDeltaKind,
  type FullNightIterationId,
  type FullNightRehearsalIteration,
} from "./fullNightPixelRehearsalData";

export type FullNightPixelRehearsalRoute = {
  iterationId: FullNightIterationId | null;
};

const boardSquares = Array.from({ length: 64 }, (_, index) => {
  const file = index % 8;
  const rank = Math.floor(index / 8);
  return {
    id: `${file}-${rank}`,
    light: (file + rank) % 2 === 0,
  };
});

const boardPieces: Record<number, string> = {
  0: "r",
  3: "q",
  4: "k",
  8: "p",
  12: "n",
  18: "b",
  27: "P",
  35: "N",
  42: "B",
  45: "Q",
  52: "K",
  63: "R",
};

function StrictBoard({ state = "neutral" }: { state?: "neutral" | "success" | "miss" | "pressure" }) {
  return (
    <div className={`fnpr-board fnpr-board-${state}`} data-board-visible="true" data-evidence-role="board">
      {boardSquares.map((square, index) => (
        <span className={`fnpr-square ${square.light ? "fnpr-square-light" : "fnpr-square-dark"}`} key={square.id}>
          {boardPieces[index] ? <b>{boardPieces[index]}</b> : null}
        </span>
      ))}
      {state === "success" ? <i className="fnpr-board-mark fnpr-board-mark-success" /> : null}
      {state === "miss" ? <i className="fnpr-board-mark fnpr-board-mark-miss" /> : null}
      {state === "pressure" ? <i className="fnpr-board-pressure" /> : null}
    </div>
  );
}

function Sigil({ variant }: { variant: "a" | "b" | "c" }) {
  return (
    <svg className={`fnpr-sigil fnpr-sigil-${variant}`} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 6 78 20 92 50 78 80 50 94 22 80 8 50 22 20Z" />
      <path d="M50 18 68 50 50 82 32 50Z" />
      <path d={variant === "a" ? "M20 50h60" : variant === "b" ? "M50 20v60" : "m25 25 50 50M75 25 25 75"} />
      <circle cx="50" cy="50" r="8" />
    </svg>
  );
}

function FeedbackGlyph({ tone }: { tone: "held" | "success" | "miss" | "replay" }) {
  return (
    <svg className={`fnpr-feedback-glyph fnpr-feedback-${tone}`} viewBox="0 0 96 96" aria-hidden="true">
      <path d="M48 7 78 24 84 58 48 89 12 58 18 24Z" />
      <path d="M48 22 63 48 48 74 33 48Z" />
      {tone === "success" ? <path d="m29 49 13 13 26-32" /> : null}
      {tone === "miss" ? <path d="m30 30 36 36M66 30 30 66" /> : null}
      {tone === "replay" ? <path d="M64 36a20 20 0 1 0 3 20M64 36h-17" /> : null}
      {tone === "held" ? <circle cx="48" cy="48" r="9" /> : null}
    </svg>
  );
}

function ChamberCandidate() {
  return (
    <div className="fnpr-chamber" data-evidence-role="main-surface">
      <div className="fnpr-chamber-side">
        <span />
        <span />
        <span />
      </div>
      <div className="fnpr-chamber-core">
        <em>production chamber candidate</em>
        <StrictBoard />
      </div>
      <div className="fnpr-chamber-side fnpr-chamber-side-right">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function FeedbackCandidate() {
  const states = [
    { key: "held", label: "No spoiler", board: "neutral" },
    { key: "success", label: "Success", board: "success" },
    { key: "miss", label: "Miss", board: "miss" },
    { key: "replay", label: "Replay", board: "neutral" },
  ] as const;
  return (
    <div className="fnpr-feedback-grid" data-evidence-role="main-surface">
      {states.map((state) => (
        <section className={`fnpr-feedback-state fnpr-feedback-state-${state.key}`} key={state.key}>
          <FeedbackGlyph tone={state.key} />
          <strong>{state.label}</strong>
          <StrictBoard state={state.board} />
        </section>
      ))}
    </div>
  );
}

function SigilVariants() {
  return (
    <div className="fnpr-sigil-variants" data-evidence-role="main-surface">
      <StrictBoard />
      {(["a", "b", "c"] as const).map((variant) => (
        <section key={variant}>
          <Sigil variant={variant} />
          <strong>Sigil {variant.toUpperCase()}</strong>
        </section>
      ))}
    </div>
  );
}

function MemoryCabinet() {
  return (
    <div className="fnpr-memory" data-evidence-role="main-surface">
      <StrictBoard />
      {["Recall", "Pattern", "Return"].map((label, index) => (
        <section className="fnpr-memory-card" key={label}>
          <span>{`0${index + 1}`}</span>
          <strong>{label}</strong>
          <i />
        </section>
      ))}
    </div>
  );
}

function PressureField() {
  return (
    <div className="fnpr-pressure" data-evidence-role="main-surface">
      <div className="fnpr-pressure-ring fnpr-pressure-ring-a" />
      <div className="fnpr-pressure-ring fnpr-pressure-ring-b" />
      <StrictBoard state="pressure" />
      <aside>
        <strong>Peripheral pressure only</strong>
        <span>No eval bar, no solution arrow, no pre-feedback hint.</span>
      </aside>
    </div>
  );
}

function CombinationScene() {
  return (
    <div className="fnpr-combination" data-evidence-role="main-surface">
      <ChamberCandidate />
      <aside>
        <Sigil variant="b" />
        <FeedbackGlyph tone="held" />
        <FeedbackGlyph tone="success" />
        <div className="fnpr-memory-card">
          <span>06</span>
          <strong>Memory return</strong>
          <i />
        </div>
      </aside>
    </div>
  );
}

function NorthStarMicroFlow() {
  const phases = [
    { label: "Observe", tone: "held" },
    { label: "Try", tone: "held" },
    { label: "Feedback", tone: "success" },
    { label: "Memory", tone: "replay" },
  ] as const;
  return (
    <div className="fnpr-micro-flow" data-evidence-role="main-surface">
      {phases.map((phase, index) => (
        <section key={phase.label}>
          <span>{index + 1}</span>
          <FeedbackGlyph tone={phase.tone} />
          <strong>{phase.label}</strong>
          {index === 0 ? <StrictBoard /> : null}
        </section>
      ))}
    </div>
  );
}

function ProgressBoard() {
  return (
    <div className="fnpr-progress" data-evidence-role="main-surface">
      <StrictBoard />
      <div className="fnpr-progress-list">
        {fullNightIterations.map((iteration) => (
          <span key={iteration.id}>
            <b>{iteration.number}</b>
            {iteration.doctorVerdict}
          </span>
        ))}
      </div>
      <strong>19.35 -&gt; 19.50 candidate</strong>
    </div>
  );
}

function PixelVisual({ kind }: { kind: FullNightDeltaKind }) {
  if (kind === "feedback") return <FeedbackCandidate />;
  if (kind === "sigil") return <SigilVariants />;
  if (kind === "memory") return <MemoryCabinet />;
  if (kind === "pressure") return <PressureField />;
  if (kind === "combination") return <CombinationScene />;
  if (kind === "micro_flow") return <NorthStarMicroFlow />;
  if (kind === "progress") return <ProgressBoard />;
  return <ChamberCandidate />;
}

function IterationCard({ iteration }: { iteration: FullNightRehearsalIteration }) {
  return (
    <article
      className={`fnpr-card fnpr-card-${iteration.kind}`}
      data-testid="full-night-pixel-delta-preview"
      data-pixel-delta-id={iteration.id}
      data-objective-id={iteration.objective}
      data-evidence-role="primary"
    >
      <header>
        <p>Iteration {iteration.number}</p>
        <h2>{iteration.label}</h2>
        <strong>{iteration.objective}</strong>
      </header>
      <PixelVisual kind={iteration.kind} />
      <footer>
        <span data-testid="mission-doctor-summary">{iteration.doctorVerdict}</span>
        <span>{iteration.scoreDelta}</span>
        <span>utility {iteration.utility.toFixed(1)}</span>
      </footer>
    </article>
  );
}

function FullNightSummary() {
  const data = fullNightPixelRehearsalData;
  return (
    <main className="full-night-pixel-rehearsal" data-testid="full-night-pixel-rehearsal">
      <header className="fnpr-header">
        <div>
          <p>DEV-only Full Night Pixel Rehearsal</p>
          <h1>{data.title}</h1>
          <span>{data.route}</span>
        </div>
        <strong>{data.score.newOverall.toFixed(2)}</strong>
      </header>

      <section className="fnpr-summary" aria-label="Full night summary">
        <div>
          <p>Configuration</p>
          <strong>{data.configuration.maxIterations} iterations / {data.configuration.maxRuntimeMinutes} min cap</strong>
          <span>{data.configuration.liveWeb} live web / {data.configuration.userIntervention} user input</span>
        </div>
        <div data-testid="omega-decision-log">
          <p>OMEGA decision log</p>
          <strong>{data.omegaDecision.activeMandate}</strong>
          <span>{data.omegaDecision.rejectedLanes.join(" / ")}</span>
        </div>
        <div data-testid="score-progression">
          <p>Score progression</p>
          <strong>{data.score.previousOverall.toFixed(2)}{" -> "}{data.score.newOverall.toFixed(2)}</strong>
          <span>{data.score.candidateStatus}</span>
        </div>
        <div>
          <p>Night readiness</p>
          <strong>{data.nightReadinessVerdict}</strong>
          <span>{data.recommendedMission}</span>
        </div>
      </section>

      <section className="fnpr-direction">
        <p>Current best visual direction</p>
        <strong>{data.currentBestDirection}</strong>
      </section>

      <section className="fnpr-grid" aria-label="Full night pixel delta previews">
        {fullNightIterations.map((iteration) => (
          <IterationCard iteration={iteration} key={iteration.id} />
        ))}
      </section>
    </main>
  );
}

function IsolatedIteration({ iterationId }: { iterationId: FullNightIterationId }) {
  const iteration = getFullNightIteration(iterationId);
  return (
    <main
      className={`full-night-pixel-rehearsal fnpr-isolated fnpr-isolated-${iteration.kind}`}
      data-testid="full-night-pixel-rehearsal-iteration"
      data-pixel-delta-id={iteration.id}
      data-objective-id={iteration.objective}
      data-evidence-role="primary"
    >
      <header className="fnpr-header fnpr-isolated-header">
        <div>
          <p>DEV-only isolated full-night delta</p>
          <h1>{iteration.label}</h1>
          <span>{fullNightPixelRehearsalData.isolatedRoutePrefix}{iteration.id}</span>
        </div>
        <strong>{iteration.number}</strong>
      </header>
      <section className="fnpr-isolated-layout">
        <PixelVisual kind={iteration.kind} />
        <aside className="fnpr-notes">
          <p>{iteration.objective}</p>
          <h2>{iteration.result}</h2>
          <dl>
            <div>
              <dt>Selected by</dt>
              <dd>{iteration.selectedBy}</dd>
            </div>
            <div>
              <dt>Proof</dt>
              <dd>{iteration.screenshot}</dd>
            </div>
            <div>
              <dt>Mission Doctor</dt>
              <dd>{iteration.doctorVerdict}</dd>
            </div>
            <div>
              <dt>Useful delta</dt>
              <dd>{iteration.useful ? "yes" : "no"}</dd>
            </div>
          </dl>
        </aside>
      </section>
    </main>
  );
}

export function FullNightPixelRehearsal({ route }: { route: FullNightPixelRehearsalRoute }) {
  if (route.iterationId) {
    return <IsolatedIteration iterationId={route.iterationId} />;
  }
  return <FullNightSummary />;
}
