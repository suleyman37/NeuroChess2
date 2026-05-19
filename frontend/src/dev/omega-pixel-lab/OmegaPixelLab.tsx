import "./omegaPixelLabStyles.css";
import { omegaPixelLabData } from "./omegaPixelLabData";

const boardSquares = Array.from({ length: 64 }, (_, index) => {
  const file = index % 8;
  const rank = Math.floor(index / 8);
  return {
    id: `${file}-${rank}`,
    light: (file + rank) % 2 === 0,
  };
});

const pieces: Record<number, string> = {
  0: "r",
  4: "k",
  7: "r",
  11: "p",
  12: "q",
  20: "n",
  27: "B",
  36: "N",
  44: "Q",
  48: "P",
  52: "K",
  63: "R",
};

function OmegaMiniBoard() {
  return (
    <div className="omega-mini-board" data-evidence-role="board" data-board-visible="true">
      {boardSquares.map((square, index) => (
        <span
          className={square.light ? "omega-mini-square omega-mini-square-light" : "omega-mini-square omega-mini-square-dark"}
          key={square.id}
        >
          {pieces[index] ? <b>{pieces[index]}</b> : null}
        </span>
      ))}
    </div>
  );
}

function FeedbackMark({ tone }: { tone: "held" | "success" | "miss" }) {
  return (
    <svg className={`omega-feedback-mark omega-feedback-mark-${tone}`} viewBox="0 0 80 80" aria-hidden="true">
      <path d="M40 6 66 21 72 49 40 74 8 49 14 21Z" />
      <path d="M40 18 55 40 40 62 25 40Z" />
      {tone === "success" ? <path d="m24 42 11 12 23-29" /> : null}
      {tone === "miss" ? <path d="m25 25 30 30M55 25 25 55" /> : null}
      {tone === "held" ? <circle cx="40" cy="40" r="8" /> : null}
    </svg>
  );
}

function VisualPilot() {
  return (
    <section className="omega-pilot" data-testid="omega-visual-pilot" data-evidence-role="main-surface">
      <div className="omega-pilot-chamber" aria-hidden="true">
        <div className="omega-chamber-rail omega-chamber-rail-left">
          <span />
          <span />
          <span />
        </div>
        <div className="omega-board-well">
          <span className="omega-board-label">Variant B chamber</span>
          <OmegaMiniBoard />
        </div>
        <div className="omega-chamber-rail omega-chamber-rail-right">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="omega-feedback-strip">
        <div>
          <FeedbackMark tone="held" />
          <span>No spoiler</span>
        </div>
        <div>
          <FeedbackMark tone="success" />
          <span>After success</span>
        </div>
        <div>
          <FeedbackMark tone="miss" />
          <span>After miss</span>
        </div>
      </div>
    </section>
  );
}

export function OmegaPixelLab() {
  const data = omegaPixelLabData;

  return (
    <main className="omega-pixel-lab" data-testid="omega-pixel-lab">
      <header className="omega-lab-header">
        <div>
          <p>DEV-only OMEGA Pixel Lab</p>
          <h1>Autonomy kernel selecting the next pixel move</h1>
        </div>
        <span>{data.route}</span>
      </header>

      <section className="omega-lab-band omega-kernel-summary" aria-label="OMEGA kernel summary">
        <div data-testid="omega-bottleneck">
          <p>Current bottleneck</p>
          <strong>{data.currentBottleneck.primary}</strong>
          <span>{data.currentBottleneck.secondary.join(" / ")}</span>
        </div>
        <div>
          <p>Pixel mandate</p>
          <strong>{data.currentBottleneck.pixelMandateActive ? "active" : "inactive"}</strong>
          <span>{data.currentBottleneck.recommendedLane}</span>
        </div>
        <div data-testid="omega-selected-objective">
          <p>Selected mission</p>
          <strong>{data.selectedMission.label}</strong>
          <span>{data.selectedMission.id}</span>
        </div>
      </section>

      <section className="omega-lab-layout">
        <div className="omega-candidate-panel">
          <h2>Utility-ranked candidates</h2>
          <ol>
            {data.candidates.map((candidate) => (
              <li key={candidate.id}>
                <span>{candidate.family}</span>
                <strong>{candidate.id}</strong>
                <em>{candidate.utility.toFixed(2)}</em>
                <p>{candidate.reason}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="omega-status-panel">
          <h2>Signature Five status</h2>
          <ul>
            {data.signatureFive.map((signature) => (
              <li key={signature.id}>
                <strong>{signature.id}</strong>
                <span>{signature.status}</span>
                <small>{signature.marker}</small>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="omega-lab-layout omega-pilot-layout">
        <div>
          <h2>First autonomous pixel pilot</h2>
          <p>
            The kernel chooses the provisional Variant B direction because it already has
            perception-grade evidence, taste packets, and board-safe tripled variants.
          </p>
          <dl>
            <div>
              <dt>Top two</dt>
              <dd>{data.topTwo.join(" + ")}</dd>
            </div>
            <div>
              <dt>Provisional winners</dt>
              <dd>
                sacred_board_chamber {data.provisionalWinners.sacred_board_chamber} / decision_feedback_language{" "}
                {data.provisionalWinners.decision_feedback_language}
              </dd>
            </div>
            <div>
              <dt>Proof</dt>
              <dd>{data.selectedMission.proof}</dd>
            </div>
            <div>
              <dt>Next action</dt>
              <dd>{data.nextAction}</dd>
            </div>
          </dl>
        </div>
        <VisualPilot />
      </section>
    </main>
  );
}
