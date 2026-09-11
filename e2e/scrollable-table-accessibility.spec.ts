import { expect, test, type Locator, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

import { accountFor, deleteAccountThroughProduct, provisionAccount } from "./support/journey.js";

const narrowViewport = { width: 320, height: 900 } as const;
const wideViewport = { width: 1_440, height: 1_000 } as const;

async function reachWithKeyboard(page: Page, target: Locator): Promise<boolean> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

  for (let press = 0; press < 60; press += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) return true;
  }
  return false;
}

async function expectHorizontalScrollRegionAccessible(page: Page, scrollRegion: Locator) {
  await expect(scrollRegion).toBeVisible();
  const dimensions = await scrollRegion.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);

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
}

async function expectWideLayout(page: Page, route: string, heading: string) {
  await page.setViewportSize(wideViewport);
  await page.goto(route);
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  ).toBe(true);
}

test("Journey Map scroll regions remain keyboard accessible at 320px", async ({
  page
}, testInfo) => {
  const account = accountFor(testInfo, "journey-map-scroll-region");

  try {
    await provisionAccount(page, account);
    await page.setViewportSize(narrowViewport);

    for (const [route, heading] of [
      ["/app/today", "Today’s mission"],
      ["/app/roadmap", "The whole mountain stays visible."]
    ] as const) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      const scrollRegion = page.locator("figure.journey-map");
      await expect(scrollRegion).toHaveJSProperty("tagName", "FIGURE");
      await expect(page.getByRole("img", { name: "Journey Map" })).toBeVisible();
      await expectHorizontalScrollRegionAccessible(page, scrollRegion);
    }

    await expectWideLayout(page, "/app/today", "Today’s mission");
  } finally {
    await deleteAccountThroughProduct(page, account);
  }
});

test("Skill Constellation remains keyboard accessible at 320px", async ({ page }, testInfo) => {
  const account = accountFor(testInfo, "skill-constellation-scroll-region");

  try {
    await provisionAccount(page, account);
    await page.setViewportSize(narrowViewport);
    await page.goto("/app/skills");

    await expect(
      page.getByRole("heading", { name: "Mastery is more than completion." })
    ).toBeVisible();
    const scrollRegion = page.locator("figure.skill-constellation");
    await expect(scrollRegion).toHaveJSProperty("tagName", "FIGURE");
    await expect(page.getByRole("img", { name: "Skill Constellation" })).toBeVisible();
    await expectHorizontalScrollRegionAccessible(page, scrollRegion);

    await expectWideLayout(page, "/app/skills", "Mastery is more than completion.");
  } finally {
    await deleteAccountThroughProduct(page, account);
  }
});

test("Code Garden remains keyboard accessible at 320px", async ({ page }, testInfo) => {
  const account = accountFor(testInfo, "code-garden-scroll-region");

  try {
    await provisionAccount(page, account);
    await page.setViewportSize(narrowViewport);
    await page.goto("/app/portfolio");

    await expect(
      page.getByRole("heading", { name: "Grow the story from real evidence." })
    ).toBeVisible();
    const scrollRegion = page.getByRole("img", { name: "Code Garden portfolio visualization" });
    await expect(scrollRegion).toHaveJSProperty("tagName", "DIV");
    await expectHorizontalScrollRegionAccessible(page, scrollRegion);

    await expectWideLayout(page, "/app/portfolio", "Grow the story from real evidence.");
  } finally {
    await deleteAccountThroughProduct(page, account);
  }
});

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
    await expectHorizontalScrollRegionAccessible(page, scrollRegion);

    await expectWideLayout(page, "/app/evals", "Provider capability matrix");
    await expect(page.getByRole("table")).toBeVisible();
  } finally {
    await deleteAccountThroughProduct(page, account);
  }
});
