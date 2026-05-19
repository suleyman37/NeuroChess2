#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserSmokeHarness, createEvidence } from "./browser_test_helpers.mjs";

const MISSION = "A20AP Critical Deficit Uplift 10 Signature Probes";
const EVIDENCE_DIR =
  "C:\\Users\\suley\\Documents\\Dev\\NeuroChess_QA_Artifacts\\autopilot\\visual_probes\\A20AP_critical_deficit_uplift_10_probes_20260518";
const SCREENSHOT_DIR = path.join(EVIDENCE_DIR, "screenshots");
const DEV_ROUTE = "/app?visualProbeGallery=1";

const PROBE_IDS = [
  "sacred_board_chamber",
  "piece_identity_system",
  "decision_feedback_language",
  "critical_moment_sigil",
  "verdict_wax_seal",
  "aftermath_timeline",
  "memory_cabinet",
  "piece_breath",
  "position_resonance",
  "decision_pressure_field",
];

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const evidence = createEvidence(MISSION, "browser_signature_probe_gallery_smoke.json");
evidence.strategy = "DEV-only visual probe route + Vite + Edge CDP + external screenshots";
evidence.output_path = path.join(EVIDENCE_DIR, "probe_gallery_smoke_report.json");
evidence.dev_route = DEV_ROUTE;
evidence.screenshots = [];
evidence.visible_probe_ids = [];
evidence.contact_sheet_path = path.join(EVIDENCE_DIR, "contact_sheet_signature_probes.png");
evidence.contact_sheet_html_path = path.join(EVIDENCE_DIR, "contact_sheet_signature_probes.html");
evidence.manifest_path = path.join(EVIDENCE_DIR, "manifest.json");
evidence.console_log_path = path.join(EVIDENCE_DIR, "console_log.txt");
evidence.screenshots_committed = false;
evidence.backend_touched = false;
evidence.package_files_touched = false;
evidence.product_mission_executed = false;
evidence.a21_launched = false;
evidence.night_mode_launched = false;

const harness = new BrowserSmokeHarness(evidence);

