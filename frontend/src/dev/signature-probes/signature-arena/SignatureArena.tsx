import "./signatureArenaStyles.css";
import type { CSSProperties } from "react";
import {
  getSignatureArenaVariant,
  selectedSignatureFive,
  signatureArenaVariants,
  type SignatureArenaSignatureId,
  type SignatureArenaVariant,
  type SignatureArenaVariantId,
} from "./signatureArenaData";

export type SignatureArenaVariantRoute = {
  signatureId: SignatureArenaSignatureId;
  variantId: SignatureArenaVariantId;
};

const boardSquares = Array.from({ length: 64 }, (_, index) => {
  const file = index % 8;
  const rank = Math.floor(index / 8);
  return {
    id: `${file}-${rank}`,
    isLight: (file + rank) % 2 === 0,
  };
});

const chamberPieces: Record<number, string> = {
  0: "r",
  4: "k",
  7: "r",
  10: "p",
  12: "q",
  19: "n",
  27: "B",
  36: "N",
  45: "Q",
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
      className={`signature-arena-board signature-arena-board-${mode} signature-arena-board-${state}`}
      data-evidence-role="board"
      data-board-visible="true"
      aria-hidden="true"
    >
      {boardSquares.map((square, index) => (
        <span
          className={`signature-arena-square ${
            square.isLight ? "signature-arena-square-light" : "signature-arena-square-dark"
          }`}
          key={square.id}
        >
          {pieces[index] ? <b>{pieces[index]}</b> : null}
        </span>
      ))}
      {state === "success" ? <span className="signature-arena-trace signature-arena-trace-success" /> : null}
      {state === "miss" ? <span className="signature-arena-trace signature-arena-trace-miss" /> : null}
    </div>
  );
}

