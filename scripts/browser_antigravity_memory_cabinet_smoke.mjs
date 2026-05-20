#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  FORBIDDEN_V1_LABELS,
  createEvidence,
} from "./browser_test_helpers.mjs";

const MISSION = "A20BV Memory Cabinet Antigravity import";
const EVIDENCE_DIR =
  process.env.ANTIGRAVITY_MEMORY_CABINET_ARTIFACT_DIR ??
  "C:\\Users\\suley\\Documents\\Dev\\NeuroChess_QA_Artifacts\\autopilot\\antigravity\\A20BV_import_memory_cabinet_20260520";
const SCREENSHOT_DIR = path.join(EVIDENCE_DIR, "screenshots");
const DEV_ROUTE = "/app?antigravitySpike=memory_cabinet";

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_antigravity_memory_cabinet_smoke.json");
evidence.strategy = "DEV-only Memory Cabinet route with external screenshot proof";
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

async function captureVariant(label, slug) {
  await harness.evalPage((variantLabel) => {
    const buttons = Array.from(document.querySelectorAll("button.cabinet-tab"));
    const target = buttons.find((button) => button.textContent?.includes(variantLabel));
    target?.click();
  }, label);
  await harness.waitForPagePredicate(
    `memory cabinet variant ${label}`,
    (variantLabel) => {
      const heading = document.querySelector(".cabinet-card h2")?.textContent ?? "";
      return {
        ok: heading.includes(variantLabel),
        heading,
      };
    },
    10_000,
    label,
  );
  const screenshotPath = path.join(SCREENSHOT_DIR, `memory_cabinet_${slug}_1440.png`);
  await captureExternalScreenshot(screenshotPath);
  return screenshotPath;
}

async function main() {
  try {
    await harness.startBackendWithTempDb();
    await harness.startFrontendVite();
    await harness.startBrowser(DEV_ROUTE);
    await harness.setViewport({ width: 1440, height: 920 });

    await harness.waitForPagePredicate(
      "memory cabinet Antigravity spike route",
      () => {
        const host = document.querySelector('[data-testid="antigravity-spike-host"]');
        const text = document.body?.innerText ?? "";
        const normalizedText = text.toLowerCase();
        const variantTabs = Array.from(document.querySelectorAll("button.cabinet-tab")).map(
          (node) => node.textContent ?? "",
        );
        return {
          ok:
            Boolean(host) &&
            normalizedText.includes("memory_cabinet") &&
            normalizedText.includes("visual cabinet showcase") &&
            variantTabs.length === 3,
          text,
          variantTabs,
        };
      },
      30_000,
    );

    const routeState = await harness.evalPage((forbiddenLabels) => {
      const text = document.body?.innerText ?? "";
      const variantTabs = Array.from(document.querySelectorAll("button.cabinet-tab")).map(
        (node) => node.textContent ?? "",
      );
      const forbiddenVisible = forbiddenLabels.filter((label) => text.includes(label));
      return {
        route_visible: Boolean(document.querySelector('[data-testid="antigravity-spike-host"]')),
        registry_entry_visible: Boolean(
          document.querySelector('[data-testid="antigravity-spike-registry-entry"]'),
        ),
        spike_id: document.querySelector('[data-testid="antigravity-spike-id"]')?.textContent ?? "",
        title_visible: text.includes("Memory Cabinet"),
        premium_clarity_visible: text.includes("Premium Clarity"),
        signature_identity_visible: text.includes("Signature Identity"),
        radical_board_safe_visible: text.includes("Radical but Board-Safe"),
        variant_tab_count: variantTabs.length,
        variant_tabs: variantTabs,
        board_visible: Boolean(document.querySelector(".mini-board")),
        compliance_visible: text.includes("Memory Cabinet Compliance Audit"),
        forbidden_visible: forbiddenVisible,
      };
    }, FORBIDDEN_V1_LABELS);

    if (!routeState.route_visible) {
      harness.fail("route_visible", JSON.stringify(routeState));
    }
    if (routeState.spike_id !== "memory_cabinet") {
      harness.fail("spike_id", JSON.stringify(routeState));
    }
    if (
      !routeState.title_visible ||
      !routeState.premium_clarity_visible ||
      !routeState.signature_identity_visible ||
      !routeState.radical_board_safe_visible
    ) {
      harness.fail("variant_visibility", JSON.stringify(routeState));
    }
    if (routeState.variant_tab_count !== 3) {
      harness.fail("variant_tab_count", JSON.stringify(routeState));
    }
    if (!routeState.board_visible) {
      harness.fail("board_visible", JSON.stringify(routeState));
    }
    if (routeState.forbidden_visible.length > 0) {
      harness.fail("forbidden_v1_labels", JSON.stringify(routeState.forbidden_visible));
    }

    const variantScreenshots = {
      premium_clarity: await captureVariant("Premium Clarity", "premium_clarity"),
      signature_identity: await captureVariant("Signature Identity", "signature_identity"),
      radical_board_safe: await captureVariant("Radical but Board-Safe", "radical_board_safe"),
    };
    const screenshotPath = variantScreenshots.premium_clarity;

    evidence.ui = {
      ...evidence.ui,
      ...routeState,
      screenshot_path: screenshotPath,
      variant_screenshots: variantScreenshots,
    };
    evidence.screenshot_path = screenshotPath;
    harness.mark("antigravity_memory_cabinet_smoke", "pass", DEV_ROUTE);
    writeJson(path.join(EVIDENCE_DIR, "manifest.json"), {
      mission: MISSION,
      route: DEV_ROUTE,
      status: "PASS",
      screenshot_path: screenshotPath,
      variant_screenshots: variantScreenshots,
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
