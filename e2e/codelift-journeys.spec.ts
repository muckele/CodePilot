import { writeFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

import { issueE2eInvitation, userOwnedCounts } from "./support/database.js";
import { E2E_BASE_URL } from "./support/environment.js";
import {
  accountFor,
  completeMission,
  dashboard,
  cleanupSyntheticAccount,
  isoDateDaysAgo,
  provisionAccount,
  recordUnexpectedBrowserErrors,
  registerAndOnboardWithKeyboard,
  responseJson
} from "./support/journey.js";

const browserErrors = new WeakMap<Page, string[]>();

async function expectNoCriticalAccessibilityViolations(page: Page, route: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target)
    })),
    `${route} accessibility violations`
  ).toEqual([]);
}

async function horizontalOverflowMeasurement(page: Page) {
  return page.evaluate(() => {
    const round = (value: number) => Math.round(value * 100) / 100;
    const root = document.documentElement;
    const body = document.body;
    const viewportWidth = window.innerWidth;
    const isHorizontallyClippedByAncestor = (element: HTMLElement) => {
      const elementRectangle = element.getBoundingClientRect();
      let ancestor = element.parentElement;
      while (ancestor !== null && ancestor !== body) {
        const ancestorStyle = window.getComputedStyle(ancestor);
        if (["auto", "scroll", "hidden", "clip"].includes(ancestorStyle.overflowX)) {
          const ancestorRectangle = ancestor.getBoundingClientRect();
          if (
            elementRectangle.left < ancestorRectangle.left - 1 ||
            elementRectangle.right > ancestorRectangle.right + 1
          ) {
            return true;
          }
        }
        ancestor = ancestor.parentElement;
      }
      return false;
    };
    const visibleElements = [...body.querySelectorAll<HTMLElement>("*")].filter((element) => {
      if (element.closest('[aria-hidden="true"]') !== null) return false;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rectangle = element.getBoundingClientRect();
      return (
        rectangle.width > 0 && rectangle.height > 0 && !isHorizontallyClippedByAncestor(element)
      );
    });
    const visibleBounds = visibleElements.map((element) => {
      const rectangle = element.getBoundingClientRect();
      const selector = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${
        typeof element.className === "string" && element.className.trim().length > 0
          ? `.${element.className.trim().split(/\s+/u).join(".")}`
          : ""
      }`;
      return {
        selector,
        left: round(rectangle.left),
        right: round(rectangle.right),
        width: round(rectangle.width)
      };
    });
    return {
      viewportWidth,
      rootClientWidth: root.clientWidth,
      rootScrollWidth: root.scrollWidth,
      bodyClientWidth: body.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      documentOverflowPixels: Math.max(0, root.scrollWidth - root.clientWidth),
      bodyOverflowPixels: Math.max(0, body.scrollWidth - body.clientWidth),
      minimumVisibleLeft: Math.min(0, ...visibleBounds.map(({ left }) => left)),
      maximumVisibleRight: Math.max(viewportWidth, ...visibleBounds.map(({ right }) => right)),
      horizontalScrollRegions: [...body.querySelectorAll<HTMLElement>("*")]
        .filter((element) => {
          const style = window.getComputedStyle(element);
          return (
            ["auto", "scroll"].includes(style.overflowX) &&
            element.scrollWidth > element.clientWidth + 1
          );
        })
        .map((element) => ({
          selector: `${element.tagName.toLowerCase()}${
            typeof element.className === "string" && element.className.trim().length > 0
              ? `.${element.className.trim().split(/\s+/u).join(".")}`
              : ""
          }`,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth
        })),
      visibleOffenders: visibleBounds
        .filter(({ left, right }) => left < -1 || right > viewportWidth + 1)
        .slice(0, 12)
    };
  });
}

async function themeMeasurement(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const rootStyle = window.getComputedStyle(root);
    const bodyStyle = window.getComputedStyle(document.body);
    return {
      persistedTheme: root.dataset.theme ?? null,
      colorScheme: rootStyle.colorScheme,
      canvasToken: rootStyle.getPropertyValue("--color-canvas").trim(),
      inkToken: rootStyle.getPropertyValue("--color-ink").trim(),
      bodyColor: bodyStyle.color,
      bodyBackgroundImage: bodyStyle.backgroundImage
    };
  });
}

async function motionMeasurement(page: Page) {
  return page.evaluate(() => {
    const durationMs = (value: string) =>
      Math.max(
        ...value.split(",").map((duration) => {
          const trimmed = duration.trim();
          return trimmed.endsWith("ms")
            ? Number.parseFloat(trimmed)
            : Number.parseFloat(trimmed) * 1_000;
        })
      );
    const root = document.documentElement;
    const animatedMarker = document.querySelector<HTMLElement>(".backdrop-star");
    if (animatedMarker === null) throw new Error("The visual motion marker is missing.");
    const markerStyle = window.getComputedStyle(animatedMarker);
    return {
      mediaMatches: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      persistedMotion: root.dataset.motion ?? null,
      rootScrollBehavior: window.getComputedStyle(root).scrollBehavior,
      animationName: markerStyle.animationName,
      animationDurationMs: durationMs(markerStyle.animationDuration),
      animationIterationCount: markerStyle.animationIterationCount,
      transitionDurationMs: durationMs(markerStyle.transitionDuration)
    };
  });
}

async function captureVisualEvidence(
  page: Page,
  testInfo: Parameters<typeof accountFor>[0],
  name: string,
  viewport: { readonly width: number; readonly height: number }
) {
  await page.setViewportSize(viewport);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const layout = await horizontalOverflowMeasurement(page);
  const screenshotPath = testInfo.outputPath(`${name}.png`);
  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
    animations: "disabled"
  });
  await testInfo.attach(name, { path: screenshotPath, contentType: "image/png" });
  return { name, viewport, layout, screenshot: `${name}.png` };
}

test.beforeEach(async ({ page }) => {
  browserErrors.set(page, recordUnexpectedBrowserErrors(page));
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([]);
});

test("1. register → onboard → Day 1 → Core evidence/reflection → completion → XP", async ({
  page
}, testInfo) => {
  const account = accountFor(testInfo, "core");
  try {
    await registerAndOnboardWithKeyboard(page, account);
    await expect(page.getByText("Day 1 of 365", { exact: true })).toBeVisible();
    await completeMission(page, "core");

    const snapshot = await dashboard(page);
    expect(snapshot.summary).toMatchObject({
      currentDayNumber: 2,
      coreCompletions: 1,
      recoveryWins: 0,
      xp: 30
    });

    await page.getByRole("button", { name: "Open the next useful step" }).click();
    await expect(page.getByText("Day 2 of 365", { exact: true })).toBeVisible();
    await expect(page.getByText("30 XP", { exact: true })).toBeVisible();
  } finally {
    await cleanupSyntheticAccount(account);
  }
});

test("2. a missed calendar day keeps the next incomplete curriculum day", async ({
  page
}, testInfo) => {
  const account = accountFor(testInfo, "missed-day");
  try {
    await provisionAccount(page, account, { startDate: isoDateDaysAgo(3) });
    await page.goto("/app/today");

    await expect(page.getByRole("heading", { name: "Today’s mission" })).toBeVisible();
    await expect(page.getByText("Day 1 of 365", { exact: true })).toBeVisible();
    await expect(
      page.getByText("A calendar gap is not a curriculum gap", { exact: true })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Continue from Day 1." })).toBeVisible();
    await expect(page.getByText(/without skipping a mission\./u)).toBeVisible();

    const snapshot = await dashboard(page);
    expect(snapshot.summary.currentDayNumber).toBe(1);
    expect(snapshot.missedCalendarDays).toBeGreaterThanOrEqual(2);
  } finally {
    await cleanupSyntheticAccount(account);
  }
});

test("3. Recovery remains distinct and uses humane completion feedback", async ({
  page
}, testInfo) => {
  const account = accountFor(testInfo, "recovery");
  try {
    await provisionAccount(page, account);
    await page.goto("/app/today");
    await expect(page.getByRole("heading", { name: "Today’s mission" })).toBeVisible();
    await completeMission(page, "recovery");

    await expect(
      page.getByText("A five-minute return still protects your next step.", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Core mission recorded with evidence." })
    ).toHaveCount(0);
    expect((await dashboard(page)).summary).toMatchObject({
      coreCompletions: 0,
      recoveryWins: 1,
      xp: 5
    });
  } finally {
    await cleanupSyntheticAccount(account);
  }
});

test("4. an unavailable Python provider returns deterministic usable fallback guidance", async ({
  page
}, testInfo) => {
  const account = accountFor(testInfo, "provider-fallback");
  try {
    await provisionAccount(page, account);
    await page.goto("/app/coach");
    await expect(
      page.getByRole("heading", { name: "Generated guidance, honest evidence boundary." })
    ).toBeVisible();
    await page
      .getByLabel("Learner-authored context (optional)", { exact: true })
      .fill("Explain why runtime validation is a trust boundary.");

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/coach/explain") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Generate bounded guidance" }).click();
    const response = await responsePromise;
    const body = await responseJson<{
      readonly provider: string;
      readonly evidenceBoundary: string;
    }>(response, "Coach fallback response");

    expect(body.provider).toBe("fallback");
    expect(body.evidenceBoundary).toContain("does not claim understanding");
    await expect(page.getByText("Generated · fallback", { exact: true })).toBeVisible();
    await expect(page.locator(".coach-output .evidence-boundary")).toContainText(
      "does not claim understanding"
    );
  } finally {
    await cleanupSyntheticAccount(account);
  }
});

test("5. a private note answer is grounded and every citation resolves", async ({
  page
}, testInfo) => {
  const account = accountFor(testInfo, "rag");
  try {
    await provisionAccount(page, account);
    await page.goto("/app/search");
    await expect(
      page.getByRole("heading", { name: "Ask your notes, then inspect the citations." })
    ).toBeVisible();

    const sourceTitle = "Runtime validation boundary";
    await page.getByLabel("Title", { exact: true }).fill(sourceTitle);
    await page.getByLabel("Day (optional)", { exact: true }).fill("1");
    await page
      .getByLabel("Note", { exact: true })
      .fill(
        "Runtime validation keeps network values unknown until a schema proves every required field. A malformed response must become a visible error state, not invented curriculum."
      );
    await page.getByRole("button", { name: "Index note locally" }).click();
    await expect(
      page.getByText(/chunked, hashed, versioned, embedded, and indexed locally/u)
    ).toBeVisible();
    await expect(page.getByText(sourceTitle, { exact: true })).toBeVisible();

    await page
      .getByLabel("Question", { exact: true })
      .fill("Why keep network values unknown until runtime validation?");
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/search/notes") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Retrieve support" }).click();
    const searchResponse = await responsePromise;
    const answer = await responseJson<{
      readonly abstained: boolean;
      readonly statements: readonly {
        readonly citationChunkIds: readonly string[];
      }[];
      readonly citations: readonly {
        readonly sourceId: string;
        readonly chunkId: string;
        readonly sourceTitle: string;
        readonly excerpt: string;
      }[];
    }>(searchResponse, "RAG answer");
    expect(answer.abstained).toBe(false);
    expect(answer.citations.length).toBeGreaterThan(0);
    const citationChunkIds = new Set(answer.citations.map((citation) => citation.chunkId));
    for (const statement of answer.statements) {
      expect(statement.citationChunkIds.length).toBeGreaterThan(0);
      for (const chunkId of statement.citationChunkIds)
        expect(citationChunkIds.has(chunkId)).toBe(true);
    }

    const sourcesResponse = await page.request.get("/api/v1/notes");
    const sources = await responseJson<{
      readonly sources: readonly { readonly id: string; readonly title: string }[];
    }>(sourcesResponse, "Indexed source lookup");
    for (const citation of answer.citations) {
      expect(sources.sources).toContainEqual(
        expect.objectContaining({ id: citation.sourceId, title: citation.sourceTitle })
      );
      expect(citation.excerpt.length).toBeGreaterThan(20);
    }

    await expect(page.getByText("Source-supported", { exact: true })).toBeVisible();
    await expect(page.locator(".rag-answer").getByText(sourceTitle, { exact: true })).toBeVisible();
  } finally {
    await cleanupSyntheticAccount(account);
  }
});

test("6. two browser users never receive each other’s notes or search results", async ({
  browser,
  page
}, testInfo) => {
  const accountA = accountFor(testInfo, "tenant-a");
  const accountB = accountFor(testInfo, "tenant-b");
  const contextB = await browser.newContext({ baseURL: E2E_BASE_URL });
  const pageB = await contextB.newPage();
  const pageBErrors = recordUnexpectedBrowserErrors(pageB);
  try {
    await provisionAccount(page, accountA);
    await provisionAccount(pageB, accountB);

    await pageB.goto("/app/search");
    const privateTitle = "Private tenant B note";
    const privatePhrase = "lunar-tenant-only-citation-boundary";
    await pageB.getByLabel("Title", { exact: true }).fill(privateTitle);
    await pageB.getByLabel("Day (optional)", { exact: true }).fill("2");
    await pageB
      .getByLabel("Note", { exact: true })
      .fill(`The private phrase ${privatePhrase} must never cross accounts.`);
    await pageB.getByRole("button", { name: "Index note locally" }).click();
    await expect(pageB.getByText(privateTitle, { exact: true })).toBeVisible();

    await page.goto("/app/search");
    await expect(page.getByRole("heading", { name: "Indexed sources" })).toBeVisible();
    await expect(page.getByText(privateTitle, { exact: true })).toHaveCount(0);
    await page.getByLabel("Question", { exact: true }).fill(`What does ${privatePhrase} mean?`);
    const isolatedResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/search/notes") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Retrieve support" }).click();
    const isolatedResponse = await isolatedResponsePromise;
    const isolatedBody = await responseJson<{
      readonly abstained: boolean;
      readonly citations: readonly unknown[];
    }>(isolatedResponse, "Cross-tenant RAG answer");
    expect(isolatedBody.abstained).toBe(true);
    expect(isolatedBody.citations).toEqual([]);
    expect(JSON.stringify(isolatedBody)).not.toContain(privatePhrase);
    await expect(page.getByText("Unsupported / unknown", { exact: true })).toBeVisible();
    expect(pageBErrors).toEqual([]);
  } finally {
    await cleanupSyntheticAccount(accountA);
    await cleanupSyntheticAccount(accountB);
    await contextB.close();
  }
});

test("7. a weekly plan remains read-only until explicit human approval", async ({
  page
}, testInfo) => {
  const account = accountFor(testInfo, "planner");
  try {
    await provisionAccount(page, account);
    await page.goto("/app/planner");
    await expect(
      page.getByRole("heading", { name: "Plan narrowly. Stop before side effects." })
    ).toBeVisible();
    await expect(
      page.getByText("Nothing can schedule or message on your behalf from this state.", {
        exact: true
      })
    ).toBeVisible();

    const taskBefore = await responseJson<{ readonly status: string }>(
      await page.request.get("/api/v1/tasks/1"),
      "Pre-plan task lookup"
    );
    expect(taskBefore.status).toBe("not_started");

    const proposalPromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/planner/week") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Propose a read-only week" }).click();
    const proposal = await responseJson<{
      readonly id: string;
      readonly status: string;
      readonly approvalBehavior: string;
      readonly terminalReason: string;
      readonly actions: readonly unknown[];
    }>(await proposalPromise, "Weekly-plan proposal");
    expect(proposal).toMatchObject({
      status: "awaiting_approval",
      approvalBehavior: "proposal_only",
      terminalReason: "awaiting_human_approval"
    });
    expect(proposal.actions.length).toBeGreaterThan(0);
    await expect(page.getByText(/does not persist these actions as tasks/iu)).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept proposal only" })).toBeVisible();
    expect(
      (
        await responseJson<{ readonly status: string }>(
          await page.request.get("/api/v1/tasks/1"),
          "Awaiting-approval task lookup"
        )
      ).status
    ).toBe("not_started");

    const approvalPromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/v1/planner/${proposal.id}/approve`) &&
        response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Accept proposal only" }).click();
    const approved = await responseJson<{
      readonly status: string;
      readonly approvalBehavior: string;
      readonly terminalReason: string;
      readonly trace: readonly string[];
    }>(await approvalPromise, "Weekly-plan approval");
    expect(approved).toMatchObject({
      status: "approved",
      approvalBehavior: "proposal_only",
      terminalReason: "approved_by_human"
    });
    expect(approved.trace.join(" ")).toContain("no product state or external system was changed");
    await expect(page.getByText(/deterministic workflow · approved/iu)).toBeVisible();
    expect(
      (
        await responseJson<{ readonly status: string }>(
          await page.request.get("/api/v1/tasks/1"),
          "Post-approval proposal-only task lookup"
        )
      ).status
    ).toBe("not_started");
  } finally {
    await cleanupSyntheticAccount(account);
  }
});

test("8. account deletion removes product records and derived indexed chunks", async ({
  page
}, testInfo) => {
  const account = accountFor(testInfo, "deletion");
  const userId = await provisionAccount(page, account);
  await page.goto("/app/search");
  await page.getByLabel("Title", { exact: true }).fill("Deletion cascade browser evidence");
  await page.getByLabel("Day (optional)", { exact: true }).fill("1");
  await page
    .getByLabel("Note", { exact: true })
    .fill(
      "This source and every derived chunk must disappear when the browser deletes the account."
    );
  await page.getByRole("button", { name: "Index note locally" }).click();
  await expect(
    page.getByText(/chunked, hashed, versioned, embedded, and indexed locally/u)
  ).toBeVisible();

  const before = await userOwnedCounts(userId);
  expect(before.user).toBe(1);
  expect(before.sessions).toBeGreaterThan(0);
  expect(before.indexedSources).toBe(1);
  expect(before.indexedChunks).toBeGreaterThan(0);

  await page.goto("/app/account/delete");
  await expect(page.getByRole("heading", { name: "Delete your CodeLift account?" })).toBeVisible();
  await page.getByLabel("Current password", { exact: true }).fill(account.password);
  await page.getByLabel("Type DELETE to confirm", { exact: true }).fill("DELETE");
  const destructiveAction = page.getByRole("button", { name: "Permanently delete my account" });
  await destructiveAction.focus();
  await expect(destructiveAction).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/login\?deleted=1$/u);
  await expect(
    page.getByText("Your CodeLift account data was deleted.", { exact: true })
  ).toBeVisible();
  expect(await userOwnedCounts(userId)).toEqual({
    user: 0,
    sessions: 0,
    userActivities: 0,
    invitations: 0,
    passwordResets: 0,
    progress: 0,
    reflections: 0,
    xpEvents: 0,
    userAchievements: 0,
    skillEvidence: 0,
    reviews: 0,
    misconceptions: 0,
    errors: 0,
    portfolioArtifacts: 0,
    aiTraces: 0,
    evalRuns: 0,
    indexedSources: 0,
    indexedChunks: 0,
    agentRuns: 0,
    jobApplications: 0
  });
  const me = await responseJson<{ readonly authenticated: boolean }>(
    await page.request.get("/api/v1/me"),
    "Post-deletion session lookup"
  );
  expect(me.authenticated).toBe(false);
});

