#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = new Map();
  for (let index = 2; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      throw new Error(`Unexpected argument: ${item}`);
    }
    const key = item.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args.set(key, value);
    index += 1;
  }
  return args;
}

function requireArg(args, name) {
  const value = args.get(name);
  if (!value) {
    throw new Error(`Missing required --${name}`);
  }
  return value;
}

function normalizePath(filePath) {
  return path.resolve(filePath);
}

function listPngs(rootDir) {
  if (!rootDir || !existsSync(rootDir)) {
    return [];
  }
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
        found.push(normalizePath(fullPath));
      }
    }
  };
  walk(rootDir);
  return found.sort((a, b) => a.localeCompare(b));
}

function screenshotPathsFromEvidence(evidence) {
  const screenshots = Array.isArray(evidence.screenshots) ? evidence.screenshots : [];
  return screenshots
    .map((item) => (typeof item === "string" ? item : item?.path))
    .filter(Boolean)
    .map(normalizePath);
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function buildMarkdown({ evidencePath, screenshots, manifestPath, briefPath, surface }) {
  const lines = [
    "# A19X Visual Contact Sheet",
    "",
    `Surface: ${surface}`,
    `Evidence JSON: ${evidencePath}`,
    `Manifest: ${manifestPath}`,
    `Visual review brief: ${briefPath}`,
    "",
    "## Screenshots",
    "",
  ];
  screenshots.forEach((screenshot, index) => {
    lines.push(`### ${index + 1}. ${path.basename(screenshot)}`);
    lines.push("");
    lines.push(`Path: ${screenshot}`);
    lines.push(`![${path.basename(screenshot)}](${screenshot})`);
    lines.push("");
  });
  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv);
  const evidencePath = normalizePath(requireArg(args, "evidence"));
  const outDir = normalizePath(requireArg(args, "out-dir"));
  const screenshotDir = args.get("screenshots-dir") ? normalizePath(args.get("screenshots-dir")) : "";
  const surface = args.get("surface") ?? "Forge read-only visual proof";
  const state = args.get("state") ?? "existing read-only browser smoke";

  if (!existsSync(evidencePath)) {
    throw new Error(`Evidence JSON not found: ${evidencePath}`);
  }
  mkdirSync(outDir, { recursive: true });

  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  const screenshots = unique([
    ...screenshotPathsFromEvidence(evidence),
    ...listPngs(screenshotDir),
  ]).filter((screenshot) => existsSync(screenshot));

  if (screenshots.length === 0) {
    throw new Error("No screenshots found in evidence or screenshot directory.");
  }

  const manifestPath = path.join(outDir, "a19x_visual_contact_manifest.json");
  const briefPath = path.join(outDir, "a19x_visual_review_brief.json");
  const contactSheetPath = path.join(outDir, "a19x_visual_contact_sheet.md");

  const manifest = {
    schema: "NC_A19X_VISUAL_CONTACT_SHEET/1",
    surface,
    state,
    source_evidence_path: evidencePath,
    screenshot_count: screenshots.length,
    screenshot_paths: screenshots,
    evidence_marks: Array.isArray(evidence.marks) ? evidence.marks : [],
    forbidden_ui_claims_detected: Array.isArray(evidence.forbidden_visible)
      ? evidence.forbidden_visible.length > 0
      : false,
    generated_paths: {
      manifest: manifestPath,
      contact_sheet: contactSheetPath,
      visual_review_brief: briefPath,
    },
  };

  const brief = {
    surface,
    state,
    desktop_target: "1366px and wider desktop browser",
    product_intent: "Verify that the existing Forge read-only surface has inspectable desktop screenshot evidence.",
    must_be_true: [
      "Screenshots come from an existing read-only browser smoke.",
      "Generated artifacts stay outside the repository.",
      "No product source file is changed by this helper.",
    ],
    must_not_happen: [
      "Unsafe readiness claims.",
      "Fake progress claims.",
      "Mobile-first cramped primary layout.",
      "Decorative motion without learning purpose.",
    ],
    north_star_question:
      "Does this visual evidence make the player-facing review path easier to trust before branch review?",
    expected_visual_verdict: "PASS_VISUAL",
    screenshot_paths: screenshots,
  };

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  writeFileSync(briefPath, `${JSON.stringify(brief, null, 2)}\n`, "utf8");
  writeFileSync(contactSheetPath, buildMarkdown({ evidencePath, screenshots, manifestPath, briefPath, surface }), "utf8");

  console.log(JSON.stringify({
    status: "PASS",
    manifest_path: manifestPath,
    contact_sheet_path: contactSheetPath,
    visual_review_brief_path: briefPath,
    screenshot_count: screenshots.length,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", error: error.message }, null, 2));
  process.exitCode = 1;
}
