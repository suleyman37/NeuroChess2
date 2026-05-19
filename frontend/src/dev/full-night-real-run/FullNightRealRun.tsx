import "./fullNightRealRunStyles.css";
import {
  fullNightRealRunData,
  fullNightRealRunIterations,
  getFullNightRealRunIteration,
  type FullNightRealRunDeltaKind,
  type FullNightRealRunIteration,
  type FullNightRealRunIterationId,
} from "./fullNightRealRunData";

export type FullNightRealRunRoute = {
  iterationId: FullNightRealRunIterationId | null;
};

const boardSquares = Array.from({ length: 64 }, (_, index) => {
  const file = index % 8;
  const rank = Math.floor(index / 8);
  return { id: `${file}-${rank}`, light: (file + rank) % 2 === 0 };
});

const boardPieces: Record<number, string> = {
  2: "b",
  4: "k",
  9: "p",
  12: "q",
  20: "n",
  28: "P",
  35: "N",
  37: "B",
  44: "Q",
  51: "P",
  60: "K",
  63: "R",
};

function StrictBoard({ state = "neutral" }: { state?: "neutral" | "success" | "miss" | "pressure" }) {
  return (
    <div className={`fnrr-board fnrr-board-${state}`} data-board-visible="true" data-evidence-role="board">
      {boardSquares.map((square, index) => (
        <span className={`fnrr-square ${square.light ? "fnrr-square-light" : "fnrr-square-dark"}`} key={square.id}>
          {boardPieces[index] ? <b>{boardPieces[index]}</b> : null}
        </span>
      ))}
      {state === "success" ? <i className="fnrr-board-trace fnrr-board-trace-success" /> : null}
      {state === "miss" ? <i className="fnrr-board-trace fnrr-board-trace-miss" /> : null}
      {state === "pressure" ? <i className="fnrr-pressure-rail" /> : null}
    </div>
  );
}

function FeedbackGlyph({ tone }: { tone: "held" | "success" | "miss" | "replay" }) {
  return (
    <svg className={`fnrr-feedback-glyph fnrr-feedback-${tone}`} viewBox="0 0 96 96" aria-hidden="true">
      <path d="M48 7 78 24 84 58 48 89 12 58 18 24Z" />
      <path d="M48 22 63 48 48 74 33 48Z" />
      {tone === "success" ? <path d="m29 49 13 13 26-32" /> : null}
      {tone === "miss" ? <path d="m30 30 36 36M66 30 30 66" /> : null}
      {tone === "replay" ? <path d="M64 36a20 20 0 1 0 3 20M64 36h-17" /> : null}
      {tone === "held" ? <circle cx="48" cy="48" r="9" /> : null}
    </svg>
  );
}

function MomentSigil({ variant }: { variant: "a" | "b" | "c" | "d" }) {
  return (
    <svg className={`fnrr-sigil fnrr-sigil-${variant}`} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 5 77 19 94 50 77 81 50 95 23 81 6 50 23 19Z" />
      <path d="M50 17 69 50 50 83 31 50Z" />
      <path d={variant === "a" ? "M20 50h60" : variant === "b" ? "M50 20v60" : variant === "c" ? "m24 28 52 44" : "M26 73 74 27"} />
      <circle cx="50" cy="50" r="8" />
    </svg>
  );
}

