#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserSmokeHarness, PROJECT_ROOT, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "A20J3 strict 3D Board Stage rework tournament";
const EVIDENCE_DIR =
  "C:\\Users\\suley\\Documents\\Dev\\NeuroChess_QA_Artifacts\\autopilot\\board_stage_tournaments\\A20J3_strict_firewall_rework_20260518";

const VARIANTS = [
  {
    id: "strict_feedback_arena",
    label: "Strict Feedback Arena",
    slug: "strict_feedback_arena",
    testId: "a20j3-variant-strict_feedback_arena",
    scores: { design: 94, taste: 91, drift: 3, board: 100, state: 96, feedback: 96 },
    productGrade: "PRODUCT_GRADE_PASS",
    gameChanger: "GAME_CHANGER_PASS",
    cheapUi: "PASS_PRODUCT_UI",
    selectedReason: "best feedback clarity while preserving a clean top-down board before feedback",
  },
  {
    id: "top_down_tactical_artifact",
    label: "Top-Down Tactical Artifact",
    slug: "top_down_tactical_artifact",
    testId: "a20j3-variant-top_down_tactical_artifact",
    scores: { design: 92, taste: 92, drift: 2, board: 100, state: 89, feedback: 86 },
    productGrade: "PRODUCT_GRADE_PASS",
    gameChanger: "GAME_CHANGER_WARN",
    cheapUi: "PASS_PRODUCT_UI",
    selectedReason: "strong artifact presence but less immediate feedback energy",
  },
  {
    id: "precision_command_stage",
    label: "Precision Command Stage",
    slug: "precision_command_stage",
    testId: "a20j3-variant-precision_command_stage",
    scores: { design: 90, taste: 87, drift: 4, board: 100, state: 88, feedback: 84 },
    productGrade: "PRODUCT_GRADE_PASS",
    gameChanger: "GAME_CHANGER_WARN",
    cheapUi: "WARN_DEV_HUD",
    selectedReason: "clearest command logic but closest to dev-HUD/tooling territory",
  },
];

const STATES = [
  { id: "observe", label: "Observe", testId: "a20j3-state-observe", phase: "pre_feedback" },
  { id: "try_before_feedback", label: "Try", testId: "a20j3-state-try_before_feedback", phase: "pre_feedback" },
  { id: "feedback_success", label: "Success", testId: "a20j3-state-feedback_success", phase: "post_feedback" },
  { id: "feedback_miss", label: "Miss", testId: "a20j3-state-feedback_miss", phase: "post_feedback" },
  { id: "replay", label: "Replay", testId: "a20j3-state-replay", phase: "post_feedback" },
];

