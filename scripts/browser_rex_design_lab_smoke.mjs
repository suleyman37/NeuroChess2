#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

const MISSION = "R1E.REX-DESIGN-LAB-THREE-VISUAL-DIRECTIONS-V1";
const QA_ROOT = path.join(
  process.env.USERPROFILE ?? "C:\\Users\\bahij",
  "OneDrive",
  "Desktop",
  "NeuroChess_QA_Artifacts",
  "R1E_REX_DESIGN_LAB_THREE_VISUAL_DIRECTIONS_V1",
);
const SCREENSHOT_DIR = path.join(QA_ROOT, "screenshots");
const EVIDENCE_DIR = path.join(QA_ROOT, "browser_evidence");

const DIRECTIONS = [
  { id: "tactical", testId: "rex-design-direction-tactical", screenshot: "rex_design_lab_tactical.png" },
  { id: "constellation", testId: "rex-design-direction-constellation", screenshot: "rex_design_lab_constellation.png" },
  { id: "rpg", testId: "rex-design-direction-rpg", screenshot: "rex_design_lab_rpg.png" },
];

const FORBIDDEN_VISIBLE_TEXT = [
  "ton cerveau",
  "cortex",
  "synapses",
  "diagnostic mental",
  "prediction elo",
  "prédiction elo",
  "raw wdl",
  "criticality_score",
  "diagnostic_gap",
  "etv",
  "fsrs",
  "skilltrace mastery",
  "neurochess garantit",
  "tu es nul",
];

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(EVIDENCE_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_rex_design_lab_smoke.json");
evidence.strategy = "REX design lab only + Vite + Edge CDP";
evidence.output_path = path.join(EVIDENCE_DIR, "browser_rex_design_lab_smoke.json");
evidence.screenshots = [];

const harness = new BrowserSmokeHarness(evidence);

async function captureScreenshot(name) {
  await harness.browserClient.send("Page.bringToFront");
  await harness.evalPage(async () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    window.scrollTo(0, 0);
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    return { scrollX: window.scrollX, scrollY: window.scrollY };
  });
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
  const screenshotPath = path.join(SCREENSHOT_DIR, name);
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, path: screenshotPath });
  harness.writeEvidence();
  return screenshotPath;
}

async function assertForbiddenTextAbsent(stage) {
  const text = normalizeText(await harness.visibleText());
  const visible = FORBIDDEN_VISIBLE_TEXT.filter((label) => text.includes(normalizeText(label)));
  evidence.forbidden_visible = visible;
  if (visible.length > 0) {
    harness.fail(stage, visible.join(", "));
  }
  harness.mark(stage, "pass", "no forbidden design lab text visible");
}

async function assertPreviewForDirection(direction) {
  const result = await harness.evalPage(
    ({ expectedDirection }) => {
      const preview = document.querySelector('[data-testid="rex-design-preview"]');
      const scorecard = document.querySelector('[data-testid="rex-design-scorecard"]');
      return {
        ok:
          Boolean(preview) &&
          Boolean(scorecard) &&
          preview?.getAttribute("data-active-direction") === expectedDirection,
        activeDirection: preview?.getAttribute("data-active-direction"),
        hasScorecard: Boolean(scorecard),
      };
    },
    { expectedDirection: direction.id },
  );
  if (!result.ok) {
    harness.fail(`design_direction_${direction.id}_preview`, JSON.stringify(result));
  }
  harness.mark(`design_direction_${direction.id}_preview`, "pass", JSON.stringify(result));
}

async function main() {
  try {
    harness.backendBaseUrl = "http://127.0.0.1:9";
    await harness.startFrontendVite();
    await harness.startBrowser("/app?rex=1&designLab=1");
    await harness.setViewport({ width: 1366, height: 768, mobile: false });
    await harness.waitForPagePredicate(
      "REX design lab ready",
      () => ({
        ok:
          Boolean(document.querySelector('[data-testid="rex-design-lab"]')) &&
          Boolean(document.querySelector('[data-testid="rex-design-lab-nav"]')) &&
          Boolean(document.querySelector('[data-testid="rex-design-preview"]')) &&
          Boolean(document.querySelector('[data-testid="rex-design-scorecard"]')),
      }),
      30_000,
    );
    harness.mark("design_lab_route_loads", "pass", `${harness.frontendBaseUrl}/app?rex=1&designLab=1`);

    const navResult = await harness.evalPage(() => {
      const ids = [
        "rex-design-direction-tactical",
        "rex-design-direction-constellation",
        "rex-design-direction-rpg",
      ];
      const missing = ids.filter((id) => !document.querySelector(`[data-testid="${id}"]`));
      return { ok: missing.length === 0, missing };
    });
    if (!navResult.ok) {
      harness.fail("design_lab_directions_present", JSON.stringify(navResult));
    }
    harness.mark("design_lab_directions_present", "pass", "3 directions");

    for (const direction of DIRECTIONS) {
      await harness.clickByTestId(direction.testId, { afterMs: 260 });
      await assertPreviewForDirection(direction);
      await assertForbiddenTextAbsent(`design_lab_forbidden_text_absent_${direction.id}`);
      await captureScreenshot(direction.screenshot);
    }

    await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app?rex=1` });
    await harness.waitForPagePredicate("REX baseline route still accessible", () => ({
      ok:
        Boolean(document.querySelector('[data-testid="rex-shell"]')) &&
        !document.querySelector('[data-testid="rex-design-lab"]'),
    }), 30_000);
    harness.mark("rex_baseline_route_still_accessible", "pass", `${harness.frontendBaseUrl}/app?rex=1`);

    await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app` });
    await harness.waitForPagePredicate("V1 route still accessible", () => {
      const text = document.body?.innerText ?? "";
      return {
        ok:
          !document.querySelector('[data-testid="rex-shell"]') &&
          !document.querySelector('[data-testid="rex-design-lab"]') &&
          (text.includes("Aujourd") || text.includes("Mes parties") || text.includes("NeuroChess")),
        text: text.slice(0, 300),
      };
    }, 30_000);
    harness.mark("v1_route_without_rex_accessible", "pass", `${harness.frontendBaseUrl}/app`);

    if (evidence.browser_errors.page.length > 0) {
      harness.fail("design_lab_no_page_crash", evidence.browser_errors.page.join(" | "));
    }
    harness.mark("design_lab_no_page_crash", "pass", "no runtime page exception");
    harness.writeEvidence();
    console.log(`PASS browser_rex_design_lab_smoke evidence=${evidence.output_path}`);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
