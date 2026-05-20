#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  FORBIDDEN_V1_LABELS,
  createEvidence,
} from "./browser_test_helpers.mjs";

const MISSION = "A20BM Antigravity Safe Import Surface";
const EVIDENCE_DIR =
  "C:\\Users\\suley\\Documents\\Dev\\NeuroChess_QA_Artifacts\\autopilot\\antigravity\\A20BM_revision_pack_20260518\\smoke_artifacts";
const SCREENSHOT_DIR = path.join(EVIDENCE_DIR, "screenshots");
const DEV_ROUTE = "/app?antigravitySpike=critical_moment_sigil";

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_antigravity_spike_host_smoke.json");
evidence.strategy = "DEV-only Antigravity spike host route with external screenshot proof";
evidence.output_path = path.join(EVIDENCE_DIR, "smoke_report.json");
evidence.dev_route = DEV_ROUTE;
evidence.artifact_path = EVIDENCE_DIR;
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
      "antigravity spike host route",
      () => {
        const host = document.querySelector('[data-testid="antigravity-spike-host"]');
        const text = document.body?.innerText ?? "";
        const normalizedText = text.toLowerCase();
        return {
          ok:
            Boolean(host) &&
            normalizedText.includes("critical_moment_sigil") &&
            normalizedText.includes("awaiting revised patch proposal pack"),
          text,
        };
      },
      30_000,
    );

    const routeState = await harness.evalPage((forbiddenLabels) => {
      const text = document.body?.innerText ?? "";
      const variantSlots = Array.from(
        document.querySelectorAll('[data-testid="antigravity-spike-variant-slot"]'),
      ).map((node) => node.textContent ?? "");
      const forbiddenVisible = forbiddenLabels.filter((label) => text.includes(label));
      return {
        route_visible: Boolean(document.querySelector('[data-testid="antigravity-spike-host"]')),
        registry_entry_visible: Boolean(
          document.querySelector('[data-testid="antigravity-spike-registry-entry"]'),
        ),
        placeholder_visible: Boolean(
          document.querySelector('[data-testid="antigravity-spike-placeholder"]'),
        ),
        spike_id: document.querySelector('[data-testid="antigravity-spike-id"]')?.textContent ?? "",
        variant_slot_count: variantSlots.length,
        variant_slots: variantSlots,
        allowed_surface_text:
          document.querySelector('[data-testid="antigravity-spike-allowed-surface"]')?.textContent ?? "",
        forbidden_visible: forbiddenVisible,
      };
    }, FORBIDDEN_V1_LABELS);

    if (!routeState.route_visible) {
      harness.fail("route_visible", JSON.stringify(routeState));
    }
    if (routeState.spike_id !== "critical_moment_sigil") {
      harness.fail("spike_id", JSON.stringify(routeState));
    }
    if (routeState.variant_slot_count !== 3) {
      harness.fail("variant_slots", JSON.stringify(routeState));
    }
    if (!routeState.allowed_surface_text.includes("frontend/src/dev/antigravity-spikes/**")) {
      harness.fail("allowed_surface", JSON.stringify(routeState));
    }
    if (routeState.forbidden_visible.length > 0) {
      harness.fail("forbidden_v1_labels", JSON.stringify(routeState.forbidden_visible));
    }

    const screenshotPath = path.join(SCREENSHOT_DIR, "antigravity_spike_host_1440.png");
    await captureExternalScreenshot(screenshotPath);

    evidence.ui = {
      ...evidence.ui,
      ...routeState,
      screenshot_path: screenshotPath,
    };
    evidence.screenshot_path = screenshotPath;
    harness.mark("antigravity_spike_host_smoke", "pass", DEV_ROUTE);
    writeJson(path.join(EVIDENCE_DIR, "manifest.json"), {
      mission: MISSION,
      route: DEV_ROUTE,
      status: "PASS",
      screenshot_path: screenshotPath,
      screenshots_committed: false,
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
