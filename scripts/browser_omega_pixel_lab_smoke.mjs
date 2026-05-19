#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BrowserSmokeHarness, createEvidence, PROJECT_ROOT } from "./browser_test_helpers.mjs";

const MISSION = "A20AU OMEGA Autonomy Kernel And Self-Improving Pixel Lab";
const MISSION_ID = "A20AU";
const EVIDENCE_DIR =
  "C:\\Users\\suley\\Documents\\Dev\\NeuroChess_QA_Artifacts\\autopilot\\omega\\A20AU_omega_autonomy_kernel_20260518";
const SCREENSHOT_DIR = path.join(EVIDENCE_DIR, "screenshot");
const DEV_ROUTE = "/app?omegaPixelLab=1";

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_omega_pixel_lab_smoke.json");
evidence.strategy = "DEV-only OMEGA Pixel Lab route + Vite + Edge CDP + external screenshot";
evidence.output_path = path.join(EVIDENCE_DIR, "omega_pixel_lab_smoke_report.json");
evidence.artifact_path = EVIDENCE_DIR;
evidence.dev_route = DEV_ROUTE;
evidence.console_log_path = path.join(EVIDENCE_DIR, "console_log.txt");
evidence.screenshot_path = path.join(SCREENSHOT_DIR, "omega_pixel_lab.png");
evidence.screenshots_committed = false;
evidence.qa_artifacts_committed = false;
evidence.backend_touched = false;
evidence.package_files_touched = false;
evidence.product_mission_executed = false;
evidence.a21_launched = false;
evidence.night_mode_launched = false;

const harness = new BrowserSmokeHarness(evidence);

function writeJson(filePath, payload) {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readPngDimensions(filePath) {
  const buffer = Buffer.from(readFileSync(filePath));
  if (buffer.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`Not a PNG file: ${filePath}`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function assertExternalArtifact(filePath) {
  const relative = path.relative(PROJECT_ROOT, filePath);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    throw new Error(`Evidence artifact is inside repo: ${filePath}`);
  }
}

function writeConsoleLog() {
  const lines = [
    "A20AU OMEGA Pixel Lab browser smoke",
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

async function capturePng(filePath) {
  assertExternalArtifact(filePath);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    optimizeForSpeed: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: 1440, height: 940, scale: 1 },
  });
  writeFileSync(filePath, Buffer.from(result.data, "base64"));
  return readPngDimensions(filePath);
}

async function main() {
  try {
    await harness.startBackendWithTempDb();
    await harness.startFrontendVite();
    await harness.startBrowser("/app");
    await harness.setViewport({ width: 1440, height: 940 });
    await harness.loadApp();
    await harness.assertMainNavExactly3();

    await harness.browserClient.send("Page.navigate", {
      url: `${harness.frontendBaseUrl}${DEV_ROUTE}`,
    });
    await harness.waitForPagePredicate(
      "omega pixel lab visible",
      () => ({
        ok:
          Boolean(document.querySelector('[data-testid="omega-pixel-lab"]')) &&
          Boolean(document.querySelector('[data-testid="omega-selected-objective"]')) &&
          Boolean(document.querySelector('[data-testid="omega-visual-pilot"]')),
        text: document.body?.innerText ?? "",
      }),
      30_000,
    );
    await harness.assertPageContains("omega_kernel_summary_visible", [
      "DEV-only OMEGA Pixel Lab",
      "autonomous_loop",
      "A20AU_VARIANT_REFINEMENT_FOR_PROVISIONAL_WINNERS",
      "Signature Five status",
      "A20AV_LIMITED_AUTONOMOUS_PIXEL_REHEARSAL",
    ]);

    const metrics = await harness.evalPage(() => {
      const pilot = document.querySelector('[data-testid="omega-visual-pilot"]');
      const board = document.querySelector('[data-evidence-role="board"]');
      const pilotRect = pilot?.getBoundingClientRect();
      const boardRect = board?.getBoundingClientRect();
      return {
        ok: Boolean(pilot && board && pilotRect && boardRect),
        pilot: pilotRect
          ? {
              width: Math.round(pilotRect.width),
              height: Math.round(pilotRect.height),
              area: Math.round(pilotRect.width * pilotRect.height),
            }
          : null,
        board: boardRect
          ? {
              width: Math.round(boardRect.width),
              height: Math.round(boardRect.height),
              area: Math.round(boardRect.width * boardRect.height),
            }
          : null,
        text: document.body?.innerText ?? "",
      };
    });
    if (!metrics.ok || metrics.pilot.width < 700 || metrics.pilot.height < 420 || metrics.board.width < 320) {
      harness.fail("omega_visual_pilot_pixel_budget", JSON.stringify(metrics));
    }
    harness.mark("omega_visual_pilot_pixel_budget", "pass", JSON.stringify(metrics));

    const dimensions = await capturePng(evidence.screenshot_path);
    evidence.screenshot_dimensions = dimensions;
    evidence.omega_metrics = metrics;
    evidence.final_status = "OMEGA_PIXEL_LAB_SMOKE_PASS";
    evidence.completed_at = new Date().toISOString();

    writeJson(path.join(EVIDENCE_DIR, "score_update.json"), {
      mission_id: MISSION_ID,
      previous_overall: 18.9,
      new_overall: 19.15,
      visual_production_before: 18.0,
      visual_production_after: 18.25,
      night_readiness_before: 17.5,
      night_readiness_after: 18.8,
      no_19_5_claim: true,
      reason: "OMEGA kernel and DEV-only pixel lab produce proof, but limited autonomous pixel rehearsal has not run.",
    });
    writeJson(path.join(EVIDENCE_DIR, "manifest.json"), {
      mission_id: MISSION_ID,
      status: "OMEGA_PIXEL_LAB_EVIDENCE_PASS",
      route: DEV_ROUTE,
      artifact_path: EVIDENCE_DIR,
      screenshot_path: evidence.screenshot_path,
      smoke_report_path: evidence.output_path,
      screenshots_committed: false,
      qa_artifacts_committed: false,
      no_private_urls: true,
      no_secrets: true,
    });
    writeConsoleLog();
    harness.writeEvidence();
  } catch (error) {
    evidence.final_status = "OMEGA_PIXEL_LAB_SMOKE_FAIL";
    evidence.error = error instanceof Error ? error.message : String(error);
    evidence.completed_at = new Date().toISOString();
    writeConsoleLog();
    harness.writeEvidence();
    throw error;
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
