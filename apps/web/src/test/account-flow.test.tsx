import type {
  AccountUser,
  AuthenticatedTodayResponse,
  OnboardingProfile,
  ProgressDayResponse
} from "@codelift/contracts";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { App } from "../app/App";
import { scratchStorageKey, writeScratch } from "../features/account/scratchStorage";
import { jsonResponse, verifiedMissionFixture } from "./fixtures";

const profile: OnboardingProfile = {
  displayName: "Mathew",
  timezone: "America/Los_Angeles",
  startDate: "2026-07-24",
  commitmentMinutes: 30,
  preferredCodingTime: "20:30",
  routineCue: "the children are asleep",
  codingPlace: "my desk",
  implementationIntention:
    "Today at 20:30, after the children are asleep, I will code at my desk for 30 minutes.",
  whyItMatters: "Build useful AI products.",
  githubUsername: "",
  targetRoles: ["Full-Stack AI Application Engineer"],
  aiPrivacyMode: "local_only",
  themePreference: "system",
  motionPreference: "gentle",
  reviewPreference: "before_mission"
};

const user: AccountUser = {
  id: "64f000000000000000000001",
  email: "mathew@example.com",
  onboardingComplete: true,
  profile,
  createdAt: "2026-07-24T20:00:00.000Z"
};

function progress(overrides: Partial<ProgressDayResponse> = {}): ProgressDayResponse {
  return {
    dayNumber: 1,
    status: "not_started",
    selectedMode: null,
    evidence: [],
    reflection: {
      confused: "",
      mentalModelChanged: "",
      retrieveLater: "",
      updatedAt: null
    },
    version: 0,
    startedAt: null,
    completedAt: null,
    updatedAt: null,
    ...overrides
  };
}

function today(progressValue = progress()): AuthenticatedTodayResponse {
  return {
    selection: "next_incomplete",
    user,
    day: verifiedMissionFixture,
    progress: progressValue,
    futureStartDate: null
  };
}

function dashboard(xp: number, currentDayNumber: number) {
  return {
    generatedAt: "2026-07-24T20:30:00.000Z",
    day: verifiedMissionFixture,
    summary: {
      currentDayNumber,
      coreCompletions: xp >= 30 ? 1 : 0,
      recoveryWins: 0,
      intentionalSkips: 0,
      totalReturns: xp > 0 ? 1 : 0,
      currentStreak: xp > 0 ? 1 : 0,
      longestStreak: xp > 0 ? 1 : 0,
      rolling7DayReturns: xp > 0 ? 1 : 0,
      rolling30DayReturns: xp > 0 ? 1 : 0,
      xp,
      graceTokensAvailable: 1
    },
    journey: Array.from({ length: 365 }, (_, index) => ({
      dayNumber: index + 1,
      monthNumber: Math.min(12, Math.ceil((index + 1) / 31)),
      status: index === 0 && xp > 0 ? "core_completed" : "not_started",
      selectedMode: index === 0 && xp > 0 ? "core" : null
    })),
    reviewsDue: [],
    portfolioFocus: null,
    missedCalendarDays: 0,
    recentEvidence: []
  };
}

function privateTodayFetch(todayResponse: AuthenticatedTodayResponse, mutationResponse: Response) {
  return vi.fn<typeof fetch>().mockImplementation((input) => {
    const path = String(input);
    if (path === "/api/v1/me") {
      return Promise.resolve(jsonResponse({ authenticated: true, user }));
    }
    if (path === "/api/v1/auth/csrf") {
      return Promise.resolve(
        jsonResponse({
          csrfToken: "a".repeat(43),
          expiresAt: "2026-07-25T00:00:00.000Z"
        })
      );
    }
    if (path === "/api/v1/me/today") {
      return Promise.resolve(jsonResponse(todayResponse));
    }
    if (path === "/api/v1/progress/1/status") {
      return Promise.resolve(mutationResponse);
    }
    return Promise.reject(new Error(`Unexpected test request: ${path}`));
  });
}

