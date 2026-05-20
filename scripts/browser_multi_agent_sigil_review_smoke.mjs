#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  FORBIDDEN_V1_LABELS,
  createEvidence,
} from "./browser_test_helpers.mjs";

const MISSION = "A20BQ True Multi-Agent Pixel Run";
const ARTIFACT_ROOT =
  "C:\\Users\\suley\\Documents\\Dev\\NeuroChess_QA_Artifacts\\autopilot\\multi_agent_pixel_run\\A20BQ_true_multi_agent_sigil_run_20260518";
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, "screenshots");
const DEV_ROUTE = "/app?antigravitySpike=critical_moment_sigil";

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_multi_agent_sigil_review_smoke.json");
evidence.strategy = "DEV-only multi-agent sigil comparison route with external screenshot proof";
evidence.output_path = path.join(ARTIFACT_ROOT, "smoke_report.json");
evidence.dev_route = DEV_ROUTE;
evidence.artifact_path = ARTIFACT_ROOT;
evidence.screenshots_committed = false;
evidence.qa_artifacts_committed = false;
evidence.backend_touched = false;
evidence.package_files_touched = false;
evidence.v1_product_flow_changed = false;

const harness = new BrowserSmokeHarness(evidence);

function writeJson(filePath, payload) {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function captureExternalScreenshot(filePath) {
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  writeFileSync(filePath, Buffer.from(result.data, "base64"));
  return filePath;
}

async function main() {
  try {
    await harness.startBackendWithTempDb();
    await harness.startFrontendVite();
    await harness.startBrowser(DEV_ROUTE);
    await harness.setViewport({ width: 1440, height: 920 });

    await harness.waitForPagePredicate(
      "multi-agent sigil review stage",
      () => {
        const text = document.body?.innerText ?? "";
        return {
          ok:
            Boolean(document.querySelector('[data-testid="multi-agent-sigil-review"]')) &&
            Boolean(document.querySelector('[data-testid="original-premium-clarity"]')) &&
            Boolean(document.querySelector('[data-testid="codex-omega-refined-candidate"]')) &&
            Boolean(document.querySelector('[data-testid="multi-agent-final-recommendation"]')) &&
            text.includes("Premium Clarity v2") &&
            text.includes("Gemini visual review") &&
            text.includes("ChatGPT strategy review"),
          text,
        };
      },
      30_000,
    );

    const routeState = await harness.evalPage((forbiddenLabels) => {
      const text = document.body?.innerText ?? "";
      const normalized = text.toLowerCase();
      const forbiddenVisible = forbiddenLabels.filter((label) => text.includes(label));
      return {
        route_visible: Boolean(document.querySelector('[data-testid="antigravity-spike-host"]')),
        multi_agent_stage_visible: Boolean(
          document.querySelector('[data-testid="multi-agent-sigil-review"]'),
        ),
        original_visible: Boolean(document.querySelector('[data-testid="original-premium-clarity"]')),
        refined_visible: Boolean(
          document.querySelector('[data-testid="codex-omega-refined-candidate"]'),
        ),
        recommendation_visible: Boolean(
          document.querySelector('[data-testid="multi-agent-final-recommendation"]'),
        ),
        premium_clarity_v2_visible: text.includes("Premium Clarity v2"),
        board_visible: Boolean(document.querySelector(".board")),
        board_square_count: document.querySelectorAll(".board .square").length,
        svg_count: document.querySelectorAll(".sigil-spike svg").length,
        forbidden_visible: forbiddenVisible,
        fake_progress_visible: normalized.includes("xp") || normalized.includes("rank"),
        move_solution_visible:
          normalized.includes("best move") ||
          normalized.includes("correct move") ||
          normalized.includes("solution"),
      };
    }, FORBIDDEN_V1_LABELS);

    if (!routeState.multi_agent_stage_visible) {
      harness.fail("multi_agent_stage_visible", JSON.stringify(routeState));
    }
    if (!routeState.original_visible || !routeState.refined_visible) {
      harness.fail("comparison_cards_visible", JSON.stringify(routeState));
    }
    if (!routeState.recommendation_visible) {
      harness.fail("recommendation_visible", JSON.stringify(routeState));
    }
    if (routeState.board_square_count !== 64) {
      harness.fail("board_square_count", JSON.stringify(routeState));
    }
    if (routeState.forbidden_visible.length > 0) {
      harness.fail("forbidden_v1_labels", JSON.stringify(routeState.forbidden_visible));
    }
    if (routeState.fake_progress_visible) {
      harness.fail("fake_progress_visible", JSON.stringify(routeState));
    }
    if (routeState.move_solution_visible) {
      harness.fail("pre_feedback_solution_visible", JSON.stringify(routeState));
    }

    const screenshotPath = path.join(SCREENSHOT_DIR, "multi_agent_sigil_review_1440.png");
    await captureExternalScreenshot(screenshotPath);

    evidence.ui = {
      ...evidence.ui,
      ...routeState,
      screenshot_path: screenshotPath,
    };
    evidence.screenshot_path = screenshotPath;
    harness.mark("multi_agent_sigil_review_smoke", "pass", DEV_ROUTE);
    writeJson(path.join(ARTIFACT_ROOT, "manifest.json"), {
      mission: MISSION,
      route: DEV_ROUTE,
      status: "PASS",
      screenshot_path: screenshotPath,
      screenshots_committed: false,
      qa_artifacts_committed: false,
      v1_product_flow_changed: false,
    });
    harness.writeEvidence();
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  evidence.error = error instanceof Error ? error.message : String(error);
  harness.writeEvidence();
  console.error(error);
  process.exit(1);
});
