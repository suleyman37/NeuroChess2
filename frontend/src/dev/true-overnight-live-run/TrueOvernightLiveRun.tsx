import "./trueOvernightLiveRunStyles.css";
import {
  getTrueOvernightLiveRunIteration,
  trueOvernightLiveRunData,
  trueOvernightLiveRunIterations,
  type TrueOvernightLiveRunDeltaKind,
  type TrueOvernightLiveRunIteration,
  type TrueOvernightLiveRunIterationId,
} from "./trueOvernightLiveRunData";

export type TrueOvernightLiveRunRoute = {
  iterationId: TrueOvernightLiveRunIterationId | null;
};

const boardSquares = Array.from({ length: 64 }, (_, index) => {
  const file = index % 8;
  const rank = Math.floor(index / 8);
  return { id: `${file}-${rank}`, light: (file + rank) % 2 === 0 };
});

const boardPieces: Record<number, string> = {
  1: "n",
  4: "k",
  11: "p",
  18: "b",
  27: "P",
  28: "q",
  36: "N",
  42: "B",
  45: "Q",
  52: "P",
  60: "K",
  63: "R",
};

function StrictBoard({ tone = "neutral" }: { tone?: "neutral" | "success" | "miss" | "pressure" }) {
  return (
    <div className={`tolr-board tolr-board-${tone}`} data-board-visible="true" data-evidence-role="board">
      {boardSquares.map((square, index) => (
        <span className={square.light ? "tolr-square-light" : "tolr-square-dark"} key={square.id}>
          {boardPieces[index] ? <b>{boardPieces[index]}</b> : null}
        </span>
      ))}
      {tone === "success" ? <i className="tolr-board-line tolr-board-line-success" /> : null}
      {tone === "miss" ? <i className="tolr-board-line tolr-board-line-miss" /> : null}
      {tone === "pressure" ? <i className="tolr-pressure-frame" /> : null}
    </div>
  );
}

function FeedbackGlyph({ tone }: { tone: "held" | "success" | "miss" | "replay" }) {
  return (
    <svg className={`tolr-glyph tolr-glyph-${tone}`} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 6 82 24 90 57 50 94 10 57 18 24Z" />
      <path d="M50 19 66 50 50 82 34 50Z" />
      {tone === "success" ? <path d="m30 51 14 14 28-34" /> : null}
      {tone === "miss" ? <path d="m31 31 38 38M69 31 31 69" /> : null}
      {tone === "replay" ? <path d="M66 37a21 21 0 1 0 3 23M66 37H48" /> : null}
      {tone === "held" ? <circle cx="50" cy="50" r="8" /> : null}
    </svg>
  );
}

function SigilMark({ index }: { index: number }) {
  const line =
    index % 4 === 0
      ? "M22 50h56"
      : index % 4 === 1
        ? "M50 20v60"
        : index % 4 === 2
          ? "m26 29 48 42"
          : "M27 72 73 28";
  return (
    <svg className="tolr-sigil" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 5 76 20 94 50 76 80 50 95 24 80 6 50 24 20Z" />
      <path d="M50 18 68 50 50 82 32 50Z" />
      <path d={line} />
      <circle cx="50" cy="50" r="7" />
    </svg>
  );
}

function ChamberScene({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`tolr-chamber ${compact ? "tolr-chamber-compact" : ""}`} data-evidence-role="main-surface">
      <aside>
        <span />
        <span />
        <span />
      </aside>
      <section>
        <p>strict chamber</p>
        <StrictBoard />
      </section>
      <aside>
        <span />
        <span />
        <span />
      </aside>
    </div>
  );
}

function FeedbackStates() {
  const states = [
    { key: "held", label: "No spoiler", board: "neutral" },
    { key: "success", label: "Success", board: "success" },
    { key: "miss", label: "Miss", board: "miss" },
    { key: "replay", label: "Replay", board: "neutral" },
  ] as const;
  return (
    <div className="tolr-feedback" data-evidence-role="main-surface">
      {states.map((state) => (
        <section className={`tolr-feedback-state tolr-feedback-state-${state.key}`} key={state.key}>
          <FeedbackGlyph tone={state.key} />
          <strong>{state.label}</strong>
          <StrictBoard tone={state.board} />
        </section>
      ))}
    </div>
  );
}

function MicroFlow() {
  const steps = [
    { label: "Observe", tone: "held" },
    { label: "Try", tone: "held" },
    { label: "Feedback", tone: "success" },
    { label: "Replay", tone: "replay" },
    { label: "Memory", tone: "held" },
  ] as const;
  return (
    <div className="tolr-flow" data-evidence-role="main-surface">
      <StrictBoard tone="success" />
      <div>
        {steps.map((step, index) => (
          <section key={step.label}>
            <span>{index + 1}</span>
            <FeedbackGlyph tone={step.tone} />
            <strong>{step.label}</strong>
          </section>
        ))}
      </div>
    </div>
  );
}

