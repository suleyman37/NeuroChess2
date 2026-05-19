#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserSmokeHarness, createEvidence, PROJECT_ROOT } from "./browser_test_helpers.mjs";

const MISSION = "A20AQ Perception-Grade Visual Evidence Foundry";
const MISSION_ID = "A20AQ";
const EVIDENCE_DIR =
  "C:\\Users\\suley\\Documents\\Dev\\NeuroChess_QA_Artifacts\\autopilot\\visual_evidence\\A20AQ_perception_grade_visual_evidence_foundry_20260518";
const SCREENSHOT_DIR = path.join(EVIDENCE_DIR, "screenshots");
const FULL_DIR = path.join(SCREENSHOT_DIR, "full");
const MAIN_SURFACE_DIR = path.join(SCREENSHOT_DIR, "main_surface");
const DETAIL_DIR = path.join(SCREENSHOT_DIR, "detail");
const CONTACT_OVERVIEW_DIR = path.join(EVIDENCE_DIR, "contact_sheets", "overview");
const CONTACT_PAIRWISE_DIR = path.join(EVIDENCE_DIR, "contact_sheets", "pairwise");
const JUDGE_PACKET_DIR = path.join(EVIDENCE_DIR, "judge_packets");
const DEV_GALLERY_ROUTE = "/app?visualProbeGallery=1";

const PROBES = [
  { id: "sacred_board_chamber", title: "Sacred Board Chamber", stage: "Review focus", boardVisible: true },
  { id: "piece_identity_system", title: "Piece Identity System", stage: "Position reading", boardVisible: false },
  { id: "decision_feedback_language", title: "Decision Feedback Language", stage: "Post-attempt feedback", boardVisible: true },
  { id: "critical_moment_sigil", title: "Critical Moment Sigil", stage: "Moment selection", boardVisible: false },
  { id: "verdict_wax_seal", title: "Verdict Wax Seal", stage: "Feedback verdict", boardVisible: false },
  { id: "aftermath_timeline", title: "Aftermath Timeline", stage: "Review reflection", boardVisible: false },
  { id: "memory_cabinet", title: "Memory Cabinet", stage: "Revision", boardVisible: false },
  { id: "piece_breath", title: "Piece Breath", stage: "Quiet attention", boardVisible: false },
  { id: "position_resonance", title: "Position Resonance", stage: "Transfer", boardVisible: true },
  { id: "decision_pressure_field", title: "Decision Pressure Field", stage: "Attempt pressure", boardVisible: true },
];

const PAIRS = [
  ["sacred_board_chamber", "decision_pressure_field"],
  ["critical_moment_sigil", "verdict_wax_seal"],
  ["aftermath_timeline", "memory_cabinet"],
  ["piece_identity_system", "piece_breath"],
  ["decision_feedback_language", "position_resonance"],
];

for (const dir of [
  EVIDENCE_DIR,
  FULL_DIR,
  MAIN_SURFACE_DIR,
  DETAIL_DIR,
  CONTACT_OVERVIEW_DIR,
  CONTACT_PAIRWISE_DIR,
  path.join(JUDGE_PACKET_DIR, "gemini"),
  path.join(JUDGE_PACKET_DIR, "chatgpt"),
  path.join(JUDGE_PACKET_DIR, "pairwise"),
]) {
  mkdirSync(dir, { recursive: true });
}

const evidence = createEvidence(MISSION, "browser_signature_probe_evidence_smoke.json");
evidence.strategy =
  "DEV-only isolated probe routes + Vite + Edge CDP clipping + external perception-grade screenshots";
evidence.output_path = path.join(EVIDENCE_DIR, "browser_probe_evidence_smoke_report.json");
evidence.dev_gallery_route = DEV_GALLERY_ROUTE;
evidence.artifact_path = EVIDENCE_DIR;
evidence.console_log_path = path.join(EVIDENCE_DIR, "console_log.txt");
evidence.evidence_manifest_path = path.join(EVIDENCE_DIR, "evidence_manifest.json");
evidence.screenshot_quality_report_path = path.join(EVIDENCE_DIR, "screenshot_quality_report.json");
evidence.visual_pixel_budget_report_path = path.join(EVIDENCE_DIR, "visual_pixel_budget_report.json");
evidence.local_triage_result_path = path.join(EVIDENCE_DIR, "local_triage_result.json");
evidence.screenshots = [];
evidence.probe_results = [];
evidence.contact_sheets = [];
evidence.screenshots_committed = false;
evidence.qa_artifacts_committed = false;
evidence.backend_touched = false;
evidence.package_files_touched = false;
evidence.product_mission_executed = false;
evidence.a21_launched = false;
evidence.night_mode_launched = false;