describe("M2 browser account journey", () => {
  it("keeps protected content absent while session bootstrap is unresolved", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(
        () =>
          new Promise<Response>(() => {
            // Keep session resolution intentionally pending.
          })
      )
    );

    render(<App pathname="/app/today" />);

    expect(
      screen.getByRole("heading", { name: "Checking your private workspace…" })
    ).toBeInTheDocument();
    expect(screen.queryByText(verifiedMissionFixture.title)).not.toBeInTheDocument();
    expect(screen.queryByText("What confused me?")).not.toBeInTheDocument();
  });

  it("routes signed-out protected access to login without exposing private content", async () => {
    window.history.replaceState(null, "", "/app/today");
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse({ authenticated: false }))
        .mockResolvedValueOnce(
          jsonResponse({
            csrfToken: "a".repeat(43),
            expiresAt: "2026-07-25T00:00:00.000Z"
          })
        )
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Continue from the next useful step."
      })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
    expect(window.location.search).toBe("?returnTo=%2Fapp%2Ftoday");
    expect(screen.queryByText(verifiedMissionFixture.title)).not.toBeInTheDocument();
  });

  it("follows browser back and forward navigation between account routes", async () => {
    window.history.replaceState(null, "", "/login");
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
      const path = String(input);
      if (path === "/api/v1/me") {
        return Promise.resolve(jsonResponse({ authenticated: false }));
      }
      if (path === "/api/v1/auth/csrf") {
        return Promise.resolve(
          jsonResponse({
            csrfToken: "a".repeat(43),
            expiresAt: "2026-07-25T00:00:00.000Z"
          })
        );
      }
      return Promise.reject(new Error(`Unexpected test request: ${path}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const actor = userEvent.setup();

    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Continue from the next useful step." })
    ).toBeInTheDocument();

    await actor.click(screen.getByRole("link", { name: "Create an account" }));
    expect(
      await screen.findByRole("heading", { name: "Create a place to return to." })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/register");

    await act(async () => {
      const traversed = new Promise<void>((resolve) => {
        window.addEventListener("popstate", () => resolve(), { once: true });
      });
      window.history.back();
      await traversed;
    });
    expect(
      await screen.findByRole("heading", { name: "Continue from the next useful step." })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");

    await act(async () => {
      const traversed = new Promise<void>((resolve) => {
        window.addEventListener("popstate", () => resolve(), { once: true });
      });
      window.history.forward();
      await traversed;
    });
    expect(
      await screen.findByRole("heading", { name: "Create a place to return to." })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/register");
    expect(fetchMock.mock.calls.filter(([input]) => String(input) === "/api/v1/me")).toHaveLength(
      1
    );
  });

  it("keeps password confirmation in the browser and opens onboarding", async () => {
    window.history.replaceState(null, "", "/register");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ authenticated: false }))
      .mockResolvedValueOnce(
        jsonResponse({
          csrfToken: "a".repeat(43),
          expiresAt: "2026-07-25T00:00:00.000Z"
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            authenticated: true,
            user: {
              ...user,
              onboardingComplete: false,
              profile: null
            },
            csrfToken: "b".repeat(43)
          },
          201
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    const actor = userEvent.setup();

    render(<App />);
    await actor.type(await screen.findByLabelText("Email address"), "mathew@example.com");
    await actor.type(
      screen.getByLabelText("Password", { selector: "#register-password" }),
      "Correct horse battery staple!"
    );
    await actor.type(screen.getByLabelText("Confirm password"), "Correct horse battery staple!");
    await actor.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByRole("heading", {
        name: "Build a plan that can survive real life."
      })
    ).toBeInTheDocument();
    const registrationCall = fetchMock.mock.calls.find(
      ([path]) => path === "/api/v1/auth/register"
    );
    expect(JSON.parse(String(registrationCall?.[1]?.body))).toEqual({
      email: "mathew@example.com",
      password: "Correct horse battery staple!"
    });
    expect(window.location.pathname).toBe("/app/onboarding");
  });

  it("uses an invitation-link token without rendering it into the page", async () => {
    const invitationToken = "i".repeat(43);
    window.history.replaceState(null, "", `/register#invite=${invitationToken}`);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ authenticated: false }))
      .mockResolvedValueOnce(
        jsonResponse({
          csrfToken: "a".repeat(43),
          expiresAt: "2026-07-25T00:00:00.000Z"
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            authenticated: true,
            user: { ...user, onboardingComplete: false, profile: null },
            csrfToken: "b".repeat(43)
          },
          201
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    const actor = userEvent.setup();

    render(<App />);
    expect(await screen.findByText(/one-time invitation link is ready/i)).toBeInTheDocument();
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
    expect(screen.queryByDisplayValue(invitationToken)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(invitationToken);
    await actor.type(screen.getByLabelText("Email address"), user.email);
    await actor.type(screen.getByLabelText("Password"), "Correct horse battery staple!");
    await actor.type(screen.getByLabelText("Confirm password"), "Correct horse battery staple!");
    await actor.click(screen.getByRole("button", { name: "Create account" }));

    const registrationCall = fetchMock.mock.calls.find(
      ([path]) => path === "/api/v1/auth/register"
    );
    expect(JSON.parse(String(registrationCall?.[1]?.body))).toMatchObject({
      email: user.email,
      invitationToken
    });
  });

  it("resets a password from a one-time link and returns to a signed-out login", async () => {
    const resetToken = "r".repeat(43);
    window.history.replaceState(null, "", `/reset-password#token=${resetToken}`);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ authenticated: false }))
      .mockResolvedValueOnce(
        jsonResponse({
          csrfToken: "a".repeat(43),
          expiresAt: "2026-07-25T00:00:00.000Z"
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const actor = userEvent.setup();

    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Choose a new password" })
    ).toBeInTheDocument();
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
    expect(document.body.textContent).not.toContain(resetToken);
    await actor.type(screen.getByLabelText("New password"), "A newer secure password!");
    await actor.type(screen.getByLabelText("Confirm new password"), "A newer secure password!");
    await actor.click(screen.getByRole("button", { name: "Reset password" }));

    expect(
      await screen.findByText("Password reset complete. Sign in again with the new password.")
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
    const resetCall = fetchMock.mock.calls.find(([path]) => path === "/api/v1/auth/reset-password");
    expect(JSON.parse(String(resetCall?.[1]?.body))).toEqual({
      token: resetToken,
      password: "A newer secure password!"
    });
  });

  it.each([
    ["/privacy", "Privacy at CodeLift"],
    ["/terms", "Learning with honest evidence"],
    ["/support", "Get help without exposing private work"]
  ])("renders the public accessible policy route %s", (pathname, heading) => {
    render(<App pathname={pathname} />);
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to sign in" })).toHaveAttribute(
      "href",
      "/login"
    );
  });

  it("honors only an allowlisted protected return path after login", async () => {
    window.history.replaceState(null, "", "/login?returnTo=%2Fapp%2Faccount");
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse({ authenticated: false }))
        .mockResolvedValueOnce(
          jsonResponse({
            csrfToken: "a".repeat(43),
            expiresAt: "2026-07-25T00:00:00.000Z"
          })
        )
        .mockResolvedValueOnce(
          jsonResponse({
            authenticated: true,
            user,
            csrfToken: "b".repeat(43)
          })
        )
    );
    const actor = userEvent.setup();

    render(<App />);
    await actor.type(await screen.findByLabelText("Email address"), user.email);
    await actor.type(
      screen.getByLabelText("Password", { selector: "#login-password" }),
      "Correct horse battery staple!"
    );
    await actor.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("heading", { name: "Account and preferences" })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/app/account");
  });

  it("shows a neutral signed-out confirmation after deletion", async () => {
    window.history.replaceState(null, "", "/login?deleted=1");
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse({ authenticated: false }))
        .mockResolvedValueOnce(
          jsonResponse({
            csrfToken: "a".repeat(43),
            expiresAt: "2026-07-25T00:00:00.000Z"
          })
        )
    );

    render(<App />);

    expect(await screen.findByText("Your CodeLift account data was deleted.")).toBeInTheDocument();
  });

  it("removes only the deleted account's browser-local scratch notes", async () => {
    window.history.replaceState(null, "", "/app/account/delete");
    const otherUserId = "64f000000000000000000002";
    writeScratch(window.localStorage, user.id, 1, "delete with the account");
    writeScratch(window.localStorage, otherUserId, 1, "keep for the other account");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation((input, init) => {
        const path = String(input);
        if (path === "/api/v1/me" && init?.method === "DELETE") {
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        if (path === "/api/v1/me") {
          return Promise.resolve(jsonResponse({ authenticated: true, user }));
        }
        if (path === "/api/v1/auth/csrf") {
          return Promise.resolve(
            jsonResponse({
              csrfToken: "a".repeat(43),
              expiresAt: "2026-07-25T00:00:00.000Z"
            })
          );
        }
        return Promise.reject(new Error(`Unexpected test request: ${path}`));
      })
    );
    const actor = userEvent.setup();

    render(<App />);
    await actor.type(await screen.findByLabelText("Current password"), "Correct password 123!");
    await actor.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    await actor.click(screen.getByRole("button", { name: "Permanently delete my account" }));

    expect(await screen.findByText("Your CodeLift account data was deleted.")).toBeInTheDocument();
    expect(window.localStorage.getItem(scratchStorageKey(user.id, 1))).toBeNull();
    expect(window.localStorage.getItem(scratchStorageKey(otherUserId, 1))).toBe(
      "keep for the other account"
    );
    window.localStorage.removeItem(scratchStorageKey(otherUserId, 1));
  });

  it("renders the server-selected day and sends Recovery as a distinct mode", async () => {
    window.history.replaceState(null, "", "/app/today");
    const recoveryProgress = progress({
      status: "in_progress",
      selectedMode: "recovery",
      version: 1,
      startedAt: "2026-07-24T20:00:00.000Z",
      updatedAt: "2026-07-24T20:00:00.000Z"
    });
    const fetchMock = privateTodayFetch(today(), jsonResponse(recoveryProgress));
    vi.stubGlobal("fetch", fetchMock);
    const actor = userEvent.setup();

    render(<App />);
    expect(await screen.findByRole("heading", { name: "Today’s mission" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: verifiedMissionFixture.title })).toBeInTheDocument();
    await actor.click(screen.getByLabelText(/Recovery win · up to 5 minutes/));
    await actor.click(screen.getByRole("button", { name: "Start Recovery win" }));

    await waitFor(() => expect(screen.getByText(/Status:/)).toHaveTextContent("in progress"));
    const mutation = fetchMock.mock.calls.find(([path]) => path === "/api/v1/progress/1/status");
    expect(JSON.parse(String(mutation?.[1]?.body))).toMatchObject({
      intent: "start",
      mode: "recovery"
    });
    expect(screen.getByLabelText(/Recovery win · up to 5 minutes/)).toBeChecked();
  });

  it("resets an unstarted next curriculum day to the Core path", async () => {
    window.history.replaceState(null, "", "/app/today");
    const secondDay = {
      ...verifiedMissionFixture,
      dayNumber: 2,
      title: "Audit the development environment"
    };
    const firstProgress = progress({
      dayNumber: 1,
      status: "recovery_completed",
      selectedMode: "recovery",
      version: 3,
      completedAt: "2026-07-24T20:20:00.000Z",
      updatedAt: "2026-07-24T20:20:00.000Z"
    });
    let todayReads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation((input) => {
        const path = String(input);
        if (path === "/api/v1/me") {
          return Promise.resolve(jsonResponse({ authenticated: true, user }));
        }
        if (path === "/api/v1/auth/csrf") {
          return Promise.resolve(
            jsonResponse({
              csrfToken: "a".repeat(43),
              expiresAt: "2026-07-25T00:00:00.000Z"
            })
          );
        }
        if (path === "/api/v1/me/today") {
          todayReads += 1;
          return Promise.resolve(
            jsonResponse(
              todayReads === 1
                ? today(firstProgress)
                : {
                    ...today(),
                    day: secondDay,
                    progress: progress({ dayNumber: 2 })
                  }
            )
          );
        }
        if (path === "/api/v1/dashboard") {
          return Promise.resolve(
            jsonResponse(todayReads === 1 ? dashboard(0, 1) : dashboard(30, 2))
          );
        }
        return Promise.reject(new Error(`Unexpected test request: ${path}`));
      })
    );
    const actor = userEvent.setup();

    render(<App />);
    expect(await screen.findByText("0 XP", { exact: true })).toBeInTheDocument();
    await actor.click(await screen.findByRole("button", { name: "Open the next useful step" }));

    expect(
      await screen.findByRole("heading", { name: "Audit the development environment" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Core mission · 30 minutes/)).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Start 30-minute Core mission" })
    ).toBeInTheDocument();
    expect(await screen.findByText("30 XP", { exact: true })).toBeInTheDocument();
  });

  it("does not display completion when the server rejects it", async () => {
    window.history.replaceState(null, "", "/app/today");
    const activeProgress = progress({
      status: "in_progress",
      selectedMode: "core",
      version: 2,
      startedAt: "2026-07-24T20:00:00.000Z",
      updatedAt: "2026-07-24T20:10:00.000Z"
    });
    vi.stubGlobal(
      "fetch",
      privateTodayFetch(
        today(activeProgress),
        jsonResponse(
          {
            type: "https://codelift.ai/problems/completion-evidence-required",
            title: "Evidence required",
            status: 409,
            detail: "Add explicit evidence before recording completion.",
            requestId: "request-123"
          },
          409
        )
      )
    );
    const actor = userEvent.setup();

    render(<App />);
    await actor.click(await screen.findByRole("button", { name: "Complete Core mission" }));

    expect(
      await screen.findByText("Add explicit evidence before recording completion.")
    ).toBeInTheDocument();
    expect(screen.getByText(/Status:/)).toHaveTextContent("in progress");
    expect(
      screen.queryByRole("heading", {
        name: "Core mission recorded with evidence."
      })
    ).not.toBeInTheDocument();
  });

  it("hydrates the learner-authored reflection draft after a resume", async () => {
    window.history.replaceState(null, "", "/app/today");
    const activeProgress = progress({
      status: "in_progress",
      selectedMode: "core",
      version: 2,
      reflection: {
        confused: "I mixed up compile-time and runtime checks.",
        mentalModelChanged: "A network response stays unknown until parsing succeeds.",
        retrieveLater: "Why can TypeScript not verify remote JSON?",
        updatedAt: "2026-07-24T20:10:00.000Z"
      },
      startedAt: "2026-07-24T20:00:00.000Z",
      updatedAt: "2026-07-24T20:10:00.000Z"
    });
    vi.stubGlobal("fetch", privateTodayFetch(today(activeProgress), jsonResponse(activeProgress)));

    render(<App />);

    expect(await screen.findByLabelText("What confused me?")).toHaveValue(
      "I mixed up compile-time and runtime checks."
    );
    expect(screen.getByLabelText("What changed in my mental model?")).toHaveValue(
      "A network response stays unknown until parsing succeeds."
    );
    expect(screen.getByLabelText("What will I retrieve later?")).toHaveValue(
      "Why can TypeScript not verify remote JSON?"
    );
  });

  it("persists editable account settings and resumes them after a reload", async () => {
    window.history.replaceState(null, "", "/app/account");
    let storedUser: AccountUser = user;
    let savedProfile: OnboardingProfile | null = null;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input, init) => {
      const path = String(input);
      if (path === "/api/v1/me") {
        return Promise.resolve(jsonResponse({ authenticated: true, user: storedUser }));
      }
      if (path === "/api/v1/auth/csrf") {
        return Promise.resolve(
          jsonResponse({
            csrfToken: "a".repeat(43),
            expiresAt: "2026-07-25T00:00:00.000Z"
          })
        );
      }
      if (path === "/api/v1/me/onboarding" && init?.method === "PUT") {
        const nextProfile = JSON.parse(String(init.body)) as OnboardingProfile;
        savedProfile = nextProfile;
        storedUser = { ...storedUser, profile: nextProfile };
        return Promise.resolve(jsonResponse({ user: storedUser }));
      }
      return Promise.reject(new Error(`Unexpected test request: ${path}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const actor = userEvent.setup();

    const firstRender = render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Account and preferences" })
    ).toBeInTheDocument();
    const saveButton = screen.getByRole("button", { name: "Save settings" });
    await waitFor(() => expect(saveButton).toBeEnabled());

    await actor.clear(screen.getByLabelText("Display name"));
    await actor.type(screen.getByLabelText("Display name"), "Mathew Builder");
    await actor.clear(screen.getByLabelText("Implementation intention"));
    await actor.type(
      screen.getByLabelText("Implementation intention"),
      "At 21:15 I will make one evidence-backed change before opening another task."
    );
    fireEvent.change(screen.getByLabelText("Preferred coding time"), {
      target: { value: "21:15" }
    });
    await actor.click(screen.getByLabelText("Applied AI Engineer"));
    await actor.click(screen.getByLabelText("Ask me before any external AI use"));
    await actor.selectOptions(screen.getByLabelText("Review preference"), "after_mission");
    await actor.selectOptions(screen.getByLabelText("Theme"), "dark");
    await actor.selectOptions(screen.getByLabelText("Motion"), "reduced");
    await actor.click(saveButton);

    expect(
      await screen.findByText("Settings saved. Your next return will use these choices.")
    ).toBeInTheDocument();
    expect(savedProfile).toMatchObject({
      displayName: "Mathew Builder",
      preferredCodingTime: "21:15",
      implementationIntention:
        "At 21:15 I will make one evidence-backed change before opening another task.",
      targetRoles: ["Full-Stack AI Application Engineer", "Applied AI Engineer"],
      aiPrivacyMode: "ask_before_external",
      reviewPreference: "after_mission",
      themePreference: "dark",
      motionPreference: "reduced"
    });
    const settingsWrite = fetchMock.mock.calls.find(
      ([path, init]) => path === "/api/v1/me/onboarding" && init?.method === "PUT"
    );
    expect(settingsWrite?.[1]).toMatchObject({
      credentials: "include",
      cache: "no-store",
      headers: expect.objectContaining({ "X-CSRF-Token": "a".repeat(43) })
    });
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    expect(document.documentElement.dataset.motion).toBe("reduced");

    firstRender.unmount();
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Account and preferences" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toHaveValue("Mathew Builder");
    expect(screen.getByLabelText("Preferred coding time")).toHaveValue("21:15");
    expect(screen.getByLabelText("Implementation intention")).toHaveValue(
      "At 21:15 I will make one evidence-backed change before opening another task."
    );
    expect(screen.getByLabelText("Applied AI Engineer")).toBeChecked();
    expect(screen.getByLabelText("Ask me before any external AI use")).toBeChecked();
    expect(screen.getByLabelText("Review preference")).toHaveValue("after_mission");
    expect(screen.getByLabelText("Theme")).toHaveValue("dark");
    expect(screen.getByLabelText("Motion")).toHaveValue("reduced");
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/v1/me")).toHaveLength(2);
  });

  it("signs out from the global Workspace menu only after the server succeeds", async () => {
    window.history.replaceState(null, "", "/app/today");
    let finishLogout: (response: Response) => void = () => undefined;
    const logoutResult = new Promise<Response>((resolve) => {
      finishLogout = resolve;
    });
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input, init) => {
      const path = String(input);
      if (path === "/api/v1/me") {
        return Promise.resolve(jsonResponse({ authenticated: true, user }));
      }
      if (path === "/api/v1/auth/csrf") {
        return Promise.resolve(
          jsonResponse({
            csrfToken: "a".repeat(43),
            expiresAt: "2026-07-25T00:00:00.000Z"
          })
        );
      }
      if (path === "/api/v1/me/today") {
        return Promise.resolve(jsonResponse(today()));
      }
      if (path === "/api/v1/auth/logout" && init?.method === "POST") {
        return logoutResult;
      }
      return Promise.reject(new Error(`Unexpected test request: ${path}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const actor = userEvent.setup();

    render(<App />);
    expect(await screen.findByRole("heading", { name: "Today’s mission" })).toBeInTheDocument();
    const workspaceSummary = screen.getByText("Workspace", { selector: "summary" });
    await actor.click(workspaceSummary);
    const workspaceMenu = workspaceSummary.closest("details");
    if (workspaceMenu === null) throw new Error("Expected the Workspace details menu.");
    const signOut = within(workspaceMenu).getByRole("button", { name: "Sign out" });
    await actor.click(signOut);

    expect(within(workspaceMenu).getByRole("button", { name: "Signing out…" })).toBeDisabled();
    expect(screen.getByRole("heading", { name: "Today’s mission" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/app/today");
    fireEvent.click(signOut);
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/v1/auth/logout")).toHaveLength(1);

    finishLogout(new Response(null, { status: 204 }));
    expect(
      await screen.findByRole("heading", { name: "Continue from the next useful step." })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });

  it("keeps authenticated content and focuses a global sign-out failure reference", async () => {
    window.history.replaceState(null, "", "/app/account");
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input, init) => {
      const path = String(input);
      if (path === "/api/v1/me") {
        return Promise.resolve(jsonResponse({ authenticated: true, user }));
      }
      if (path === "/api/v1/auth/csrf") {
        return Promise.resolve(
          jsonResponse({
            csrfToken: "a".repeat(43),
            expiresAt: "2026-07-25T00:00:00.000Z"
          })
        );
      }
      if (path === "/api/v1/auth/logout" && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(
            {
              type: "https://codelift.ai/problems/service-unavailable",
              title: "Sign out unavailable",
              status: 503,
              detail: "The server session remains active. Try signing out again.",
              requestId: "logout-request-123"
            },
            503
          )
        );
      }
      return Promise.reject(new Error(`Unexpected test request: ${path}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const actor = userEvent.setup();

    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Account and preferences" })
    ).toBeInTheDocument();
    const workspaceSummary = screen.getByText("Workspace", { selector: "summary" });
    await actor.click(workspaceSummary);
    const workspaceMenu = workspaceSummary.closest("details");
    if (workspaceMenu === null) throw new Error("Expected the Workspace details menu.");
    await actor.click(within(workspaceMenu).getByRole("button", { name: "Sign out" }));

    const alert = await within(workspaceMenu).findByRole("alert");
    expect(alert).toHaveTextContent("The server session remains active. Try signing out again.");
    expect(alert).toHaveTextContent("Support reference: logout-request-123");
    expect(alert).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Account and preferences" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/app/account");
    expect(within(workspaceMenu).getByRole("button", { name: "Sign out" })).toBeEnabled();
  });

  it("applies persisted theme and reduced-motion preferences", async () => {
    window.history.replaceState(null, "", "/app/account");
    const preferenceUser: AccountUser = {
      ...user,
      profile: {
        ...profile,
        themePreference: "dark",
        motionPreference: "reduced"
      }
    };
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation((input) => {
        const path = String(input);
        if (path === "/api/v1/me") {
          return Promise.resolve(jsonResponse({ authenticated: true, user: preferenceUser }));
        }
        if (path === "/api/v1/auth/csrf") {
          return Promise.resolve(
            jsonResponse({
              csrfToken: "a".repeat(43),
              expiresAt: "2026-07-25T00:00:00.000Z"
            })
          );
        }
        return Promise.reject(new Error(`Unexpected test request: ${path}`));
      })
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Account and preferences" })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(document.documentElement.dataset.motion).toBe("reduced");
    });
  });
});
