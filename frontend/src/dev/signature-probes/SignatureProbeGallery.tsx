import "./signatureProbeStyles.css";
import type { CSSProperties } from "react";
import { signatureProbes } from "./signatureProbeData";
import type { SignatureProbe, SignatureProbeId } from "./signatureProbeData";

const boardSquares = Array.from({ length: 64 }, (_, index) => {
  const file = index % 8;
  const rank = Math.floor(index / 8);
  return {
    id: `${file}-${rank}`,
    isLight: (file + rank) % 2 === 0,
  };
});

const pieceMap: Record<number, string> = {
  0: "r",
  4: "k",
  7: "r",
  9: "p",
  12: "q",
  18: "n",
  27: "B",
  36: "N",
  44: "Q",
  48: "P",
  52: "K",
  63: "R",
};

function MiniBoard({ probeId }: { probeId: SignatureProbeId }) {
  const shouldShowTrace =
    probeId === "decision_feedback_language" ||
    probeId === "position_resonance" ||
    probeId === "decision_pressure_field";

  return (
    <div className={`sig-probe-board sig-probe-board-${probeId}`} aria-hidden="true">
      {boardSquares.map((square, index) => (
        <span
          className={`sig-probe-square ${square.isLight ? "sig-probe-square-light" : "sig-probe-square-dark"}`}
          key={square.id}
        >
          {pieceMap[index] ? <b>{pieceMap[index]}</b> : null}
        </span>
      ))}
      {shouldShowTrace ? <span className="sig-probe-board-trace" /> : null}
    </div>
  );
}

function PieceIdentityMark() {
  return (
    <div className="sig-probe-piece-set" aria-hidden="true">
      <span className="sig-piece sig-piece-classic">N</span>
      <span className="sig-piece sig-piece-cut">B</span>
      <span className="sig-piece sig-piece-sentinel">R</span>
    </div>
  );
}

function TimelineMark() {
  return (
    <div className="sig-probe-timeline" aria-hidden="true">
      <span />
      <span className="is-critical" />
      <span />
      <span className="is-scar" />
      <span />
    </div>
  );
}

function SigilMark() {
  return (
    <svg className="sig-probe-sigil" viewBox="0 0 120 120" role="img" aria-label="critical moment sigil preview">
      <polygon points="60 8 96 30 104 74 60 112 16 74 24 30" />
      <path d="M60 22 L78 60 L60 98 L42 60 Z" />
      <path d="M28 60 H92 M60 22 V98" />
      <circle cx="60" cy="60" r="12" />
    </svg>
  );
}

function SealMark() {
  return (
    <div className="sig-probe-seal" aria-hidden="true">
      <span>POST</span>
    </div>
  );
}

function CabinetMark() {
  return (
    <div className="sig-probe-cabinet" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function BreathMark() {
  return (
    <div className="sig-probe-breath" aria-hidden="true">
      <span>N</span>
      <span>B</span>
      <span>Q</span>
    </div>
  );
}

function ResonanceMark() {
  return (
    <div className="sig-probe-resonance" aria-hidden="true">
      <MiniBoard probeId="position_resonance" />
      <span className="sig-probe-resonance-link" />
      <MiniBoard probeId="position_resonance" />
    </div>
  );
}

function PressureMark() {
  return (
    <div className="sig-probe-pressure" aria-hidden="true">
      <span />
      <MiniBoard probeId="decision_pressure_field" />
      <span />
    </div>
  );
}

function VisualMark({ probe }: { probe: SignatureProbe }) {
  if (probe.id === "piece_identity_system") {
    return <PieceIdentityMark />;
  }
  if (probe.id === "critical_moment_sigil") {
    return <SigilMark />;
  }
  if (probe.id === "verdict_wax_seal") {
    return <SealMark />;
  }
  if (probe.id === "aftermath_timeline") {
    return <TimelineMark />;
  }
  if (probe.id === "memory_cabinet") {
    return <CabinetMark />;
  }
  if (probe.id === "piece_breath") {
    return <BreathMark />;
  }
  if (probe.id === "position_resonance") {
    return <ResonanceMark />;
  }
  if (probe.id === "decision_pressure_field") {
    return <PressureMark />;
  }
  return <MiniBoard probeId={probe.id} />;
}

function ProbeCard({ probe, index }: { probe: SignatureProbe; index: number }) {
  return (
    <article
      className={`sig-probe-card sig-probe-card-${probe.id}`}
      data-testid={`signature-probe-${probe.id}`}
      style={{
        "--sig-probe-accent": probe.accent,
        "--sig-probe-secondary": probe.secondary,
      } as CSSProperties}
    >
      <div className="sig-probe-card-shell">
        <div className="sig-probe-visual">
          <VisualMark probe={probe} />
        </div>
        <div className="sig-probe-copy">
          <p className="sig-probe-index">{String(index + 1).padStart(2, "0")}</p>
          <h2>{probe.title}</h2>
          <p className="sig-probe-stage">{probe.stage}</p>
          <p className="sig-probe-intent">{probe.intent}</p>
          <dl className="sig-probe-facts">
            <div>
              <dt>Proof</dt>
              <dd>{probe.factualContribution}</dd>
            </div>
            <div>
              <dt>Avoid</dt>
              <dd>{probe.antiPattern}</dd>
            </div>
          </dl>
          <div className="sig-probe-risk-row">
            <span>Decor {probe.decorativeRisk}/3</span>
            <span>Board {probe.boardReadabilityRisk}/3</span>
          </div>
        </div>
      </div>
    </article>
  );
}

export function SignatureProbeGallery() {
  return (
    <main className="sig-probe-gallery" data-testid="signature-probe-gallery">
      <header className="sig-probe-gallery-header">
        <p>NeuroChess Visual Probe Gallery</p>
        <h1>10 signature directions</h1>
        <span>DEV-only route: /app?visualProbeGallery=1</span>
      </header>
      <section className="sig-probe-grid" aria-label="Signature probes">
        {signatureProbes.map((probe, index) => (
          <ProbeCard key={probe.id} probe={probe} index={index} />
        ))}
      </section>
    </main>
  );
}
