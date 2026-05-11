#!/usr/bin/env node
import {
  assertSafeDesktopLanguage,
  captureDesktopComposition,
  createDesktopCompositionHarness,
  openDesktopCompositionVision,
} from "./browser_v2_product_vision_desktop_composition_helpers.mjs";

const { evidence, harness } = createDesktopCompositionHarness("browser_v2_product_vision_desktop_header_presentation_smoke");

async function main() {
  try {
    await openDesktopCompositionVision(harness, { viewport: { width: 1366, height: 768, mobile: false } });
    const result = await harness.evalPage(() => {
      const normalize = (value) =>
        String(value ?? "")
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .replace(/\s+/g, " ")
          .trim();
      const header = document.querySelector('[data-testid="v2-vision-header"]');
      const navButtons = [...document.querySelectorAll('[data-testid="v2-vision-main-nav"] button')];
      const navLabels = navButtons.map((button) => normalize(button.textContent));
      const nav = document.querySelector('[data-testid="v2-vision-main-nav"]');
      const exit = document.querySelector('[data-testid="v2-vision-exit"]');
      const exitStyle = exit ? window.getComputedStyle(exit) : null;
      const headerStyle = header ? window.getComputedStyle(header) : null;
      const headerBox = header?.getBoundingClientRect();
      const text = header?.textContent ?? "";
      const secondaryLabels = [...document.querySelectorAll(".v2-vision-header-actions button")]
        .map((button) => normalize(button.textContent));
      return {
        navLabels,
        secondaryLabels,
        headerHeight: Math.round(headerBox?.height ?? 0),
        headerBackground: headerStyle?.backgroundImage ?? "",
        exitClass: exit?.className ?? "",
        exitOpacity: exitStyle?.opacity ?? "",
        text,
        mainNavButtonCount: navButtons.length,
        navAria: nav?.getAttribute("aria-label") ?? "",
      };
    });
    const strictOk =
      result.navLabels.join("|") === "Aujourd'hui|Mes parties|Entrainement" &&
      result.secondaryLabels.includes("Progression") &&
      result.secondaryLabels.some((label) => label.startsWith("Profil")) &&
      result.text.includes("Prototype") &&
      result.text.includes("Retour V1") &&
      !/DEV-only|V2 Vision/i.test(result.text) &&
      result.exitOpacity !== "" &&
      Number(result.exitOpacity) <= 0.8 &&
      result.headerHeight <= 96 &&
      result.mainNavButtonCount === 3;
    if (!strictOk) {
      harness.fail("desktop_header_product_presentation", JSON.stringify(result));
    }
    harness.mark("desktop_header_product_presentation", "pass", result.navLabels.join(" / "));
    await captureDesktopComposition(harness, evidence, "header_presentation_desktop", "1366x768");
    await assertSafeDesktopLanguage(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
