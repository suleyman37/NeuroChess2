#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BrowserSmokeHarness,
  createEvidence,
  normalizeText,
} from "./browser_test_helpers.mjs";

const MISSION = "R2B.MICRO-POLISH-PARTIES-READONLY-DEGRADED-UX-V1";
const QA_ROOT = path.join(
  process.env.USERPROFILE ?? "C:\\Users\\bahij",
  "OneDrive",
  "Desktop",
  "NeuroChess_QA_Artifacts",
  "R2B_MICRO_POLISH_PARTIES_READONLY_DEGRADED_UX_V1",
);
const SCREENSHOT_DIR = path.join(QA_ROOT, "screenshots");
const EVIDENCE_DIR = path.join(QA_ROOT, "browser_evidence");

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
  "xp gagne",
  "transfer score",
];

const FORBIDDEN_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(EVIDENCE_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_rex_parties_readonly_smoke.json");
evidence.strategy = "REX Parties read-only + backend unavailable fallback + Vite + Edge CDP";
evidence.output_path = path.join(EVIDENCE_DIR, "browser_rex_parties_readonly_smoke.json");
evidence.screenshots = [];
evidence.network_calls = [];
evidence.route_sources = [
  "frontend/src/api/client.ts:getGameHistory",
  "backend/neurochess/api/game_routes.py:@router.get(\"/games/history\")",
];

const harness = new BrowserSmokeHarness(evidence);

async function captureScreenshot(name) {
  await harness.browserClient.send("Page.bringToFront");
  await harness.evalPage(async () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo(0, 0);
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

async function installNetworkRecorder() {
  await harness.browserClient.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      (() => {
        const calls = [];
        Object.defineProperty(window, "__rexNetworkCalls", {
          configurable: true,
          get() {
            return calls;
          },
        });
        const originalFetch = window.fetch;
        window.fetch = function(input, init) {
          const requestMethod = input instanceof Request ? input.method : undefined;
          const method = String((init && init.method) || requestMethod || "GET").toUpperCase();
          const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
          calls.push({ transport: "fetch", method, url });
          return originalFetch.apply(this, arguments);
        };
        const originalOpen = window.XMLHttpRequest && window.XMLHttpRequest.prototype.open;
        if (originalOpen) {
          window.XMLHttpRequest.prototype.open = function(method, url) {
            calls.push({ transport: "xhr", method: String(method || "GET").toUpperCase(), url: String(url) });
            return originalOpen.apply(this, arguments);
          };
        }
      })();
    `,
  });
}

async function assertForbiddenTextAbsent() {
  const text = normalizeText(await harness.visibleText());
  const visible = FORBIDDEN_VISIBLE_TEXT.filter((label) => text.includes(normalizeText(label)));
  evidence.forbidden_visible = visible;
  if (visible.length > 0) {
    harness.fail("rex_parties_forbidden_text_absent", visible.join(", "));
  }
  harness.mark("rex_parties_forbidden_text_absent", "pass", "no forbidden Parties text visible");
}

async function networkCalls() {
  const calls = await harness.evalPage(() => window.__rexNetworkCalls ?? []);
  evidence.network_calls = calls;
  harness.writeEvidence();
  return calls;
}

async function assertReadOnlyNetwork() {
  const calls = await networkCalls();
  const forbidden = calls.filter((call) => FORBIDDEN_METHODS.has(String(call.method).toUpperCase()));
  if (forbidden.length > 0) {
    harness.fail("rex_parties_readonly_network", JSON.stringify(forbidden));
  }
  const splineCalls = calls.filter((call) => /spline|splinetool|scene\.splinecode/i.test(String(call.url)));
  if (splineCalls.length > 0) {
    harness.fail("rex_parties_no_spline_network", JSON.stringify(splineCalls));
  }
  const historyCall = calls.find((call) => String(call.url).includes("/games/history"));
  if (!historyCall) {
    harness.fail("rex_parties_history_route_called", JSON.stringify(calls));
  }
  harness.mark("rex_parties_readonly_network", "pass", JSON.stringify(calls));
}

async function main() {
  try {
    harness.backendBaseUrl = "http://127.0.0.1:65535";
    await harness.startFrontendVite();
    await harness.startBrowser("/app");
    await harness.setViewport({ width: 1366, height: 768, mobile: false });
    await installNetworkRecorder();

    await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app?rex=1` });
    await harness.waitForPagePredicate("REX shell ready", () => ({
      ok:
        Boolean(document.querySelector('[data-testid="rex-shell"]')) &&
        Boolean(document.querySelector('[data-testid="rex-nav"]')),
    }), 30_000);
    harness.mark("rex_route_loads", "pass", `${harness.frontendBaseUrl}/app?rex=1`);

    await harness.clickByTestId("rex-nav-parties", { afterMs: 260 });
    await harness.waitForPagePredicate("Parties surface ready", () => ({
      ok:
        Boolean(document.querySelector('[data-testid="rex-surface-parties"]')) &&
        Boolean(document.querySelector('[data-testid="rex-parties-readonly-panel"]')),
    }), 10_000);
    await harness.waitForPagePredicate("Parties backend state settled", () => {
      const panel = document.querySelector('[data-testid="rex-parties-readonly-panel"]');
      const state = panel?.getAttribute("data-backend-status");
      const text = document.body?.innerText ?? "";
      return {
        ok: state === "ready" || state === "empty" || state === "unavailable",
        state,
        text: text.slice(0, 400),
      };
    }, 30_000);

    const partiesState = await harness.evalPage(() => {
      const panel = document.querySelector('[data-testid="rex-parties-readonly-panel"]');
      const technical = document.querySelector('[data-testid="rex-parties-technical-details"]');
      const ctaNoteVisible = (document.body?.innerText ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes("Import REX non branche");
      return {
        backendStatus: panel?.getAttribute("data-backend-status"),
        title: document.querySelector('[data-testid="rex-parties-backend-state"]')?.textContent ?? "",
        hasTruthChain: Boolean(document.querySelector('[data-testid="rex-artifact-truth-chain"]')),
        hasTechnicalDetails: Boolean(technical),
        ctaNoteVisible,
      };
    });
    if (!partiesState.hasTruthChain || !partiesState.hasTechnicalDetails || !partiesState.ctaNoteVisible) {
      harness.fail("rex_parties_truth_chain_present", JSON.stringify(partiesState));
    }
    harness.mark("rex_parties_state_visible", "pass", JSON.stringify(partiesState));

    await assertForbiddenTextAbsent();
    await assertReadOnlyNetwork();
    await captureScreenshot("rex_parties_r2b_polished.png");
    if (partiesState.backendStatus === "ready") {
      await captureScreenshot("rex_parties_r2b_loaded.png");
    } else {
      await captureScreenshot("rex_parties_r2b_polished_degraded.png");
    }

    await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app?rex=1&designLab=1` });
    await harness.waitForPagePredicate("Design Lab still accessible", () => ({
      ok: Boolean(document.querySelector('[data-testid="rex-design-lab"]')),
    }), 30_000);
    harness.mark("rex_design_lab_still_accessible", "pass", `${harness.frontendBaseUrl}/app?rex=1&designLab=1`);

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
      harness.fail("rex_parties_no_page_crash", evidence.browser_errors.page.join(" | "));
    }
    harness.mark("rex_parties_no_page_crash", "pass", "no runtime page exception");
    harness.writeEvidence();
    console.log(`PASS browser_rex_parties_readonly_smoke evidence=${evidence.output_path}`);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
