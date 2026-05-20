import "./webVisualRecoveryRunStyles.css";
import {
  getWebVisualRecoveryRunDelta,
  webVisualRecoveryEvents,
  webVisualRecoveryRunData,
  webVisualRecoveryRunDeltas,
  type WebVisualRecoveryRunDelta,
  type WebVisualRecoveryRunDeltaId,
} from "./webVisualRecoveryRunData";

export type WebVisualRecoveryRunRoute = {
  deltaId: WebVisualRecoveryRunDeltaId | null;
};

const boardCells = Array.from({ length: 64 }, (_, index) => ({
  id: `wvrr-${index}`,
  lit: (index + Math.floor(index / 8)) % 2 === 0,
}));

const pieces: Record<number, string> = {
  3: "k",
  8: "p",
  18: "n",
  27: "Q",
  28: "P",
  36: "B",
  45: "N",
  52: "P",
  60: "K",
};

function MiniBoard({ emphasis = "neutral" }: { emphasis?: "neutral" | "recovery" | "auction" }) {
  return (
    <div className={`wvrr-board wvrr-board-${emphasis}`} data-evidence-role="board">
      {boardCells.map((cell, index) => (
        <span className={cell.lit ? "wvrr-square-lit" : "wvrr-square-dark"} key={cell.id}>
          {pieces[index] ? <b>{pieces[index]}</b> : null}
        </span>
      ))}
      {emphasis === "recovery" ? <i className="wvrr-recovery-line" /> : null}
      {emphasis === "auction" ? <i className="wvrr-auction-frame" /> : null}
    </div>
  );
}

function RecoveryRail() {
  return (
    <div className="wvrr-rail" data-testid="recovery-event">
      <MiniBoard emphasis="recovery" />
      <ol>
        {webVisualRecoveryEvents.map((event, index) => (
          <li key={`${event.service}-${event.action}`}>
            <span>{index + 1}</span>
            <div>
              <p>{event.service}</p>
              <strong>{event.action}</strong>
              <small>{event.visible}</small>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SupervisorAuctionBoard() {
  const packets = [
    {
      source: "ChatGPT",
      kind: "strategy",
      note: "Risk challenge and next objective enter as advisory packets.",
    },
    {
      source: "Gemini",
      kind: "visual",
      note: "Visual critique counts only after attachment preview is confirmed.",
    },
    {
      source: "OMEGA",
      kind: "authority",
      note: "Local kernel and Mission Doctor keep final authority.",
    },
  ];
  return (
    <div className="wvrr-auction" data-testid="gemini-visual-packet">
      <MiniBoard emphasis="auction" />
      <section>
        {packets.map((packet) => (
          <article key={packet.source}>
            <p>{packet.kind}</p>
            <strong>{packet.source}</strong>
            <span>{packet.note}</span>
          </article>
        ))}
      </section>
    </div>
  );
}

function PixelDeltaVisual({ delta }: { delta: WebVisualRecoveryRunDelta }) {
  if (delta.visualRole === "packet_board") {
    return <SupervisorAuctionBoard />;
  }
  return <RecoveryRail />;
}

function PixelDeltaCard({ delta }: { delta: WebVisualRecoveryRunDelta }) {
  return (
    <article
      className={`wvrr-card wvrr-card-${delta.visualRole}`}
      data-testid="pixel-delta-card"
      data-pixel-delta-id={delta.id}
      data-objective-id={delta.objective}
      data-useful-delta="true"
    >
      <header>
        <p>{delta.id}</p>
        <h2>{delta.title}</h2>
        <strong>{delta.objective}</strong>
      </header>
      <PixelDeltaVisual delta={delta} />
      <footer>
        <span data-testid="mission-doctor-summary">{delta.doctorVerdict}</span>
        <span>{delta.supervisorSignal}</span>
      </footer>
    </article>
  );
}

function Summary() {
  const data = webVisualRecoveryRunData;
  return (
    <main className="web-visual-recovery-run" data-testid="web-visual-recovery-run">
      <header className="wvrr-header">
        <div>
          <p>DEV-only live web visual recovery run</p>
          <h1>{data.title}</h1>
          <span>{data.route}</span>
        </div>
        <strong>A20BG</strong>
      </header>

      <section className="wvrr-summary" aria-label="Web visual recovery run summary">
        <div data-testid="chatgpt-attempt-log">
          <p>ChatGPT</p>
          <strong>{data.chatgpt.attempts} attempts / {data.chatgpt.successfulDecisionPackets} packets</strong>
          <span>Window 9222 / {data.chatgpt.ajRotation}</span>
        </div>
        <div data-testid="gemini-attempt-log">
          <p>Gemini</p>
          <strong>{data.gemini.attempts} attempts / {data.gemini.visualDecisionPackets} visual packet</strong>
          <span>Window 9223 / separate Google session</span>
        </div>
        <div data-testid="omega-outcome">
          <p>OMEGA</p>
          <strong>{data.omega.result}</strong>
          <span>Fallback {data.omega.fallback}</span>
        </div>
        <div data-testid="mission-doctor-panel">
          <p>Mission Doctor</p>
          <strong>{data.missionDoctor.verdict}</strong>
          <span>{data.missionDoctor.summary}</span>
        </div>
      </section>

      <section className="wvrr-rule">
        <p>Universal browser rule</p>
        <strong>{data.summary}</strong>
      </section>

      <section className="wvrr-events" aria-label="Screenshot recovery events">
        {webVisualRecoveryEvents.map((event) => (
          <article key={`${event.service}-${event.action}`} data-testid="recovery-event">
            <p>{event.service}</p>
            <h2>{event.action}</h2>
            <dl>
              <div>
                <dt>Failure</dt>
                <dd>{event.failure}</dd>
              </div>
              <div>
                <dt>Visible UI</dt>
                <dd>{event.visible}</dd>
              </div>
              <div>
                <dt>Revised action</dt>
                <dd>{event.revised}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>

      <section className="wvrr-grid" aria-label="Visible pixel deltas">
        {webVisualRecoveryRunDeltas.map((delta) => (
          <PixelDeltaCard delta={delta} key={delta.id} />
        ))}
      </section>
    </main>
  );
}

function IsolatedDelta({ deltaId }: { deltaId: WebVisualRecoveryRunDeltaId }) {
  const delta = getWebVisualRecoveryRunDelta(deltaId);
  return (
    <main
      className={`web-visual-recovery-run wvrr-isolated wvrr-isolated-${delta.visualRole}`}
      data-testid="web-visual-recovery-run-delta"
      data-pixel-delta-id={delta.id}
      data-objective-id={delta.objective}
      data-useful-delta="true"
    >
      <header className="wvrr-header">
        <div>
          <p>DEV-only isolated A20BG delta</p>
          <h1>{delta.title}</h1>
          <span>{webVisualRecoveryRunData.isolatedRoutePrefix}{delta.id}</span>
        </div>
        <strong>{delta.doctorVerdict}</strong>
      </header>
      <section className="wvrr-isolated-layout">
        <PixelDeltaVisual delta={delta} />
        <aside>
          <p>{delta.objective}</p>
          <h2>{delta.result}</h2>
          <span>{delta.supervisorSignal}</span>
        </aside>
      </section>
    </main>
  );
}

export function WebVisualRecoveryRun({ route }: { route: WebVisualRecoveryRunRoute }) {
  if (route.deltaId) {
    return <IsolatedDelta deltaId={route.deltaId} />;
  }
  return <Summary />;
}