function SigilWall() {
  return (
    <div className="tolr-sigil-wall" data-evidence-role="main-surface">
      <StrictBoard />
      {Array.from({ length: 4 }, (_, index) => (
        <section key={index}>
          <SigilMark index={index} />
          <strong>Moment {index + 1}</strong>
        </section>
      ))}
    </div>
  );
}

function MemorySet() {
  return (
    <div className="tolr-memory" data-evidence-role="main-surface">
      <StrictBoard />
      {["Pattern", "Mistake", "Return", "Transfer"].map((label, index) => (
        <section key={label}>
          <span>M{index + 1}</span>
          <strong>{label}</strong>
          <i />
        </section>
      ))}
    </div>
  );
}

function PressureField() {
  return (
    <div className="tolr-pressure" data-evidence-role="main-surface">
      <i className="tolr-orbit tolr-orbit-a" />
      <i className="tolr-orbit tolr-orbit-b" />
      <StrictBoard tone="pressure" />
      <aside>
        <strong>Peripheral pressure</strong>
        <span>No eval bar. No arrows. No hidden best move.</span>
      </aside>
    </div>
  );
}

function CombinationScene() {
  return (
    <div className="tolr-combination" data-evidence-role="main-surface">
      <ChamberScene compact />
      <aside>
        <SigilMark index={1} />
        <FeedbackGlyph tone="held" />
        <FeedbackGlyph tone="success" />
        <section>
          <span>M5</span>
          <strong>Return</strong>
        </section>
      </aside>
    </div>
  );
}

function AntiWeirdnessPatch() {
  return (
    <div className="tolr-anti" data-evidence-role="main-surface">
      <section>
        <p>Rejected</p>
        <div className="tolr-risk-sample">
          <StrictBoard />
        </div>
      </section>
      <section>
        <p>Patched</p>
        <ChamberScene compact />
      </section>
    </div>
  );
}

function EvidenceWall() {
  return (
    <div className="tolr-evidence" data-evidence-role="main-surface">
      {trueOvernightLiveRunIterations.slice(0, 8).map((iteration) => (
        <section key={iteration.id}>
          <span>{iteration.number}</span>
          <strong>{iteration.kind.replace("_", " ")}</strong>
          <p>{iteration.screenshot}</p>
        </section>
      ))}
    </div>
  );
}

function DashboardVisual() {
  return (
    <div className="tolr-dashboard" data-evidence-role="main-surface">
      <StrictBoard />
      <div>
        {trueOvernightLiveRunIterations.slice(0, 18).map((iteration) => (
          <span key={iteration.id}>
            <b>{iteration.number}</b>
            {iteration.doctorVerdict}
          </span>
        ))}
      </div>
      <strong>18 useful deltas / live lanes parked</strong>
    </div>
  );
}

function ExternalPacketBoard() {
  const data = trueOvernightLiveRunData.liveSupervisor;
  return (
    <div className="tolr-external" data-evidence-role="main-surface">
      <section>
        <p>ChatGPT A-J</p>
        <strong>{data.chatgpt.attempts} attempts</strong>
        <span>{data.chatgpt.reason}</span>
      </section>
      <section>
        <p>Gemini visual</p>
        <strong>{data.gemini.attempts} attempt</strong>
        <span>{data.gemini.reason}</span>
      </section>
      <section>
        <p>Authority</p>
        <strong>Local OMEGA</strong>
        <span>Mission Doctor keeps final gate</span>
      </section>
    </div>
  );
}

function IntegrationStudy() {
  return (
    <div className="tolr-integration" data-evidence-role="main-surface">
      <MicroFlow />
      <aside>
        <SigilMark index={2} />
        <FeedbackGlyph tone="replay" />
        <section>
          <strong>Memory return</strong>
          <span>No product integration claim</span>
        </section>
      </aside>
    </div>
  );
}

function PixelVisual({ kind }: { kind: TrueOvernightLiveRunDeltaKind }) {
  if (kind === "micro_flow") return <MicroFlow />;
  if (kind === "feedback") return <FeedbackStates />;
  if (kind === "sigil") return <SigilWall />;
  if (kind === "memory") return <MemorySet />;
  if (kind === "pressure") return <PressureField />;
  if (kind === "combination") return <CombinationScene />;
  if (kind === "anti_weirdness") return <AntiWeirdnessPatch />;
  if (kind === "evidence") return <EvidenceWall />;
  if (kind === "dashboard") return <DashboardVisual />;
  if (kind === "external_packet") return <ExternalPacketBoard />;
  if (kind === "integration_study") return <IntegrationStudy />;
  return <ChamberScene />;
}

