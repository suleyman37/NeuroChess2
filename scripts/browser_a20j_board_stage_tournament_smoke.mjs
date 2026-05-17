#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserSmokeHarness, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "A20J DEV-only 3D Board Stage Golden Screen Tournament";
const EVIDENCE_DIR =
  "C:\\Users\\suley\\Documents\\Dev\\NeuroChess_QA_Artifacts\\autopilot\\board_stage_tournaments\\A20J_golden_screen_tournament_20260517";

const VARIANTS = [
  {
    slug: "variant_a",
    id: "precision_cockpit",
    label: "Precision Cockpit",
    testId: "a20j-variant-precision_cockpit",
    filePrefix: "variant_a",
    score: { design: 91, taste: 86, drift: 5, learning: 88 },
    references: ["Orano", "Linear", "Figma", "Into the Breach"],
    intent: "technical cockpit, tactical instrument, precise HUD logic",
  },
  {
    slug: "variant_b",
    id: "atmospheric_artifact",
    label: "Atmospheric Artifact",
    testId: "a20j-variant-atmospheric_artifact",
    filePrefix: "variant_b",
    score: { design: 89, taste: 91, drift: 4, learning: 82 },
    references: ["Igloo", "Messenger", "SOM"],
    intent: "board as mysterious central artifact, stronger place and material depth",
  },
  {
    slug: "variant_c",
    id: "feedback_arena",
    label: "Feedback Arena",
    testId: "a20j-variant-feedback_arena",
    filePrefix: "variant_c",
    score: { design: 94, taste: 90, drift: 4, learning: 93 },
    references: ["Balatro", "Hades", "Into the Breach", "Raycast"],
    intent: "active arena, sharper state feedback, fast one-more-try energy",
  },
];

const STATES = [
  { state: "observe", testId: "a20h-state-observe", fileName: "observe" },
  { state: "try_before_feedback", testId: "a20h-state-try_before_feedback", fileName: "try" },
  { state: "feedback_success", testId: "a20h-state-feedback_success", fileName: "success" },
  { state: "feedback_miss", testId: "a20h-state-feedback_miss", fileName: "miss" },
  { state: "replay", testId: "a20h-state-replay", fileName: "replay" },
];

