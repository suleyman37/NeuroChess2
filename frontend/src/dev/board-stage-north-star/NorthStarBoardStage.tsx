import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import "./NorthStarBoardStage.css";

type NorthStarState =
  | "observe"
  | "try_before_feedback"
  | "feedback_success"
  | "feedback_miss"
  | "replay";

type PieceSide = "white" | "black";

type Piece = {
  symbol: string;
  side: PieceSide;
  name: string;
};

type StatePreset = {
  id: NorthStarState;
  label: string;
  title: string;
  chamberLine: string;
  boardPromise: string;
  feedbackTone: string;
  accent: string;
  secondary: string;
  phase: "pre_feedback" | "post_feedback";
  allowsBoardTrace: boolean;
};

const stateOrder: NorthStarState[] = [
  "observe",
  "try_before_feedback",
  "feedback_success",
  "feedback_miss",
  "replay",
];

const statePresets: Record<NorthStarState, StatePreset> = {
  observe: {
    id: "observe",
    label: "Observe",
    title: "The position is held in silence",
    chamberLine: "A calm chamber for reading. No direction, no destination, no hint.",
    boardPromise: "The board core stays clean before effort.",
    feedbackTone: "Sacred board, quiet potential.",
    accent: "#76f3d0",
    secondary: "#f1c46a",
    phase: "pre_feedback",
    allowsBoardTrace: false,
  },
  try_before_feedback: {
    id: "try_before_feedback",
    label: "Try",
    title: "Pressure gathers outside the squares",
    chamberLine: "The room tightens around the decision, but the board gives nothing away.",
    boardPromise: "No path, arrow, target, or destination cue before the attempt.",
    feedbackTone: "Contained tension, no spoiler.",
    accent: "#f2ca6d",
    secondary: "#6de9ff",
    phase: "pre_feedback",
    allowsBoardTrace: false,
  },
  feedback_success: {
    id: "feedback_success",
    label: "Insight",
    title: "The idea stabilizes after effort",
    chamberLine: "A clean teaching line appears only now, after the attempt.",
    boardPromise: "The trace is post-feedback pedagogy, not pre-feedback guidance.",
    feedbackTone: "Confirmation without fake reward.",
    accent: "#7af6b7",
    secondary: "#e6d38a",
    phase: "post_feedback",
    allowsBoardTrace: true,
  },
  feedback_miss: {
    id: "feedback_miss",
    label: "Reorient",
    title: "The chamber bends the idea back into focus",
    chamberLine: "Correction is shown as reorientation, never punishment.",
    boardPromise: "The correction trace is allowed only after feedback.",
    feedbackTone: "Honest miss, calm recovery.",
    accent: "#ff9d7c",
    secondary: "#8fc8ff",
    phase: "post_feedback",
    allowsBoardTrace: true,
  },
  replay: {
    id: "replay",
    label: "Replay",
    title: "The decision becomes a memory path",
    chamberLine: "A guided line reconstructs the idea after feedback has happened.",
    boardPromise: "Replay is explicitly post-feedback and cannot be read as a hint.",
    feedbackTone: "Memory, sequence, reconstruction.",
    accent: "#a9a1ff",
    secondary: "#7df0cd",
    phase: "post_feedback",
    allowsBoardTrace: true,
  },
};

const boardFiles = ["a", "b", "c", "d", "e", "f", "g", "h"];
const boardRanks = [8, 7, 6, 5, 4, 3, 2, 1];

const pieces: Record<string, Piece> = {
  a8: { symbol: "♜", side: "black", name: "black rook" },
  b8: { symbol: "♞", side: "black", name: "black knight" },
  c8: { symbol: "♝", side: "black", name: "black bishop" },
  d8: { symbol: "♛", side: "black", name: "black queen" },
  e8: { symbol: "♚", side: "black", name: "black king" },
  f8: { symbol: "♝", side: "black", name: "black bishop" },
  g8: { symbol: "♞", side: "black", name: "black knight" },
  h8: { symbol: "♜", side: "black", name: "black rook" },
  a7: { symbol: "♟", side: "black", name: "black pawn" },
  b7: { symbol: "♟", side: "black", name: "black pawn" },
  c7: { symbol: "♟", side: "black", name: "black pawn" },
  d7: { symbol: "♟", side: "black", name: "black pawn" },
  e7: { symbol: "♟", side: "black", name: "black pawn" },
  f7: { symbol: "♟", side: "black", name: "black pawn" },
  g7: { symbol: "♟", side: "black", name: "black pawn" },
  h7: { symbol: "♟", side: "black", name: "black pawn" },
  c4: { symbol: "♗", side: "white", name: "white bishop" },
  d4: { symbol: "♙", side: "white", name: "white pawn" },
  e4: { symbol: "♙", side: "white", name: "white pawn" },
  f3: { symbol: "♘", side: "white", name: "white knight" },
  a2: { symbol: "♙", side: "white", name: "white pawn" },
  b2: { symbol: "♙", side: "white", name: "white pawn" },
  c2: { symbol: "♙", side: "white", name: "white pawn" },
  f2: { symbol: "♙", side: "white", name: "white pawn" },
  g2: { symbol: "♙", side: "white", name: "white pawn" },
  h2: { symbol: "♙", side: "white", name: "white pawn" },
  a1: { symbol: "♖", side: "white", name: "white rook" },
  c1: { symbol: "♗", side: "white", name: "white bishop" },
  d1: { symbol: "♕", side: "white", name: "white queen" },
  e1: { symbol: "♔", side: "white", name: "white king" },
  h1: { symbol: "♖", side: "white", name: "white rook" },
};