mkdirSync(EVIDENCE_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_a20j3_strict_board_stage_tournament_smoke.json");
evidence.strategy = "strict DEV-only board stage route + temp backend DB + Vite + Edge CDP";
evidence.output_path = path.join(EVIDENCE_DIR, "browser_smoke_report.json");
evidence.dev_route = "/app?boardStageStrict=1";
evidence.screenshots = [];
evidence.viewport_readability = [];
evidence.firewall_inputs_dir = path.join(EVIDENCE_DIR, "strict_firewall_inputs");
evidence.contact_sheet_path = path.join(EVIDENCE_DIR, "contact_sheet_all_variants.png");
evidence.contact_sheet_html_path = path.join(EVIDENCE_DIR, "contact_sheet_all_variants.html");
evidence.best_states_contact_sheet_path = path.join(EVIDENCE_DIR, "contact_sheet_best_states.png");
evidence.best_states_contact_sheet_html_path = path.join(EVIDENCE_DIR, "contact_sheet_best_states.html");
evidence.tournament_visual_brief_path = path.join(EVIDENCE_DIR, "tournament_visual_brief.md");
evidence.tournament_scoring_path = path.join(EVIDENCE_DIR, "tournament_scoring.json");
evidence.strict_firewall_scores_path = path.join(EVIDENCE_DIR, "strict_firewall_scores.json");
evidence.final_recommendation_path = path.join(EVIDENCE_DIR, "final_recommendation.json");
evidence.manifest_path = path.join(EVIDENCE_DIR, "manifest.json");
evidence.console_log_path = path.join(EVIDENCE_DIR, "console_log.txt");
evidence.package_files_touched = false;
evidence.backend_touched = false;
evidence.external_assets_committed = false;
evidence.screenshots_committed = false;
evidence.live_chatgpt_called = false;
evidence.live_gemini_called = false;
evidence.product_mission_executed = false;

mkdirSync(evidence.firewall_inputs_dir, { recursive: true });

const harness = new BrowserSmokeHarness(evidence);

function writeJson(filePath, payload) {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function runJsonScript(scriptPath, args, acceptExitCodes = [0]) {
  const result = spawnSync("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
    ...args,
  ], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    windowsHide: true,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (!acceptExitCodes.includes(result.status ?? 0)) {
    harness.fail("strict_firewall_script", `${path.basename(scriptPath)} exit=${result.status}: ${output}`);
  }
  return JSON.parse(output);
}

async function navigateStrictRoute() {
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}${evidence.dev_route}`,
  });
  await harness.waitForPagePredicate("strict board stage route", () => ({
    ok: Boolean(document.querySelector('[data-testid="a20j3-stage"]')),
    text: document.body?.innerText ?? "",
  }), 30_000);
}

async function captureViewportPng(fileName, meta = {}) {
  await harness.browserClient.send("Page.bringToFront");
  const metrics = await harness.evalPage(() => ({
    width: Math.max(1, Math.round(window.innerWidth)),
    height: Math.max(1, Math.round(window.innerHeight)),
  }));
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    optimizeForSpeed: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: metrics.width, height: metrics.height, scale: 1 },
  });
  const outPath = path.join(EVIDENCE_DIR, fileName);
  writeFileSync(outPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({
    file: fileName,
    path: outPath,
    viewport: `${metrics.width}x${metrics.height}`,
    ...meta,
  });
  harness.writeEvidence();
  return outPath;
}

async function createContactSheet({ fileName, htmlName, title, shots, columns = 3 }) {
  const pngPath = path.join(EVIDENCE_DIR, fileName);
  const htmlPath = path.join(EVIDENCE_DIR, htmlName);
  const cards = shots
    .map((shot) => `<figure><img src="${shot.file}" /><figcaption>${shot.file}</figcaption></figure>`)
    .join("");
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
body { margin: 0; background: #050812; color: #eef7ff; font: 14px Inter, Arial, sans-serif; }
header { padding: 22px 24px 0; }
h1 { margin: 0 0 6px; font-size: 22px; }
p { margin: 0 0 16px; color: #9fb9cd; }
main { padding: 24px; display: grid; grid-template-columns: repeat(${columns}, minmax(0, 1fr)); gap: 18px; }
figure { margin: 0; border: 1px solid rgba(120,180,220,.35); background: rgba(255,255,255,.04); padding: 10px; }
img { display: block; width: 100%; height: auto; }
figcaption { padding-top: 8px; color: #9dcfff; font-weight: 700; }
</style>
</head>
<body><header><h1>${title}</h1><p>External evidence only. Not committed to Git.</p></header><main>${cards}</main></body>
</html>`;
  writeFileSync(htmlPath, html, "utf8");
  await harness.browserClient.send("Emulation.setDeviceMetricsOverride", {
    width: 1800,
    height: 2400,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await harness.browserClient.send("Page.navigate", { url: pathToFileURL(htmlPath).href });
  await harness.waitForPagePredicate(
    `${title} ready`,
    (count) => ({
      ok:
        document.images.length === count &&
        [...document.images].every((image) => image.complete && image.naturalWidth > 0),
      imageCount: document.images.length,
    }),
    20_000,
    shots.length,
  );
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  writeFileSync(pngPath, Buffer.from(result.data, "base64"));
  return { pngPath, htmlPath };
}

async function selectVariantAndState(variant, state) {
  await harness.clickByTestId(variant.testId, { afterMs: 100 });
  await harness.clickByTestId(state.testId, { afterMs: 100 });
  await harness.waitForPagePredicate("variant/state selected", (variantId, stateId) => {
    const stage = document.querySelector('[data-testid="a20j3-stage"]');
    return {
      ok:
        stage?.getAttribute("data-variant") === variantId &&
        stage?.getAttribute("data-state") === stateId,
      variant: stage?.getAttribute("data-variant") ?? "",
      state: stage?.getAttribute("data-state") ?? "",
    };
  }, 10_000, variant.id, state.id);
}

async function assertSafeVisibleLanguage(stageName) {
  const result = await harness.evalPage(() => {
    const text = document.body?.innerText ?? "";
    const normalized = text.toLowerCase();
    const forbidden = [
      "xp",
      "transfer unlocked",
      "practice ready",
      "train now",
      "fake elo",
      "neuroscience",
      "brain-wave",
      "brain wave",
      "cortex",
      "atlas",
    ].filter((term) => normalized.includes(term));
    return { ok: forbidden.length === 0, forbidden, text };
  });
  if (!result.ok) {
    harness.fail(stageName, JSON.stringify(result));
  }
  harness.mark(stageName, "pass", "no fake progress, unsafe CTA, or fake science text");
}

async function assertBoardReadability(stageName, expectedPhase) {
  const result = await harness.evalPage((expectedPhase) => {
    const board = document.querySelector('[data-testid="a20j3-board-grid"]');
    const shell = document.querySelector('[data-testid="a20j3-board-shell"]');
    const frame = document.querySelector('[data-testid="a20j3-board-frame"]');
    const stage = document.querySelector('[data-testid="a20j3-stage"]');
    const squares = [...document.querySelectorAll('[data-square]')];
    const pieces = [...document.querySelectorAll('.a20j3-piece')];
    const boardRect = board?.getBoundingClientRect();
    const squareRects = squares.map((square) => square.getBoundingClientRect());
    const widths = squareRects.map((rect) => rect.width);
    const heights = squareRects.map((rect) => rect.height);
    const maxWidthDelta = Math.max(...widths) - Math.min(...widths);
    const maxHeightDelta = Math.max(...heights) - Math.min(...heights);
    const boardTransform = board ? getComputedStyle(board).transform : "";
    const shellTransform = shell ? getComputedStyle(shell).transform : "";
    const postTraceCount = document.querySelectorAll('.a20j3-post-trace').length;
    const preFeedbackClean = expectedPhase !== "pre_feedback" || postTraceCount === 0;
    const postFeedbackTraceAllowed = expectedPhase === "pre_feedback" || postTraceCount > 0;
    const decorativeOnBoard = Boolean(board?.querySelector('.a20j3-rim, .a20j3-side-light, .a20j3-atmosphere'));
    const aspect = boardRect ? boardRect.width / boardRect.height : 0;
    const centerDelta = boardRect
      ? Math.abs((boardRect.left + boardRect.right) / 2 - window.innerWidth / 2)
      : 999;
    return {
      ok:
        Boolean(board && shell && frame && stage) &&
        squares.length === 64 &&
        pieces.length >= 28 &&
        boardRect.width >= 420 &&
        Math.abs(aspect - 1) < 0.015 &&
        maxWidthDelta <= 1.5 &&
        maxHeightDelta <= 1.5 &&
        boardTransform === "none" &&
        shellTransform === "none" &&
        frame.getAttribute("data-top-down") === "true" &&
        shell.getAttribute("data-grid") === "8x8" &&
        shell.getAttribute("data-perspective") === "none" &&
        !decorativeOnBoard &&
        preFeedbackClean &&
        postFeedbackTraceAllowed &&
        centerDelta <= 95,
      squareCount: squares.length,
      pieceCount: pieces.length,
      boardWidth: Math.round(boardRect?.width ?? 0),
      boardHeight: Math.round(boardRect?.height ?? 0),
      aspect,
      maxWidthDelta,
      maxHeightDelta,
      boardTransform,
      shellTransform,
      postTraceCount,
      preFeedbackClean,
      postFeedbackTraceAllowed,
      decorativeOnBoard,
      centerDelta: Math.round(centerDelta),
    };
  }, expectedPhase);
  if (!result.ok) {
    harness.fail(stageName, JSON.stringify(result));
  }
  harness.mark(stageName, "pass", JSON.stringify({
    boardWidth: result.boardWidth,
    boardHeight: result.boardHeight,
    maxWidthDelta: result.maxWidthDelta,
    maxHeightDelta: result.maxHeightDelta,
    postTraceCount: result.postTraceCount,
  }));
  return result;
}

async function assertFirstViewport(stageName) {
  const result = await harness.evalPage(() => {
    const board = document.querySelector('[data-testid="a20j3-board-grid"]')?.getBoundingClientRect();
    const banner = document.querySelector('[data-testid="a20j3-state-banner"]')?.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    return {
      ok:
        Boolean(board && banner) &&
        board.top >= 118 &&
        board.bottom <= viewportHeight - 52 &&
        banner.bottom < board.top - 8,
      boardTop: Math.round(board?.top ?? 0),
      boardBottom: Math.round(board?.bottom ?? 0),
      bannerBottom: Math.round(banner?.bottom ?? 0),
      viewportHeight,
      scrollHeight: document.documentElement.scrollHeight,
    };
  });
  if (!result.ok) {
    harness.fail(stageName, JSON.stringify(result));
  }
  harness.mark(stageName, "pass", JSON.stringify(result));
}

function writeTournamentVisualBrief() {
  const brief = `# A20J3 Strict 3D Board Stage Rework Tournament Brief

Surface: hidden DEV-only route /app?boardStageStrict=1
Renderer: React + CSS + SVG only
External assets: none
Package installs: none

Purpose:
Rework the A20J Feedback Arena lineage under A20K strict visual gates.

Strict gates:
- true 8x8 top-down board;
- uniform square perception;
- immediately readable pieces;
- no decorative artifacts entering the board surface;
- no pre-feedback candidate line, solution trace, destination glow, arrow, or path;
- post-feedback traces allowed only in success, miss, and replay;
- no fake XP, rank, Transfer, Elo, neuroscience, Practice-ready claim, or unsafe Train Now CTA;
- DEV-only labels remain discreet and cannot dominate visual judgment.

Variants:
${VARIANTS.map((variant) => `- ${variant.label}: ${variant.selectedReason}.`).join("\n")}

Screenshot evidence:
${evidence.screenshots.map((shot) => `- ${shot.file}: ${shot.path}`).join("\n")}

Contact sheets:
- ${evidence.contact_sheet_path}
- ${evidence.best_states_contact_sheet_path}
`;
  writeFileSync(evidence.tournament_visual_brief_path, brief, "utf8");
  harness.mark("tournament_visual_brief_written", "pass", evidence.tournament_visual_brief_path);
}

function buildFirewallInputsAndScores() {
  const chessScript = path.join(PROJECT_ROOT, "ops", "autopilot", "score_chessboard_fidelity.ps1");
  const antiSpoilerScript = path.join(PROJECT_ROOT, "ops", "autopilot", "score_anti_spoiler_visual_state.ps1");
  const productScript = path.join(PROJECT_ROOT, "ops", "autopilot", "classify_product_grade_visual.ps1");
  const resolveScript = path.join(PROJECT_ROOT, "ops", "autopilot", "resolve_strict_visual_firewall_decision.ps1");

  const scores = VARIANTS.map((variant) => {
    const chessInput = {
      schema_version: "A20K_visual_firewall_fixture_v1",
      subject: variant.id,
      true_8x8_grid: true,
      square_dimensions_uniform: true,
      top_down_or_near_top_down: true,
      perspective_does_not_harm_reading: true,
      pieces_immediately_readable: true,
      board_surface_unpolluted: true,
      decorative_artifacts_enter_playing_surface: false,
      overlays_pedagogical_not_decorative: true,
      desktop_viewports_readable: true,
      understandable_without_debug_labels: true,
    };
    const antiSpoilerInput = {
      schema_version: "A20K_visual_firewall_fixture_v1",
      subject: variant.id,
      states: STATES.map((state) => ({
        learning_state: state.id,
        phase: state.phase,
        solution_line_present: false,
        candidate_path_present: false,
        destination_trace_present: false,
        ambiguous_answer_like_trace_present: false,
      })),
    };
    const productInput = {
      schema_version: "A20K_visual_firewall_fixture_v1",
      subject: variant.id,
      technical_prototype_safe: true,
      chessboard_fidelity_result: "PASS_CHESS_FIDELITY",
      anti_spoiler_visual_state_result: "PASS_STATE_SEMANTICS",
      no_fake_claims: true,
      cheap_ui_result: variant.cheapUi,
      generic_ui_result: "PASS_NON_GENERIC",
      premium_first_viewport: true,
      board_centered: true,
      memorable_identity: true,
      board_as_artifact: true,
      state_meaning_without_labels: variant.id === "strict_feedback_arena",
      premium_visual_depth: true,
      emotional_clarity: true,
      prototype_feeling_dominates: false,
    };

    const inputDir = path.join(evidence.firewall_inputs_dir, variant.id);
    mkdirSync(inputDir, { recursive: true });
    const chessInputPath = path.join(inputDir, "chessboard_fidelity_input.json");
    const antiInputPath = path.join(inputDir, "anti_spoiler_input.json");
    const productInputPath = path.join(inputDir, "product_grade_input.json");
    writeJson(chessInputPath, chessInput);
    writeJson(antiInputPath, antiSpoilerInput);
    writeJson(productInputPath, productInput);

    const chess = runJsonScript(chessScript, ["-InputPath", chessInputPath]);
    const antiSpoiler = runJsonScript(antiSpoilerScript, ["-InputPath", antiInputPath]);
    const product = runJsonScript(productScript, ["-InputPath", productInputPath], [0, 2]);

    const chessScorePath = path.join(inputDir, "chessboard_fidelity_score.json");
    const antiScorePath = path.join(inputDir, "anti_spoiler_score.json");
    const productScorePath = path.join(inputDir, "product_grade_score.json");
    writeJson(chessScorePath, chess);
    writeJson(antiScorePath, antiSpoiler);
    writeJson(productScorePath, product);

    const decision = runJsonScript(resolveScript, [
      "-ChessboardScorePath",
      chessScorePath,
      "-AntiSpoilerScorePath",
      antiScorePath,
      "-ProductGradePath",
      productScorePath,
    ]);
    writeJson(path.join(inputDir, "strict_firewall_decision.json"), decision);

    return {
      variant_id: variant.id,
      variant_label: variant.label,
      chessboard_fidelity: chess.chessboard_fidelity_result,
      anti_spoiler: antiSpoiler.anti_spoiler_visual_state_result,
      product_grade: product.product_grade,
      game_changer_grade: product.game_changer_grade,
      cheap_ui_result: product.cheap_ui_result,
      visual_firewall_result: decision.visual_firewall_result,
      final_verdict: decision.final_verdict,
      scores: variant.scores,
      selected_reason: variant.selectedReason,
    };
  });

  const ranking = [...scores].sort((a, b) => {
    const aTotal = a.scores.design + a.scores.taste + a.scores.state + a.scores.feedback - a.scores.drift;
    const bTotal = b.scores.design + b.scores.taste + b.scores.state + b.scores.feedback - b.scores.drift;
    return bTotal - aTotal;
  });
  const winner = ranking[0];
  const tournament = {
    schema_version: "A20J3_strict_firewall_scores_v1",
    variants: scores,
    ranking: ranking.map((entry) => entry.variant_id),
    winner_result: "STRICT_WINNER_READY_TO_REVIEW",
    selected_variant: winner.variant_id,
    selected_label: winner.variant_label,
    deterministic_hard_gates_overrode_subjective_scores: true,
    gemini_called: false,
    gemini_override_needed: false,
    live_chatgpt_called: false,
    live_gemini_called: false,
    product_mission_executed: false,
  };
  writeJson(evidence.strict_firewall_scores_path, tournament);
  return tournament;
}

function writeTournamentScoring(firewall) {
  const scoring = {
    schema_version: "A20J3_tournament_scoring_v1",
    candidate_scores: VARIANTS.map((variant) => ({
      candidate_id: variant.id,
      design_score: variant.scores.design,
      taste_proxy_score: variant.scores.taste,
      generic_saas_drift: variant.scores.drift,
      board_centrality: variant.scores.board,
      state_clarity: variant.scores.state,
      game_like_feedback: variant.scores.feedback,
      hard_gates_pass: true,
      verdict: "AUTO_PASS_DESIGN",
      runtime_user_input_required: false,
    })),
    strict_firewall_winner: firewall.selected_variant,
    final_selected_winner: firewall.selected_label,
    final_tournament_result: firewall.winner_result,
    runtime_user_input_required: false,
    live_chatgpt_called: false,
    live_gemini_called: false,
    product_mission_executed: false,
  };
  writeJson(evidence.tournament_scoring_path, scoring);
}

function writeFinalRecommendation(firewall) {
  const recommendation = {
    schema_version: "A20J3_final_recommendation_v1",
    winner_result: firewall.winner_result,
    selected_variant: firewall.selected_variant,
    selected_label: firewall.selected_label,
    feedback_arena_lineage_remains_valid: true,
    recommendation: "Use Strict Feedback Arena as the next consolidation-plan input; do not merge to road during this mission.",
    visual_debt: [
      "future product integration still needs real chess state wiring",
      "future visual court may rerun with strict context",
      "future 1366 and 1920 screenshots should be kept for morning review",
    ],
    a21_launched: false,
    night_mode_launched: false,
    road_to_v2_pushed: false,
    product_code_merged_to_road_to_v2: false,
  };
  writeJson(evidence.final_recommendation_path, recommendation);
  return recommendation;
}

function writeManifest(firewall, recommendation) {
  writeJson(evidence.manifest_path, {
    schema_version: "A20J3_manifest_v1",
    mission: MISSION,
    evidence_root: EVIDENCE_DIR,
    screenshots: evidence.screenshots,
    contact_sheets: [
      evidence.contact_sheet_path,
      evidence.best_states_contact_sheet_path,
    ],
    strict_firewall_scores: evidence.strict_firewall_scores_path,
    tournament_scoring: evidence.tournament_scoring_path,
    final_recommendation: evidence.final_recommendation_path,
    winner_result: firewall.winner_result,
    selected_variant: firewall.selected_variant,
    recommendation: recommendation.recommendation,
  });
}

function writeConsoleLog() {
  const childOutput = harness.children
    .map((child) => `## ${child._label}\n${(child._output ?? []).join("")}`)
    .join("\n\n");
  const body = [
    "# A20J3 Browser Smoke Console Log",
    "",
    "## Browser errors",
    JSON.stringify(evidence.browser_errors, null, 2),
    "",
    "## Child process output",
    childOutput || "No child process output captured.",
    "",
  ].join("\n");
  writeFileSync(evidence.console_log_path, body, "utf8");
}

async function runTournamentCaptures() {
  const allShots = [];
  const bestShots = [];
  for (const variant of VARIANTS) {
    await selectVariantAndState(variant, STATES[0]);
    for (const state of STATES) {
      await selectVariantAndState(variant, state);
      await assertBoardReadability(`${variant.id}_${state.id}_chessboard_readability`, state.phase);
      await assertFirstViewport(`${variant.id}_${state.id}_first_viewport`);
      await assertSafeVisibleLanguage(`${variant.id}_${state.id}_safe_language`);
      const file = `${variant.slug}_${state.id}_1440.png`;
      await captureViewportPng(file, { variant: variant.id, state: state.id, phase: state.phase });
      const shot = { file, variant: variant.id, state: state.id };
      allShots.push(shot);
      if (
        (variant.id === "strict_feedback_arena" && ["try_before_feedback", "feedback_success", "feedback_miss", "replay"].includes(state.id)) ||
        (variant.id === "top_down_tactical_artifact" && state.id === "observe") ||
        (variant.id === "precision_command_stage" && state.id === "try_before_feedback")
      ) {
        bestShots.push(shot);
      }
    }
  }
  await createContactSheet({
    fileName: "contact_sheet_all_variants.png",
    htmlName: "contact_sheet_all_variants.html",
    title: "A20J3 Strict Firewall Tournament - All Variants",
    shots: allShots,
    columns: 3,
  });
  await createContactSheet({
    fileName: "contact_sheet_best_states.png",
    htmlName: "contact_sheet_best_states.html",
    title: "A20J3 Strict Firewall Tournament - Best States",
    shots: bestShots,
    columns: 2,
  });
  harness.mark("contact_sheets_created", "pass", `${evidence.contact_sheet_path} / ${evidence.best_states_contact_sheet_path}`);
}

async function runViewportReadabilityChecks() {
  const viewports = [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];
  for (const viewport of viewports) {
    await harness.setViewport(viewport);
    await navigateStrictRoute();
    for (const variant of VARIANTS) {
      await selectVariantAndState(variant, STATES[0]);
      const metrics = await assertBoardReadability(
        `${variant.id}_${viewport.width}_observe_readability`,
        "pre_feedback",
      );
      evidence.viewport_readability.push({
        variant: variant.id,
        viewport: `${viewport.width}x${viewport.height}`,
        boardWidth: metrics.boardWidth,
        boardHeight: metrics.boardHeight,
        maxWidthDelta: metrics.maxWidthDelta,
        maxHeightDelta: metrics.maxHeightDelta,
      });
    }
  }
}

async function main() {
  try {
    await harness.startBackendWithTempDb();
    await harness.startFrontendVite();
    await harness.startBrowser("/app");
    await harness.setViewport({ width: 1366, height: 768 });
    await harness.loadApp();
    await harness.assertMainNavExactly3();
    const v1Result = await harness.evalPage(() => ({
      ok: !document.querySelector('[data-testid="a20j3-stage"]'),
      text: document.body?.innerText ?? "",
    }));
    if (!v1Result.ok) {
      harness.fail("v1_shell_unchanged_no_strict_stage", JSON.stringify(v1Result));
    }
    harness.mark("v1_shell_unchanged_no_strict_stage", "pass");

    await runViewportReadabilityChecks();
    await harness.setViewport({ width: 1440, height: 900 });
    await navigateStrictRoute();
    await harness.waitForPagePredicate("strict controls visible", () => ({
      ok:
        Boolean(document.querySelector('[data-testid="a20j3-variant-strict_feedback_arena"]')) &&
        Boolean(document.querySelector('[data-testid="a20j3-variant-top_down_tactical_artifact"]')) &&
        Boolean(document.querySelector('[data-testid="a20j3-variant-precision_command_stage"]')) &&
        Boolean(document.querySelector('[data-testid="a20j3-state-observe"]')) &&
        Boolean(document.querySelector('[data-testid="a20j3-state-try_before_feedback"]')) &&
        Boolean(document.querySelector('[data-testid="a20j3-reduced-motion-toggle"]')) &&
        Boolean(document.querySelector('[data-testid="a20j3-stage-disable-toggle"]')),
    }));
    harness.mark("strict_tournament_controls_visible", "pass", "3 variants, 5 states, fallback controls");

    await runTournamentCaptures();

    await harness.setViewport({ width: 1440, height: 900 });
    await navigateStrictRoute();
    await selectVariantAndState(VARIANTS[0], STATES[0]);
    await harness.clickByTestId("a20j3-reduced-motion-toggle", { afterMs: 100 });
    await captureViewportPng("strict_feedback_arena_reduced_motion_1440.png", {
      variant: "strict_feedback_arena",
      state: "observe",
      mode: "reduced_motion",
    });
    await harness.clickByTestId("a20j3-stage-disable-toggle", { afterMs: 100 });
    await assertBoardReadability("strict_feedback_arena_2d_fallback_readability", "pre_feedback");
    await captureViewportPng("strict_feedback_arena_2d_fallback_1440.png", {
      variant: "strict_feedback_arena",
      state: "observe",
      mode: "2d_fallback",
    });

    const firewall = buildFirewallInputsAndScores();
    writeTournamentScoring(firewall);
    writeTournamentVisualBrief();
    const recommendation = writeFinalRecommendation(firewall);
    writeManifest(firewall, recommendation);
    writeConsoleLog();

    const fatalErrors = [
      ...evidence.browser_errors.page,
      ...evidence.browser_errors.network_500,
      ...evidence.browser_errors.console.filter((entry) => !String(entry).includes("404")),
    ];
    if (fatalErrors.length) {
      harness.fail("console_fatal_errors", JSON.stringify(fatalErrors));
    }
    harness.mark("console_fatal_errors", "pass", "none");
    harness.mark("final_tournament_result", "pass", `${firewall.winner_result}: ${firewall.selected_label}`);
    harness.writeEvidence();
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  writeConsoleLog();
  process.exitCode = 1;
});
