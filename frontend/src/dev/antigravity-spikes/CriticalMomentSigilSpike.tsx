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
    avoided: "Cheap glowing arcade badges, occult clutter.",
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
    avoided: "Pre-feedback solutions or direction hints.",
    rationale: "Split-prism chevrons representing the decision crossroads. High-contrast volcanic amber."
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
          <li><strong>No cheap neon / occult glow:</strong> Harmonious design built with gold, platinum, and teal lines.</li>
          <li><strong>No pre-decision hints:</strong> Highlights the location, never spoils the correct movement.</li>
        </ul>
      </footer>
    </div>
  );
}
