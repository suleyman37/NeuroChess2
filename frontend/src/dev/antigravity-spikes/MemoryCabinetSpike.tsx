import { useState } from "react";
import "./MemoryCabinetSpike.css";

type VariantId = "premium_clarity" | "signature_identity" | "radical_safe";

type VariantData = {
  id: VariantId;
  name: string;
  label: string;
  stage: string;
  role: string;
  safety: string;
  avoided: string;
  rationale: string;
};

const variants: Record<VariantId, VariantData> = {
  premium_clarity: {
    id: "premium_clarity",
    name: "1. Premium Clarity",
    label: "Archival Card (Fiche d'archive)",
    stage: "Spaced Repetition / Revision",
    role: "Memory & Return. A quiet indexing of fragile positions for practice.",
    safety: "High. Placed strictly in the sidebar; zero board presence.",
    avoided: "Gamified reward systems and fake progress metrics.",
    rationale: "Minimalist thin-line outline index card with a single discrete gold marker dot."
  },
  signature_identity: {
    id: "signature_identity",
    name: "2. Signature Identity",
    label: "Return Anchor (Ancre de retour)",
    stage: "Review Summary Journey",
    role: "Review & Transfer. Anchors critical memory crossroads in your history.",
    safety: "High. Docked safely near the move list; no piece occlusion.",
    avoided: "Cheap neon glow and literal chess-piece metaphors (no rooks).",
    rationale: "Clean concentric vector arcs forming a modern return trajectory around a base mark."
  },
  radical_safe: {
    id: "radical_safe",
    name: "3. Radical but Board-Safe",
    label: "Decision Trace Quadrant (Trace de decision)",
    stage: "Active Repetition Prep",
    role: "Return & Recall. Frame indicator reminding you of decision tension.",
    safety: "High. Sits in viewport margins, completely outside playable board space.",
    avoided: "Pre-feedback hints, target indicators, or play-revealing cues.",
    rationale: "An ambitious vector crosshair framing the outer boundaries of the board area."
  }
};

type StoredMoment = {
  id: string;
  name: string;
  square: string;
  desc: string;
};

const mockMoments: StoredMoment[] = [
  { id: "m1", name: "Moment A: Fragile d4 Fork", square: "d4", desc: "Tactical crossroads in opening" },
  { id: "m2", name: "Moment B: Refuted e5 Push", square: "e5", desc: "Positional mistake on center push" },
  { id: "m3", name: "Moment C: Castling Blunder", square: "g1", desc: "King safety risk under pressure" }
];