function ChamberRefinement({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`fnrr-chamber ${compact ? "fnrr-chamber-compact" : ""}`} data-evidence-role="main-surface">
      <div className="fnrr-chamber-instrument fnrr-chamber-instrument-left">
        <span />
        <span />
        <span />
      </div>
      <section className="fnrr-chamber-core">
        <em>strict board chamber</em>
        <StrictBoard />
      </section>
      <div className="fnrr-chamber-instrument fnrr-chamber-instrument-right">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function FeedbackLanguage() {
  const states = [
    { key: "held", label: "No spoiler", board: "neutral" },
    { key: "success", label: "Success", board: "success" },
    { key: "miss", label: "Miss", board: "miss" },
    { key: "replay", label: "Replay", board: "neutral" },
  ] as const;
  return (
    <div className="fnrr-feedback-grid" data-evidence-role="main-surface">
      {states.map((state) => (
        <section className={`fnrr-feedback-state fnrr-feedback-state-${state.key}`} key={state.key}>
          <FeedbackGlyph tone={state.key} />
          <strong>{state.label}</strong>
          <StrictBoard state={state.board} />
        </section>
      ))}
    </div>
  );
}

function NorthStarFlow({ secondPass = false }: { secondPass?: boolean }) {
  const phases = [
    { label: "Observe", tone: "held" },
    { label: "Try", tone: "held" },
    { label: "Feedback", tone: secondPass ? "miss" : "success" },
    { label: "Replay", tone: "replay" },
    { label: "Memory", tone: "held" },
  ] as const;
  return (
    <div className={`fnrr-flow ${secondPass ? "fnrr-flow-second" : ""}`} data-evidence-role="main-surface">
      <StrictBoard state={secondPass ? "miss" : "success"} />
      <div className="fnrr-flow-steps">
        {phases.map((phase, index) => (
          <section key={phase.label}>
            <span>{index + 1}</span>
            <FeedbackGlyph tone={phase.tone} />
            <strong>{phase.label}</strong>
          </section>
        ))}
      </div>
    </div>
  );
}

function SigilVariants() {
  return (
    <div className="fnrr-sigil-wall" data-evidence-role="main-surface">
      <StrictBoard />
      {(["a", "b", "c", "d"] as const).map((variant) => (
        <section key={variant}>
          <MomentSigil variant={variant} />
          <strong>Moment {variant.toUpperCase()}</strong>
        </section>
      ))}
    </div>
  );
}

function MemoryCabinet() {
  return (
    <div className="fnrr-memory" data-evidence-role="main-surface">
      <StrictBoard />
      {["Pattern", "Mistake", "Return", "Transfer"].map((label, index) => (
        <section className="fnrr-memory-object" key={label}>
          <span>{`M${index + 1}`}</span>
          <strong>{label}</strong>
          <i />
        </section>
      ))}
    </div>
  );
}

function PressureField() {
  return (
    <div className="fnrr-pressure" data-evidence-role="main-surface">
      <i className="fnrr-pressure-orbit fnrr-pressure-orbit-a" />
      <i className="fnrr-pressure-orbit fnrr-pressure-orbit-b" />
      <StrictBoard state="pressure" />
      <aside>
        <strong>Peripheral only</strong>
        <span>No eval bar. No arrows. No hidden best-move cue.</span>
      </aside>
    </div>
  );
}

function CombinationScene() {
  return (
    <div className="fnrr-combination" data-evidence-role="main-surface">
      <ChamberRefinement compact />
      <aside>
        <MomentSigil variant="b" />
        <FeedbackGlyph tone="held" />
        <FeedbackGlyph tone="success" />
        <section className="fnrr-memory-object">
          <span>M5</span>
          <strong>Return</strong>
          <i />
        </section>
      </aside>
    </div>
  );
}

function AntiWeirdnessPatch() {
  return (
    <div className="fnrr-anti-weirdness" data-evidence-role="main-surface">
      <section>
        <p>Rejected</p>
        <div className="fnrr-noisy-sample">
          <StrictBoard />
        </div>
      </section>
      <section>
        <p>Patched</p>
        <ChamberRefinement compact />
      </section>
    </div>
  );
}

function ProgressDashboard() {
  return (
    <div className="fnrr-dashboard" data-evidence-role="main-surface">
      <StrictBoard />
      <div className="fnrr-dashboard-rows">
        {fullNightRealRunIterations.slice(0, 12).map((iteration) => (
          <span key={iteration.id}>
            <b>{iteration.number}</b>
            {iteration.doctorVerdict}
          </span>
        ))}
      </div>
      <strong>12 useful pixel deltas / NIGHT_READY</strong>
    </div>
  );
}

function EvidenceRecap() {
  return (
    <div className="fnrr-evidence" data-evidence-role="main-surface">
      {fullNightRealRunIterations.slice(0, 6).map((iteration) => (
        <section key={iteration.id}>
          <span>{iteration.number}</span>
          <strong>{iteration.kind.replace("_", " ")}</strong>
          <p>{iteration.screenshot}</p>
        </section>
      ))}
    </div>
  );
}

function MorningBoard() {
  const data = fullNightRealRunData;
  return (
    <div className="fnrr-morning" data-evidence-role="main-surface">
      <section>
        <p>Morning status</p>
        <strong>{data.morningReport.status}</strong>
        <span>{data.recommendedMission}</span>
      </section>
      <section>
        <p>Useful deltas</p>
        <strong>{data.morningReport.usefulDeltas}</strong>
        <span>{data.morningReport.nightReadiness}</span>
      </section>
      <section>
        <p>Safety</p>
        <strong>No road push</strong>
        <span>No public release</span>
      </section>
    </div>
  );
}

function PixelVisual({ kind }: { kind: FullNightRealRunDeltaKind }) {
  if (kind === "north_star") return <NorthStarFlow />;
  if (kind === "feedback") return <FeedbackLanguage />;
  if (kind === "sigil") return <SigilVariants />;
  if (kind === "memory") return <MemoryCabinet />;
  if (kind === "pressure") return <PressureField />;
  if (kind === "combination") return <CombinationScene />;
  if (kind === "anti_weirdness") return <AntiWeirdnessPatch />;
  if (kind === "dashboard") return <ProgressDashboard />;
  if (kind === "evidence") return <EvidenceRecap />;
  if (kind === "flow_second_pass") return <NorthStarFlow secondPass />;
  if (kind === "morning_board") return <MorningBoard />;
  return <ChamberRefinement />;
}

function IterationCard({ iteration }: { iteration: FullNightRealRunIteration }) {
  return (
    <article
      className={`fnrr-card fnrr-card-${iteration.kind}`}
      data-testid="full-night-real-run-pixel-delta-preview"
      data-pixel-delta-id={iteration.id}
      data-objective-id={iteration.objective}
      data-useful-delta={iteration.useful ? "true" : "false"}
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
        <span>{iteration.learningStage}</span>
        <span>{iteration.scoreDelta}</span>
      </footer>
    </article>
  );
}

function FullNightRealRunSummary() {
  const data = fullNightRealRunData;
  return (
    <main className="full-night-real-run" data-testid="full-night-real-run">
      <header className="fnrr-header">
        <div>
          <p>DEV-only full-night real pixel run</p>
          <h1>{data.title}</h1>
          <span>{data.route}</span>
        </div>
        <strong>{data.score.newOverall.toFixed(2)}</strong>
      </header>

      <section className="fnrr-summary" aria-label="Full night real run summary">
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
          <span>{data.score.status}</span>
        </div>
        <div data-testid="morning-report-summary">
          <p>Morning report</p>
          <strong>{data.morningReport.status}</strong>
          <span>{data.recommendedMission}</span>
        </div>
      </section>

      <section className="fnrr-direction">
        <p>Current best visual direction</p>
        <strong>{data.currentBestDirection}</strong>
      </section>

      <section className="fnrr-grid" aria-label="Full night real run pixel delta previews">
        {fullNightRealRunIterations.map((iteration) => (
          <IterationCard iteration={iteration} key={iteration.id} />
        ))}
      </section>
    </main>
  );
}

function IsolatedIteration({ iterationId }: { iterationId: FullNightRealRunIterationId }) {
  const iteration = getFullNightRealRunIteration(iterationId);
  return (
    <main
      className={`full-night-real-run fnrr-isolated fnrr-isolated-${iteration.kind}`}
      data-testid="full-night-real-run-iteration"
      data-pixel-delta-id={iteration.id}
      data-objective-id={iteration.objective}
      data-useful-delta={iteration.useful ? "true" : "false"}
      data-evidence-role="primary"
    >
      <header className="fnrr-header fnrr-isolated-header">
        <div>
          <p>DEV-only isolated full-night real-run delta</p>
          <h1>{iteration.label}</h1>
          <span>{fullNightRealRunData.isolatedRoutePrefix}{iteration.id}</span>
        </div>
        <strong>{iteration.number}</strong>
      </header>
      <section className="fnrr-isolated-layout">
        <PixelVisual kind={iteration.kind} />
        <aside className="fnrr-notes">
          <p>{iteration.objective}</p>
          <h2>{iteration.result}</h2>
          <dl>
            <div>
              <dt>Learning loop</dt>
              <dd>{iteration.learningStage}</dd>
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
              <dt>Board safety</dt>
              <dd>{iteration.boardSafety}</dd>
            </div>
          </dl>
        </aside>
      </section>
    </main>
  );
}

export function FullNightRealRun({ route }: { route: FullNightRealRunRoute }) {
  if (route.iterationId) {
    return <IsolatedIteration iterationId={route.iterationId} />;
  }
  return <FullNightRealRunSummary />;
}