function IterationCard({ iteration }: { iteration: TrueOvernightLiveRunIteration }) {
  return (
    <article
      className={`tolr-card tolr-card-${iteration.kind}`}
      data-testid="true-overnight-live-run-pixel-delta-preview"
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
        <span>{iteration.supervisorCheckpoint}</span>
      </footer>
    </article>
  );
}

function TrueOvernightLiveRunSummary() {
  const data = trueOvernightLiveRunData;
  return (
    <main className="true-overnight-live-run" data-testid="true-overnight-live-run">
      <header className="tolr-header">
        <div>
          <p>DEV-only true overnight live-supervised pixel run</p>
          <h1>{data.title}</h1>
          <span>{data.route}</span>
        </div>
        <strong>{data.score.newOverall.toFixed(2)}</strong>
      </header>

      <section className="tolr-summary" aria-label="True overnight run summary">
        <div>
          <p>Runtime contract</p>
          <strong>{data.runtime.actualMinutes} min actual / {data.configuration.minRuntimeMinutes} min minimum</strong>
          <span>{data.runtime.stopReason}</span>
        </div>
        <div data-testid="omega-decision-log">
          <p>OMEGA loop</p>
          <strong>{data.configuration.minIterations} iterations minimum / {trueOvernightLiveRunIterations.length} attempted</strong>
          <span>{data.configuration.liveSupervisorMode} / no user intervention</span>
        </div>
        <div data-testid="chatgpt-supervisor-log">
          <p>ChatGPT supervisor</p>
          <strong>{data.liveSupervisor.chatgpt.attempts} attempts / {data.liveSupervisor.chatgpt.successes} successes</strong>
          <span>{data.liveSupervisor.chatgpt.reason}</span>
        </div>
        <div data-testid="gemini-visual-log">
          <p>Gemini visual</p>
          <strong>{data.liveSupervisor.gemini.attempts} attempt / {data.liveSupervisor.gemini.successes} successes</strong>
          <span>{data.liveSupervisor.gemini.reason}</span>
        </div>
        <div data-testid="parked-lane-summary">
          <p>Parked lanes</p>
          <strong>ChatGPT + Gemini parked</strong>
          <span>Ntfy/local alerts recorded, local OMEGA continued</span>
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

      <section className="tolr-direction">
        <p>Current best visual direction</p>
        <strong>{data.currentBestDirection}</strong>
      </section>

      <section className="tolr-grid" aria-label="True overnight live run pixel deltas">
        {trueOvernightLiveRunIterations.map((iteration) => (
          <IterationCard iteration={iteration} key={iteration.id} />
        ))}
      </section>
    </main>
  );
}

function IsolatedIteration({ iterationId }: { iterationId: TrueOvernightLiveRunIterationId }) {
  const iteration = getTrueOvernightLiveRunIteration(iterationId);
  return (
    <main
      className={`true-overnight-live-run tolr-isolated tolr-isolated-${iteration.kind}`}
      data-testid="true-overnight-live-run-iteration"
      data-pixel-delta-id={iteration.id}
      data-objective-id={iteration.objective}
      data-useful-delta={iteration.useful ? "true" : "false"}
      data-evidence-role="primary"
    >
      <header className="tolr-header tolr-isolated-header">
        <div>
          <p>DEV-only isolated true overnight delta</p>
          <h1>{iteration.label}</h1>
          <span>{trueOvernightLiveRunData.isolatedRoutePrefix}{iteration.id}</span>
        </div>
        <strong>{iteration.number}</strong>
      </header>
      <section className="tolr-isolated-layout">
        <PixelVisual kind={iteration.kind} />
        <aside className="tolr-notes">
          <p>{iteration.objective}</p>
          <h2>{iteration.result}</h2>
          <dl>
            <div>
              <dt>Learning loop</dt>
              <dd>{iteration.learningStage}</dd>
            </div>
            <div>
              <dt>Screenshot</dt>
              <dd>{iteration.screenshot}</dd>
            </div>
            <div>
              <dt>Supervisor</dt>
              <dd>{iteration.supervisorCheckpoint}</dd>
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

export function TrueOvernightLiveRun({ route }: { route: TrueOvernightLiveRunRoute }) {
  if (route.iterationId) {
    return <IsolatedIteration iterationId={route.iterationId} />;
  }
  return <TrueOvernightLiveRunSummary />;
}