const harness = new BrowserSmokeHarness(evidence);

function writeJson(filePath, payload) {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readPngDimensions(filePath) {
  const buffer = Buffer.from(readFileSync(filePath));
  if (buffer.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`Not a PNG file: ${filePath}`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function assertExternalArtifact(filePath) {
  const relative = path.relative(PROJECT_ROOT, filePath);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    throw new Error(`Evidence artifact is inside repo: ${filePath}`);
  }
}

function writeConsoleLog() {
  const lines = [
    "A20AQ perception-grade visual evidence smoke",
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

async function navigate(urlPath, label) {
  await harness.browserClient.send("Page.navigate", {
    url: `${harness.frontendBaseUrl}${urlPath}`,
  });
  await harness.waitForPagePredicate(
    label,
    () => ({ ok: document.readyState === "complete" || document.readyState === "interactive" }),
    30_000,
  );
}

async function waitForProbe(probeId) {
  await harness.waitForPagePredicate(
    `probe ${probeId} loaded`,
    (id) => ({
      ok: Boolean(document.querySelector(`[data-testid="signature-probe-main-surface-${id}"]`)),
      text: document.body?.innerText ?? "",
    }),
    30_000,
    probeId,
  );
}

async function capturePng(filePath, options = {}) {
  assertExternalArtifact(filePath);
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    optimizeForSpeed: true,
    captureBeyondViewport: options.captureBeyondViewport === true,
    ...(options.clip ? { clip: options.clip } : {}),
  });
  writeFileSync(filePath, Buffer.from(result.data, "base64"));
  return readPngDimensions(filePath);
}

function normalizedClip(rect, viewport) {
  const x = Math.max(0, Math.floor(rect.left));
  const y = Math.max(0, Math.floor(rect.top));
  const maxWidth = Math.max(1, viewport.width - x);
  const maxHeight = Math.max(1, viewport.height - y);
  return {
    x,
    y,
    width: Math.max(1, Math.min(Math.ceil(rect.width), maxWidth)),
    height: Math.max(1, Math.min(Math.ceil(rect.height), maxHeight)),
    scale: 1,
  };
}

async function probeMetrics(probeId) {
  return harness.evalPage((id) => {
    const rectFor = (selector) => {
      const node = document.querySelector(selector);
      if (!node) {
        return null;
      }
      node.scrollIntoView({ block: "center", inline: "center" });
      const rect = node.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        area: Math.round(rect.width * rect.height),
      };
    };
    const primary = rectFor('[data-evidence-role="primary"]');
    const mainSurface = rectFor(`[data-testid="signature-probe-main-surface-${id}"]`);
    const detail = rectFor(`[data-testid="signature-probe-detail-${id}"]`);
    const boardCandidates = [...document.querySelectorAll('[data-evidence-role="board"]')]
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          area: Math.round(rect.width * rect.height),
        };
      })
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .sort((a, b) => b.area - a.area);
    const viewport = {
      width: Math.round(window.innerWidth),
      height: Math.round(window.innerHeight),
      area: Math.round(window.innerWidth * window.innerHeight),
    };
    const routeMeta = document.querySelector('[data-testid="signature-probe-evidence-page"]');
    return {
      ok: Boolean(primary && mainSurface && detail && routeMeta),
      primary,
      mainSurface,
      detail,
      board: boardCandidates[0] ?? null,
      viewport,
      route_probe_id: routeMeta?.getAttribute("data-visual-probe-id") ?? null,
      board_visible: routeMeta?.getAttribute("data-board-visible") === "true",
      text: document.body?.innerText ?? "",
    };
  }, probeId);
}

