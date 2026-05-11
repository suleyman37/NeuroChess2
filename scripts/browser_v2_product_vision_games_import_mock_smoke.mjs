#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
} from "./browser_test_helpers.mjs";

const MISSION = "P1.V2-VISION-02-GAMES-SOURCE-ROOM-V1";
const MISSION_ID = "P1_V2_VISION_02_GAMES_SOURCE_ROOM_V1";
const QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID);
const SCREENSHOT_DIR = path.join(QA_DIR, "screenshots_raw");
const EVIDENCE_DIR = path.join(QA_DIR, "browser_evidence");

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(EVIDENCE_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_v2_product_vision_games_import_mock_smoke.json");
evidence.output_path = path.join(EVIDENCE_DIR, "browser_v2_product_vision_games_import_mock_smoke.json");
evidence.screenshots = [];

const harness = new BrowserSmokeHarness(evidence);

async function capture(name, viewport = "1366x768") {
  const screenshotPath = path.join(SCREENSHOT_DIR, `${name}_${viewport}.png`);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, viewport, path: screenshotPath });
  harness.writeEvidence();
}

async function main() {
  try {
    await harness.startBackendWithTempDb();
    await harness.startFrontendVite();
    await harness.startBrowser("/app#/v2-vision");
    await harness.setViewport({ width: 1366, height: 768 });
    await harness.waitForPagePredicate("V2 shell ready", () => ({
      ok: Boolean(document.querySelector('[data-testid="v2-vision-main-nav"]')),
      text: document.body?.innerText ?? "",
    }), 30_000);
    await harness.clickByTestId("v2-vision-nav-games", { afterMs: 250 });

    const before = await harness.evalPage(() =>
      performance.getEntriesByType("resource").map((entry) => entry.name),
    );
    await harness.clickByTestId("v2-vision-import-pgn", { afterMs: 250 });
    await harness.waitForPagePredicate("import mock open", () => {
      const text = document.body?.innerText ?? "";
      const normalized = text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return {
        ok:
          Boolean(document.querySelector('[data-testid="v2-vision-import-mock"]')) &&
          normalized.includes("analyser cette partie") &&
          normalized.includes("demonstration locale"),
        text,
      };
    });
    await capture("import_mock_open");

    const after = await harness.evalPage(() =>
      performance.getEntriesByType("resource").map((entry) => entry.name),
    );
    const newApiCalls = after
      .filter((url) => !before.includes(url))
      .filter((url) => {
        try {
          const pathname = new URL(url).pathname;
          return ["/api/", "/games/", "/review/", "/practice/", "/daily-plan"].some((prefix) =>
            pathname.startsWith(prefix),
          );
        } catch {
          return false;
        }
      });
    if (newApiCalls.length > 0) {
      harness.fail("import_mock_no_api_calls", JSON.stringify(newApiCalls));
    }
    harness.mark("import_mock_no_api_calls", "pass");

    await harness.clickByTestId("v2-vision-import-cancel", { afterMs: 150 });
    const closed = await harness.evalPage(() => ({
      ok: !document.querySelector('[data-testid="v2-vision-import-mock"]'),
      text: document.body?.innerText ?? "",
    }));
    if (!closed.ok) {
      harness.fail("import_mock_cancel_closes", JSON.stringify(closed));
    }
    harness.mark("import_mock_cancel_closes", "pass");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