function ChamberStage({ variant }: { variant: SignatureArenaVariant }) {
  return (
    <div className={`signature-arena-stage chamber-stage chamber-stage-${variant.variantId.toLowerCase()}`}>
      <div className="chamber-rail chamber-rail-left" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="chamber-core">
        <span className="chamber-state-label">decision chamber</span>
        <StrictBoard mode="chamber" />
      </div>
      <div className="chamber-rail chamber-rail-right" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="chamber-instrument-line" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function FeedbackGlyph({ tone }: { tone: "before" | "success" | "miss" }) {
  return (
    <svg
      className={`feedback-glyph feedback-glyph-${tone}`}
      viewBox="0 0 96 96"
      role="img"
      aria-label={`${tone} feedback glyph`}
    >
      <path d="M48 8 L76 24 L82 58 L48 88 L14 58 L20 24 Z" />
      <path d="M48 22 L63 48 L48 74 L33 48 Z" />
      {tone === "success" ? <path d="M29 50 L43 64 L69 34" /> : null}
      {tone === "miss" ? <path d="M32 32 L64 64 M64 32 L32 64" /> : null}
      {tone === "before" ? <circle cx="48" cy="48" r="10" /> : null}
    </svg>
  );
}

function FeedbackStatePanel({
  label,
  tone,
  boardState,
}: {
  label: string;
  tone: "before" | "success" | "miss";
  boardState: "neutral" | "success" | "miss";
}) {
  return (
    <section className={`feedback-state feedback-state-${tone}`}>
      <div className="feedback-state-header">
        <FeedbackGlyph tone={tone} />
        <span>{label}</span>
      </div>
      <StrictBoard mode="feedback" state={boardState} />
    </section>
  );
}

function FeedbackStage({ variant }: { variant: SignatureArenaVariant }) {
  return (
    <div className={`signature-arena-stage feedback-stage feedback-stage-${variant.variantId.toLowerCase()}`}>
      <FeedbackStatePanel label="No spoiler" tone="before" boardState="neutral" />
      <FeedbackStatePanel label="Success after try" tone="success" boardState="success" />
      <FeedbackStatePanel label="Miss after try" tone="miss" boardState="miss" />
    </div>
  );
}

function VariantVisual({ variant }: { variant: SignatureArenaVariant }) {
  if (variant.signatureId === "decision_feedback_language") {
    return <FeedbackStage variant={variant} />;
  }
  return <ChamberStage variant={variant} />;
}

function VariantScores({ variant }: { variant: SignatureArenaVariant }) {
  return (
    <dl className="signature-score-grid">
      <div>
        <dt>Identity</dt>
        <dd>{variant.scores.visualIdentity.toFixed(1)}</dd>
      </div>
      <div>
        <dt>Board</dt>
        <dd>{variant.scores.boardSafety.toFixed(1)}</dd>
      </div>
      <div>
        <dt>Loop</dt>
        <dd>{variant.scores.learningLoop.toFixed(1)}</dd>
      </div>
      <div>
        <dt>Risk</dt>
        <dd>{variant.scores.integrationRisk.toFixed(1)}</dd>
      </div>
    </dl>
  );
}

function VariantCopy({ variant }: { variant: SignatureArenaVariant }) {
  return (
    <div className="signature-variant-copy">
      <p className="signature-stage-label">{variant.stage}</p>
      <h2>
        {variant.componentName} <span>{variant.variantId}</span>
      </h2>
      <h3>{variant.variantName}</h3>
      <p>{variant.concept}</p>
      <dl className="signature-variant-facts">
        <div>
          <dt>Learning contribution</dt>
          <dd>{variant.learningContribution}</dd>
        </div>
        <div>
          <dt>Board safety</dt>
          <dd>{variant.boardSafety}</dd>
        </div>
        <div>
          <dt>Risk note</dt>
          <dd>{variant.riskNote}</dd>
        </div>
        <div>
          <dt>Avoided</dt>
          <dd>{variant.antiPatternAvoided}</dd>
        </div>
      </dl>
    </div>
  );
}

function VariantCard({ variant }: { variant: SignatureArenaVariant }) {
  return (
    <article
      className={`signature-variant-card signature-variant-${variant.signatureId} signature-variant-${variant.variantId.toLowerCase()}`}
      data-testid={`signature-variant-${variant.signatureId}-${variant.variantId}`}
      data-signature-id={variant.signatureId}
      data-variant-id={variant.variantId}
      data-board-visible="true"
      style={
        {
          "--signature-accent": variant.accent,
          "--signature-secondary": variant.secondary,
        } as CSSProperties
      }
    >
      <div className="signature-variant-visual" data-evidence-role="main-surface">
        <VariantVisual variant={variant} />
      </div>
      <VariantCopy variant={variant} />
      <footer className="signature-variant-footer">
        <span>{variant.material}</span>
        <strong>{variant.preliminaryScore.toFixed(2)}</strong>
      </footer>
    </article>
  );
}

export function SignatureArena() {
  return (
    <main className="signature-arena" data-testid="signature-arena">
      <header className="signature-arena-header">
        <div>
          <p>DEV-only Signature Arena</p>
          <h1>Tripled variants for the top two signatures</h1>
        </div>
        <span>/app?signatureArena=1</span>
      </header>

      <section className="signature-five-summary" data-testid="signature-five-summary">
        <div>
          <p>Selected Signature Five</p>
          <ul>
            {selectedSignatureFive.map((signature) => (
              <li key={signature}>{signature}</li>
            ))}
          </ul>
        </div>
        <aside>
          <strong>Tripled now</strong>
          <span>sacred_board_chamber</span>
          <span>decision_feedback_language</span>
        </aside>
      </section>

      <section className="signature-variant-grid" aria-label="Signature variants">
        {signatureArenaVariants.map((variant) => (
          <VariantCard
            key={`${variant.signatureId}-${variant.variantId}`}
            variant={variant}
          />
        ))}
      </section>
    </main>
  );
}

export function SignatureArenaVariantPage({ route }: { route: SignatureArenaVariantRoute }) {
  const variant = getSignatureArenaVariant(route.signatureId, route.variantId);
  return (
    <main
      className={`signature-arena signature-variant-page signature-variant-page-${variant.signatureId} signature-variant-page-${variant.variantId.toLowerCase()}`}
      data-testid={`signature-variant-page-${variant.signatureId}-${variant.variantId}`}
      data-signature-id={variant.signatureId}
      data-variant-id={variant.variantId}
      data-evidence-role="primary"
      data-board-visible="true"
      style={
        {
          "--signature-accent": variant.accent,
          "--signature-secondary": variant.secondary,
        } as CSSProperties
      }
    >
      <header className="signature-variant-page-header">
        <div>
          <p>{variant.stage}</p>
          <h1>
            {variant.componentName} {variant.variantId}: {variant.variantName}
          </h1>
          <span>{variant.route}</span>
        </div>
        <strong>{variant.preliminaryScore.toFixed(2)}</strong>
      </header>

      <section className="signature-variant-page-layout">
        <article
          className="signature-variant-main-surface"
          data-testid={`signature-variant-main-surface-${variant.signatureId}-${variant.variantId}`}
          data-evidence-role="main-surface"
          data-signature-id={variant.signatureId}
          data-variant-id={variant.variantId}
          data-board-visible="true"
        >
          <VariantVisual variant={variant} />
        </article>
        <aside
          className="signature-variant-detail"
          data-testid={`signature-variant-detail-${variant.signatureId}-${variant.variantId}`}
          data-evidence-role="detail"
          data-signature-id={variant.signatureId}
          data-variant-id={variant.variantId}
        >
          <VariantCopy variant={variant} />
          <VariantScores variant={variant} />
        </aside>
      </section>
    </main>
  );
}
