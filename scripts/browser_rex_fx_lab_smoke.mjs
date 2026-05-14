#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  createEvidence,
  delay,
  normalizeText,
} from "./browser_test_helpers.mjs";

const MISSION = "R2F.REX-VISUAL-FX-LAB-SIGNATURE-EFFECTS-V1";
const QA_ROOT = path.join(
  process.env.USERPROFILE ?? "C:\\Users\\bahij",
  "OneDrive",
  "Desktop",
  "NeuroChess_QA_Artifacts",
  "R2F_REX_VISUAL_FX_LAB_SIGNATURE_EFFECTS_V1",
);
const SCREENSHOT_DIR = path.join(QA_ROOT, "screenshots");
const EVIDENCE_DIR = path.join(QA_ROOT, "browser_evidence");

const EFFECTS = [
  { id: "vortex", testId: "rex-fx-vortex", screenshot: "rex_fx_vortex.png" },
  { id: "aurora", testId: "rex-fx-aurora", screenshot: "rex_fx_aurora.png" },
  { id: "wind-lanes", testId: "rex-fx-wind-lanes", screenshot: "rex_fx_wind_lanes.png" },
];

const FORBIDDEN_VISIBLE_TEXT = [
  "ton cerveau",
  "cortex",
  "synapses",
  "diagnostic mental",
  "prediction elo",
  "prÃ©diction elo",
  "raw wdl",
  "criticality_score",
  "diagnostic_gap",
  "etv",
  "fsrs",
  "skilltrace mastery",
  "neurochess garantit",
  "tu es nul",
  "transfer score",
];

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(EVIDENCE_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_rex_fx_lab_smoke.json");
evidence.strategy = "REX FX lab isolated route + Vite + Edge CDP";
evidence.output_path = path.join(EVIDENCE_DIR, "browser_rex_fx_lab_smoke.json");
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
  harness.mark(stage, "pass", "no forbidden FX lab text visible");
}

async function assertPreviewForEffect(effect) {
  const result = await harness.evalPage(
    ({ expectedEffect }) => {
      const preview = document.querySelector('[data-testid="rex-fx-preview"]');
      return {
        ok: Boolean(preview) && preview?.getAttribute("data-active-effect") === expectedEffect,
        activeEffect: preview?.getAttribute("data-active-effect"),
      };
    },
    { expectedEffect: effect.id },
  );
  if (!result.ok) {
    harness.fail(`fx_effect_${effect.id}_preview`, JSON.stringify(result));
  }
  harness.mark(`fx_effect_${effect.id}_preview`, "pass", JSON.stringify(result));
}

async function main() {
  try {
    harness.backendBaseUrl = "http://127.0.0.1:9";
    await harness.startFrontendVite();
    await harness.startBrowser("/app?rex=1&fxLab=1");
    await harness.setViewport({ width: 1366, height: 768, mobile: false });
    await harness.waitForPagePredicate(
      "REX FX lab ready",
      () => ({
        ok:
          Boolean(document.querySelector('[data-testid="rex-fx-lab"]')) &&
          Boolean(document.querySelector('[data-testid="rex-fx-lab-nav"]')) &&
          Boolean(document.querySelector('[data-testid="rex-fx-preview"]')),
      }),
      30_000,
    );
    harness.mark("fx_lab_route_loads", "pass", `${harness.frontendBaseUrl}/app?rex=1&fxLab=1`);

    const navResult = await harness.evalPage(() => {
      const ids = ["rex-fx-vortex", "rex-fx-aurora", "rex-fx-wind-lanes"];
      const missing = ids.filter((id) => !document.querySelector(`[data-testid="${id}"]`));
      return { ok: missing.length === 0, missing };
    });
    if (!navResult.ok) {
      harness.fail("fx_lab_effects_present", JSON.stringify(navResult));
    }
    harness.mark("fx_lab_effects_present", "pass", "3 effects");

    for (const effect of EFFECTS) {
      await harness.clickByTestId(effect.testId, { afterMs: 320 });
      await assertPreviewForEffect(effect);
      await assertForbiddenTextAbsent(`fx_lab_forbidden_text_absent_${effect.id}`);
      await captureScreenshot(effect.screenshot);
    }

    await harness.clickByTestId("rex-fx-vortex", { afterMs: 260 });
    for (const index of [1, 2, 3]) {
      await delay(900);
      await captureScreenshot(`rex_fx_vortex_motion_${index}.png`);
    }

    await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app?rex=1` });
    await harness.waitForPagePredicate("REX shell route still accessible", () => ({
      ok:
        Boolean(document.querySelector('[data-testid="rex-shell"]')) &&
        !document.querySelector('[data-testid="rex-fx-lab"]') &&
        !document.querySelector('[data-testid="rex-design-lab"]'),
    }), 30_000);
    harness.mark("rex_shell_route_still_accessible", "pass", `${harness.frontendBaseUrl}/app?rex=1`);

    await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app?rex=1&designLab=1` });
    await harness.waitForPagePredicate("Design Lab still accessible", () => ({
      ok:
        Boolean(document.querySelector('[data-testid="rex-design-lab"]')) &&
        !document.querySelector('[data-testid="rex-fx-lab"]'),
    }), 30_000);
    harness.mark("rex_design_lab_still_accessible", "pass", `${harness.frontendBaseUrl}/app?rex=1&designLab=1`);

    if (evidence.browser_errors.page.length > 0) {
      harness.fail("fx_lab_no_page_crash", evidence.browser_errors.page.join(" | "));
    }
    harness.mark("fx_lab_no_page_crash", "pass", "no runtime page exception");
    harness.writeEvidence();
    console.log(`PASS browser_rex_fx_lab_smoke evidence=${evidence.output_path}`);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
