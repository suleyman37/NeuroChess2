#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  PROJECT_ROOT,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

const MISSION = "P1.V2-VISION-01-SHELL-AND-TODAY-NORTH-STAR-V1";
const MISSION_ID = "P1_V2_VISION_01_SHELL_AND_TODAY_NORTH_STAR_V1";
const QA_DIR = path.join(PROJECT_ROOT, "qa_artifacts", MISSION_ID);
const SCREENSHOT_DIR = path.join(QA_DIR, "screenshots_raw");
const EVIDENCE_DIR = path.join(QA_DIR, "browser_evidence");

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(EVIDENCE_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_v2_product_vision_shell_premium_smoke.json");
evidence.output_path = path.join(EVIDENCE_DIR, "browser_v2_product_vision_shell_premium_smoke.json");
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

async function captureElement(name, selector, viewport = "1366x768") {
  const rect = await harness.evalPage((targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!element) {
      return null;
    }
    const box = element.getBoundingClientRect();
    return {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: Math.max(1, box.width),
      height: Math.max(1, box.height),
    };
  }, selector);
  if (!rect) {
    harness.fail(`capture_${name}`, `missing selector ${selector}`);
  }
  const screenshotPath = path.join(SCREENSHOT_DIR, `${name}_${viewport}.png`);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    clip: { ...rect, scale: 1 },
  });
  writeFileSync(screenshotPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({ name, viewport, path: screenshotPath, selector });
  harness.writeEvidence();
}

async function main() {
  try {
    await harness.startBackendWithTempDb();
    await harness.startFrontendVite();
    await harness.startBrowser("/app");
    await harness.setViewport({ width: 1366, height: 768 });
    await harness.loadApp();
    await harness.assertMainNavExactly3();
    const v1Default = await harness.evalPage(() => ({
      ok: !document.querySelector('[data-testid="v2-vision-app"]'),
      text: document.body?.innerText ?? "",
    }));
    if (!v1Default.ok) {
      harness.fail("v1_default_unchanged", JSON.stringify(v1Default));
    }
    harness.mark("v1_default_unchanged", "pass");

    await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app#/v2-vision` });
    await harness.waitForPagePredicate("V2 shell ready", () => ({
      ok: Boolean(document.querySelector('[data-testid="v2-vision-header"]')),
      text: document.body?.innerText ?? "",
    }), 30_000);
    await capture("header_focus");
    await captureElement("header_focus_clip", '[data-testid="v2-vision-header"]');

    const result = await harness.evalPage(() => {
      const normalize = (value) =>
        String(value ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      const navLabels = [...document.querySelectorAll('[data-testid="v2-vision-main-nav"] button')].map((button) =>
        normalize(button.textContent),
      );
      const header = document.querySelector('[data-testid="v2-vision-header"]');
      const progression = document.querySelector('[data-testid="v2-vision-open-progression"]');
      const profile = document.querySelector('[data-testid="v2-vision-open-profile"]');
      const exit = document.querySelector('[data-testid="v2-vision-exit"]');
      const exitStyle = exit ? window.getComputedStyle(exit) : null;
      return {
        ok:
          navLabels.join("|") === "aujourd'hui|mes parties|entrainement" &&
          Boolean(header?.textContent?.includes("NeuroChess")) &&
          Boolean(header?.textContent?.includes("Prototype")) &&
          Boolean(progression && !progression.closest('[data-testid="v2-vision-main-nav"]')) &&
          Boolean(profile && !profile.closest('[data-testid="v2-vision-main-nav"]')) &&
          Boolean(exit && exit.classList.contains("v2-vision-exit")) &&
          exitStyle?.backgroundColor === "rgba(0, 0, 0, 0)",
        navLabels,
        headerText: header?.textContent ?? "",
        exitClass: exit?.getAttribute("class"),
        exitBackground: exitStyle?.backgroundColor ?? null,
      };
    });
    if (!result.ok) {
      harness.fail("v2_shell_premium_contract", JSON.stringify(result));
    }
    harness.mark("v2_shell_premium_contract", "pass", result.navLabels.join(" / "));

    const text = await harness.visibleText();
    const normalized = normalizeText(text);
    if (normalized.includes("candidate trainer") || normalized.includes("transfer gap") || /\belo\b/i.test(text)) {
      harness.fail("shell_no_forbidden_or_elo", text);
    }
    harness.mark("shell_no_forbidden_or_elo", "pass");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
