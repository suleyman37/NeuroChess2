import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import "./StrictBoardStageTournament.css";

type StageState =
  | "observe"
  | "try_before_feedback"
  | "feedback_success"
  | "feedback_miss"
  | "replay";

type VariantId =
  | "strict_feedback_arena"
  | "top_down_tactical_artifact"
  | "precision_command_stage";

type Variant = {
  id: VariantId;
  label: string;
  shortLabel: string;
  intent: string;
  boardRole: string;
  atmosphere: string;
  references: string[];
  accent: string;
  secondary: string;
  surface: string;
  stageTexture: string;
  result: {
    productGrade: "PRODUCT_GRADE_PASS" | "PRODUCT_GRADE_FAIL";
    gameChanger: "GAME_CHANGER_PASS" | "GAME_CHANGER_WARN";
    cheapUi: "PASS_PRODUCT_UI" | "WARN_DEV_HUD";
  };
};

type StatePreset = {
  id: StageState;
  label: string;
  eyebrow: string;
  headline: string;
  stateMeaning: string;
  boardInstruction: string;
  accentRole: string;
  allowsBoardTrace: boolean;
};

const variantOrder: VariantId[] = [
  "strict_feedback_arena",
  "top_down_tactical_artifact",
  "precision_command_stage",
];

const stateOrder: StageState[] = [
  "observe",
  "try_before_feedback",
  "feedback_success",
  "feedback_miss",
  "replay",
];

const variants: Record<VariantId, Variant> = {
  strict_feedback_arena: {
    id: "strict_feedback_arena",
    label: "Strict Feedback Arena",
    shortLabel: "Arena",
    intent:
      "Fast feedback energy around the board, with the playing surface protected before feedback.",
    boardRole: "true 8x8 decision arena",
    atmosphere: "charged rim energy outside the legal squares",
    references: ["Balatro", "Into the Breach", "Raycast", "Hades"],
    accent: "#78f6c6",
    secondary: "#f5c86b",
    surface: "#111a2d",
    stageTexture: "arena",
    result: {
      productGrade: "PRODUCT_GRADE_PASS",
      gameChanger: "GAME_CHANGER_PASS",
      cheapUi: "PASS_PRODUCT_UI",
    },
  },
  top_down_tactical_artifact: {
    id: "top_down_tactical_artifact",
    label: "Top-Down Tactical Artifact",
    shortLabel: "Artifact",
    intent:
      "Premium board object with atmospheric depth outside the board and a calm top-down read.",
    boardRole: "position artifact",
    atmosphere: "quiet material halo and preserved negative space",
    references: ["Igloo", "SOM", "Messenger", "Figma"],
    accent: "#9fd9ff",
    secondary: "#f0d08a",
    surface: "#162033",
    stageTexture: "artifact",
    result: {
      productGrade: "PRODUCT_GRADE_PASS",
      gameChanger: "GAME_CHANGER_WARN",
      cheapUi: "PASS_PRODUCT_UI",
    },
  },
  precision_command_stage: {
    id: "precision_command_stage",
    label: "Precision Command Stage",
    shortLabel: "Command",
    intent:
      "Serious desktop cockpit where compact controls support the board without becoming debug UI.",
    boardRole: "central tactical instrument",
    atmosphere: "restrained technical field and amber/cyan attention",
    references: ["Orano", "Linear", "Figma", "Into the Breach"],
    accent: "#6ee7ff",
    secondary: "#ffcf72",
    surface: "#121d31",
    stageTexture: "command",
    result: {
      productGrade: "PRODUCT_GRADE_PASS",
      gameChanger: "GAME_CHANGER_WARN",
      cheapUi: "WARN_DEV_HUD",
    },
  },
};