test("9. a stale or invalid session cookie is cleared and protected routing recovers", async ({
  context,
  page
}) => {
  const staleValue = "stale-playwright-session-token";
  await context.addCookies([
    {
      name: "codelift_session",
      value: staleValue,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);

  const mePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/v1/me") && response.request().method() === "GET"
  );
  await page.goto("/app/today");
  const meResponse = await mePromise;
  expect(await meResponse.headerValue("set-cookie")).toContain("Max-Age=0");

  await expect(page).toHaveURL(/\/login\?returnTo=%2Fapp%2Ftoday$/u);
  await expect(
    page.getByRole("heading", { name: "Continue from the next useful step." })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today’s mission" })).toHaveCount(0);
  await expect(page.getByLabel("Email address", { exact: true })).toBeEditable();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "autocomplete",
    "current-password"
  );
  const currentCookies = await context.cookies(E2E_BASE_URL);
  expect(currentCookies.some((cookie) => cookie.value === staleValue)).toBe(false);
});

test("10. release visual and accessibility evidence covers responsive, theme, motion, and focus boundaries", async ({
  page
}, testInfo) => {
  const account = accountFor(testInfo, "visual-accessibility");
  const wideViewport = { width: 1_440, height: 1_000 } as const;
  const exactMobileViewport = { width: 320, height: 900 } as const;

  try {
    await provisionAccount(page, account, {
      themePreference: "light",
      motionPreference: "system"
    });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
    await page.setViewportSize(wideViewport);
    await page.goto("/app/today");

    const heading = page.getByRole("heading", { level: 1, name: "Today’s mission" });
    const main = page.getByRole("main");
    const navigation = page.getByRole("navigation", { name: "Private workspace" });
    const banner = page.getByRole("banner");
    const contentInfo = page.getByRole("contentinfo");
    await expect(heading).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(main).toHaveCount(1);
    await expect(navigation).toBeVisible();
    await expect(banner).toBeVisible();
    await expect(contentInfo).toBeVisible();

    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
    const skipLinkFocus = await skipLink.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        transform: style.transform
      };
    });
    expect(skipLinkFocus.outlineStyle).not.toBe("none");
    expect(Number.parseFloat(skipLinkFocus.outlineWidth)).toBeGreaterThan(0);
    await page.keyboard.press("Enter");
    await expect(main).toBeFocused();
    const missionAction = page.getByRole("button", { name: "Start 30-minute Core mission" });
    await missionAction.focus();
    await expect(missionAction).toBeFocused();

    const normalMotion = await motionMeasurement(page);
    expect(normalMotion).toMatchObject({
      mediaMatches: false,
      persistedMotion: null,
      rootScrollBehavior: "smooth",
      animationName: "breathe-star",
      animationIterationCount: "infinite"
    });
    expect(normalMotion.animationDurationMs).toBeGreaterThanOrEqual(1_000);

    const lightTheme = await themeMeasurement(page);
    expect(lightTheme).toMatchObject({ persistedTheme: "light", colorScheme: "light" });
    const wideLight = await captureVisualEvidence(page, testInfo, "today-wide-light", wideViewport);
    const mobileLight = await captureVisualEvidence(
      page,
      testInfo,
      "today-320-light",
      exactMobileViewport
    );
    expect(wideLight.layout.documentOverflowPixels).toBe(0);
    expect(wideLight.layout.bodyOverflowPixels).toBe(0);
    expect(wideLight.layout.visibleOffenders).toEqual([]);
    expect(mobileLight.layout.viewportWidth).toBe(320);
    expect(mobileLight.layout.rootClientWidth).toBe(320);
    expect(mobileLight.layout.documentOverflowPixels).toBe(0);
    expect(mobileLight.layout.bodyOverflowPixels).toBe(0);
    expect(mobileLight.layout.visibleOffenders).toEqual([]);

    await page.setViewportSize(wideViewport);
    await page.goto("/app/account");
    await expect(
      page.getByRole("heading", { level: 1, name: "Account and preferences" })
    ).toBeVisible();
    await page.getByLabel("Theme", { exact: true }).selectOption("dark");
    await page.getByLabel("Motion", { exact: true }).selectOption("system");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(
      page.getByText("Settings saved. Your next return will use these choices.", { exact: true })
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto("/app/today");
    await expect(heading).toBeVisible();
    const reducedMotion = await motionMeasurement(page);
    expect(reducedMotion).toMatchObject({
      mediaMatches: true,
      persistedMotion: null,
      rootScrollBehavior: "auto",
      animationName: "breathe-star",
      animationIterationCount: "1"
    });
    expect(reducedMotion.animationDurationMs).toBeLessThanOrEqual(0.02);
    expect(reducedMotion.transitionDurationMs).toBeLessThanOrEqual(0.02);

    const darkTheme = await themeMeasurement(page);
    expect(darkTheme).toMatchObject({ persistedTheme: "dark", colorScheme: "dark" });
    expect(darkTheme.canvasToken).not.toBe(lightTheme.canvasToken);
    expect(darkTheme.inkToken).not.toBe(lightTheme.inkToken);
    expect(darkTheme.bodyColor).not.toBe(lightTheme.bodyColor);
    const wideDark = await captureVisualEvidence(
      page,
      testInfo,
      "today-wide-dark-reduced-motion",
      wideViewport
    );
    const mobileDark = await captureVisualEvidence(
      page,
      testInfo,
      "today-320-dark-reduced-motion",
      exactMobileViewport
    );
    expect(wideDark.layout.documentOverflowPixels).toBe(0);
    expect(wideDark.layout.bodyOverflowPixels).toBe(0);
    expect(wideDark.layout.visibleOffenders).toEqual([]);
    expect(mobileDark.layout.viewportWidth).toBe(320);
    expect(mobileDark.layout.rootClientWidth).toBe(320);
    expect(mobileDark.layout.documentOverflowPixels).toBe(0);
    expect(mobileDark.layout.bodyOverflowPixels).toBe(0);
    expect(mobileDark.layout.visibleOffenders).toEqual([]);

    const errors = browserErrors.get(page) ?? [];
    expect(errors).toEqual([]);
    const evidence = {
      version: 1,
      journey: "release-visual-accessibility",
      route: "/app/today",
      accessibility: {
        heading: "Today’s mission",
        h1Count: await page.locator("h1").count(),
        landmarks: {
          banner: await banner.count(),
          navigation: await navigation.count(),
          main: await main.count(),
          contentInfo: await contentInfo.count()
        },
        focus: {
          skipLink: skipLinkFocus,
          skipTarget: "main#main-content",
          missionAction: "Start 30-minute Core mission"
        }
      },
      themes: { light: lightTheme, dark: darkTheme },
      motion: { normal: normalMotion, reduced: reducedMotion },
      viewports: [wideLight, mobileLight, wideDark, mobileDark],
      browserErrors: errors
    };
    const evidencePath = testInfo.outputPath("visual-accessibility-evidence.json");
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    await testInfo.attach("visual-accessibility-evidence", {
      path: evidencePath,
      contentType: "application/json"
    });
  } finally {
    await cleanupSyntheticAccount(account);
  }
});

