import { useState } from "react";
import "./CriticalMomentSigilSpike.css";

type VariantId = "premium_clarity" | "signature_identity" | "radical_safe";

type VariantData = {
  id: VariantId;
  name: string;
  stage: string;
  safety: string;
  avoided: string;
  rationale: string;
};

const variants: Record<VariantId, VariantData> = {
  premium_clarity: {
    id: "premium_clarity",
    name: "1. Premium Clarity",
    stage: "Key Moment Summary / Quick Lecture",
    safety: "High. Fine-line diamond integrates neatly into HUD corners.",
    avoided: "Arcade badge noise and overloaded symbolic styling.",
    rationale: "Absolute geometric restraint with thin lines (0.75px-1px) in slate/platinum. For precision analysis."
  },
  signature_identity: {
    id: "signature_identity",
    name: "2. Signature Identity",
    stage: "Active Training Entry / Full Lesson",
    safety: "High. Confined to sidebar log and move list, no piece overlay.",
    avoided: "Generic outline icons, standard dark SaaS cards.",
    rationale: "Fuses clean helix lines with a chess pawn motif. Distinct branding in teal/gold."
  },
  radical_safe: {
    id: "radical_safe",
    name: "3. Radical but Board-Safe",
    stage: "Practice / Spaced Revision CTA",
    safety: "Medium-High. Sits in bottom margin, zero board pollution.",
    avoided: "Answer cues, loud direction prompts, and board overlays.",
    rationale: "Split-prism chevrons representing the decision crossroads. High-contrast amber."
  }
};