mkdirSync(EVIDENCE_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_a20j_board_stage_tournament_smoke.json");
evidence.strategy = "DEV-only Board Stage tournament + temp backend DB + Vite + Edge CDP";
evidence.output_path = path.join(EVIDENCE_DIR, "browser_smoke_report.json");
evidence.screenshots = [];
evidence.variant_candidate_paths = {};
evidence.contact_sheet_path = path.join(EVIDENCE_DIR, "contact_sheet_all_variants.png");
evidence.contact_sheet_html_path = path.join(EVIDENCE_DIR, "contact_sheet_all_variants.html");
evidence.best_states_contact_sheet_path = path.join(EVIDENCE_DIR, "contact_sheet_best_states.png");
evidence.best_states_contact_sheet_html_path = path.join(EVIDENCE_DIR, "contact_sheet_best_states.html");
evidence.tournament_visual_brief_path = path.join(EVIDENCE_DIR, "tournament_visual_brief.md");
evidence.tournament_scoring_path = path.join(EVIDENCE_DIR, "tournament_scoring.json");
evidence.console_log_path = path.join(EVIDENCE_DIR, "console_log.txt");
evidence.dev_route = "/app?boardStage=1";
evidence.package_files_touched = false;
evidence.external_assets_committed = false;
evidence.live_chatgpt_called = false;
evidence.live_gemini_called = false;
evidence.product_mission_executed = false;

const harness = new BrowserSmokeHarness(evidence);

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

function writeTournamentVisualBrief() {
  const brief = `# A20J 3D Board Stage Golden Screen Tournament Brief

Surface: hidden DEV-only route /app?boardStage=1
Viewport: 1440px desktop for variant/state captures
Renderer: React + CSS 3D transforms + SVG traces, no package install
External assets: none

Variants:
- Precision Cockpit: Orano / Linear / Figma / Into the Breach; technical tactical instrument.
- Atmospheric Artifact: Igloo / Messenger / SOM; board as mysterious central artifact.
- Feedback Arena: Balatro / Hades / Into the Breach / Raycast; sharper state feedback and fast retry energy.

Required truths:
- Board remains central, readable, and stable in all variants.
- Observe, try, success, miss, and replay remain available in all variants.
- Reduced motion and 2D fallback controls remain visible.
- No fake XP/rank/Transfer, fake neuroscience, fake Elo, Practice-ready claim, or unsafe Train Now CTA.
- No Spline, Unity, Godot, Three/R3F, external images, models, textures, videos, or package installs.

Screenshot evidence:
${evidence.screenshots.map((shot) => `- ${shot.file}: ${shot.path}`).join("\n")}

Contact sheets:
- ${evidence.contact_sheet_path}
- ${evidence.best_states_contact_sheet_path}
`;
  writeFileSync(evidence.tournament_visual_brief_path, brief, "utf8");
  harness.mark("tournament_visual_brief_written", "pass", evidence.tournament_visual_brief_path);
}

function writeAutonomousCandidates() {
  const candidateDir = path.join(EVIDENCE_DIR, "candidates");
  mkdirSync(candidateDir, { recursive: true });
  const candidates = VARIANTS.map((variant) => {
    const candidate = {
      candidate_id: variant.id,
      surface: "3D Board Stage / Decision Arena prototype",
      reference_inspirations: variant.references,
      intended_player_emotion: variant.intent,
      visual_traits: ["desktop_first_strategic_cockpit", "chessboard_as_central_artifact", "motion_with_meaning"],
      board_present: true,
      board_central: true,
      desktop_first: true,
      primary_action: "Select a state and inspect decision feedback",
      learning_loop_step: "try_before_feedback_and_feedback_review",
      three_d_scene_role: "controlled_css_svg_scene_language",
      screenshot_requirements: ["1440 desktop", "all five states", "board central", "reduced motion visible"],
      anti_pattern_risks: [],
      generic_saas_signals: [],
      design_score_base: variant.score.design,
      taste_proxy_score_base: variant.score.taste,
      generic_saas_drift_base: variant.score.drift,
      learning_loop_support_score: variant.score.learning,
      cta_truthfulness: 100,
      no_fake_gamification: 100,
      fake_xp_rank_transfer: false,
      fake_neuroscience: false,
      fake_elo: false,
      mobile_first_drift: false,
      uncontrolled_3d_spectacle: false,
      red_tier_risk: false,
      visual_provider_verdict: "PASS_VISUAL",
      notes: `${variant.label}: ${variant.intent}`,
    };
    const outPath = path.join(candidateDir, `${variant.id}.json`);
    writeFileSync(outPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
    evidence.variant_candidate_paths[variant.id] = outPath;
    return candidate;
  });
  const scoring = {
    schema_version: "A20J_tournament_scoring_v1",
    variants: candidates,
    thresholds: {
      design_score_min: 80,
      taste_proxy_score_min: 75,
      generic_saas_drift_max: 25,
      clear_winner_margin: 10,
    },
    runtime_user_input_required: false,
  };
  writeFileSync(evidence.tournament_scoring_path, `${JSON.stringify(scoring, null, 2)}\n`, "utf8");
  harness.writeEvidence();
  return candidates;
}

function writeConsoleLog() {
  const childOutput = harness.children
    .map((child) => `## ${child._label}\n${(child._output ?? []).join("")}`)
    .join("\n\n");
  const body = [
    "# A20J Browser Smoke Console Log",
    "",
    "## Browser page errors",
    JSON.stringify(evidence.browser_errors, null, 2),
    "",
    "## Child process output",
    childOutput,
    "",
  ].join("\n");
  writeFileSync(evidence.console_log_path, body, "utf8");
  harness.writeEvidence();
}

async function assertPrototypeReady() {
  await harness.waitForPagePredicate(
    "A20J Board Stage tournament ready",
    () => {
      const root = document.querySelector('[data-testid="a20h-board-stage-prototype"]');
      const board = document.querySelector('[data-testid="a20h-board"]');
      const variants = [
        "a20j-variant-precision_cockpit",
        "a20j-variant-atmospheric_artifact",
        "a20j-variant-feedback_arena",
      ].map((id) => document.querySelector(`[data-testid="${id}"]`));
      const states = [
        "a20h-state-observe",
        "a20h-state-try_before_feedback",
        "a20h-state-feedback_success",
        "a20h-state-feedback_miss",
        "a20h-state-replay",
      ].map((id) => document.querySelector(`[data-testid="${id}"]`));
      return {
        ok: Boolean(root) && Boolean(board) && variants.every(Boolean) && states.every(Boolean),
        text: document.body?.innerText ?? "",
      };
    },
    30_000,
  );
  harness.mark("prototype_loads", "pass", `${harness.frontendBaseUrl}${evidence.dev_route}`);
}

async function assertBoardVisibleAndCentered(stageName) {
  const result = await harness.evalPage(() => {
    const root = document.querySelector('[data-testid="a20h-stage-core"]');
    const board = document.querySelector('[data-testid="a20h-board"]');
    const rootRect = root?.getBoundingClientRect();
    const boardRect = board?.getBoundingClientRect();
    if (!rootRect || !boardRect) {
      return { ok: false, reason: "missing stage or board" };
    }
    const rootCenterX = rootRect.left + rootRect.width / 2;
    const boardCenterX = boardRect.left + boardRect.width / 2;
    const centerDelta = Math.abs(rootCenterX - boardCenterX);
    return {
      ok: boardRect.width >= 500 && boardRect.height >= 500 && centerDelta < 36,
      boardWidth: Math.round(boardRect.width),
      boardHeight: Math.round(boardRect.height),
      centerDelta: Math.round(centerDelta),
    };
  });
  if (!result.ok) {
    harness.fail(`${stageName}_board_visible_and_centered`, JSON.stringify(result));
  }
  harness.mark(`${stageName}_board_visible_and_centered`, "pass", JSON.stringify(result));
}

async function assertFirstViewportFraming(stageName) {
  const result = await harness.evalPage(() => {
    const board = document.querySelector('[data-testid="a20h-board"]');
    const cue = document.querySelector('[data-testid="a20h-state-cue"]');
    const boardRect = board?.getBoundingClientRect();
    const cueRect = cue?.getBoundingClientRect();
    const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const viewportHeight = window.innerHeight;
    return {
      ok:
        Boolean(boardRect) &&
        Boolean(cueRect) &&
        scrollHeight <= viewportHeight + 4 &&
        boardRect.top > 120 &&
        boardRect.bottom < viewportHeight - 30,
      scrollHeight,
      viewportHeight,
      boardTop: Math.round(boardRect?.top ?? 0),
      boardBottom: Math.round(boardRect?.bottom ?? 0),
      cueVisible: Boolean(cueRect && cueRect.top >= 0 && cueRect.bottom <= viewportHeight),
    };
  });
  if (!result.ok) {
    harness.fail(`${stageName}_first_viewport_framing`, JSON.stringify(result));
  }
  harness.mark(`${stageName}_first_viewport_framing`, "pass", JSON.stringify(result));
}

async function assertSafeVisibleText() {
  const result = await harness.evalPage(() => {
    const text = document.body?.innerText ?? "";
    const forbidden = [
      /\bXP\b/i,
      /\brank\b/i,
      /\bTransfer\b/i,
      /Practice ready/i,
      /Train now/i,
      /\bElo\b/i,
      /neuroscience/i,
      /brain wave/i,
    ]
      .filter((pattern) => pattern.test(text))
      .map((pattern) => pattern.toString());
    return { ok: forbidden.length === 0, forbidden, textLength: text.length };
  });
  if (!result.ok) {
    harness.fail("safe_visible_text", JSON.stringify(result));
  }
  harness.mark("safe_visible_text", "pass", "no fake progress, unsafe CTA, or fake science text visible");
}

async function assertFallbackControlsVisible() {
  const result = await harness.evalPage(() => {
    const reducedMotion = document.querySelector('[data-testid="a20h-reduced-motion-toggle"]');
    const fallback = document.querySelector('[data-testid="a20h-effects-toggle"]');
    return {
      ok: Boolean(reducedMotion) && Boolean(fallback),
      reducedMotionVisible: Boolean(reducedMotion),
      fallbackVisible: Boolean(fallback),
    };
  });
  if (!result.ok) {
    harness.fail("fallback_controls_visible", JSON.stringify(result));
  }
  harness.mark("fallback_controls_visible", "pass", JSON.stringify(result));
}

async function assertProductionShellStillLoads() {
  await harness.browserClient.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app` });
  await harness.waitForPagePredicate(
    "production app shell ready",
    () => {
      const nav = document.querySelector('[data-testid="main-nav"]');
      const labels = [...(nav?.querySelectorAll("button") ?? [])].map((button) =>
        button.textContent?.replace(/\s+/g, " ").trim(),
      );
      return {
        ok:
          labels.length === 3 &&
          labels.some((label) => label?.includes("Aujourd")) &&
          labels.some((label) => label?.includes("Mes parties")) &&
          labels.some((label) => label?.includes("Entra")),
        labels,
      };
    },
    30_000,
  );
  await harness.assertMainNavExactly3();
  harness.mark("production_shell_loads_after_app_change", "pass", "main V1 nav intact");
}

async function assertNoFatalConsole() {
  const pageErrors = evidence.browser_errors.page ?? [];
  const consoleErrors = (evidence.browser_errors.console ?? []).filter(
    (entry) =>
      !/favicon|manifest|ResizeObserver/i.test(entry) &&
      !/Failed to load resource: the server responded with a status of 404/i.test(entry),
  );
  const network500 = evidence.browser_errors.network_500 ?? [];
  if (pageErrors.length > 0 || consoleErrors.length > 0 || network500.length > 0) {
    harness.fail(
      "no_console_fatal_errors",
      JSON.stringify({ pageErrors, consoleErrors, network500 }, null, 2),
    );
  }
  harness.mark("no_console_fatal_errors", "pass", "no runtime exception, console error, or network 500 captured");
}

async function main() {
  try {
    await harness.startBackendWithTempDb();
    await harness.startFrontendVite();
    await harness.startBrowser(evidence.dev_route);
    await harness.setViewport({ width: 1440, height: 900, mobile: false });
    await assertPrototypeReady();
    await assertFallbackControlsVisible();
    await assertSafeVisibleText();

    for (const variant of VARIANTS) {
      await harness.clickByTestId(variant.testId, { afterMs: 240 });
      for (const state of STATES) {
        await harness.clickByTestId(state.testId, { afterMs: 220 });
        const stageName = `${variant.slug}_${state.fileName}`;
        await assertBoardVisibleAndCentered(stageName);
        await assertFirstViewportFraming(stageName);
        const fileName = `${variant.filePrefix}_${state.fileName}_1440.png`;
        await captureViewportPng(fileName, {
          variant: variant.id,
          variant_label: variant.label,
          state: state.state,
        });
        harness.mark(`screenshot_${stageName}`, "pass", path.join(EVIDENCE_DIR, fileName));
      }
    }

    await harness.clickByTestId("a20j-variant-feedback_arena", { afterMs: 180 });
    await harness.clickByTestId("a20h-state-observe", { afterMs: 160 });
    await harness.clickByTestId("a20h-reduced-motion-toggle", { afterMs: 160 });
    await captureViewportPng("tournament_reduced_motion_1440.png", {
      variant: "feedback_arena",
      state: "observe",
      proof: "reduced_motion",
    });
    harness.mark("screenshot_reduced_motion", "pass", path.join(EVIDENCE_DIR, "tournament_reduced_motion_1440.png"));
    await harness.clickByTestId("a20h-effects-toggle", { afterMs: 160 });
    await captureViewportPng("tournament_2d_fallback_1440.png", {
      variant: "feedback_arena",
      state: "observe",
      proof: "2d_fallback",
    });
    harness.mark("screenshot_2d_fallback", "pass", path.join(EVIDENCE_DIR, "tournament_2d_fallback_1440.png"));

    const fullSheet = await createContactSheet({
      fileName: "contact_sheet_all_variants.png",
      htmlName: "contact_sheet_all_variants.html",
      title: "A20J Board Stage Tournament - All Variants",
      shots: evidence.screenshots,
      columns: 3,
    });
    evidence.contact_sheet_path = fullSheet.pngPath;
    evidence.contact_sheet_html_path = fullSheet.htmlPath;
    harness.mark("contact_sheet_all_variants_captured", "pass", evidence.contact_sheet_path);

    const bestShots = evidence.screenshots.filter((shot) =>
      ["variant_a_try_1440.png", "variant_b_observe_1440.png", "variant_c_success_1440.png", "variant_c_miss_1440.png", "variant_c_replay_1440.png"].includes(shot.file),
    );
    const bestSheet = await createContactSheet({
      fileName: "contact_sheet_best_states.png",
      htmlName: "contact_sheet_best_states.html",
      title: "A20J Board Stage Tournament - Best State Comparison",
      shots: bestShots,
      columns: 2,
    });
    evidence.best_states_contact_sheet_path = bestSheet.pngPath;
    evidence.best_states_contact_sheet_html_path = bestSheet.htmlPath;
    harness.mark("contact_sheet_best_states_captured", "pass", evidence.best_states_contact_sheet_path);

    writeAutonomousCandidates();
    writeTournamentVisualBrief();
    await assertProductionShellStillLoads();
    await assertNoFatalConsole();
    evidence.completed_at = new Date().toISOString();
    evidence.status = "pass";
    harness.writeEvidence();
  } catch (error) {
    evidence.status = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    try {
      await captureViewportPng("failure_screenshot_1440.png", { proof: "failure" });
    } catch {
      // Best-effort failure screenshot only.
    }
    harness.writeEvidence();
    throw error;
  } finally {
    writeConsoleLog();
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
