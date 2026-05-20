#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BrowserSmokeHarness, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "A20BG Web Visual Recovery Rule ChatGPT Gemini Live Run";
const EVIDENCE_DIR =
  "C:\\Users\\suley\\Documents\\Dev\\NeuroChess_QA_Artifacts\\autopilot\\web_visual_recovery\\A20BG";
const SCREENSHOT_DIR = path.join(EVIDENCE_DIR, "screenshots", "frontend");
const DEV_ROUTE = "/app?webVisualRecoveryRun=1";

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_web_visual_recovery_run_smoke.json");
evidence.strategy = "DEV-only web visual recovery route with two visible pixel deltas";
evidence.output_path = path.join(EVIDENCE_DIR, "browser_web_visual_recovery_run_smoke_report.json");
evidence.artifact_path = EVIDENCE_DIR;
evidence.dev_route = DEV_ROUTE;
evidence.console_log_path = path.join(EVIDENCE_DIR, "console_log.txt");
evidence.screenshots_committed = false;
evidence.qa_artifacts_committed = false;
evidence.backend_touched = false;
evidence.package_files_touched = false;
evidence.a21_launched = false;
evidence.public_release_made = false;
evidence.paid_api_used = false;

const harness = new BrowserSmokeHarness(evidence);

function writeJson(filePath, payload) {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeConsoleLog() {
  const lines = [
    "A20BG web visual recovery browser smoke",
    "",
    "Console:",
    ...evidence.browser_errors.console.map((entry) => JSON.stringify(entry)),
    "",
    "Page:",
    ...evidence.browser_errors.page.map((entry) => JSON.stringify(entry)),
    "",
    "Network 500:",
    ...evidence.browser_errors.network_500.map((entry) => JSON.stringify(entry)),
  ];
  writeFileSync(evidence.console_log_path, `${lines.join("\n")}\n`, "utf8");
}

async function captureViewport(filePath) {
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    optimizeForSpeed: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: 1440, height: 960, scale: 1 },
  });
  writeFileSync(filePath, Buffer.from(result.data, "base64"));
}

async function navigateAndWait(route, label, testId) {
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}${route}`,
  });
  await harness.waitForPagePredicate(
    label,
    (selector) => ({
      ok: Boolean(document.querySelector(selector)),
      text: document.body?.innerText ?? "",
    }),
    30_000,
    `[data-testid="${testId}"]`,
  );
}

async function main() {
  try {
    await harness.startBackendWithTempDb();
    await harness.startFrontendVite();
    await harness.startBrowser("/app");
    await harness.setViewport({ width: 1440, height: 960 });
    await navigateAndWait(DEV_ROUTE, "web visual recovery route visible", "web-visual-recovery-run");

    await harness.assertPageContains("web_visual_recovery_copy", [
      "DEV-only live web visual recovery run",
      "ChatGPT",
      "Gemini",
      "Window 9222",
      "Window 9223",
      "WEB_VISUAL_RECOVERY_RULE_VISUAL_RAIL",
      "CHATGPT_GEMINI_PACKET_COMPARISON_SURFACE",
    ]);

    const metrics = await harness.evalPage(() => {
      const deltas = Array.from(document.querySelectorAll('[data-testid="pixel-delta-card"]'));
      const usefulDeltas = deltas.filter((node) => node.getAttribute("data-useful-delta") === "true");
      const recoveryEvents = Array.from(document.querySelectorAll('[data-testid="recovery-event"]'));
      return {
        deltaCount: deltas.length,
        usefulDeltaCount: usefulDeltas.length,
        recoveryEventCount: recoveryEvents.length,
        chatgptVisible: Boolean(document.querySelector('[data-testid="chatgpt-attempt-log"]')),
        geminiPacketVisible: Boolean(document.querySelector('[data-testid="gemini-visual-packet"]')),
        missionDoctorVisible: Boolean(document.querySelector('[data-testid="mission-doctor-summary"]')),
        omegaVisible: Boolean(document.querySelector('[data-testid="omega-outcome"]')),
        bodyText: document.body?.innerText ?? "",
      };
    });

    if (
      metrics.usefulDeltaCount < 2 ||
      metrics.recoveryEventCount < 2 ||
      !metrics.chatgptVisible ||
      !metrics.geminiPacketVisible ||
      !metrics.missionDoctorVisible ||
      !metrics.omegaVisible
    ) {
      harness.fail("web_visual_recovery_route_contract", JSON.stringify(metrics));
    }
    harness.mark("web_visual_recovery_route_contract", "pass", JSON.stringify(metrics));

    await captureViewport(path.join(SCREENSHOT_DIR, "web_visual_recovery_summary.png"));

    for (const delta of ["delta1", "delta2"]) {
      await navigateAndWait(`/app?webVisualRecoveryRun=${delta}`, `${delta} visible`, "web-visual-recovery-run-delta");
      await captureViewport(path.join(SCREENSHOT_DIR, `web_visual_recovery_${delta}.png`));
    }

    const errorCount =
      evidence.browser_errors.console.length +
      evidence.browser_errors.page.length +
      evidence.browser_errors.network_500.length;
    if (errorCount > 0) {
      harness.fail("web_visual_recovery_no_browser_errors", JSON.stringify(evidence.browser_errors));
    }
    harness.mark("web_visual_recovery_no_browser_errors", "pass", "0 browser errors");
    evidence.final_status = "WEB_VISUAL_RECOVERY_SMOKE_PASS";
    evidence.completed_at = new Date().toISOString();
    writeConsoleLog();
    writeJson(evidence.output_path, evidence);
  } catch (error) {
    evidence.final_status = "WEB_VISUAL_RECOVERY_SMOKE_FAIL";
    evidence.error = error instanceof Error ? error.message : String(error);
    evidence.completed_at = new Date().toISOString();
    writeConsoleLog();
    writeJson(evidence.output_path, evidence);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await harness.cleanupProcesses();
  }
}

await main();
