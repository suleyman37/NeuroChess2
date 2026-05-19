import "./trueOvernightComposerFirstRunStyles.css";
import {
  getTrueOvernightComposerFirstRunIteration,
  trueOvernightComposerFirstDecisionPackets,
  trueOvernightComposerFirstRunData,
  trueOvernightComposerFirstRunIterations,
  type TrueOvernightComposerFirstDeltaKind,
  type TrueOvernightComposerFirstRunIteration,
  type TrueOvernightComposerFirstRunIterationId,
} from "./trueOvernightComposerFirstRunData";

export type TrueOvernightComposerFirstRunRoute = {
  iterationId: TrueOvernightComposerFirstRunIterationId | null;
};

const boardSquares = Array.from({ length: 64 }, (_, index) => {
  const file = index % 8;
  const rank = Math.floor(index / 8);
  return { id: `${file}-${rank}`, light: (file + rank) % 2 === 0 };
});

const boardPieces: Record<number, string> = {
  0: "r",
  4: "k",
  11: "p",
  18: "b",
  27: "P",
  28: "q",
  35: "N",
  42: "B",
  45: "Q",
  52: "P",
  60: "K",
  63: "R",
};

function StrictBoard({ tone = "neutral" }: { tone?: "neutral" | "success" | "miss" | "pressure" }) {
  return (
    <div className={`tocf-board tocf-board-${tone}`} data-board-visible="true" data-evidence-role="board">
      {boardSquares.map((square, index) => (
        <span className={square.light ? "tocf-square-light" : "tocf-square-dark"} key={square.id}>
          {boardPieces[index] ? <b>{boardPieces[index]}</b> : null}
        </span>
      ))}
      {tone === "success" ? <i className="tocf-board-line tocf-board-line-success" /> : null}
      {tone === "miss" ? <i className="tocf-board-line tocf-board-line-miss" /> : null}
      {tone === "pressure" ? <i className="tocf-pressure-frame" /> : null}
    </div>
  );
}

function FeedbackGlyph({ tone }: { tone: "held" | "success" | "miss" | "replay" }) {
  return (
    <svg className={`tocf-glyph tocf-glyph-${tone}`} viewBox="0 0 100 100" aria-hidden="true">
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
    <svg className="tocf-sigil" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 5 76 20 94 50 76 80 50 95 24 80 6 50 24 20Z" />
      <path d="M50 18 68 50 50 82 32 50Z" />
      <path d={line} />
      <circle cx="50" cy="50" r="7" />
    </svg>
  );
}

