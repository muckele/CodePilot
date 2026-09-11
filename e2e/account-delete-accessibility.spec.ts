import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { accountFor, cleanupSyntheticAccount, provisionAccount } from "./support/journey.js";

interface RgbColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

function parseRgb(value: string): RgbColor {
  const channels = value.match(/\d+(?:\.\d+)?/gu)?.map(Number);
  const [red, green, blue] = channels ?? [];
  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error(`Expected an RGB color, received ${value}.`);
  }
  return { red, green, blue };
}

function relativeLuminance(color: RgbColor): number {
  const linearize = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return (
    linearize(color.red) * 0.2126 + linearize(color.green) * 0.7152 + linearize(color.blue) * 0.0722
  );
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(parseRgb(foreground));
  const backgroundLuminance = relativeLuminance(parseRgb(background));
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

test("the enabled account-deletion action remains readable after password validation fails", async ({
  page
}, testInfo) => {
  const account = accountFor(testInfo, "delete-action-contrast");

  try {
    await provisionAccount(page, account, {
      themePreference: "dark",
      motionPreference: "reduced"
    });
    await page.goto("/app/account/delete");

    await page.getByLabel("Current password", { exact: true }).fill("Not the current password!47");
    await page.getByLabel("Type DELETE to confirm", { exact: true }).fill("DELETE");
    const deleteAction = page.getByRole("button", { name: "Permanently delete my account" });
    await expect(deleteAction).toBeEnabled();
    await deleteAction.click();

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toBeFocused();
    await expect(deleteAction).toBeEnabled();

    const accessibility = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    expect(
      accessibility.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes.map((node) => node.target)
      }))
    ).toEqual([]);

    const colors = await deleteAction.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return { foreground: style.color, background: style.backgroundColor };
    });
    expect(contrastRatio(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
  } finally {
    await cleanupSyntheticAccount(account);
  }
});
