import "./autonomousPixelRehearsalStyles.css";
import {
  autonomousPixelRehearsalData,
  getRehearsalIteration,
  rehearsalIterations,
  type PixelIterationId,
  type PixelRehearsalIteration,
} from "./autonomousPixelRehearsalData";

export type AutonomousPixelRehearsalRoute = {
  iterationId: PixelIterationId | null;
};

const boardSquares = Array.from({ length: 64 }, (_, index) => {
  const file = index % 8;
  const rank = Math.floor(index / 8);
  return {
    id: `${file}-${rank}`,
    light: (file + rank) % 2 === 0,
  };
});

const chamberPieces: Record<number, string> = {
  0: "r",
  4: "k",
  7: "r",
  11: "p",
  12: "q",
  19: "n",
  27: "B",
  36: "N",
  44: "Q",
  48: "P",
  52: "K",
  63: "R",
};

const feedbackPieces: Record<number, string> = {
  4: "k",
  7: "r",
  12: "q",
  18: "n",
  28: "P",
  35: "b",
  44: "N",
  52: "K",
  60: "R",
};

function StrictBoard({
  mode,
  state = "neutral",
}: {
  mode: "chamber" | "feedback";
  state?: "neutral" | "success" | "miss";
}) {
  const pieces = mode === "chamber" ? chamberPieces : feedbackPieces;
  return (
    <div
      className={`apr-board apr-board-${mode} apr-board-${state}`}
      data-board-visible="true"
      data-evidence-role="board"
    >
      {boardSquares.map((square, index) => (
        <span
          className={`apr-square ${square.light ? "apr-square-light" : "apr-square-dark"}`}
          key={square.id}
        >
          {pieces[index] ? <b>{pieces[index]}</b> : null}
        </span>
      ))}
      {state === "success" ? <span className="apr-board-trace apr-board-trace-success" /> : null}
      {state === "miss" ? <span className="apr-board-trace apr-board-trace-miss" /> : null}
    </div>
  );
}

function FeedbackGlyph({ tone }: { tone: "held" | "success" | "miss" }) {
  return (
    <svg className={`apr-feedback-glyph apr-feedback-glyph-${tone}`} viewBox="0 0 92 92" aria-hidden="true">
      <path d="M46 7 74 23 81 55 46 86 11 55 18 23Z" />
      <path d="M46 20 61 46 46 72 31 46Z" />
      {tone === "success" ? <path d="m27 48 13 13 25-31" /> : null}
      {tone === "miss" ? <path d="m29 29 34 34M63 29 29 63" /> : null}
      {tone === "held" ? <circle cx="46" cy="46" r="9" /> : null}
    </svg>
  );
}

