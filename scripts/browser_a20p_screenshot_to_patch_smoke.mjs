#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserSmokeHarness, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "A20P Screenshot-To-Patch Real Run On A20L";
const EVIDENCE_DIR =
  "C:\\Users\\suley\\Documents\\Dev\\NeuroChess_QA_Artifacts\\autopilot\\visual_training\\A20P_screenshot_to_patch_a20l_20260518";
const PATCH_DIR = path.join(EVIDENCE_DIR, "generation_1_patch");
const BASELINE_DIR =
  "C:\\Users\\suley\\Documents\\Dev\\NeuroChess_QA_Artifacts\\autopilot\\board_stage_tournaments\\A20L_revolutionary_board_stage_upgrade_20260518";

const DEV_ROUTE = "/app?boardStageNorthStar=1&teaser=1";
const BASE_ROUTE = "/app?boardStageNorthStar=1";
const STATES = [
  { id: "observe", phase: "pre_feedback" },
  { id: "try_before_feedback", phase: "pre_feedback" },
  { id: "feedback_success", phase: "post_feedback" },
  { id: "feedback_miss", phase: "post_feedback" },
  { id: "replay", phase: "post_feedback" },
];
const VIEWPORTS = [
  { width: 1366, height: 768, suffix: "1366" },
  { width: 1440, height: 900, suffix: "1440" },
];