function scoreProbe({ probe, primaryDimensions, mainSurfaceDimensions, detailDimensions, metrics, paths }) {
  const failureReasons = [];
  let score = 0;
  const mainRatio = metrics.mainSurface.area / metrics.viewport.area;

  if (primaryDimensions.width >= 1200 && primaryDimensions.height >= 800) {
    score += 20;
  } else {
    failureReasons.push("primary_screenshot_below_1200x800");
  }

  if (
    metrics.mainSurface.width >= 700 &&
    metrics.mainSurface.height >= 450 &&
    mainRatio >= 0.35 &&
    mainSurfaceDimensions.width >= 700 &&
    mainSurfaceDimensions.height >= 450
  ) {
    score += 25;
  } else {
    failureReasons.push("main_surface_pixel_budget_failed");
  }

  if (!probe.boardVisible || (metrics.board && metrics.board.width >= 360)) {
    score += 15;
  } else {
    failureReasons.push("board_bbox_below_360px");
  }

  if (detailDimensions.width >= 300 && detailDimensions.height >= 220 && metrics.detail.width >= 300) {
    score += 20;
  } else {
    failureReasons.push("signature_detail_not_large_enough");
  }

  if (metrics.text.includes(probe.title) && metrics.text.includes(probe.stage)) {
    score += 10;
  } else {
    failureReasons.push("route_context_missing");
  }

  if (paths.primary && paths.mainSurface && paths.detail) {
    score += 10;
  } else {
    failureReasons.push("judge_packet_paths_incomplete");
  }

  return {
    evidence_quality_score: score,
    failure_reasons: failureReasons,
    primary_evidence_ready: score >= 75 && failureReasons.length === 0,
    recommended_for_gemini: score >= 75,
    recommended_for_chatgpt: score >= 75,
    main_surface_area_ratio: Number(mainRatio.toFixed(3)),
  };
}

async function captureProbe(probe) {
  const route = `/app?visualProbe=${probe.id}&evidence=primary`;
  await navigate(route, `navigate ${probe.id}`);
  await waitForProbe(probe.id);
  const metrics = await probeMetrics(probe.id);
  if (!metrics.ok || metrics.route_probe_id !== probe.id) {
    harness.fail(`probe_route_${probe.id}`, JSON.stringify(metrics));
  }

  const primaryPath = path.join(FULL_DIR, `${probe.id}.png`);
  const mainSurfacePath = path.join(MAIN_SURFACE_DIR, `${probe.id}_main.png`);
  const detailPath = path.join(DETAIL_DIR, `${probe.id}_detail.png`);
  const primaryDimensions = await capturePng(primaryPath, {
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: metrics.viewport.width, height: metrics.viewport.height, scale: 1 },
  });
  const mainSurfaceDimensions = await capturePng(mainSurfacePath, {
    captureBeyondViewport: false,
    clip: normalizedClip(metrics.mainSurface, metrics.viewport),
  });
  const detailDimensions = await capturePng(detailPath, {
    captureBeyondViewport: false,
    clip: normalizedClip(metrics.detail, metrics.viewport),
  });

  const quality = scoreProbe({
    probe,
    primaryDimensions,
    mainSurfaceDimensions,
    detailDimensions,
    metrics,
    paths: { primary: primaryPath, mainSurface: mainSurfacePath, detail: detailPath },
  });

  const result = {
    probe_id: probe.id,
    route,
    primary_screenshot_path: primaryPath,
    main_surface_screenshot_path: mainSurfacePath,
    detail_screenshot_path: detailPath,
    viewport_width: metrics.viewport.width,
    viewport_height: metrics.viewport.height,
    primary_screenshot_dimensions: primaryDimensions,
    main_surface_screenshot_dimensions: mainSurfaceDimensions,
    detail_screenshot_dimensions: detailDimensions,
    main_surface_bbox: metrics.mainSurface,
    main_surface_area_ratio: quality.main_surface_area_ratio,
    board_visible: metrics.board_visible,
    board_bbox: metrics.board ?? {},
    learning_loop_stage: probe.stage,
    primary_evidence_ready: quality.primary_evidence_ready,
    recommended_for_gemini: quality.recommended_for_gemini,
    recommended_for_chatgpt: quality.recommended_for_chatgpt,
    evidence_quality_score: quality.evidence_quality_score,
    failure_reasons: quality.failure_reasons,
  };

  evidence.screenshots.push(primaryPath, mainSurfacePath, detailPath);
  evidence.probe_results.push(result);
  harness.mark(`probe_evidence_${probe.id}`, quality.primary_evidence_ready ? "pass" : "fail", `${quality.evidence_quality_score}/100`);
  return result;
}

async function captureSheet(htmlPath, pngPath, expectedFigures, stageName) {
  await harness.setViewport({ width: 1600, height: 1200 });
  await harness.browserClient.send("Page.navigate", { url: pathToFileURL(htmlPath).href });
  await harness.waitForPagePredicate(
    stageName,
    (count) => ({ ok: document.querySelectorAll("figure").length === count }),
    10_000,
    expectedFigures,
  );
  const metrics = await harness.evalPage(() => ({
    width: Math.max(1, Math.ceil(document.documentElement.scrollWidth || window.innerWidth || 1)),
    height: Math.max(1, Math.ceil(document.documentElement.scrollHeight || window.innerHeight || 1)),
  }));
  const result = await harness.browserClient.send("Page.captureScreenshot", {
    format: "png",
    optimizeForSpeed: true,
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: metrics.width, height: metrics.height, scale: 1 },
  });
  assertExternalArtifact(pngPath);
  writeFileSync(pngPath, Buffer.from(result.data, "base64"));
  evidence.contact_sheets.push(pngPath);
}

