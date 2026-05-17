import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import "./BoardStagePrototype.css";

type StageState =
  | "observe"
  | "try_before_feedback"
  | "feedback_success"
  | "feedback_miss"
  | "replay";

type ScenePreset = {
  learning_state: StageState;
  label: string;
  shortLabel: string;
  headline: string;
  atmosphere: string;
  accent: string;
  board_role: string;
  motion_policy: string;
  allowed_effects: string[];
  forbidden_effects: string[];
};

const SCENE_PRESETS: Record<StageState, ScenePreset> = {
  observe: {
    learning_state: "observe",
    label: "Observe",
    shortLabel: "Observe",
    headline: "Stable read of the position",
    atmosphere: "quiet technical field",
    accent: "#69e8ff",
    board_role: "central_artifact",
    motion_policy: "locked_orthographic_low_motion",
    allowed_effects: ["subtle_grid", "material_depth", "focus_halo"],
    forbidden_effects: ["camera_spin", "meaningless_glow", "fake_progress_claim"],
  },
  try_before_feedback: {
    learning_state: "try_before_feedback",
    label: "Try before feedback",
    shortLabel: "Try",
    headline: "Contained tension, no answer trace",
    atmosphere: "compressed decision pressure",
    accent: "#f6c766",
    board_role: "decision_arena",
    motion_policy: "state_energy_without_solution_reveal",
    allowed_effects: ["decision_ring", "subtle_grid", "artifact_fragment"],
    forbidden_effects: ["solution_spoiler", "camera_spin", "motion_without_state"],
  },
  feedback_success: {
    learning_state: "feedback_success",
    label: "Feedback success",
    shortLabel: "Success",
    headline: "Decision stabilizes after effort",
    atmosphere: "earned stabilization",
    accent: "#61e6a7",
    board_role: "confirmed_decision_artifact",
    motion_policy: "short_stabilization_pulse",
    allowed_effects: ["stabilization_pulse", "line_trace_after_attempt"],
    forbidden_effects: ["fake_reward_economy", "random_particles", "excessive_bloom"],
  },
  feedback_miss: {
    learning_state: "feedback_miss",
    label: "Feedback miss",
    shortLabel: "Miss",
    headline: "Brief imbalance, then clarity reset",
    atmosphere: "corrective pressure",
    accent: "#ff7b91",
    board_role: "resettable_learning_field",
    motion_policy: "brief_imbalance_no_humiliation",
    allowed_effects: ["decision_ring", "artifact_fragment"],
    forbidden_effects: ["punitive_spectacle", "board_obscuring_fog", "fake_science_claim"],
  },
  replay: {
    learning_state: "replay",
    label: "Replay",
    shortLabel: "Replay",
    headline: "Guided line after feedback",
    atmosphere: "traceable memory path",
    accent: "#9b8cff",
    board_role: "replay_path_surface",
    motion_policy: "guided_path_after_feedback_only",
    allowed_effects: ["replay_path", "memory_trace", "material_depth"],
    forbidden_effects: ["free_camera_spin", "zoom_jumps", "decorative_shader_noise"],
  },
};

const BOARD_FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const BOARD_ROWS = [8, 7, 6, 5, 4, 3, 2, 1];

const PIECES: Record<string, string> = {
  a8: "r",
  b8: "n",
  c8: "b",
  d8: "q",
  e8: "k",
  f8: "b",
  g8: "n",
  h8: "r",
  a7: "p",
  b7: "p",
  c7: "p",
  d7: "p",
  e7: "p",
  f7: "p",
  g7: "p",
  h7: "p",
  c4: "B",
  d4: "P",
  e4: "P",
  f3: "N",
  a2: "P",
  b2: "P",
  c2: "P",
  f2: "P",
  g2: "P",
  h2: "P",
  a1: "R",
  c1: "B",
  d1: "Q",
  e1: "K",
  h1: "R",
};

const stateOrder: StageState[] = [
  "observe",
  "try_before_feedback",
  "feedback_success",
  "feedback_miss",
  "replay",
];

function formatEffect(effect: string) {
  return effect.replace(/_/g, " ");
}

