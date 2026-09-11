import { expect, test, type Locator, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

import { accountFor, deleteAccountThroughProduct, provisionAccount } from "./support/journey.js";

const narrowViewport = { width: 320, height: 900 } as const;
const wideViewport = { width: 1_440, height: 1_000 } as const;

async function reachWithKeyboard(page: Page, target: Locator): Promise<boolean> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

  for (let press = 0; press < 20; press += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) return true;
  }
  return false;
}

test("the Evals table scroll region remains keyboard accessible at 320px", async ({
  page
}, testInfo) => {
  const account = accountFor(testInfo, "evals-scroll-region");

  try {
    await provisionAccount(page, account);
    await page.setViewportSize(narrowViewport);
    await page.goto("/app/evals");

    const heading = page.getByRole("heading", { name: "Provider capability matrix" });
    const card = page.locator("section.mission-card").filter({ has: heading });
    const scrollRegion = card.locator(":scope > .table-scroll");
    const table = scrollRegion.getByRole("table");

    await expect(heading).toBeVisible();
    await expect(table).toBeVisible();
    expect(
      await scrollRegion.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth
      }))
    ).toMatchObject({ clientWidth: expect.any(Number), scrollWidth: expect.any(Number) });
    expect(await scrollRegion.evaluate((element) => element.scrollWidth)).toBeGreaterThan(
      await scrollRegion.evaluate((element) => element.clientWidth)
    );

    const accessibility = await new AxeBuilder({ page })
      .withRules(["scrollable-region-focusable"])
      .analyze();
    expect(
      accessibility.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes.map((node) => node.target)
      }))
    ).toEqual([]);

    expect(await reachWithKeyboard(page, scrollRegion)).toBe(true);
    await expect(scrollRegion).toBeFocused();
    const focusStyle = await scrollRegion.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth)
      };
    });
    expect(focusStyle.outlineStyle).not.toBe("none");
    expect(focusStyle.outlineWidth).toBeGreaterThan(0);

    const startingScrollLeft = await scrollRegion.evaluate((element) => element.scrollLeft);
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => scrollRegion.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(startingScrollLeft);

    await page.setViewportSize(wideViewport);
    await page.goto("/app/evals");
    await expect(page.getByRole("heading", { name: "Provider capability matrix" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    ).toBe(true);
  } finally {
    await deleteAccountThroughProduct(page, account);
  }
});