async function createOverviewContactSheet(probeResults) {
  const htmlPath = path.join(CONTACT_OVERVIEW_DIR, "overview_only_contact_sheet.html");
  const pngPath = path.join(CONTACT_OVERVIEW_DIR, "overview_only_contact_sheet.png");
  const figures = probeResults
    .map(
      (probe) => `<figure><img src="${pathToFileURL(probe.main_surface_screenshot_path).href}" /><figcaption>${probe.probe_id}</figcaption></figure>`,
    )
    .join("");
  writeFileSync(
    htmlPath,
    `<!doctype html><html><head><meta charset="utf-8" />
<style>
body { margin: 0; background: #080b12; color: #eef4fb; font: 14px Segoe UI, Arial, sans-serif; }
header { padding: 24px 24px 0; }
h1 { margin: 0 0 6px; font-size: 24px; letter-spacing: 0; }
p { margin: 0 0 18px; color: #f2c572; font-weight: 800; }
main { padding: 24px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
figure { margin: 0; border: 1px solid rgba(221, 234, 247, 0.18); background: #101722; }
img { display: block; width: 100%; }
figcaption { padding: 8px 10px; color: #dce8f5; font-weight: 800; font-size: 12px; }
</style></head><body><header><h1>A20AQ Probe Overview</h1><p>OVERVIEW_ONLY: not primary judge evidence.</p></header><main>${figures}</main></body></html>`,
    "utf8",
  );
  await captureSheet(htmlPath, pngPath, probeResults.length, "overview contact sheet");
  return pngPath;
}

async function createPairwiseSheets(probeResults) {
  const byId = new Map(probeResults.map((probe) => [probe.probe_id, probe]));
  const sheets = [];
  for (const [leftId, rightId] of PAIRS) {
    const left = byId.get(leftId);
    const right = byId.get(rightId);
    if (!left || !right) {
      throw new Error(`Missing pairwise inputs for ${leftId} vs ${rightId}`);
    }
    const name = `${leftId}_vs_${rightId}`;
    const htmlPath = path.join(CONTACT_PAIRWISE_DIR, `${name}.html`);
    const pngPath = path.join(CONTACT_PAIRWISE_DIR, `${name}.png`);
    writeFileSync(
      htmlPath,
      `<!doctype html><html><head><meta charset="utf-8" />
<style>
body { margin: 0; background: #080b12; color: #eef4fb; font: 15px Segoe UI, Arial, sans-serif; }
header { padding: 24px 24px 0; }
h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: 0; }
p { margin: 0 0 18px; color: #aeb9c7; }
main { padding: 24px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
figure { margin: 0; border: 1px solid rgba(221, 234, 247, 0.18); background: #101722; }
img { display: block; width: 100%; }
figcaption { padding: 12px; color: #dce8f5; font-weight: 850; }
</style></head><body><header><h1>${leftId} vs ${rightId}</h1><p>Pairwise comparison only. Two probes maximum.</p></header><main>
<figure><img src="${pathToFileURL(left.main_surface_screenshot_path).href}" /><figcaption>${leftId}</figcaption></figure>
<figure><img src="${pathToFileURL(right.main_surface_screenshot_path).href}" /><figcaption>${rightId}</figcaption></figure>
</main></body></html>`,
      "utf8",
    );
    await captureSheet(htmlPath, pngPath, 2, `pairwise ${name}`);
    sheets.push({ pair: [leftId, rightId], path: pngPath, max_probe_count: 2, use: "comparison_only" });
  }
  return sheets;
}

function runPowerShellScript(script, args) {
  if (!existsSync(script)) {
    return { status: "SKIPPED_SCRIPT_MISSING", script };
  }
  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, ...args],
    { cwd: PROJECT_ROOT, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`${path.basename(script)} failed: ${result.stdout}\n${result.stderr}`);
  }
  return {
    status: "PASS",
    script,
    stdout: result.stdout.trim().slice(0, 4000),
  };
}