export default function CriticalMomentSigilSpike() {
  const [selectedVariant, setSelectedVariant] = useState<VariantId>("premium_clarity");
  const [isPulse, setIsPulse] = useState(true);
  const [activeSquare, setActiveSquare] = useState("e4");

  const variant = variants[selectedVariant];

  const renderSVG = (id: VariantId, cls = "svg-sigil") => {
    if (id === "premium_clarity") {
      return (
        <svg className={`${cls} premium-clarity`} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" stroke="hsl(215 15% 40%)" strokeWidth="0.8" strokeDasharray="2 3" fill="none" />
          <circle cx="50" cy="50" r="32" stroke="hsl(215 15% 82%)" strokeWidth="1.2" fill="none" />
          <line x1="50" y1="10" x2="50" y2="24" stroke="hsl(215 15% 82%)" strokeWidth="1.2" />
          <line x1="50" y1="76" x2="50" y2="90" stroke="hsl(215 15% 82%)" strokeWidth="1.2" />
          <rect x="33" y="33" width="34" height="34" rx="2" transform="rotate(45 50 50)" stroke="hsl(43 85% 65%)" strokeWidth="1.5" fill="none" className="pulse-target" />
          <circle cx="50" cy="50" r="3" fill="hsl(43 85% 65%)" />
        </svg>
      );
    }
    if (id === "signature_identity") {
      return (
        <svg className={`${cls} signature-identity`} viewBox="0 0 100 100">
          <path d="M 28,25 C 16,38 16,62 28,75" stroke="hsl(174 65% 55%)" strokeWidth="1.5" fill="none" />
          <path d="M 72,25 C 84,38 84,62 72,75" stroke="hsl(174 65% 55%)" strokeWidth="1.5" fill="none" />
          <path d="M 38,32 C 45,32 45,68 50,68 C 55,68 55,32 62,32 M 38,68 C 45,68 45,32 50,32 C 55,32 55,68 62,68" stroke="hsl(215 15% 82%)" strokeWidth="1" fill="none" />
          <circle cx="50" cy="50" r="10" stroke="hsl(43 85% 65%)" strokeWidth="2" fill="none" className="pulse-target" />
        </svg>
      );
    }
    return (
      <svg className={`${cls} radical-safe`} viewBox="0 0 100 100">
        <polygon points="50,10 88,32 88,68 50,90 12,68 12,32" stroke="hsl(22 30% 25%)" strokeWidth="1" strokeDasharray="3 3" fill="none" />
        <path d="M 22,38 L 38,50 L 22,62 M 78,38 L 62,50 L 78,62" stroke="hsl(215 15% 82%)" strokeWidth="1.75" fill="none" />
        <path d="M 50,18 L 50,34 M 50,82 L 50,66" stroke="hsl(22 80% 55%)" strokeWidth="1.5" fill="none" />
        <polygon points="50,36 62,50 50,64 38,50" stroke="hsl(43 80% 55%)" strokeWidth="2" fill="none" className="pulse-target" />
      </svg>
    );
  };

  const renderPremiumClarityV2 = (cls = "svg-sigil") => (
    <svg className={`${cls} premium-clarity-v2`} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="42" stroke="hsl(215 14% 36%)" strokeWidth="0.8" strokeDasharray="1 4" fill="none" />
      <rect x="32" y="32" width="36" height="36" rx="3" transform="rotate(45 50 50)" stroke="hsl(43 86% 66%)" strokeWidth="1.4" fill="none" />
      <rect x="39" y="39" width="22" height="22" rx="2" transform="rotate(45 50 50)" stroke="hsl(174 62% 58%)" strokeWidth="1" fill="none" />
      <path d="M 50 18 L 50 30 M 50 70 L 50 82 M 18 50 L 30 50 M 70 50 L 82 50" stroke="hsl(215 16% 82%)" strokeWidth="1.1" strokeLinecap="round" />
      <circle cx="50" cy="50" r="2.8" fill="hsl(43 86% 66%)" />
    </svg>
  );

  const renderPremiumClarityV3 = (cls = "svg-sigil") => (
    <svg className={`${cls} premium-clarity-v3`} viewBox="0 0 100 100">
      <rect x="16" y="16" width="68" height="68" rx="6" stroke="hsl(215 13% 55%)" strokeWidth="0.8" fill="none" />
      <path d="M 22 22 H 38 M 62 22 H 78 M 22 78 H 38 M 62 78 H 78" stroke="hsl(43 78% 67%)" strokeWidth="1" strokeLinecap="round" />
      <path d="M 22 22 V 38 M 78 22 V 38 M 22 78 V 62 M 78 78 V 62" stroke="hsl(43 78% 67%)" strokeWidth="1" strokeLinecap="round" />
      <rect x="41" y="41" width="18" height="18" rx="2" transform="rotate(45 50 50)" stroke="hsl(174 58% 60%)" strokeWidth="1" fill="none" />
      <circle cx="50" cy="50" r="1.8" fill="hsl(42 72% 74%)" />
    </svg>
  );

  const renderRadicalSafeV2 = (cls = "svg-sigil") => (
    <svg className={`${cls} radical-safe-v2`} viewBox="0 0 100 100">
      <rect x="18" y="26" width="64" height="48" rx="8" stroke="hsl(214 14% 48%)" strokeWidth="0.9" fill="none" />
      <path d="M 28 50 H 41 M 59 50 H 72" stroke="hsl(42 58% 68%)" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M 42 39 L 50 50 L 42 61 M 58 39 L 50 50 L 58 61" stroke="hsl(176 44% 60%)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="50" cy="50" r="3" fill="hsl(42 62% 68%)" />
      <path d="M 32 31 H 42 M 58 69 H 68" stroke="hsl(42 44% 54%)" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );

  return (
    <div className="sigil-spike">
      <nav className="sigil-nav">
        {(Object.keys(variants) as VariantId[]).map((vId) => (
          <button
            key={vId}
            className={`sigil-tab ${selectedVariant === vId ? "active" : ""}`}
            onClick={() => setSelectedVariant(vId)}
          >
            {variants[vId].name}
          </button>
        ))}
      </nav>

      <div className="sigil-grid">
        <section className="sigil-card">
          <header>
            <h2>{variant.name}</h2>
            <div className="sigil-badges">
              <span className="badge stage">{variant.stage}</span>
              <span className="badge dev">DEV-ONLY SPIKE</span>
            </div>
          </header>
          <p>{variant.rationale}</p>

          <div className="sigil-viewport-container">
            <div className={`sigil-viewport ${isPulse ? "pulse" : ""}`}>
              {renderSVG(selectedVariant)}
            </div>
            <button className="sigil-toggle" onClick={() => setIsPulse(!isPulse)}>
              Toggle Pulse Animation: {isPulse ? "ON" : "OFF"}
            </button>
          </div>

          <div className="sigil-specs">
            <div><strong>Board Safety:</strong> {variant.safety}</div>
            <div><strong>Anti-Pattern Avoided:</strong> {variant.avoided}</div>
          </div>
        </section>

        <section className="sigil-preview">
          <div className="board-box">
            <h3>Visual Placement Context</h3>
            <p className="subtitle">Click squares to shift sigil. Active: <strong>{activeSquare}</strong></p>
            <div className="board" role="grid">
              {Array.from({ length: 64 }).map((_, i) => {
                const r = 8 - Math.floor(i / 8);
                const c = String.fromCharCode(97 + (i % 8));
                const coord = `${c}${r}`;
                const isLight = (Math.floor(i / 8) + (i % 8)) % 2 === 0;
                const isTeachable = coord === activeSquare;
                const mockPiece = coord === "e4" ? "P" : coord === "e5" ? "p" : coord === "f3" ? "N" : null;

                return (
                  <div
                    key={coord}
                    className={`square ${isLight ? "light" : "dark"}`}
                    onClick={() => setActiveSquare(coord)}
                    role="gridcell"
                  >
                    {mockPiece}
                    {isTeachable && <div className="square-indicator" />}
                    {isTeachable && (
                      <div className="square-sigil">
                        {renderSVG(selectedVariant, "svg-sigil-small")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="hud-panel">
            <h4>Lesson Focus Context</h4>
            <div className="hud-item">
              <div className="hud-item-left">
                <div className="hud-icon">{renderSVG(selectedVariant)}</div>
                <div>
                  <strong>Teachable Moment ({activeSquare})</strong>
                  <p>Critical decision junction needing review and pattern focus.</p>
                </div>
              </div>
              <span className="badge active">active</span>
            </div>
          </div>
        </section>
      </div>

      <footer className="sigil-compliance">
        <h3>V1 Boundaries Compliance Check</h3>
        <ul>
          <li><strong>No anatomical / medical visuals:</strong> Strictly geometric vector symbols.</li>
          <li><strong>No raw scores or engine internal data:</strong> Only focuses on learning review forks.</li>
          <li><strong>No loud arcade treatment:</strong> Harmonious design built with gold, platinum, and teal lines.</li>
          <li><strong>No answer reveal:</strong> Highlights the location, never reveals the move.</li>
        </ul>
      </footer>

      <section className="multi-agent-sigil-review" data-testid="multi-agent-sigil-review">
        <div className="review-kicker">A20BR live-lane pixel run 2</div>
        <div className="review-heading-row">
          <div>
            <h2>Premium Clarity Live-Lane Comparison</h2>
            <p>
              OMEGA accepted the live-lane packets and selected a bounded objective:
              keep the mark board-first, quieter, and anchored to the stage frame before
              any product-facing use.
            </p>
          </div>
          <span className="badge dev">LIVE PREFLIGHT PASSED</span>
        </div>

        <div className="review-comparison-grid">
          <article className="review-comparison-card" data-testid="original-premium-clarity">
            <span className="comparison-label">Antigravity original</span>
            <div className="comparison-sigil">{renderSVG("premium_clarity", "svg-sigil")}</div>
            <h3>Premium Clarity</h3>
            <p>
              Strongest imported candidate. It is precise, quiet, and board-safe, but still reads
              more like a mark than a complete learning signal.
            </p>
          </article>

          <article className="review-comparison-card selected" data-testid="codex-omega-refined-candidate">
            <span className="comparison-label">Codex / OMEGA refinement</span>
            <div className="comparison-sigil">{renderPremiumClarityV2()}</div>
            <h3>Premium Clarity v2</h3>
            <p>
              Refines the diamond into a double-layer decision marker: gold for the critical
              moment, teal for the learning loop, and crosshair ticks for board-safe placement.
            </p>
          </article>

          <article className="review-comparison-card selected live-lane-card" data-testid="live-lane-refined-candidate">
            <span className="comparison-label">Live-lane refinement</span>
            <div className="live-frame-preview">
              <div className="live-frame-board" aria-hidden="true">
                {Array.from({ length: 16 }).map((_, i) => (
                  <span key={i} className={(Math.floor(i / 4) + (i % 4)) % 2 === 0 ? "light" : "dark"} />
                ))}
              </div>
              <div className="comparison-sigil frame-anchored">{renderPremiumClarityV3()}</div>
            </div>
            <h3>Premium Clarity v3</h3>
            <p>
              Moves the signal away from the grid and into the outer stage frame: a smaller
              tension marker that supports the board instead of competing with it.
            </p>
          </article>
        </div>

        <div className="multi-agent-notes">
          <article>
            <h3>Gemini visual review</h3>
            <p>
              Live visual packet was produced from an isolated screenshot. The packet stayed
              advisory, with the strongest useful signal being to keep board readability and
              use visual critique as a secondary judge.
            </p>
          </article>
          <article>
            <h3>ChatGPT strategy review</h3>
            <p>
              Strategy packet normalized cleanly: reduce visual dominance, anchor the mark to
              the outer frame, and keep the position as the first thing the player reads.
            </p>
          </article>
          <article className="recommendation-card" data-testid="multi-agent-final-recommendation">
            <h3>Final recommendation</h3>
            <ul>
              <li>Promote Premium Clarity v3 as the safest DEV candidate.</li>
              <li>Refine Radical but Board-Safe before any further promotion.</li>
              <li>Promote only as a DEV candidate until tied to a real learning-loop action.</li>
            </ul>
          </article>
        </div>

        <section className="radical-risk-reduction" data-testid="radical-risk-reduction-panel">
          <div className="risk-panel-copy">
            <span className="comparison-label">A20BS risk reduction</span>
            <h3>Radical but Board-Safe: v2 Comparison</h3>
            <p>
              The current radical mark keeps ambition, but its sharp chevrons and hotter
              contrast can pull too much attention. v2 keeps the crossroads idea while
              moving it into a calmer margin signal.
            </p>
          </div>

          <div className="risk-comparison-grid">
            <article data-testid="radical-original-risk-card">
              <div className="comparison-sigil risk-original">{renderSVG("radical_safe", "svg-sigil")}</div>
              <h4>Current Radical</h4>
              <p>Bold and memorable, but still the riskiest imported direction.</p>
            </article>

            <article className="preferred" data-testid="radical-safe-v2-card">
              <div className="comparison-sigil risk-v2">{renderRadicalSafeV2()}</div>
              <h4>Radical but Board-Safe v2</h4>
              <p>
                Softer geometry, lower contrast, and frame-margin placement. It reads as
                serious craft instead of spectacle.
              </p>
            </article>

            <article className="safe-reference" data-testid="premium-clarity-v3-reference-card">
              <div className="comparison-sigil frame-anchored">{renderPremiumClarityV3()}</div>
              <h4>Safe Reference</h4>
              <p>Premium Clarity v3 remains the safest DEV candidate for future exploration.</p>
            </article>
          </div>
        </section>
      </section>
    </div>
  );
}
