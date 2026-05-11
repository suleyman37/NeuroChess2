#!/usr/bin/env node
import {
  assertDesktopSafetyText,
  captureDesktopNorthStar,
  createDesktopNorthStarHarness,
  openDesktopVision,
} from "./browser_v2_product_vision_desktop_north_star_helpers.mjs";

const { evidence, harness } = createDesktopNorthStarHarness("browser_v2_product_vision_desktop_profile_toggles_smoke");

async function main() {
  try {
    await openDesktopVision(harness);
    await harness.clickByTestId("v2-vision-open-profile", { afterMs: 240 });
    await harness.assertPageContains("profile_switch_copy", [
      "Animations du board",
      "Sons de déplacement",
      "Rappels doux",
      "Masquer l'évaluation",
      "Exporter mes données",
      "Supprimer mes données",
    ]);
    const result = await harness.evalPage(() => {
      const profile = document.querySelector('[data-testid="v2-vision-profile"]');
      const buttons = [...(profile?.querySelectorAll("button") ?? [])]
        .map((button) => button.textContent?.replace(/\s+/g, " ").trim() ?? "")
        .filter(Boolean);
      const onOffButtons = buttons.filter((label) => label === "On" || label === "Off");
      const switches = [...(profile?.querySelectorAll('[role="switch"].v2-vision-switch') ?? [])];
      const danger = profile?.querySelector(".v2-vision-danger");
      return {
        ok:
          onOffButtons.length === 0 &&
          switches.length >= 4 &&
          switches.every((button) => button.getAttribute("aria-checked") !== null) &&
          Boolean(danger) &&
          danger?.classList.contains("v2-vision-danger-subtle") &&
          !danger?.classList.contains("v2-vision-primary"),
        onOffButtons,
        switchCount: switches.length,
        dangerClass: danger?.className ?? "",
      };
    });
    if (!result.ok) {
      harness.fail("profile_toggles_compact_no_on_off_duplicates", JSON.stringify(result));
    }
    harness.mark("profile_toggles_compact_no_on_off_duplicates", "pass", `${result.switchCount} switches`);
    await captureDesktopNorthStar(harness, evidence, "profile_toggles_desktop");
    await assertDesktopSafetyText(harness);
  } finally {
    await harness.cleanupProcesses();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
