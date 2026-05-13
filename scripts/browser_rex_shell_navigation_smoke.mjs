#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  createEvidence,
  delay,
  normalizeText,
} from "./browser_test_helpers.mjs";

const MISSION = "R1D.REX-SHELL-AURA-RESTRAINT-AND-PREMIUM-CONTRAST-PASS-V1";
const QA_ROOT = path.join(
  process.env.USERPROFILE ?? "C:\\Users\\bahij",
  "OneDrive",
  "Desktop",
  "NeuroChess_QA_Artifacts",
  "R1D_REX_SHELL_AURA_RESTRAINT_AND_PREMIUM_CONTRAST_PASS_V1",
);
const SCREENSHOT_DIR = path.join(QA_ROOT, "screenshots");
const EVIDENCE_DIR = path.join(QA_ROOT, "browser_evidence");

const SURFACES = [
  { id: "qg", navTestId: "rex-nav-qg", surfaceTestId: "rex-surface-qg", screenshot: "rex_qg_r1d.png" },
  {
    id: "parties",
    navTestId: "rex-nav-parties",
    surfaceTestId: "rex-surface-parties",
    screenshot: "rex_parties_r1d.png",
  },
  {
    id: "forge",
    navTestId: "rex-nav-forge",
    surfaceTestId: "rex-surface-forge",
    screenshot: "rex_forge_r1d.png",
  },
  {
    id: "arene",
    navTestId: "rex-nav-arene",
    surfaceTestId: "rex-surface-arene",
    screenshot: "rex_arene_r1d.png",
  },
  {
    id: "profil",
    navTestId: "rex-nav-profil",
    surfaceTestId: "rex-surface-profil",
    screenshot: "rex_profil_r1d.png",
  },
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

const evidence = createEvidence(MISSION, "browser_rex_shell_navigation_smoke.json");
evidence.strategy = "REX shell only + Vite + Edge CDP";
evidence.output_path = path.join(EVIDENCE_DIR, "browser_rex_shell_navigation_smoke.json");
evidence.screenshots = [];

const harness = new BrowserSmokeHarness(evidence);

async function captureScreenshot(name) {
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
  const screenshotPath = path.join(SCREENSHOT_DIR, name);
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, path: screenshotPath });
  harness.writeEvidence();
  return screenshotPath;
}

async function assertOnlySurfaceVisible(stage, surfaceTestId) {
  const result = await harness.evalPage(
    ({ expectedTestId }) => {
      const surfaceNodes = [...document.querySelectorAll('[data-testid^="rex-surface-"]')];
      const visible = surfaceNodes
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          const style = window.getComputedStyle(node);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        })
        .map((node) => node.getAttribute("data-testid"));
      return {
        ok: visible.length === 1 && visible[0] === expectedTestId,
        visible,
        expectedTestId,
      };
    },
    { expectedTestId: surfaceTestId },
  );
  if (!result.ok) {
    harness.fail(stage, JSON.stringify(result));
  }
  harness.mark(stage, "pass", result.visible.join(", "));
}

async function assertForbiddenTextAbsent() {
  const text = normalizeText(await harness.visibleText());
  const visible = FORBIDDEN_VISIBLE_TEXT.filter((label) => text.includes(normalizeText(label)));
  evidence.forbidden_visible = visible;
  if (visible.length > 0) {
    harness.fail("rex_forbidden_text_absent", visible.join(", "));
  }
  harness.mark("rex_forbidden_text_absent", "pass", "no forbidden REX text visible");
}

async function main() {
  try {
    harness.backendBaseUrl = "http://127.0.0.1:9";
    await harness.startFrontendVite();
    await harness.startBrowser("/app?rex=1");
    await harness.setViewport({ width: 1366, height: 768, mobile: false });
    await harness.waitForPagePredicate("REX shell ready", () => ({
      ok:
        Boolean(document.querySelector('[data-testid="rex-shell"]')) &&
        Boolean(document.querySelector('[data-testid="rex-nav"]')),
      text: document.body?.innerText ?? "",
    }), 30_000);
    harness.mark("rex_route_loads", "pass", `${harness.frontendBaseUrl}/app?rex=1`);

    const navResult = await harness.evalPage(() => {
      const ids = [
        "rex-nav-qg",
        "rex-nav-parties",
        "rex-nav-forge",
        "rex-nav-arene",
        "rex-nav-profil",
      ];
      const missing = ids.filter((id) => !document.querySelector(`[data-testid="${id}"]`));
      return { ok: missing.length === 0, missing };
    });
    if (!navResult.ok) {
      harness.fail("rex_nav_items_present", JSON.stringify(navResult));
    }
    harness.mark("rex_nav_items_present", "pass", "5 nav items");

    for (const surface of SURFACES) {
      await harness.clickByTestId(surface.navTestId, { afterMs: 220 });
      await harness.waitForPagePredicate(`surface ${surface.id} visible`, (surfaceTestId) => ({
        ok: Boolean(document.querySelector(`[data-testid="${surfaceTestId}"]`)),
      }), 10_000, surface.surfaceTestId);
      await assertOnlySurfaceVisible(`surface_${surface.id}_only_visible`, surface.surfaceTestId);
      await assertForbiddenTextAbsent();
      await captureScreenshot(surface.screenshot);
      if (surface.id === "qg") {
        await captureScreenshot("rex_motion_qg_1.png");
        await delay(2200);
        await captureScreenshot("rex_motion_qg_2.png");
        await delay(2200);
        await captureScreenshot("rex_motion_qg_3.png");
      }
    }

    await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app` });
    await harness.waitForPagePredicate("V1 route still accessible", () => {
      const text = document.body?.innerText ?? "";
      return {
        ok:
          !document.querySelector('[data-testid="rex-shell"]') &&
          (text.includes("Aujourd") || text.includes("Mes parties") || text.includes("NeuroChess")),
        text: text.slice(0, 300),
      };
    }, 30_000);
    harness.mark("v1_route_without_rex_accessible", "pass", `${harness.frontendBaseUrl}/app`);

    if (evidence.browser_errors.page.length > 0) {
      harness.fail("rex_no_page_crash", evidence.browser_errors.page.join(" | "));
    }
    harness.mark("rex_no_page_crash", "pass", "no runtime page exception");
    harness.writeEvidence();
    console.log(`PASS browser_rex_shell_navigation_smoke evidence=${evidence.output_path}`);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