async function main() {
  try {
    await harness.startBackendWithTempDb();
    await harness.startFrontendVite();
    await harness.startBrowser("/app");
    await harness.setViewport({ width: 1440, height: 940 });
    await harness.loadApp();
    await harness.assertMainNavExactly3();

    await navigate(DEV_GALLERY_ROUTE, "gallery route");
    await harness.waitForPagePredicate(
      "gallery visible",
      () => ({ ok: Boolean(document.querySelector('[data-testid="signature-probe-gallery"]')) }),
      30_000,
    );

    const probeResults = [];
    for (const probe of PROBES) {
      probeResults.push(await captureProbe(probe));
    }

    const overviewContactSheet = await createOverviewContactSheet(probeResults);
    const pairwiseSheets = await createPairwiseSheets(probeResults);
    const manifest = {
      schema_version: "visual_evidence_manifest_v1",
      mission_id: MISSION_ID,
      status: "VISUAL_EVIDENCE_CAPTURED",
      created_at: new Date().toISOString(),
      artifact_path: EVIDENCE_DIR,
      overview_contact_sheet: {
        path: overviewContactSheet,
        use: "OVERVIEW_ONLY",
        primary_evidence_allowed: false,
      },
      pairwise_sheets: pairwiseSheets,
      probes: probeResults,
      screenshots_committed: false,
      qa_artifacts_committed: false,
      normal_app_route_unchanged: true,
      a21_launched: false,
      night_mode_launched: false,
    };
    writeJson(evidence.evidence_manifest_path, manifest);

    const qualityReport = {
      mission_id: MISSION_ID,
      probe_count: probeResults.length,
      judge_ready_count: probeResults.filter((probe) => probe.primary_evidence_ready).length,
      average_quality_score: Number(
        (
          probeResults.reduce((sum, probe) => sum + probe.evidence_quality_score, 0) / probeResults.length
        ).toFixed(2),
      ),
      weak_probes: probeResults
        .filter((probe) => !probe.primary_evidence_ready)
        .map((probe) => ({ probe_id: probe.probe_id, failure_reasons: probe.failure_reasons })),
    };
    writeJson(evidence.screenshot_quality_report_path, qualityReport);
    writeJson(evidence.visual_pixel_budget_report_path, {
      mission_id: MISSION_ID,
      status: qualityReport.weak_probes.length === 0 ? "VISUAL_PIXEL_BUDGET_PASS" : "VISUAL_PIXEL_BUDGET_FAIL",
      checked_at: new Date().toISOString(),
      rules: [
        "primary_width_ge_1200",
        "primary_height_ge_800",
        "main_surface_width_ge_700",
        "main_surface_height_ge_450",
        "main_surface_area_ratio_ge_0_35",
        "board_width_ge_360_when_visible",
        "contact_sheet_not_primary",
        "pairwise_max_2",
      ],
      weak_probes: qualityReport.weak_probes,
    });

    const packetBuilder = runPowerShellScript(path.join(PROJECT_ROOT, "ops", "autopilot", "build_visual_evidence_packets.ps1"), [
      "-ManifestPath",
      evidence.evidence_manifest_path,
      "-OutDir",
      JUDGE_PACKET_DIR,
    ]);
    const triage = runPowerShellScript(path.join(PROJECT_ROOT, "ops", "autopilot", "local_visual_evidence_triage.ps1"), [
      "-ManifestPath",
      evidence.evidence_manifest_path,
      "-OutPath",
      evidence.local_triage_result_path,
    ]);

    evidence.packet_builder = packetBuilder.status;
    evidence.local_triage = triage.status;
    evidence.final_status =
      qualityReport.weak_probes.length === 0 ? "PERCEPTION_GRADE_EVIDENCE_CAPTURE_PASS" : "PERCEPTION_EVIDENCE_CAPTURE_PARTIAL";
    evidence.completed_at = new Date().toISOString();
    writeJson(path.join(EVIDENCE_DIR, "manifest.json"), {
      mission_id: MISSION_ID,
      status: evidence.final_status,
      artifact_path: EVIDENCE_DIR,
      evidence_manifest_path: evidence.evidence_manifest_path,
      overview_contact_sheet: overviewContactSheet,
      pairwise_sheet_count: pairwiseSheets.length,
      probe_count: probeResults.length,
      screenshots_committed: false,
      qa_artifacts_committed: false,
      private_urls_committed: false,
      secrets_committed: false,
    });
    writeConsoleLog();
    harness.writeEvidence();
  } catch (error) {
    evidence.final_status = "PERCEPTION_GRADE_EVIDENCE_CAPTURE_FAIL";
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
