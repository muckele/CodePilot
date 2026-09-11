import { createHash } from "node:crypto";

import { expect, type Page, type TestInfo } from "@playwright/test";

import { E2E_BASE_URL } from "./environment.js";
import { deleteE2eSyntheticAccount, issueE2eInvitation } from "./database.js";

export interface TestAccount {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
}

interface AuthenticatedUserResponse {
  readonly authenticated: true;
  readonly user: {
    readonly id: string;
    readonly email: string;
  };
}

interface CsrfResponse {
  readonly csrfToken: string;
}

interface AuthResponse extends AuthenticatedUserResponse {
  readonly csrfToken: string;
}

interface ProvisionOptions {
  readonly startDate?: string;
  readonly aiPrivacyMode?: "local_only" | "ask_before_external";
  readonly themePreference?: "system" | "light" | "dark";
  readonly motionPreference?: "system" | "reduced" | "gentle";
}

interface JsonResponse {
  ok(): boolean;
  status(): number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export interface DashboardSnapshot {
  readonly summary: {
    readonly currentDayNumber: number;
    readonly coreCompletions: number;
    readonly recoveryWins: number;
    readonly xp: number;
  };
  readonly missedCalendarDays: number;
}

export function accountFor(testInfo: TestInfo, label: string): TestAccount {
  const identity = createHash("sha256")
    .update(`${testInfo.file}:${testInfo.title}:${testInfo.retry}:${label}`)
    .digest("hex")
    .slice(0, 12);
  return {
    email: `e2e-${label}-${identity}@example.test`,
    password: "Playwright-only-example-password!47",
    displayName: `E2E ${label} learner`
  };
}

export function isoDateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export async function responseJson<T>(response: JsonResponse, boundary: string): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${boundary} returned HTTP ${response.status()}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

async function csrfToken(page: Page): Promise<string> {
  const response = await page.request.get("/api/v1/auth/csrf");
  return (await responseJson<CsrfResponse>(response, "CSRF bootstrap")).csrfToken;
}

function onboardingProfile(account: TestAccount, options: ProvisionOptions = {}) {
  return {
    displayName: account.displayName,
    timezone: "UTC",
    startDate: options.startDate ?? isoDateDaysAgo(0),
    commitmentMinutes: 30,
    preferredCodingTime: "19:30",
    routineCue: "the test workspace is ready",
    codingPlace: "the isolated browser",
    implementationIntention:
      "Today at 19:30, after the test workspace is ready, I will code at the isolated browser for 30 minutes.",
    whyItMatters: "Verify CodeLift behavior through a real browser and real service boundaries.",
    githubUsername: "",
    targetRoles: ["Full-Stack AI Application Engineer"],
    aiPrivacyMode: options.aiPrivacyMode ?? "local_only",
    themePreference: options.themePreference ?? "light",
    motionPreference: options.motionPreference ?? "reduced"
  };
}

export async function provisionAccount(
  page: Page,
  account: TestAccount,
  options: ProvisionOptions = {}
): Promise<string> {
  const protection = await csrfToken(page);
  const invitationToken = await issueE2eInvitation(account.email);
  const registration = await page.request.post("/api/v1/auth/register", {
    headers: {
      Origin: E2E_BASE_URL,
      "X-CSRF-Token": protection
    },
    data: {
      email: account.email,
      password: account.password,
      invitationToken
    }
  });
  const authenticated = await responseJson<AuthResponse>(registration, "Account registration");
  const onboarding = await page.request.put("/api/v1/me/onboarding", {
    headers: {
      Origin: E2E_BASE_URL,
      "X-CSRF-Token": authenticated.csrfToken
    },
    data: onboardingProfile(account, options)
  });
  await responseJson(onboarding, "Account onboarding");
  return authenticated.user.id;
}

export async function registerAndOnboardWithKeyboard(
  page: Page,
  account: TestAccount
): Promise<string> {
  const invitationToken = await issueE2eInvitation(account.email);
  await page.goto(`/register#invite=${invitationToken}`);
  await expect(page.getByRole("heading", { name: "Create a place to return to." })).toBeVisible();

  const email = page.getByLabel("Email address", { exact: true });
  const password = page.getByLabel("Password", { exact: true });
  const confirmation = page.getByLabel("Confirm password", { exact: true });
  await expect(email).toHaveAttribute("autocomplete", "email");
  await expect(password).toHaveAttribute("autocomplete", "new-password");
  await email.fill(account.email);
  await password.fill(account.password);
  await confirmation.fill(account.password);

  const createAccount = page.getByRole("button", { name: "Create account" });
  await expect(createAccount).toBeEnabled();
  await confirmation.focus();
  await page.keyboard.press("Tab");
  await expect(createAccount).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { name: "Build a plan that can survive real life." })
  ).toBeVisible();
  await page.getByLabel("Display name", { exact: true }).fill(account.displayName);
  await page.getByLabel("Timezone", { exact: true }).fill("UTC");
  await page.getByLabel("Curriculum start date", { exact: true }).fill(isoDateDaysAgo(0));
  await page.getByLabel("Preferred coding time", { exact: true }).fill("19:30");
  await page.getByLabel("Routine cue", { exact: true }).fill("the test workspace is ready");
  await page.getByLabel("Coding place", { exact: true }).fill("the isolated browser");
  await page
    .getByLabel("Implementation intention", { exact: true })
    .fill(
      "Today at 19:30, after the test workspace is ready, I will code at the isolated browser for 30 minutes."
    );
  await page
    .getByLabel("Why this matters", { exact: true })
    .fill("Verify one complete evidence-backed browser journey.");
  await page.getByLabel("Theme", { exact: true }).selectOption("light");
  const motion = page.getByLabel("Motion", { exact: true });
  await motion.selectOption("reduced");

  const save = page.getByRole("button", { name: "Save and open Today" });
  await expect(save).toBeEnabled();
  await save.focus();
  await expect(save).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/app\/today$/u);
  await expect(page.getByRole("heading", { name: "Today’s mission" })).toBeVisible();
  const me = await page.request.get("/api/v1/me");
  return (await responseJson<AuthenticatedUserResponse>(me, "Authenticated user lookup")).user.id;
}