export function BoardStagePrototype() {
  const [stageState, setStageState] = useState<StageState>("observe");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const preset = SCENE_PRESETS[stageState];
  const style = { "--stage-accent": preset.accent } as CSSProperties;

  const sceneLanguage = useMemo(
    () => ({
      schema_version: "A20H_dev_board_stage_scene_v1",
      scene_id: `a20h_${preset.learning_state}`,
      learning_state: preset.learning_state,
      board_role: preset.board_role,
      board_readability_rule:
        "Board remains central, stable, readable, and precise; if visual stage effects reduce readability they recede.",
      camera_mode: "locked_orthographic",
      atmosphere_family: preset.atmosphere,
      reference_inspirations: [
        "Orano precision",
        "Igloo material depth",
        "Messenger compact living world",
        "SOM central totem",
        "Into the Breach tactical clarity",
        "Balatro feedback rhythm",
      ],
      allowed_effects: preset.allowed_effects,
      forbidden_effects: preset.forbidden_effects,
      motion_policy: preset.motion_policy,
      performance_budget: {
        target_desktop_fps: 60,
        graceful_minimum_fps: 30,
        postprocess_passes: 0,
        external_assets: false,
      },
      accessibility_mode: {
        reduced_motion_available: true,
        effects_can_be_disabled: true,
        critical_information_not_only_visual: true,
      },
    }),
    [preset],
  );

  return (
    <main
      className="a20h-board-stage-prototype"
      data-testid="a20h-board-stage-prototype"
      data-state={stageState}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      data-effects-enabled={effectsEnabled ? "true" : "false"}
      style={style}
    >
      <header className="a20h-stage-header">
        <div>
          <p className="a20h-kicker">DEV-only prototype</p>
          <h1>NeuroChess Board Stage</h1>
        </div>
        <div className="a20h-stage-status" data-testid="a20h-state-summary">
          <span>{preset.label}</span>
          <strong>{preset.headline}</strong>
        </div>
      </header>

      <section className="a20h-stage-shell" aria-label="DEV-only board-centered visual stage">
        <aside className="a20h-side-panel a20h-left-panel">
          <p className="a20h-panel-label">Scene language</p>
          <h2>{preset.shortLabel}</h2>
          <dl>
            <div>
              <dt>Board role</dt>
              <dd>{formatEffect(preset.board_role)}</dd>
            </div>
            <div>
              <dt>Motion</dt>
              <dd>{formatEffect(preset.motion_policy)}</dd>
            </div>
            <div>
              <dt>Atmosphere</dt>
              <dd>{preset.atmosphere}</dd>
            </div>
          </dl>
        </aside>

        <div className="a20h-stage-core" data-testid="a20h-stage-core">
          <div className="a20h-stage-depth" aria-hidden="true">
            <span className="a20h-depth-line a20h-depth-line-1" />
            <span className="a20h-depth-line a20h-depth-line-2" />
            <span className="a20h-depth-line a20h-depth-line-3" />
          </div>
          <div className="a20h-stage-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          {effectsEnabled ? <StageEffects state={stageState} /> : null}
          <div className="a20h-board-plane" data-testid="a20h-board-plane">
            <div className="a20h-board-frame">
              <div
                className="a20h-board"
                data-testid="a20h-board"
                aria-label="Readable chessboard at the center of the DEV-only Board Stage"
              >
                {BOARD_ROWS.map((rowNumber, rowIndex) =>
                  BOARD_FILES.map((fileName, fileIndex) => {
                    const square = `${fileName}${rowNumber}`;
                    const piece = PIECES[square];
                    const isLight = (rowIndex + fileIndex) % 2 === 0;
                    return (
                      <div
                        key={square}
                        className={`a20h-square ${isLight ? "is-light" : "is-dark"}`}
                        data-square={square}
                      >
                        {piece ? (
                          <span
                            className={`a20h-piece ${
                              piece === piece.toUpperCase() ? "is-white" : "is-black"
                            }`}
                          >
                            {piece.toUpperCase()}
                          </span>
                        ) : null}
                      </div>
                    );
                  }),
                )}
                <svg className="a20h-board-trace" viewBox="0 0 800 800" aria-hidden="true">
                  <circle className="a20h-decision-ring" cx="450" cy="450" r="84" />
                  <path className="a20h-candidate-path" d="M450 650 C460 540 480 430 560 320" />
                  <path className="a20h-replay-path" d="M250 650 C340 545 450 430 560 320" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <aside className="a20h-side-panel a20h-right-panel">
          <p className="a20h-panel-label">State controls</p>
          <div className="a20h-state-controls" role="group" aria-label="DEV-only visual states">
            {stateOrder.map((nextState) => (
              <button
                key={nextState}
                type="button"
                className={nextState === stageState ? "is-active" : ""}
                data-testid={`a20h-state-${nextState}`}
                onClick={() => setStageState(nextState)}
              >
                {SCENE_PRESETS[nextState].shortLabel}
              </button>
            ))}
          </div>
          <label className="a20h-toggle">
            <input
              data-testid="a20h-reduced-motion-toggle"
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => setReducedMotion(event.target.checked)}
            />
            Reduced motion
          </label>
          <label className="a20h-toggle">
            <input
              data-testid="a20h-effects-toggle"
              type="checkbox"
              checked={!effectsEnabled}
              onChange={(event) => setEffectsEnabled(!event.target.checked)}
            />
            2D fallback
          </label>
        </aside>
      </section>

      <footer className="a20h-stage-footer">
        <span>Code-native renderer: React + CSS 3D + SVG traces</span>
        <span>No external assets</span>
        <span>No package install</span>
        <span data-testid="a20h-scene-language-json">
          {sceneLanguage.learning_state} / {sceneLanguage.camera_mode}
        </span>
      </footer>
    </main>
  );
}

function StageEffects({ state }: { state: StageState }) {
  return (
    <div className="a20h-stage-effects" data-testid="a20h-stage-effects" aria-hidden="true">
      <span className="a20h-artifact-fragment a20h-fragment-1" />
      <span className="a20h-artifact-fragment a20h-fragment-2" />
      <span className="a20h-artifact-fragment a20h-fragment-3" />
      <span className="a20h-focus-column" />
      <svg className="a20h-state-vector" viewBox="0 0 900 520">
        <path
          className="a20h-state-vector-primary"
          d={
            state === "feedback_miss"
              ? "M160 360 C270 250 410 355 530 230 C620 135 705 155 760 108"
              : "M150 355 C270 290 370 250 480 210 C590 170 690 130 760 105"
          }
        />
        <path className="a20h-state-vector-secondary" d="M170 410 C340 370 520 330 730 280" />
      </svg>
    </div>
  );
}