const statePresets: Record<StageState, StatePreset> = {
  observe: {
    id: "observe",
    label: "Observe",
    eyebrow: "Read",
    headline: "Stable read of the position",
    stateMeaning: "Calm board-first scan. No line, no target, no hint.",
    boardInstruction: "The board is clean before effort.",
    accentRole: "quiet perimeter focus",
    allowsBoardTrace: false,
  },
  try_before_feedback: {
    id: "try_before_feedback",
    label: "Try",
    eyebrow: "Effort",
    headline: "Tension around the board, not on it",
    stateMeaning: "The player is thinking. The stage compresses, but the board reveals nothing.",
    boardInstruction: "No candidate path, no destination glow, no answer trace.",
    accentRole: "contained outer pressure",
    allowsBoardTrace: false,
  },
  feedback_success: {
    id: "feedback_success",
    label: "Success",
    eyebrow: "After effort",
    headline: "The attempted idea stabilizes",
    stateMeaning: "A post-attempt teaching trace appears only now.",
    boardInstruction: "Trace is pedagogical and post-feedback.",
    accentRole: "earned stabilization",
    allowsBoardTrace: true,
  },
  feedback_miss: {
    id: "feedback_miss",
    label: "Miss",
    eyebrow: "After effort",
    headline: "Brief correction, then clarity",
    stateMeaning: "The correction is honest and non-humiliating.",
    boardInstruction: "Correction trace is post-feedback only.",
    accentRole: "calm corrective pressure",
    allowsBoardTrace: true,
  },
  replay: {
    id: "replay",
    label: "Replay",
    eyebrow: "After feedback",
    headline: "Replay the line after the attempt",
    stateMeaning: "A guided path is allowed because feedback already happened.",
    boardInstruction: "Playback cannot be confused with pre-feedback hinting.",
    accentRole: "guided memory path",
    allowsBoardTrace: true,
  },
};

const boardFiles = ["a", "b", "c", "d", "e", "f", "g", "h"];
const boardRanks = [8, 7, 6, 5, 4, 3, 2, 1];

const pieces: Record<string, { label: string; side: "white" | "black" }> = {
  a8: { label: "R", side: "black" },
  b8: { label: "N", side: "black" },
  c8: { label: "B", side: "black" },
  d8: { label: "Q", side: "black" },
  e8: { label: "K", side: "black" },
  f8: { label: "B", side: "black" },
  g8: { label: "N", side: "black" },
  h8: { label: "R", side: "black" },
  a7: { label: "P", side: "black" },
  b7: { label: "P", side: "black" },
  c7: { label: "P", side: "black" },
  d7: { label: "P", side: "black" },
  e7: { label: "P", side: "black" },
  f7: { label: "P", side: "black" },
  g7: { label: "P", side: "black" },
  h7: { label: "P", side: "black" },
  c4: { label: "B", side: "white" },
  d4: { label: "P", side: "white" },
  e4: { label: "P", side: "white" },
  f3: { label: "N", side: "white" },
  a2: { label: "P", side: "white" },
  b2: { label: "P", side: "white" },
  c2: { label: "P", side: "white" },
  f2: { label: "P", side: "white" },
  g2: { label: "P", side: "white" },
  h2: { label: "P", side: "white" },
  a1: { label: "R", side: "white" },
  c1: { label: "B", side: "white" },
  d1: { label: "Q", side: "white" },
  e1: { label: "K", side: "white" },
  h1: { label: "R", side: "white" },
};

function squareTone(fileIndex: number, rank: number) {
  return (fileIndex + rank) % 2 === 0 ? "dark" : "light";
}

function formatList(items: string[]) {
  return items.join(" / ");
}