export async function cleanupSyntheticAccount(account: TestAccount): Promise<void> {
  await deleteE2eSyntheticAccount(account.email);
}

export async function dashboard(page: Page): Promise<DashboardSnapshot> {
  const response = await page.request.get("/api/v1/dashboard");
  return responseJson<DashboardSnapshot>(response, "Dashboard lookup");
}

export async function completeMission(page: Page, mode: "core" | "recovery"): Promise<void> {
  const modeLabel =
    mode === "core" ? /Core mission · 30 minutes/u : /Recovery win · up to 5 minutes/u;
  const startLabel = mode === "core" ? "Start 30-minute Core mission" : "Start Recovery win";
  const completionLabel = mode === "core" ? "Complete Core mission" : "Record Recovery win";
  const completionHeading =
    mode === "core" ? "Core mission recorded with evidence." : "Recovery win recorded separately.";

  const modeControl = page.getByLabel(modeLabel);
  await expect(modeControl).toHaveAccessibleName(modeLabel);
  if (mode === "recovery") await modeControl.check();

  const start = page.getByRole("button", { name: startLabel });
  await start.focus();
  await expect(start).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Status:/u)).toContainText("in progress");

  await page.getByLabel("Evidence kind", { exact: true }).selectOption("test_name");
  await page
    .getByLabel("Evidence label", { exact: true })
    .fill(mode === "core" ? "Playwright Core journey" : "Playwright Recovery journey");
  await page
    .getByLabel("Evidence value", { exact: true })
    .fill(
      mode === "core"
        ? "The real browser completed the validated Day 1 flow."
        : "The real browser recorded one small explicit return."
    );
  await page
    .getByLabel("What confused me?", { exact: true })
    .fill("I separated browser state from persisted completion state.");
  await page
    .getByLabel("What changed in my mental model?", { exact: true })
    .fill("A successful response must precede any completion message.");
  await page
    .getByLabel("What will I retrieve later?", { exact: true })
    .fill("Which boundary proves that completion and XP are idempotent?");

  const addEvidence = page.getByRole("button", { name: "Add evidence" });
  await addEvidence.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Mission evidence saved.", { exact: true })).toBeVisible();

  const saveReflection = page.getByRole("button", { name: "Save reflection" });
  await saveReflection.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Reflection draft saved.", { exact: true })).toBeVisible();

  const complete = page.getByRole("button", { name: completionLabel });
  await complete.focus();
  await expect(complete).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: completionHeading })).toBeVisible();
}

export function recordUnexpectedBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}