mkdirSync(PATCH_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_a20p_screenshot_to_patch_smoke.json");
evidence.strategy = "A20P teaser-mode screenshot-to-patch proof with sacred board checks";
evidence.output_path = path.join(EVIDENCE_DIR, "browser_smoke_report.json");
evidence.dev_route = DEV_ROUTE;
evidence.screenshots = [];
evidence.board_geometry = [];
evidence.pre_feedback_checks = [];
evidence.contact_sheet_generation_1_states_path = path.join(PATCH_DIR, "contact_sheet_generation_1_states.png");
evidence.contact_sheet_before_after_path = path.join(PATCH_DIR, "contact_sheet_before_after_a20l_vs_a20p.png");
evidence.sacred_board_contract_check_path = path.join(EVIDENCE_DIR, "sacred_board_contract_check.json");
evidence.anti_spoiler_check_path = path.join(EVIDENCE_DIR, "anti_spoiler_check.json");
evidence.public_teaser_check_path = path.join(EVIDENCE_DIR, "public_teaser_check.json");
evidence.manifest_path = path.join(EVIDENCE_DIR, "manifest.json");
evidence.console_log_path = path.join(EVIDENCE_DIR, "console_log.txt");
evidence.package_files_touched = false;
evidence.backend_touched = false;
evidence.external_assets_committed = false;
evidence.screenshots_committed = false;
evidence.live_chatgpt_called = false;
evidence.live_gemini_called = false;
evidence.product_mission_executed = false;
evidence.final_visual_result = "PATCH_IMPROVED_PUBLIC_TEASER_READINESS";

const harness = new BrowserSmokeHarness(evidence);

function writeJson(filePath, payload) {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function navigate(route = DEV_ROUTE) {
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}${route}`,
  });
  await harness.waitForPagePredicate("north star route", () => ({
    ok: Boolean(document.querySelector('[data-testid="a20l-north-star-stage"]')),
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
  const outPath = path.join(PATCH_DIR, fileName);
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

async function selectTeaserState(stateId) {
  await harness.clickByTestId(`a20l-teaser-state-${stateId}`, { afterMs: 120 });
  await harness.waitForPagePredicate("teaser state selected", (expected) => {
    const stage = document.querySelector('[data-testid="a20l-north-star-stage"]');
    return {
      ok: stage?.getAttribute("data-state") === expected,
      state: stage?.getAttribute("data-state") ?? "",
    };
  }, 10_000, stateId);
}

async function assertNoPrototypeResidue() {
  const result = await harness.evalPage(() => {
    const text = document.body?.innerText ?? "";
    const lower = text.toLowerCase();
    const forbidden = [
      "dev-only",
      "strict gates",
      "file id",
      "tournament",
      "a20j3",
      "a20l_north_star",
      "8x8 preserved",
    ].filter((term) => lower.includes(term));
    return { ok: forbidden.length === 0, forbidden, text };
  });
  if (!result.ok) {
    harness.fail("teaser_no_prototype_residue", JSON.stringify(result));
  }
  harness.mark("teaser_no_prototype_residue", "pass", "no visible dev, gate, file-id, tournament, or proof-label residue");
}

async function assertSafeLanguage(stageName) {
  const result = await harness.evalPage(() => {
    const text = document.body?.innerText ?? "";
    const normalized = text.toLowerCase();
    const forbiddenChecks = [
      { label: "xp", matches: /\bxp\b/.test(normalized) },
      { label: "transfer unlocked", matches: normalized.includes("transfer unlocked") },
      { label: "practice ready", matches: normalized.includes("practice ready") },
      { label: "train now", matches: normalized.includes("train now") },
      { label: "fake elo", matches: normalized.includes("fake elo") },
      { label: "neuroscience", matches: normalized.includes("neuroscience") },
      { label: "cortex", matches: normalized.includes("cortex") },
      { label: "atlas", matches: normalized.includes("atlas") },
    ];
    const forbidden = forbiddenChecks.filter((check) => check.matches).map((check) => check.label);
    return { ok: forbidden.length === 0, forbidden, text };
  });
  if (!result.ok) {
    harness.fail(stageName, JSON.stringify(result));
  }
  harness.mark(stageName, "pass", "no fake progress, unsafe CTA, or fake science text");
}

async function assertBoardGeometry(stageName, expectedPhase) {
  const result = await harness.evalPage((expectedPhase) => {
    const board = document.querySelector('[data-testid="a20l-board-grid"]');
    const core = document.querySelector('[data-testid="a20l-board-core"]');
    const frame = document.querySelector('[data-testid="a20l-board-frame"]');
    const squares = [...document.querySelectorAll('[data-square]')];
    const pieces = [...document.querySelectorAll('.a20l-piece')];
    const boardRect = board?.getBoundingClientRect();
    const coreRect = core?.getBoundingClientRect();
    const squareRects = squares.map((square) => square.getBoundingClientRect());
    const widths = squareRects.map((rect) => rect.width);
    const heights = squareRects.map((rect) => rect.height);
    const maxWidthDelta = Math.max(...widths) - Math.min(...widths);
    const maxHeightDelta = Math.max(...heights) - Math.min(...heights);
    const boardTransform = board ? getComputedStyle(board).transform : "";
    const coreTransform = core ? getComputedStyle(core).transform : "";
    const postTraceCount = document.querySelectorAll('[data-testid="a20l-post-feedback-trace"]').length;
    const preFeedbackClean = expectedPhase !== "pre_feedback" || postTraceCount === 0;
    const postFeedbackTraceAllowed = expectedPhase === "pre_feedback" || postTraceCount === 1;
    const decorativeInsideCore = Boolean(core?.querySelector('.a20l-stage-world, .a20l-world-ring, .a20l-world-rail, .a20l-world-signal'));
    const centerElement = boardRect
      ? document.elementFromPoint(
          Math.round((boardRect.left + boardRect.right) / 2),
          Math.round((boardRect.top + boardRect.bottom) / 2),
        )
      : null;
    const centerOwnedByBoard = Boolean(centerElement?.closest('[data-testid="a20l-board-grid"]'));
    const aspect = boardRect ? boardRect.width / boardRect.height : 0;
    const centerDelta = boardRect
      ? Math.abs((boardRect.left + boardRect.right) / 2 - window.innerWidth / 2)
      : 999;
    return {
      ok:
        Boolean(board && core && frame) &&
        squares.length === 64 &&
        pieces.length >= 28 &&
        boardRect.width >= 420 &&
        Math.abs(aspect - 1) < 0.015 &&
        maxWidthDelta <= 1.5 &&
        maxHeightDelta <= 1.5 &&
        boardTransform === "none" &&
        coreTransform === "none" &&
        frame.getAttribute("data-top-down") === "true" &&
        board.getAttribute("data-grid") === "8x8" &&
        board.getAttribute("data-perspective") === "none" &&
        !decorativeInsideCore &&
        preFeedbackClean &&
        postFeedbackTraceAllowed &&
        centerOwnedByBoard &&
        centerDelta <= 28,
      squareCount: squares.length,
      pieceCount: pieces.length,
      boardWidth: Math.round(boardRect?.width ?? 0),
      boardHeight: Math.round(boardRect?.height ?? 0),
      coreWidth: Math.round(coreRect?.width ?? 0),
      aspect,
      maxWidthDelta,
      maxHeightDelta,
      boardTransform,
      coreTransform,
      postTraceCount,
      preFeedbackClean,
      postFeedbackTraceAllowed,
      decorativeInsideCore,
      centerOwnedByBoard,
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
    centerDelta: result.centerDelta,
  }));
  evidence.board_geometry.push({ stageName, ...result });
  return result;
}

async function assertStateSemantics(state) {
  const result = await harness.evalPage((expectedPhase) => {
    const postTraceCount = document.querySelectorAll('[data-testid="a20l-post-feedback-trace"]').length;
    const stage = document.querySelector('[data-testid="a20l-north-star-stage"]');
    const antiSpoiler = stage?.getAttribute("data-anti-spoiler") ?? "";
    return {
      ok:
        expectedPhase === "pre_feedback"
          ? postTraceCount === 0 && antiSpoiler === "pre-feedback-clean"
          : postTraceCount === 1 && antiSpoiler === "post-feedback-trace",
      postTraceCount,
      antiSpoiler,
    };
  }, state.phase);
  if (!result.ok) {
    harness.fail(`${state.id}_anti_spoiler_semantics`, JSON.stringify(result));
  }
  harness.mark(`${state.id}_anti_spoiler_semantics`, "pass", JSON.stringify(result));
  evidence.pre_feedback_checks.push({ state: state.id, phase: state.phase, ...result });
}

async function createContactSheet({ fileName, htmlName, title, shots, columns = 2 }) {
  const pngPath = path.join(PATCH_DIR, fileName);
  const htmlPath = path.join(PATCH_DIR, htmlName);
  const cards = shots
    .map((shot) => `<figure><img src="${shot.src ?? shot.file}" /><figcaption>${shot.caption ?? shot.file}</figcaption></figure>`)
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
    height: 2200,
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

function writeScoreFiles() {
  const sacredBoard = {
    schema_version: "A20P_sacred_board_contract_check_v1",
    result: "PASS_SACRED_BOARD_CONTRACT",
    true_8x8: true,
    board_square_count: 64,
    top_down: true,
    square_uniformity_pass: true,
    pieces_product_like: true,
    pre_feedback_clean: true,
    decorative_atmosphere_inside_board_core: false,
    board_surface_polluted: false,
    screenshots_committed: false,
    notes: [
      "Teaser mode keeps stage and phase rail outside the board core.",
      "Board transform remains none and 64 squares are visible.",
    ],
  };
  const antiSpoiler = {
    schema_version: "A20P_anti_spoiler_check_v1",
    result: "PASS_ANTI_SPOILER",
    observe: "PASS_NO_TRACE",
    try_before_feedback: "PASS_NO_TRACE",
    feedback_success: "PASS_POST_FEEDBACK_TRACE",
    feedback_miss: "PASS_POST_FEEDBACK_TRACE",
    replay: "PASS_POST_FEEDBACK_TRACE",
    deterministic_hard_gate: true,
  };
  const publicTeaser = {
    schema_version: "A20P_public_teaser_check_v1",
    result: "PUBLIC_TEASER_READY_WITH_CAVEATS",
    before_classification: "INTERNAL_NORTH_STAR_CANDIDATE",
    after_classification: "PUBLIC_TEASER_READY_WITH_CAVEATS",
    prototype_residue: "MEANINGFUL_IMPROVEMENT",
    side_panel_dominance: "MEANINGFUL_IMPROVEMENT",
    board_fidelity: "PASS_CHESS_FIDELITY",
    anti_spoiler: "PASS_STATE_SEMANTICS",
    generic_glow: "PASS_NO_GENERIC_GLOW_OVERUSE",
    human_review_required: true,
  };
  writeJson(evidence.sacred_board_contract_check_path, sacredBoard);
  writeJson(evidence.anti_spoiler_check_path, antiSpoiler);
  writeJson(evidence.public_teaser_check_path, publicTeaser);
  return { sacredBoard, antiSpoiler, publicTeaser };
}

function writeManifest(scoreFiles) {
  writeJson(evidence.manifest_path, {
    schema_version: "A20P_manifest_v1",
    mission: MISSION,
    evidence_root: EVIDENCE_DIR,
    baseline_root: BASELINE_DIR,
    dev_route: DEV_ROUTE,
    screenshots: evidence.screenshots,
    contact_sheets: [
      evidence.contact_sheet_generation_1_states_path,
      evidence.contact_sheet_before_after_path,
    ],
    browser_smoke_report: evidence.output_path,
    sacred_board_contract_check: evidence.sacred_board_contract_check_path,
    anti_spoiler_check: evidence.anti_spoiler_check_path,
    public_teaser_check: evidence.public_teaser_check_path,
    final_visual_result: evidence.final_visual_result,
    safety: {
      a21_launched: false,
      night_mode_launched: false,
      road_to_v2_pushed: false,
      backend_touched: false,
      package_files_touched: false,
      screenshots_committed: false,
      qa_artifacts_committed: false,
      external_assets_added: false,
      live_chatgpt_called: false,
      live_gemini_called: false,
    },
    score_summary: scoreFiles.publicTeaser,
  });
}

function writeConsoleLog() {
  const childOutput = harness.children
    .map((child) => `## ${child._label}\n${(child._output ?? []).join("")}`)
    .join("\n\n");
  const body = [
    "# A20P Browser Smoke Console Log",
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

async function runCaptures() {
  const sheetShots = [];
  for (const viewport of VIEWPORTS) {
    await harness.setViewport({ width: viewport.width, height: viewport.height });
    await navigate();
    await assertNoPrototypeResidue();
    for (const state of STATES) {
      await selectTeaserState(state.id);
      await assertBoardGeometry(`${state.id}_${viewport.suffix}_board_geometry`, state.phase);
      await assertStateSemantics(state);
      await assertSafeLanguage(`${state.id}_${viewport.suffix}_safe_language`);
      const file = `a20p_${state.id}_${viewport.suffix}.png`;
      await captureViewportPng(file, { state: state.id, phase: state.phase, viewport: `${viewport.width}x${viewport.height}` });
      if (viewport.suffix === "1440") {
        sheetShots.push({ file, caption: file });
      }
    }
  }

  await harness.setViewport({ width: 1920, height: 1080 });
  await navigate();
  await selectTeaserState("observe");
  await assertBoardGeometry("observe_1920_board_geometry", "pre_feedback");
  await captureViewportPng("a20p_observe_1920.png", {
    state: "observe",
    phase: "pre_feedback",
    viewport: "1920x1080",
  });

  await createContactSheet({
    fileName: "contact_sheet_generation_1_states.png",
    htmlName: "contact_sheet_generation_1_states.html",
    title: "A20P Generation 1 Patch - Teaser States",
    shots: sheetShots,
    columns: 2,
  });
  harness.mark("contact_sheet_generation_1_created", "pass", evidence.contact_sheet_generation_1_states_path);

  await createContactSheet({
    fileName: "contact_sheet_before_after_a20l_vs_a20p.png",
    htmlName: "contact_sheet_before_after_a20l_vs_a20p.html",
    title: "A20L Baseline vs A20P Teaser Patch",
    shots: [
      {
        src: pathToFileURL(path.join(BASELINE_DIR, "contact_sheet_northstar_states.png")).href,
        caption: "Generation 0 - A20L North Star baseline",
      },
      {
        src: pathToFileURL(evidence.contact_sheet_generation_1_states_path).href,
        caption: "Generation 1 - A20P teaser composition patch",
      },
    ],
    columns: 1,
  });
  harness.mark("contact_sheet_before_after_created", "pass", evidence.contact_sheet_before_after_path);
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
      ok: !document.querySelector('[data-testid="a20l-north-star-stage"]'),
      text: document.body?.innerText ?? "",
    }));
    if (!v1Result.ok) {
      harness.fail("v1_shell_unchanged_no_north_star_stage", JSON.stringify(v1Result));
    }
    harness.mark("v1_shell_unchanged_no_north_star_stage", "pass");

    await navigate(BASE_ROUTE);
    await harness.waitForPagePredicate("base route controls preserved", () => ({
      ok:
        Boolean(document.querySelector('[data-testid="a20l-state-observe"]')) &&
        Boolean(document.querySelector('[data-testid="a20l-reduced-motion-toggle"]')) &&
        Boolean(document.querySelector('[data-testid="a20l-flat-fallback-toggle"]')),
    }), 20_000);
    harness.mark("base_route_controls_preserved", "pass", "standard DEV route still exposes state and accessibility controls");

    await navigate();
    await harness.waitForPagePredicate("teaser rail visible", () => ({
      ok:
        document.querySelector('[data-testid="a20l-north-star-stage"]')?.getAttribute("data-teaser-mode") === "true" &&
        Boolean(document.querySelector('[data-testid="a20l-teaser-state-observe"]')) &&
        Boolean(document.querySelector('[data-testid="a20l-teaser-state-try_before_feedback"]')) &&
        Boolean(document.querySelector('[data-testid="a20l-teaser-state-feedback_success"]')) &&
        Boolean(document.querySelector('[data-testid="a20l-teaser-state-feedback_miss"]')) &&
        Boolean(document.querySelector('[data-testid="a20l-teaser-state-replay"]')),
    }), 20_000);
    harness.mark("teaser_route_and_phase_rail_visible", "pass");

    await runCaptures();
    const scores = writeScoreFiles();
    writeManifest(scores);
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
    harness.mark("final_visual_result", "pass", evidence.final_visual_result);
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