function ChamberScene({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`tocf-chamber ${compact ? "tocf-chamber-compact" : ""}`} data-evidence-role="main-surface">
      <aside>
        <span />
        <span />
        <span />
      </aside>
      <section>
        <p>composer-first chamber</p>
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
    <div className="tocf-feedback" data-evidence-role="main-surface">
      {states.map((state) => (
        <section className={`tocf-feedback-state tocf-feedback-state-${state.key}`} key={state.key}>
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
    <div className="tocf-flow" data-evidence-role="main-surface">
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
    <div className="tocf-sigil-wall" data-evidence-role="main-surface">
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
    <div className="tocf-memory" data-evidence-role="main-surface">
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
    <div className="tocf-pressure" data-evidence-role="main-surface">
      <i className="tocf-orbit tocf-orbit-a" />
      <i className="tocf-orbit tocf-orbit-b" />
      <StrictBoard tone="pressure" />
      <aside>
        <strong>Pressure without spoilers</strong>
        <span>Composer-first advice challenged the atmosphere, not the answer.</span>
      </aside>
    </div>
  );
}

function CombinationScene() {
  return (
    <div className="tocf-combination" data-evidence-role="main-surface">
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
    <div className="tocf-anti" data-evidence-role="main-surface">
      <section>
        <p>Risk</p>
        <div className="tocf-risk-sample">
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
    <div className="tocf-evidence" data-evidence-role="main-surface">
      {trueOvernightComposerFirstRunIterations.slice(0, 8).map((iteration) => (
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
    <div className="tocf-dashboard" data-evidence-role="main-surface">
      <StrictBoard />
      <div>
        {trueOvernightComposerFirstRunIterations.map((iteration) => (
          <span key={iteration.id}>
            <b>{iteration.number}</b>
            {iteration.doctorVerdict}
          </span>
        ))}
      </div>
      <strong>18 useful deltas / composer-first ChatGPT active</strong>
    </div>
  );
}

function ExternalPacketBoard() {
  return (
    <div className="tocf-external" data-evidence-role="main-surface">
      {trueOvernightComposerFirstDecisionPackets.map((packet) => (
        <section data-testid="chatgpt-decision-packet" key={packet.id}>
          <p>{packet.cadence}</p>
          <strong>{packet.id}</strong>
          <span>{packet.recommendation}</span>
        </section>
      ))}
    </div>
  );
}

function IntegrationStudy() {
  return (
    <div className="tocf-integration" data-evidence-role="main-surface">
      <MicroFlow />
      <aside>
        <SigilMark index={2} />
        <FeedbackGlyph tone="replay" />
        <section>
          <strong>Packet influence</strong>
          <span>ChatGPT advises; OMEGA and Mission Doctor remain final authority.</span>
        </section>
      </aside>
    </div>
  );
}

function PixelVisual({ kind }: { kind: TrueOvernightComposerFirstDeltaKind }) {
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

function IterationCard({ iteration }: { iteration: TrueOvernightComposerFirstRunIteration }) {
  return (
    <article
      className={`tocf-card tocf-card-${iteration.kind}`}
      data-testid="composer-first-pixel-delta-preview"
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
        <span>{iteration.classifierResult}</span>
        <span>{iteration.chatgptPacket}</span>
      </footer>
    </article>
  );
}

function Summary() {
  const data = trueOvernightComposerFirstRunData;
  return (
    <main className="true-overnight-composer-first-run" data-testid="true-overnight-composer-first-run">
      <header className="tocf-header">
        <div>
          <p>DEV-only true overnight composer-first run</p>
          <h1>{data.title}</h1>
          <span>{data.route}</span>
        </div>
        <strong>{data.score.newOverall.toFixed(2)}</strong>
      </header>

      <section className="tocf-summary" aria-label="True overnight composer-first summary">
        <div>
          <p>Runtime contract</p>
          <strong>{data.runtime.actualMinutes} min actual / {data.configuration.minRuntimeMinutes} min minimum</strong>
          <span>{data.runtime.validShortStopReason}</span>
        </div>
        <div data-testid="omega-decision-log">
          <p>OMEGA loop</p>
          <strong>{data.configuration.minIterations} iterations minimum / {trueOvernightComposerFirstRunIterations.length} attempted</strong>
          <span>{data.configuration.liveSupervisorMode} / no user intervention</span>
        </div>
        <div data-testid="chatgpt-supervisor-log">
          <p>ChatGPT supervisor</p>
          <strong>{data.chatgpt.attempts} attempts / {data.chatgpt.successfulDecisionPackets} packets</strong>
          <span>{data.chatgpt.classifierStatus}</span>
        </div>
        <div data-testid="aj-rotation-status">
          <p>A-J rotation</p>
          <strong>threshold 50</strong>
          <span>{data.chatgpt.ajRotation}</span>
        </div>
        <div data-testid="parked-lane-summary">
          <p>Gemini lane</p>
          <strong>{data.gemini.status}</strong>
          <span>Optional and non-blocking</span>
        </div>
        <div data-testid="score-progression">
          <p>Score progression</p>
          <strong>{data.score.previousOverall.toFixed(2)}{" -> "}{data.score.newOverall.toFixed(2)}</strong>
          <span>{data.score.status}</span>
        </div>
        <div data-testid="morning-report-summary">
          <p>Morning report</p>
          <strong>{data.morningReport.nightReadiness}</strong>
          <span>{data.recommendedMission}</span>
        </div>
      </section>

      <section className="tocf-packets" aria-label="Successful ChatGPT Decision Packets">
        {trueOvernightComposerFirstDecisionPackets.map((packet) => (
          <article data-testid="chatgpt-decision-packet" key={packet.id}>
            <p>{packet.cadence}</p>
            <strong>{packet.id}</strong>
            <span>{packet.recommendation}</span>
          </article>
        ))}
      </section>

      <section className="tocf-direction">
        <p>Current best visual direction</p>
        <strong>{data.currentBestDirection}</strong>
      </section>

      <section className="tocf-grid" aria-label="Composer-first pixel deltas">
        {trueOvernightComposerFirstRunIterations.map((iteration) => (
          <IterationCard iteration={iteration} key={iteration.id} />
        ))}
      </section>
    </main>
  );
}

function IsolatedIteration({ iterationId }: { iterationId: TrueOvernightComposerFirstRunIterationId }) {
  const iteration = getTrueOvernightComposerFirstRunIteration(iterationId);
  return (
    <main
      className={`true-overnight-composer-first-run tocf-isolated tocf-isolated-${iteration.kind}`}
      data-testid="true-overnight-composer-first-run-iteration"
      data-pixel-delta-id={iteration.id}
      data-objective-id={iteration.objective}
      data-useful-delta={iteration.useful ? "true" : "false"}
      data-evidence-role="primary"
    >
      <header className="tocf-header tocf-isolated-header">
        <div>
          <p>DEV-only isolated composer-first delta</p>
          <h1>{iteration.label}</h1>
          <span>{trueOvernightComposerFirstRunData.isolatedRoutePrefix}{iteration.id}</span>
        </div>
        <strong>{iteration.number}</strong>
      </header>
      <section className="tocf-isolated-layout">
        <PixelVisual kind={iteration.kind} />
        <aside className="tocf-notes">
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
              <dt>Classifier</dt>
              <dd>{iteration.classifierResult}</dd>
            </div>
            <div>
              <dt>ChatGPT packet</dt>
              <dd>{iteration.chatgptPacket}</dd>
            </div>
          </dl>
        </aside>
      </section>
    </main>
  );
}

export function TrueOvernightComposerFirstRun({ route }: { route: TrueOvernightComposerFirstRunRoute }) {
  if (route.iterationId) {
    return <IsolatedIteration iterationId={route.iterationId} />;
  }
  return <Summary />;
}