function squareTone(fileIndex: number, rank: number) {
  return (fileIndex + rank) % 2 === 0 ? "dark" : "light";
}

export function NorthStarBoardStage() {
  const [stageState, setStageState] = useState<NorthStarState>("observe");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [flatFallback, setFlatFallback] = useState(false);

  const preset = statePresets[stageState];
  const traceVisible = preset.allowsBoardTrace;
  const stageStyle = {
    "--a20l-accent": preset.accent,
    "--a20l-secondary": preset.secondary,
  } as CSSProperties;

  const sceneContract = useMemo(
    () => ({
      schema_version: "A20L_north_star_scene_v1",
      scene_id: `a20l_north_star_${preset.id}`,
      learning_state: preset.id,
      board_role: "sacred top-down 8x8 decision artifact",
      board_readability_rule:
        "The board core is a true 8x8 grid. No stage atmosphere, fog, rim, or decorative geometry enters the board before feedback.",
      camera_mode: "locked_orthographic",
      atmosphere_family: "premium decision chamber",
      allowed_effects: traceVisible
        ? ["post_feedback_pedagogical_trace", "outer_chamber_light", "memory_rail"]
        : ["outer_chamber_light", "pressure_without_hint", "material_depth"],
      forbidden_effects: [
        "pre_feedback_solution_line",
        "pre_feedback_candidate_path",
        "destination_glow_before_attempt",
        "board_surface_fog",
        "decorative_artifacts_on_board",
        "fake_xp_rank_transfer",
        "fake_neuroscience",
        "fake_elo",
      ],
      reduced_motion: reducedMotion,
      flat_fallback: flatFallback,
    }),
    [flatFallback, preset, reducedMotion, traceVisible],
  );

  return (
    <main
      className="a20l-stage"
      data-testid="a20l-north-star-stage"
      data-state={stageState}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      data-flat-fallback={flatFallback ? "true" : "false"}
      data-chessboard-fidelity="pass"
      data-anti-spoiler={preset.phase === "pre_feedback" ? "pre-feedback-clean" : "post-feedback-trace"}
      style={stageStyle}
    >
      {/* Visual role: atmosphere_without_hint / product_identity. The chamber lives outside the board core. */}
      <StageWorld state={stageState} hidden={flatFallback} />

      <section className="a20l-shell" aria-label="NeuroChess North Star Board Stage">
        <header className="a20l-hero">
          <div>
            <p className="a20l-kicker">Decision chamber</p>
            <h1>NeuroChess Board Stage</h1>
          </div>
          <p>{preset.title}</p>
        </header>

        <section className="a20l-experience" aria-label="Board-centered decision chamber">
          <aside className="a20l-chamber-panel a20l-chamber-panel-left" aria-label="Decision context">
            <p className="a20l-panel-label">Current state</p>
            <h2>{preset.label}</h2>
            <p>{preset.chamberLine}</p>
            <div className="a20l-state-meter" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          </aside>

          <section className="a20l-board-theater" aria-label="Sacred board stage">
            {/* Visual role: board_readability. The frame may glow, but the grid never distorts. */}
            <div
              className="a20l-board-frame"
              data-testid="a20l-board-frame"
              data-zone="board-frame"
              data-top-down="true"
            >
              <div className="a20l-board-aura" aria-hidden="true" />
              <div
                className="a20l-board-core"
                data-testid="a20l-board-core"
                data-zone="board-core"
                data-board-surface-clean={preset.phase === "pre_feedback" ? "true" : "post-feedback"}
              >
                <div
                  className="a20l-board-grid"
                  data-testid="a20l-board-grid"
                  data-grid="8x8"
                  data-perspective="none"
                  aria-label="Top-down chessboard"
                >
                  {boardRanks.flatMap((rank) =>
                    boardFiles.map((file, fileIndex) => {
                      const square = `${file}${rank}`;
                      const piece = pieces[square];
                      return (
                        <div
                          key={square}
                          className={`a20l-square a20l-square-${squareTone(fileIndex, rank)}`}
                          data-testid={`a20l-square-${square}`}
                          data-square={square}
                        >
                          {piece && (
                            <span
                              className={`a20l-piece a20l-piece-${piece.side}`}
                              aria-label={piece.name}
                            >
                              {piece.symbol}
                            </span>
                          )}
                        </div>
                      );
                    }),
                  )}
                  {traceVisible && <PostFeedbackTrace state={stageState} />}
                </div>
              </div>
            </div>
            <div className="a20l-board-caption" data-testid="a20l-board-caption">
              <span>8x8 preserved</span>
              <span>{preset.boardPromise}</span>
            </div>
          </section>

          <aside className="a20l-chamber-panel a20l-chamber-panel-right" aria-label="State controls">
            <p className="a20l-panel-label">Decision flow</p>
            <div className="a20l-state-controls">
              {stateOrder.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={id === stageState ? "is-active" : ""}
                  data-testid={`a20l-state-${id}`}
                  onClick={() => setStageState(id)}
                >
                  <span>{statePresets[id].label}</span>
                </button>
              ))}
            </div>
            <div className="a20l-accessibility-controls" aria-label="Display controls">
              <label>
                <input
                  data-testid="a20l-reduced-motion-toggle"
                  type="checkbox"
                  checked={reducedMotion}
                  onChange={(event) => setReducedMotion(event.target.checked)}
                />
                Reduced motion
              </label>
              <label>
                <input
                  data-testid="a20l-flat-fallback-toggle"
                  type="checkbox"
                  checked={flatFallback}
                  onChange={(event) => setFlatFallback(event.target.checked)}
                />
                2D fallback
              </label>
            </div>
          </aside>
        </section>

        <footer className="a20l-footer">
          <p>{preset.feedbackTone}</p>
          <p>{sceneContract.board_readability_rule}</p>
        </footer>
      </section>
    </main>
  );
}