export function StrictBoardStageTournament() {
  const [variantId, setVariantId] = useState<VariantId>("strict_feedback_arena");
  const [stageState, setStageState] = useState<StageState>("observe");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [stageDisabled, setStageDisabled] = useState(false);

  const variant = variants[variantId];
  const preset = statePresets[stageState];
  const traceVisible = preset.allowsBoardTrace && !stageDisabled;
  const stageStyle = {
    "--a20j3-accent": variant.accent,
    "--a20j3-secondary": variant.secondary,
    "--a20j3-board-surface": variant.surface,
  } as CSSProperties;

  const sceneLanguage = useMemo(
    () => ({
      schema_version: "A20J3_strict_firewall_scene_v1",
      scene_id: `a20j3_${variant.id}_${preset.id}`,
      learning_state: preset.id,
      visual_variant: variant.id,
      board_role: variant.boardRole,
      board_readability_rule:
        "True 8x8 top-down grid. Decorative elements stay outside the playing surface. Pre-feedback board surface remains clean.",
      camera_mode: "locked_orthographic",
      atmosphere_family: variant.atmosphere,
      reference_inspirations: variant.references,
      allowed_effects: traceVisible
        ? ["post_feedback_trace", "rim_energy", "material_depth"]
        : ["rim_energy", "subtle_lighting", "material_depth"],
      forbidden_effects: [
        "pre_feedback_solution_line",
        "pre_feedback_candidate_path",
        "decorative_artifacts_on_board",
        "camera_spin",
        "board_surface_fog",
        "fake_xp_rank_transfer",
        "fake_neuroscience",
        "fake_elo",
      ],
      motion_policy: reducedMotion
        ? "reduced_motion_static_state"
        : "subtle_outer_stage_motion_only",
      performance_budget: {
        target_desktop_fps: 60,
        external_assets: false,
        package_install: false,
      },
      accessibility_mode: {
        reduced_motion_available: true,
        stage_disable_available: true,
        critical_information_not_only_visual: true,
      },
    }),
    [preset, reducedMotion, stageDisabled, traceVisible, variant],
  );

  return (
    <main
      className="a20j3-stage"
      data-testid="a20j3-stage"
      data-variant={variantId}
      data-state={stageState}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      data-stage-disabled={stageDisabled ? "true" : "false"}
      data-chessboard-fidelity="pass"
      data-anti-spoiler={preset.allowsBoardTrace ? "post-feedback-trace" : "pre-feedback-clean"}
      style={stageStyle}
    >
      <header className="a20j3-header">
        <div className="a20j3-heading">
          <p className="a20j3-dev-label">DEV-only strict visual firewall tournament</p>
          <h1>NeuroChess Board Stage</h1>
          <p>
            Top-down, board-first, no pre-feedback hints. The stage reacts around
            the chess decision, not over it.
          </p>
        </div>
        <div className="a20j3-status" data-testid="a20j3-firewall-summary">
          <span>Strict gates</span>
          <strong>Chess fidelity + anti-spoiler required</strong>
        </div>
      </header>

      <section className="a20j3-layout" aria-label="Strict Board Stage Tournament">
        <aside className="a20j3-context-panel" aria-label="Selected variant">
          <p className="a20j3-panel-kicker">Variant</p>
          <h2>{variant.label}</h2>
          <p>{variant.intent}</p>
          <dl>
            <div>
              <dt>Board role</dt>
              <dd>{variant.boardRole}</dd>
            </div>
            <div>
              <dt>References</dt>
              <dd>{formatList(variant.references)}</dd>
            </div>
            <div>
              <dt>Firewall</dt>
              <dd>8x8 uniform grid, clean pre-feedback board, no fake claims.</dd>
            </div>
          </dl>
        </aside>

        <section className="a20j3-board-stage" aria-label="Board stage">
          <div className="a20j3-state-banner" data-testid="a20j3-state-banner">
            <span>{variant.shortLabel} / {preset.eyebrow}</span>
            <strong>{preset.headline}</strong>
          </div>
          {!stageDisabled && <StageAtmosphere variant={variantId} state={stageState} />}
          <div
            className="a20j3-board-frame"
            data-testid="a20j3-board-frame"
            data-top-down="true"
            data-board-surface-clean={preset.allowsBoardTrace ? "post-feedback" : "true"}
          >
            <div
              className="a20j3-board-shell"
              data-testid="a20j3-board-shell"
              data-grid="8x8"
              data-perspective="none"
            >
              <div
                className="a20j3-board-grid"
                data-testid="a20j3-board-grid"
                aria-label="Top-down 8 by 8 chessboard"
              >
                {boardRanks.flatMap((rank) =>
                  boardFiles.map((file, fileIndex) => {
                    const square = `${file}${rank}`;
                    const piece = pieces[square];
                    return (
                      <div
                        key={square}
                        className={`a20j3-square a20j3-square-${squareTone(fileIndex, rank)}`}
                        data-testid={`a20j3-square-${square}`}
                        data-square={square}
                      >
                        {piece && (
                          <span className={`a20j3-piece a20j3-piece-${piece.side}`}>
                            {piece.label}
                          </span>
                        )}
                      </div>
                    );
                  }),
                )}
                {traceVisible && <PostFeedbackTrace state={stageState} />}
              </div>
            </div>
            <div className="a20j3-board-readout" data-testid="a20j3-board-readout">
              <span>Top-down 8x8</span>
              <span>Clean surface before feedback</span>
              <span>No external assets</span>
            </div>
          </div>
        </section>

        <aside className="a20j3-control-panel" aria-label="Tournament controls">
          <div>
            <p className="a20j3-panel-kicker">Variants</p>
            <div className="a20j3-control-group">
              {variantOrder.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={id === variantId ? "is-active" : ""}
                  data-testid={`a20j3-variant-${id}`}
                  onClick={() => setVariantId(id)}
                >
                  {variants[id].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="a20j3-panel-kicker">States</p>
            <div className="a20j3-control-group">
              {stateOrder.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={id === stageState ? "is-active" : ""}
                  data-testid={`a20j3-state-${id}`}
                  onClick={() => setStageState(id)}
                >
                  {statePresets[id].label}
                </button>
              ))}
            </div>
          </div>

          <div className="a20j3-toggle-group" aria-label="Fallback controls">
            <label>
              <input
                data-testid="a20j3-reduced-motion-toggle"
                type="checkbox"
                checked={reducedMotion}
                onChange={(event) => setReducedMotion(event.target.checked)}
              />
              Reduced motion
            </label>
            <label>
              <input
                data-testid="a20j3-stage-disable-toggle"
                type="checkbox"
                checked={stageDisabled}
                onChange={(event) => setStageDisabled(event.target.checked)}
              />
              2D fallback
            </label>
          </div>
        </aside>
      </section>

      <footer className="a20j3-footer">
        <p>{preset.stateMeaning}</p>
        <p>{preset.boardInstruction}</p>
        <code>{sceneLanguage.scene_id}</code>
      </footer>
    </main>
  );
}