test("11. automated accessibility scans cover every private-pilot critical flow", async ({
  page
}, testInfo) => {
  const account = accountFor(testInfo, "axe-critical-flows");
  const invitation = await issueE2eInvitation(account.email);
  const publicRoutes = [
    "/login",
    `/register#invite=${invitation}`,
    "/privacy",
    "/terms",
    "/support"
  ];
  for (const route of publicRoutes) {
    await page.goto(route);
    await expect(page.locator("h1")).toHaveCount(1);
    await expectNoCriticalAccessibilityViolations(page, route.split("?", 1)[0] ?? route);
  }

  await page.goto(`/reset-password#token=${"r".repeat(43)}`);
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  await expectNoCriticalAccessibilityViolations(page, "/reset-password");

  try {
    await provisionAccount(page, account);
    for (const route of ["/app/today", "/app/account", "/app/account/delete"]) {
      await page.goto(route);
      await expect(page.locator("h1")).toHaveCount(1);
      await expectNoCriticalAccessibilityViolations(page, route);
    }
  } finally {
    await cleanupSyntheticAccount(account);
  }
});

test("12. @mobile-webkit invitation cookie, Today, logout, and return smoke", async ({
  page
}, testInfo) => {
  const account = accountFor(testInfo, "mobile-webkit");
  try {
    await provisionAccount(page, account);
    await page.goto("/app/today");
    await expect(page.getByRole("heading", { name: "Today’s mission" })).toBeVisible();
    await page.goto("/app/account");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fapp%2Faccount$/u);
    await page.getByLabel("Email address", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/app\/account$/u);
    await expect(page.getByRole("heading", { name: "Account and preferences" })).toBeVisible();
    await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(account.email);
    await page.getByRole("link", { name: "Today", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/today$/u);
    await expect(page.getByRole("heading", { name: "Today’s mission" })).toBeVisible();
  } finally {
    await cleanupSyntheticAccount(account);
  }
});
