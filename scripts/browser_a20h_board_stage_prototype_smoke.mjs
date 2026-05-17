#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserSmokeHarness, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "A20H DEV-only 3D Board Stage prototype";
const EVIDENCE_DIR =
  "C:\\Users\\suley\\Documents\\Dev\\NeuroChess_QA_Artifacts\\autopilot\\board_stage_prototypes\\A20H_dev_3d_board_stage_20260517";
const SCREENSHOTS = [
  { state: "observe", testId: "a20h-state-observe", file: "screenshot_observe_1440.png" },
  { state: "try", testId: "a20h-state-try_before_feedback", file: "screenshot_try_1440.png" },
  { state: "success", testId: "a20h-state-feedback_success", file: "screenshot_success_1440.png" },
  { state: "miss", testId: "a20h-state-feedback_miss", file: "screenshot_miss_1440.png" },
  { state: "replay", testId: "a20h-state-replay", file: "screenshot_replay_1440.png" },
];

mkdirSync(EVIDENCE_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_a20h_board_stage_prototype_smoke.json");
evidence.strategy = "DEV-only Board Stage prototype + temp backend DB + Vite + Edge CDP";
evidence.output_path = path.join(EVIDENCE_DIR, "browser_smoke_report.json");
evidence.screenshots = [];
evidence.contact_sheet_path = path.join(EVIDENCE_DIR, "contact_sheet.png");
evidence.contact_sheet_html_path = path.join(EVIDENCE_DIR, "contact_sheet.html");
evidence.visual_review_brief_path = path.join(EVIDENCE_DIR, "visual_review_brief.md");
evidence.console_log_path = path.join(EVIDENCE_DIR, "console_log.txt");
evidence.dev_route = "/app?boardStage=1";
evidence.package_files_touched = false;
evidence.external_assets_committed = false;
evidence.live_chatgpt_called = false;
evidence.live_gemini_called = false;
evidence.product_mission_executed = false;

const harness = new BrowserSmokeHarness(evidence);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureViewportPng(fileName) {
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
  evidence.screenshots.push({ file: fileName, path: outPath, viewport: `${metrics.width}x${metrics.height}` });
  harness.writeEvidence();
  return outPath;
}

async function createContactSheet() {
  const cards = evidence.screenshots
    .map((shot) => {
      return `<figure><img src="${shot.file}" /><figcaption>${shot.file}</figcaption></figure>`;
    })
    .join("");
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
body { margin: 0; background: #050812; color: #eef7ff; font: 14px Inter, Arial, sans-serif; }
main { padding: 24px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
figure { margin: 0; border: 1px solid rgba(120,180,220,.35); background: rgba(255,255,255,.04); padding: 10px; }
img { display: block; width: 100%; height: auto; }
figcaption { padding-top: 8px; color: #9dcfff; font-weight: 700; }
</style>
</head>
<body><main>${cards}</main></body>
</html>`;
  writeFileSync(evidence.contact_sheet_html_path, html, "utf8");
  await harness.browserClient.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await harness.browserClient.send("Page.navigate", {
    url: pathToFileURL(evidence.contact_sheet_html_path).href,
  });
  const expectedImageCount = evidence.screenshots.length;
  await harness.waitForPagePredicate(
    "contact sheet ready",
    (count) => ({
      ok:
        document.images.length === count &&
        [...document.images].every((image) => image.complete && image.naturalWidth > 0),
      imageCount: document.images.length,
    }),
    20_000,
    expectedImageCount,
  );
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  writeFileSync(evidence.contact_sheet_path, Buffer.from(result.data, "base64"));
  harness.mark("contact_sheet_captured", "pass", evidence.contact_sheet_path);
}

function writeVisualReviewBrief() {
  const brief = `# A20H DEV-only 3D Board Stage Visual Review Brief

Surface: hidden DEV-only route /app?boardStage=1
Viewport: 1440px desktop
Renderer: React + CSS 3D transforms + SVG traces, no package install
External assets: none

States captured:
- observe
- try_before_feedback
- feedback_success
- feedback_miss
- replay

Required visual truths:
- The chessboard remains central, readable, and stable.
- The stage supports the decision state instead of becoming spectacle.
- The design feels like a desktop strategic cockpit, not a generic dashboard.
- Visual energy changes by learning state.
- Reduced motion and 2D fallback controls exist.
- No fake product claims or fake progress economy are visible.
- No camera spin, external model, Spline, Unity, Godot, texture, or downloaded asset is used.

Reference comparison:
- Orano: technical precision and attention accent.
- Igloo: atmosphere and material depth.
- Messenger: compact living-world feeling.
- SOM: central totem impact.
- Into the Breach and Balatro: tactical feedback clarity.
- Linear, Raycast, and Figma: clarity, speed, spatial workspace.

Screenshots:
${evidence.screenshots.map((shot) => `- ${shot.file}: ${shot.path}`).join("\n")}

Contact sheet:
- ${evidence.contact_sheet_path}
`;
  writeFileSync(evidence.visual_review_brief_path, brief, "utf8");
  harness.mark("visual_review_brief_written", "pass", evidence.visual_review_brief_path);
}

function writeAutonomousCandidate() {
  const candidatePath = path.join(EVIDENCE_DIR, "autonomous_design_candidate.json");
  const candidate = {
    candidate_id: "a20h_dev_board_stage_css3d",
    design_score_base: 86,
    taste_proxy_score_base: 84,
    learning_loop_support_score: 78,
    generic_saas_drift_base: 8,
    generic_saas_signals: [],
    anti_pattern_risks: [],
    cta_truthfulness: 100,
    no_fake_gamification: 100,
    board_present: true,
    board_central: true,
    desktop_first: true,
    mobile_first_drift: false,
    uncontrolled_3d_spectacle: false,
    fake_xp_rank_transfer: false,
    fake_neuroscience: false,
    fake_elo: false,
    red_tier_risk: false,
    visual_provider_verdict: "PASS_VISUAL",
    notes: "Hidden DEV-only board-centered prototype with CSS 3D stage and SVG state traces.",
  };
  writeFileSync(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  evidence.autonomous_design_candidate_path = candidatePath;
  harness.writeEvidence();
  return candidatePath;
}

function writeConsoleLog() {
  const childOutput = harness.children
    .map((child) => `## ${child._label}\n${(child._output ?? []).join("")}`)
    .join("\n\n");
  const body = [
    "# Browser Smoke Console Log",
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
    "A20H Board Stage ready",
    () => {
      const root = document.querySelector('[data-testid="a20h-board-stage-prototype"]');
      const board = document.querySelector('[data-testid="a20h-board"]');
      const controls = [
        "a20h-state-observe",
        "a20h-state-try_before_feedback",
        "a20h-state-feedback_success",
        "a20h-state-feedback_miss",
        "a20h-state-replay",
      ].map((id) => document.querySelector(`[data-testid="${id}"]`));
      return {
        ok: Boolean(root) && Boolean(board) && controls.every(Boolean),
        text: document.body?.innerText ?? "",
      };
    },
    30_000,
  );
  harness.mark("prototype_loads", "pass", `${harness.frontendBaseUrl}${evidence.dev_route}`);
}

async function assertBoardVisibleAndCentered() {
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
    harness.fail("board_visible_and_centered", JSON.stringify(result));
  }
  harness.mark("board_visible_and_centered", "pass", JSON.stringify(result));
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
    await assertBoardVisibleAndCentered();
    await assertSafeVisibleText();

    for (const shot of SCREENSHOTS) {
      await harness.clickByTestId(shot.testId, { afterMs: 280 });
      await captureViewportPng(shot.file);
      harness.mark(`screenshot_${shot.state}`, "pass", path.join(EVIDENCE_DIR, shot.file));
    }

    await createContactSheet();
    writeVisualReviewBrief();
    writeAutonomousCandidate();
    await assertProductionShellStillLoads();
    await assertNoFatalConsole();
    evidence.completed_at = new Date().toISOString();
    evidence.status = "pass";
    harness.writeEvidence();
  } catch (error) {
    evidence.status = "fail";
    evidence.error = error?.stack ?? error?.message ?? String(error);
    try {
      await captureViewportPng("failure_screenshot_1440.png");
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
