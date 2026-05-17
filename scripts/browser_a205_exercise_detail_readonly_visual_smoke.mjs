#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLEAN_CHECKOUT_ROOT = "C:\\Users\\suley\\Documents\\Dev\\NeuroChess2_clean";
const SOURCE_MISSION = "R3E_FORGE_READONLY_PREVIEW_INTEGRATION_V1";
const SCRIPT_NAME = "browser_a205_exercise_detail_readonly_visual_smoke";

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) {
    return "";
  }
  return process.argv[index + 1];
}

function qaRoot() {
  return path.join(
    process.env.USERPROFILE ?? "C:\\Users\\suley",
    "Documents",
    "Dev",
    "NeuroChess_QA_Artifacts",
  );
}

function defaultOutDir() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
  return path.join(qaRoot(), "autopilot", "a20_5_browser_smokes", `${SCRIPT_NAME}_${stamp}`);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function frontendViteExists(rootDir) {
  const viteCommand = process.platform === "win32" ? "vite.cmd" : "vite";
  return existsSync(path.join(rootDir, "frontend", "node_modules", ".bin", viteCommand));
}

function sourceRuntimeRoot() {
  if (frontendViteExists(PROJECT_ROOT)) {
    return PROJECT_ROOT;
  }
  if (existsSync(CLEAN_CHECKOUT_ROOT) && frontendViteExists(CLEAN_CHECKOUT_ROOT)) {
    return CLEAN_CHECKOUT_ROOT;
  }
  return PROJECT_ROOT;
}

function stagePassed(evidence, stage) {
  return evidence.stages?.[stage]?.status === "pass";
}

function copyScreenshots(sourceDir, targetDir) {
  const copied = [];
  for (const file of readdirSync(sourceDir)) {
    if (!file.toLowerCase().endsWith(".png")) {
      continue;
    }
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    copyFileSync(sourcePath, targetPath);
    copied.push({ name: file, path: targetPath });
  }
  return copied;
}

function writeContactSheet(outDir, screenshots) {
  const html = [
    "<!doctype html>",
    "<meta charset=\"utf-8\">",
    "<title>A20.5 Exercise Detail Read-Only Visual Smoke</title>",
    "<style>body{font-family:Arial,sans-serif;margin:24px;background:#111827;color:#f9fafb}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.shot{border:1px solid #374151;padding:12px;background:#1f2937}.shot img{width:100%;height:auto;display:block}.name{font-size:13px;margin-bottom:8px;color:#d1d5db}</style>",
    "<h1>A20.5 Exercise Detail Read-Only Visual Smoke</h1>",
    "<div class=\"grid\">",
    ...screenshots.map((shot) => {
      const relative = path.relative(outDir, shot.path).replace(/\\/g, "/");
      return `<div class="shot"><div class="name">${shot.name}</div><img src="${relative}" alt="${shot.name}"></div>`;
    }),
    "</div>",
  ].join("\n");
  const contactSheetPath = path.join(outDir, "contact_sheet.html");
  writeFileSync(contactSheetPath, `${html}\n`, "utf8");
  return contactSheetPath;
}

function assertSafeSourceEvidence(evidence, screenshots) {
  const requiredStages = [
    "forge_existing_exercise_detected_copy",
    "forge_existing_exercise_detected_network",
    "forge_no_page_crash",
    "smoke_complete",
  ];
  const missing = requiredStages.filter((stage) => !stagePassed(evidence, stage));
  if (missing.length > 0) {
    throw new Error(`source smoke missing required pass stages: ${missing.join(", ")}`);
  }
  const unsafeNetwork = (evidence.network_calls ?? []).filter((entry) =>
    ["POST", "PATCH", "PUT", "DELETE"].includes(String(entry.method ?? "").toUpperCase()),
  );
  if (unsafeNetwork.length > 0) {
    throw new Error(`source smoke used forbidden methods: ${JSON.stringify(unsafeNetwork)}`);
  }
  if (!screenshots.some((shot) => shot.name.includes("existing_exercise_detected"))) {
    throw new Error("source smoke did not produce existing exercise detail screenshot");
  }
}

function main() {
  const outDir = path.resolve(argValue("--out") || defaultOutDir());
  const screenshotDir = path.join(outDir, "screenshots");
  const logDir = path.join(outDir, "logs");
  mkdirSync(screenshotDir, { recursive: true });
  mkdirSync(logDir, { recursive: true });

  const runtimeRoot = sourceRuntimeRoot();
  const sourceScript = path.join(runtimeRoot, "scripts", "browser_rex_forge_readonly_smoke.mjs");
  const sourceRoot = path.join(qaRoot(), SOURCE_MISSION);
  const sourceEvidencePath = path.join(sourceRoot, "browser_evidence", "browser_rex_forge_readonly_smoke.json");
  const sourceScreenshotDir = path.join(sourceRoot, "screenshots");

  const result = spawnSync(process.execPath, [sourceScript], {
    cwd: runtimeRoot,
    encoding: "utf8",
    env: process.env,
    windowsHide: true,
  });
  writeFileSync(path.join(logDir, "source_stdout.log"), result.stdout ?? "", "utf8");
  writeFileSync(path.join(logDir, "source_stderr.log"), result.stderr ?? "", "utf8");
  if (result.status !== 0) {
    throw new Error(`source browser smoke failed with ${result.status}; see ${logDir}`);
  }
  if (!existsSync(sourceEvidencePath) || !existsSync(sourceScreenshotDir)) {
    throw new Error("source browser smoke did not produce expected evidence paths");
  }

  const sourceEvidence = readJson(sourceEvidencePath);
  const screenshots = copyScreenshots(sourceScreenshotDir, screenshotDir);
  assertSafeSourceEvidence(sourceEvidence, screenshots);
  const contactSheetPath = writeContactSheet(outDir, screenshots);
  const visualBriefPath = path.join(outDir, "visual_review_brief.json");
  const visualBrief = {
    surface: "A20.5 existing exercise detail read-only browser smoke",
    state: "fixture-backed existing UI, no product writes",
    desktop_target: "1366px desktop read-only exercise detail evidence",
    product_intent: "Verify the existing read-only exercise detail/Forge state is visually clear and truthful.",
    must_be_true: [
      "read-only state is clear",
      "existing exercise is detected without claiming a new Practice session",
      "no fake XP/rank/Transfer claim",
      "no unsafe Train now CTA",
    ],
    must_not_happen: ["fake Practice ready", "XP/rank/Transfer", "fake neuroscience", "fake Elo"],
    north_star_question: "Does this visual evidence preserve trustworthy review-to-exercise handoff without fake progress?",
    expected_visual_verdict: "PASS_VISUAL",
    screenshot_paths: screenshots.map((shot) => shot.path),
  };
  writeFileSync(visualBriefPath, `${JSON.stringify(visualBrief, null, 2)}\n`, "utf8");

  const summary = {
    schema: "A20_5_BROWSER_SMOKE_VISUAL/1",
    status: "PASS",
    runtime_root: runtimeRoot,
    source_script: sourceScript,
    source_evidence_path: sourceEvidencePath,
    screenshot_paths: screenshots.map((shot) => shot.path),
    contact_sheet_path: contactSheetPath,
    visual_review_brief_path: visualBriefPath,
    forbidden_methods_seen: [],
    product_mission_executed: false,
    frontend_modified: false,
    backend_modified: false,
  };
  const summaryPath = path.join(outDir, "browser_a205_exercise_detail_readonly_visual_smoke.json");
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(`PASS ${SCRIPT_NAME} evidence=${summaryPath}`);
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