function StageAtmosphere({ variant, state }: { variant: VariantId; state: StageState }) {
  return (
    <div
      className="a20j3-atmosphere"
      data-testid="a20j3-atmosphere"
      data-variant={variant}
      data-state={state}
      aria-hidden="true"
    >
      <span className="a20j3-rim a20j3-rim-one" />
      <span className="a20j3-rim a20j3-rim-two" />
      <span className="a20j3-rim a20j3-rim-three" />
      <span className="a20j3-side-light a20j3-side-light-left" />
      <span className="a20j3-side-light a20j3-side-light-right" />
    </div>
  );
}

function PostFeedbackTrace({ state }: { state: StageState }) {
  if (state === "feedback_success") {
    return (
      <svg className="a20j3-post-trace a20j3-post-trace-success" viewBox="0 0 100 100" aria-hidden="true">
        <path d="M39 58 C46 47, 53 42, 62 30" />
        <circle cx="39" cy="58" r="2.1" />
        <circle cx="62" cy="30" r="2.4" />
      </svg>
    );
  }
  if (state === "feedback_miss") {
    return (
      <svg className="a20j3-post-trace a20j3-post-trace-miss" viewBox="0 0 100 100" aria-hidden="true">
        <path d="M40 57 C49 56, 56 53, 64 46" />
        <path d="M55 47 L62 40 M62 47 L55 40" />
        <circle cx="44" cy="55" r="2" />
      </svg>
    );
  }
  return (
    <svg className="a20j3-post-trace a20j3-post-trace-replay" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M36 74 C44 62, 54 50, 68 30" />
      <circle cx="36" cy="74" r="2.1" />
      <circle cx="50" cy="54" r="1.8" />
      <circle cx="68" cy="30" r="2.4" />
    </svg>
  );
}