function writeJson(filePath, payload) {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeConsoleLog() {
  const lines = [
    "A20AP signature probe gallery smoke",
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

async function navigateGallery() {
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}${DEV_ROUTE}`,
  });
  await harness.waitForPagePredicate(
    "signature probe gallery route",
    () => ({
      ok: Boolean(document.querySelector('[data-testid="signature-probe-gallery"]')),
      text: document.body?.innerText ?? "",
    }),
    30_000,
  );
}

async function captureViewportPng(fileName, meta = {}) {
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
  const outPath = path.join(SCREENSHOT_DIR, fileName);
  writeFileSync(outPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({
    file: fileName,
    path: outPath,
    viewport: `${metrics.width}x${metrics.height}`,
    ...meta,
  });
  harness.writeEvidence();
  return outPath;
}

async function captureFullPagePng(fileName, meta = {}) {
  await harness.browserClient.send("Page.bringToFront");
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    optimizeForSpeed: true,
    captureBeyondViewport: true,
  });
  const outPath = path.join(SCREENSHOT_DIR, fileName);
  writeFileSync(outPath, Buffer.from(result.data, "base64"));
  evidence.screenshots.push({
    file: fileName,
    path: outPath,
    viewport: "full_page",
    ...meta,
  });
  harness.writeEvidence();
  return outPath;
}

async function assertProbeVisibility() {
  const result = await harness.evalPage((probeIds) => {
    const visible = [];
    const missing = [];
    for (const id of probeIds) {
      const node = document.querySelector(`[data-testid="signature-probe-${id}"]`);
      const rect = node?.getBoundingClientRect();
      if (node && rect && rect.width > 80 && rect.height > 120) {
        visible.push(id);
      } else {
        missing.push(id);
      }
    }
    return { ok: missing.length === 0, visible, missing };
  }, PROBE_IDS);
  if (!result.ok) {
    harness.fail("all_signature_probes_visible", JSON.stringify(result));
  }
  evidence.visible_probe_ids = result.visible;
  harness.mark("all_signature_probes_visible", "pass", result.visible.join(","));
}

async function assertV1ProductRouteUnchanged() {
  await harness.loadApp();
  await harness.assertMainNavExactly3();
  const result = await harness.evalPage(() => ({
    ok: !document.querySelector('[data-testid="signature-probe-gallery"]'),
    text: document.body?.innerText ?? "",
  }));
  if (!result.ok) {
    harness.fail("v1_route_has_no_probe_gallery", JSON.stringify(result));
  }
  harness.mark("v1_route_has_no_probe_gallery", "pass", "probe gallery absent from normal /app route");
}

async function captureProbeSet() {
  const shots = [];
  await harness.setViewport({ width: 1440, height: 1000 });
  await navigateGallery();
  await assertProbeVisibility();
  await captureFullPagePng("signature_probe_gallery_full_page_1440.png", {
    kind: "full_gallery",
  });
  shots.push({ file: "signature_probe_gallery_full_page_1440.png", probe_id: "full_gallery_all_10" });

  await harness.setViewport({ width: 1366, height: 900 });
  await navigateGallery();
  for (const id of PROBE_IDS) {
    await harness.evalPage((probeId) => {
      document.querySelector(`[data-testid="signature-probe-${probeId}"]`)?.scrollIntoView({
        block: "center",
        inline: "center",
      });
      return { ok: true };
    }, id);
    await new Promise((resolve) => setTimeout(resolve, 160));
    const file = `signature_probe_${id}_1366.png`;
    await captureViewportPng(file, { kind: "probe_focus", probe_id: id });
    shots.push({ file, probe_id: id });
  }
  return shots;
}

async function createContactSheet(shots) {
  const cards = shots
    .map(
      (shot) => `<figure><img src="screenshots/${shot.file}" /><figcaption>${shot.probe_id}</figcaption></figure>`,
    )
    .join("");
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
body { margin: 0; background: #080b12; color: #eef4fb; font: 14px Segoe UI, Arial, sans-serif; }
header { padding: 22px 24px 0; }
h1 { margin: 0 0 6px; font-size: 22px; }
p { margin: 0 0 16px; color: #aeb9c7; }
main { padding: 24px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
figure { margin: 0; border: 1px solid rgba(221, 234, 247, 0.18); background: #101722; }
img { display: block; width: 100%; }
figcaption { padding: 10px 12px; color: #dce8f5; font-weight: 700; }
</style>
</head>
<body>
<header>
<h1>A20AP Signature Probe Contact Sheet</h1>
<p>External screenshot evidence. Screenshots are not committed.</p>
</header>
<main>${cards}</main>
</body>
</html>`;
  writeFileSync(evidence.contact_sheet_html_path, html, "utf8");
  await harness.browserClient.send("Page.navigate", {
    url: pathToFileURL(evidence.contact_sheet_html_path).href,
  });
  await harness.waitForPagePredicate(
    "contact sheet loaded",
    (expectedCount) => ({ ok: document.querySelectorAll("figure").length === expectedCount }),
    10_000,
    shots.length,
  );
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    optimizeForSpeed: true,
    captureBeyondViewport: true,
  });
  writeFileSync(evidence.contact_sheet_path, Buffer.from(result.data, "base64"));
  harness.mark("contact_sheet_created", "pass", evidence.contact_sheet_path);
}

async function main() {
  try {
    await harness.startBackendWithTempDb();
    await harness.startFrontendVite();
    await harness.startBrowser("/app");
    await harness.setViewport({ width: 1366, height: 900 });
    await assertV1ProductRouteUnchanged();
    const shots = await captureProbeSet();
    await createContactSheet(shots);
    evidence.final_status = "SIGNATURE_PROBE_GALLERY_SMOKE_PASS";
    evidence.completed_at = new Date().toISOString();
    writeJson(evidence.manifest_path, {
      mission_id: "A20AP",
      status: evidence.final_status,
      dev_route: DEV_ROUTE,
      visible_probe_count: evidence.visible_probe_ids.length,
      screenshots: evidence.screenshots,
      contact_sheet: evidence.contact_sheet_path,
      screenshots_committed: false,
      a21_launched: false,
      night_mode_launched: false,
    });
    writeConsoleLog();
    harness.writeEvidence();
  } catch (error) {
    evidence.final_status = "SIGNATURE_PROBE_GALLERY_SMOKE_FAIL";
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
