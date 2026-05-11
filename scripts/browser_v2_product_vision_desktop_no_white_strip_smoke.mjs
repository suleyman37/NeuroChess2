#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  createDesktopCompositionHarness,
  openCompositionDecisionLab,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_no_white_strip_smoke");

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    await openCompositionDecisionLab(harness);
    await harness.clickByTestId("v2-vision-mode-replay", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 180 });
    await harness.clickByTestId("v2-vision-replay-primary", { afterMs: 180 });
    const result = await harness.evalPage(() => {
      window.scrollTo(0, 0);
      const isWhite = (value) => {
        const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (!match) return false;
        return Number(match[1]) > 240 && Number(match[2]) > 240 && Number(match[3]) > 240;
      };
      const sample = [];
      for (const y of [4, 18, 42, 72, 108]) {
        for (const x of [24, Math.round(window.innerWidth / 2), window.innerWidth - 24]) {
          const element = document.elementFromPoint(x, y);
          const chain = [];
          let current = element;
          while (current && chain.length < 5) {
            const style = window.getComputedStyle(current);
            chain.push({
              tag: current.tagName,
              className: String(current.className ?? ""),
              background: style.backgroundColor,
            });
            current = current.parentElement;
          }
          sample.push({ x, y, tag: element?.tagName ?? "", className: String(element?.className ?? ""), chain });
        }
      }
      const whiteHits = sample.filter((point) => point.chain.some((item) => isWhite(item.background)));
      const topElements = sample.map((point) => `${point.tag}.${point.className}`.slice(0, 120));
      return {
        ok:
          window.scrollY === 0 &&
          Boolean(document.querySelector('[data-testid="v2-vision-app"]')) &&
          whiteHits.length === 0 &&
          sample.every((point) => !["HTML", "BODY"].includes(point.tag)),
        scrollY: window.scrollY,
        whiteHits,
        topElements,
      };
    });
    if (!result.ok) {
      harness.fail("no_white_strip_feedback_success", JSON.stringify(result));
    }
    harness.mark("no_white_strip_feedback_success", "pass", `scrollY=${result.scrollY}`);
    await assertSafeDesktopLanguage(harness, "no_white_strip_safe_language");
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
