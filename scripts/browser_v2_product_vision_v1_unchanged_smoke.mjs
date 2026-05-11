#!/usr/bin/env node
import { createProductVisionHarness } from "./browser_v2_product_vision_helpers.mjs";

const { harness } = createProductVisionHarness("browser_v2_product_vision_v1_unchanged_smoke");

async function main() {
  try {
    await harness.startBackendWithTempDb();
    await harness.startFrontendVite();
    await harness.startBrowser("/app");
    await harness.setViewport({ width: 1366, height: 768 });
    await harness.loadApp();
    await harness.assertMainNavExactly3();
    const defaultResult = await harness.evalPage(() => ({
      ok: !document.querySelector('[data-testid="v2-vision-app"]') &&
        !document.body.innerText.includes("NeuroChess V2 Vision"),
      text: document.body?.innerText ?? "",
    }));
    if (!defaultResult.ok) {
      harness.fail("v1_default_has_no_v2_vision", JSON.stringify(defaultResult));
    }
    harness.mark("v1_default_has_no_v2_vision", "pass");
    await harness.browserClient.send("Page.navigate", { url: `${harness.frontendBaseUrl}/app#/v2-vision` });
    await harness.waitForPagePredicate("explicit V2 route works", () => ({
      ok: Boolean(document.querySelector('[data-testid="v2-vision-app"]')),
      text: document.body?.innerText ?? "",
    }));
    harness.mark("explicit_v2_route_works", "pass");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