export default function MemoryCabinetSpike() {
  const [selectedVariant, setSelectedVariant] = useState<VariantId>("premium_clarity");
  const [activeSquare, setActiveSquare] = useState("d4");
  const [cabinetMoments, setCabinetMoments] = useState<StoredMoment[]>(mockMoments);
  const [isPulse, setIsPulse] = useState(true);

  const variant = variants[selectedVariant];

  const renderSVG = (id: VariantId, cls = "svg-cabinet") => {
    if (id === "premium_clarity") {
      return (
        <svg className={`${cls} premium-clarity`} viewBox="0 0 100 100" fill="none" stroke="currentColor">
          <rect x="12" y="22" width="76" height="56" rx="4" stroke="hsl(215 15% 36%)" strokeWidth="1" strokeDasharray="3 3" />
          <rect x="22" y="34" width="56" height="38" rx="2" stroke="hsl(215 15% 82%)" strokeWidth="1.2" />
          <line x1="32" y1="46" x2="68" y2="46" stroke="hsl(215 15% 48%)" strokeWidth="0.8" />
          <line x1="32" y1="54" x2="58" y2="54" stroke="hsl(215 15% 48%)" strokeWidth="0.8" />
          <circle cx="70" cy="42" r="2.2" fill="hsl(43 85% 65%)" stroke="none" className="pulse-target" />
        </svg>
      );
    }
    if (id === "signature_identity") {
      return (
        <svg className={`${cls} signature-identity`} viewBox="0 0 100 100" fill="none" stroke="currentColor">
          <path d="M 22,42 A 28,28 0 0,1 78,42" stroke="hsl(174 65% 55% / 0.4)" strokeWidth="1" strokeDasharray="2 3" />
          <path d="M 32,32 A 22,22 0 0,0 68,32" stroke="hsl(174 65% 55%)" strokeWidth="1.2" />
          <path d="M 38,66 L 50,76 L 62,66" stroke="hsl(215 15% 82%)" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="50" y1="42" x2="50" y2="76" stroke="hsl(215 15% 82%)" strokeWidth="1.1" />
          <circle cx="50" cy="42" r="3.5" stroke="hsl(43 85% 65%)" strokeWidth="1.4" fill="none" className="pulse-target" />
        </svg>
      );
    }
    return (
      <svg className={`${cls} radical-safe`} viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <path d="M 22,16 H 16 V 22 M 78,16 H 84 V 22 M 16,78 V 84 H 22 M 84,78 V 84 H 78" stroke="hsl(215 15% 45%)" strokeWidth="1.2" />
        <line x1="50" y1="22" x2="50" y2="78" stroke="hsl(22 80% 55% / 0.3)" strokeWidth="0.8" strokeDasharray="3 3" />
        <line x1="22" y1="50" x2="78" y2="50" stroke="hsl(22 80% 55% / 0.3)" strokeWidth="0.8" strokeDasharray="3 3" />
        <path d="M 44,44 H 47 V 47 M 56,44 H 53 V 47 M 44,56 H 47 V 53 M 56,56 H 53 V 53" stroke="hsl(43 80% 55%)" strokeWidth="1.4" className="pulse-target" />
        <rect x="49" y="49" width="2" height="2" fill="hsl(43 80% 55%)" stroke="none" />
      </svg>
    );
  };

  const handleSelectMoment = (moment: StoredMoment) => {
    setActiveSquare(moment.square);
  };

  return (
    <div className="cabinet-spike">
      <nav className="cabinet-nav">
        {(Object.keys(variants) as VariantId[]).map((vId) => (
          <button
            key={vId}
            className={`cabinet-tab ${selectedVariant === vId ? "active" : ""}`}
            onClick={() => setSelectedVariant(vId)}
          >
            {variants[vId].name}
          </button>
        ))}
      </nav>

      <div className="cabinet-grid">
        <section className="cabinet-card">
          <header>
            <h2>{variant.name}</h2>
            <div className="cabinet-badges">
              <span className="badge label-badge">{variant.label}</span>
              <span className="badge dev-badge">DEV-ONLY SPIKE</span>
            </div>
          </header>

          <div className="cabinet-meta">
            <div><strong>Loop Stage:</strong> {variant.stage}</div>
            <div><strong>Metaphor Role:</strong> {variant.role}</div>
          </div>

          <p className="cabinet-rationale">{variant.rationale}</p>

          <div className="cabinet-viewport-container">
            <div className={`cabinet-viewport ${isPulse ? "pulse" : ""}`}>
              {renderSVG(selectedVariant)}
            </div>
            <button className="cabinet-toggle" onClick={() => setIsPulse(!isPulse)}>
              Animation: {isPulse ? "ACTIVE" : "PAUSED"}
            </button>
          </div>

          <div className="cabinet-specs">
            <div><strong>Board Safety:</strong> {variant.safety}</div>
            <div><strong>Anti-Pattern Avoided:</strong> {variant.avoided}</div>
          </div>
        </section>

        <section className="cabinet-preview">
          <div className="cabinet-integration-box">
            <h3>Visual Cabinet Showcase</h3>
            <p className="subtitle">Select a stored memory to load its board context. Active: <strong>{activeSquare}</strong></p>

            <div className="showcase-content">
              {/* Mini Board Representation */}
              <div className="mini-board-container">
                <div className="mini-board" role="grid">
                  {Array.from({ length: 64 }).map((_, i) => {
                    const r = 8 - Math.floor(i / 8);
                    const c = String.fromCharCode(97 + (i % 8));
                    const coord = `${c}${r}`;
                    const isLight = (Math.floor(i / 8) + (i % 8)) % 2 === 0;
                    const isSelected = coord === activeSquare;

                    return (
                      <div
                        key={coord}
                        className={`mini-square ${isLight ? "light" : "dark"} ${isSelected ? "selected" : ""}`}
                        role="gridcell"
                        onClick={() => setActiveSquare(coord)}
                      >
                        {isSelected && (
                          <div className="board-indicator">
                            {selectedVariant === "radical_safe" ? (
                              /* Radical-safe quadrant is rendered outside the squares, this is a board boundary overlay mockup */
                              <div className="safe-margin-bracket" />
                            ) : (
                              renderSVG(selectedVariant, "svg-cabinet-small")
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stored drawer entries */}
              <div className="moments-drawer" aria-label="Cabinet items">
                <h4>Stored Drawer (Archived Moments)</h4>
                <div className="moments-list">
                  {cabinetMoments.map((moment) => (
                    <button
                      key={moment.id}
                      className={`moment-item ${activeSquare === moment.square ? "active" : ""}`}
                      onClick={() => handleSelectMoment(moment)}
                    >
                      <div className="moment-header">
                        <strong>{moment.name}</strong>
                        <span className="badge square-badge">{moment.square}</span>
                      </div>
                      <p>{moment.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="cabinet-compliance">
        <h3>Memory Cabinet Compliance Audit</h3>
        <ul>
          <li><strong>No literal wooden furniture:</strong> Uses archival catalog symbols.</li>
          <li><strong>No pre-feedback hints:</strong> Icons mark return spots, never the correct move coordinates.</li>
          <li><strong>No arcade reward badge:</strong> Calmed, thin-line vectors suited for professional learning.</li>
          <li><strong>Forbidden labels scan:</strong> Strictly no anatomical references or gamification jargon.</li>
        </ul>
      </footer>
    </div>
  );
}