function StageWorld({ state, hidden }: { state: NorthStarState; hidden: boolean }) {
  if (hidden) {
    return null;
  }

  return (
    <div
      className="a20l-stage-world"
      data-testid="a20l-stage-world"
      data-state={state}
      aria-hidden="true"
    >
      <span className="a20l-world-rail a20l-world-rail-left" />
      <span className="a20l-world-rail a20l-world-rail-right" />
      <span className="a20l-world-ring a20l-world-ring-one" />
      <span className="a20l-world-ring a20l-world-ring-two" />
      <span className="a20l-world-signal a20l-world-signal-one" />
      <span className="a20l-world-signal a20l-world-signal-two" />
    </div>
  );
}

function PostFeedbackTrace({ state }: { state: NorthStarState }) {
  if (state === "feedback_success") {
    return (
      <svg
        className="a20l-post-trace a20l-post-trace-success"
        data-testid="a20l-post-feedback-trace"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <path className="a20l-trace-path" d="M38 58 C45 49, 52 43, 62 30" />
        <circle cx="38" cy="58" r="2.2" />
        <circle cx="62" cy="30" r="2.5" />
      </svg>
    );
  }

  if (state === "feedback_miss") {
    return (
      <svg
        className="a20l-post-trace a20l-post-trace-miss"
        data-testid="a20l-post-feedback-trace"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <path className="a20l-trace-ghost" d="M38 58 C47 53, 55 50, 63 45" />
        <path className="a20l-trace-path" d="M42 62 C50 56, 59 47, 66 35" />
        <circle cx="42" cy="62" r="2.1" />
        <circle cx="66" cy="35" r="2.5" />
      </svg>
    );
  }

  return (
    <svg
      className="a20l-post-trace a20l-post-trace-replay"
      data-testid="a20l-post-feedback-trace"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <path className="a20l-trace-path" d="M34 75 C42 64, 52 51, 67 31" />
      <circle cx="34" cy="75" r="2" />
      <circle cx="48" cy="56" r="1.8" />
      <circle cx="67" cy="31" r="2.5" />
    </svg>
  );
}