function ChamberDelta() {
  return (
    <div className="apr-chamber-delta" data-evidence-role="main-surface">
      <div className="apr-chamber-rail apr-chamber-rail-left" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="apr-chamber-center">
        <span>refined Variant B chamber</span>
        <StrictBoard mode="chamber" />
      </div>
      <div className="apr-chamber-rail apr-chamber-rail-right" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="apr-chamber-index" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

function FeedbackDelta() {
  const states = [
    { key: "held", label: "No spoiler", board: "neutral" },
    { key: "success", label: "After success", board: "success" },
    { key: "miss", label: "After miss", board: "miss" },
  ] as const;
  return (
    <div className="apr-feedback-delta" data-evidence-role="main-surface">
      {states.map((state) => (
        <section className={`apr-feedback-state apr-feedback-state-${state.key}`} key={state.key}>
          <header>
            <FeedbackGlyph tone={state.key} />
            <strong>{state.label}</strong>
          </header>
          <StrictBoard mode="feedback" state={state.board} />
        </section>
      ))}
    </div>
  );
}

function NorthStarDelta() {
  return (
    <div className="apr-north-star-delta" data-evidence-role="main-surface">
      <ChamberDelta />
      <aside>
        <span>combined rehearsal scene</span>
        <FeedbackGlyph tone="held" />
        <FeedbackGlyph tone="success" />
        <FeedbackGlyph tone="miss" />
      </aside>
    </div>
  );
}

function PixelVisual({ iteration }: { iteration: PixelRehearsalIteration }) {
  if (iteration.kind === "feedback") {
    return <FeedbackDelta />;
  }
  if (iteration.kind === "north_star") {
    return <NorthStarDelta />;
  }
  return <ChamberDelta />;
}

function IterationCard({ iteration }: { iteration: PixelRehearsalIteration }) {
  return (
    <article
      className={`apr-iteration-card apr-iteration-${iteration.kind}`}
      data-testid="pixel-delta-preview"
      data-pixel-delta-id={iteration.id}
      data-objective-id={iteration.objective}
      data-evidence-role="primary"
    >
      <div className="apr-iteration-copy">
        <p>Iteration {iteration.number}</p>
        <h2>{iteration.label}</h2>
        <strong>{iteration.objective}</strong>
        <span>{iteration.result}</span>
      </div>
      <PixelVisual iteration={iteration} />
      <footer>
        <span>{iteration.doctorVerdict}</span>
        <span>{iteration.scoreDelta}</span>
        <span>utility {iteration.utility.toFixed(1)}</span>
      </footer>
    </article>
  );
}

function RehearsalSummary() {
  const data = autonomousPixelRehearsalData;
  return (
    <main className="autonomous-pixel-rehearsal" data-testid="autonomous-pixel-rehearsal">
      <header className="apr-header">
        <div>
          <p>DEV-only Autonomous Pixel Rehearsal</p>
          <h1>{data.title}</h1>
          <span>{data.route}</span>
        </div>
        <strong>{data.score.newOverall.toFixed(2)}</strong>
      </header>

      <section className="apr-summary-band" aria-label="Rehearsal summary">
        <div>
          <p>Configuration</p>
          <strong>{data.configuration.maxIterations} iterations</strong>
          <span>{data.configuration.liveWeb} live web / {data.configuration.userIntervention} user input</span>
        </div>
        <div data-testid="omega-decision-summary">
          <p>OMEGA decision</p>
          <strong>{data.omegaDecision.activeMandate}</strong>
          <span>{data.omegaDecision.rejectedLanes.join(" / ")}</span>
        </div>
        <div data-testid="score-update">
          <p>Score movement</p>
          <strong>{data.score.previousOverall.toFixed(2)}{" -> "}{data.score.newOverall.toFixed(2)}</strong>
          <span>{data.score.candidateStatus}</span>
        </div>
      </section>

      <section className="apr-direction-strip">
        <div>
          <p>Current best visual direction</p>
          <strong>{data.currentBestDirection}</strong>
        </div>
        <div>
          <p>Next recommended mission</p>
          <strong>{data.recommendedMission}</strong>
        </div>
      </section>

      <section className="apr-iteration-grid" aria-label="Pixel delta previews">
        {rehearsalIterations.map((iteration) => (
          <IterationCard iteration={iteration} key={iteration.id} />
        ))}
      </section>
    </main>
  );
}

function IsolatedIteration({ iterationId }: { iterationId: PixelIterationId }) {
  const iteration = getRehearsalIteration(iterationId);
  return (
    <main
      className={`autonomous-pixel-rehearsal apr-isolated apr-isolated-${iteration.kind}`}
      data-testid="autonomous-pixel-rehearsal-iteration"
      data-pixel-delta-id={iteration.id}
      data-objective-id={iteration.objective}
      data-evidence-role="primary"
    >
      <header className="apr-header apr-isolated-header">
        <div>
          <p>DEV-only isolated pixel delta</p>
          <h1>{iteration.label}</h1>
          <span>{autonomousPixelRehearsalData.isolatedRoutePrefix}{iteration.id}</span>
        </div>
        <strong>{iteration.number}</strong>
      </header>
      <section className="apr-isolated-layout">
        <PixelVisual iteration={iteration} />
        <aside className="apr-isolated-notes">
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
              <dt>Score delta</dt>
              <dd>{iteration.scoreDelta}</dd>
            </div>
          </dl>
        </aside>
      </section>
    </main>
  );
}

export function AutonomousPixelRehearsal({ route }: { route: AutonomousPixelRehearsalRoute }) {
  if (route.iterationId) {
    return <IsolatedIteration iterationId={route.iterationId} />;
  }
  return <RehearsalSummary />;
}
