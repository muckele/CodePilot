import type {
  AccountUser,
  AuthenticatedTodayResponse,
  OnboardingProfile,
  ProgressDayResponse,
  ProgressMode
} from "@codelift/contracts";
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate, useOutletContext } from "react-router";

import {
  addProgressEvidence,
  AccountApiError,
  deleteAccount,
  fetchAuthenticatedToday,
  fetchCsrf,
  fetchMe,
  loginAccount,
  logoutAccount,
  registerAccount,
  saveOnboarding,
  saveProgressReflection,
  updateProgressStatus
} from "./api/accountApi";
import {
  clearUserScratchStorage,
  readScratch,
  SCRATCH_MAX_LENGTH,
  writeScratch
} from "./scratchStorage";
import { ALLOWED_RETURN_PATHS, allowedReturnTo } from "../../app/navigation";
import {
  DayTaskManager,
  TodayCompanion,
  WorkspaceExperience
} from "../workspace/WorkspaceExperience";
import { FocusOrbTimer, ParticleBurst } from "../workspace/components/SignatureGraphics";

type SessionState =
  | { status: "checking" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: AccountUser }
  | { status: "expired" }
  | { status: "unavailable"; message: string; requestId: string | null };

type MutationNotice =
  | { kind: "error"; message: string; requestId: string | null }
  | { kind: "success"; message: string }
  | null;

function asNotice(error: unknown): MutationNotice {
  if (error instanceof AccountApiError) {
    return {
      kind: "error",
      message: error.message,
      requestId: error.requestId
    };
  }
  return {
    kind: "error",
    message: "CodeLift could not safely complete that action. Nothing new was recorded.",
    requestId: null
  };
}

function Notice({ notice }: { notice: MutationNotice }) {
  const reference = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (notice?.kind === "error") {
      reference.current?.focus();
    }
  }, [notice]);

  if (notice === null) {
    return null;
  }

  return (
    <div
      ref={reference}
      className={`form-notice form-notice--${notice.kind}`}
      role={notice.kind === "error" ? "alert" : "status"}
      tabIndex={notice.kind === "error" ? -1 : undefined}
    >
      <p>{notice.message}</p>
      {notice.kind === "error" && notice.requestId !== null ? (
        <small>Support reference: {notice.requestId}</small>
      ) : null}
    </div>
  );
}

function Field({
  id,
  label,
  help,
  children
}: {
  id: string;
  label: string;
  help?: string | undefined;
  children: ReactNode;
}) {
  const helpId = `${id}-help`;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {help === undefined ? null : (
        <p id={helpId} className="field-help">
          {help}
        </p>
      )}
    </div>
  );
}

function PageIntro({
  eyebrow,
  title,
  children
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <header className="account-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{children}</p>
    </header>
  );
}

function CheckingWorkspace() {
  return (
    <section className="account-panel account-state" role="status">
      <span className="state-orb" aria-hidden="true" />
      <h1>Checking your private workspace…</h1>
      <p>Protected content will appear only after the session is verified.</p>
    </section>
  );
}

function UnavailableWorkspace({
  state,
  retry
}: {
  state: Extract<SessionState, { status: "unavailable" }>;
  retry: () => void;
}) {
  return (
    <section className="account-panel account-state" role="alert">
      <p className="eyebrow">Private workspace unavailable</p>
      <h1>Your curriculum preview is still available.</h1>
      <p>{state.message}</p>
      <div className="button-row">
        <button className="button button--primary" type="button" onClick={retry}>
          Try again
        </button>
        <Link className="button button--quiet" to="/curriculum/1">
          Open the public Day 1 preview
        </Link>
      </div>
      {state.requestId === null ? null : <small>Support reference: {state.requestId}</small>}
    </section>
  );
}

function SessionEnded({ onSignIn }: { onSignIn: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section className="account-panel account-state">
      <p className="eyebrow">Session ended</p>
      <h1 ref={heading} tabIndex={-1}>
        Your session ended to protect your account.
      </h1>
      <p>Your progress was not changed.</p>
      <button className="button button--primary" type="button" onClick={onSignIn}>
        Sign in again
      </button>
    </section>
  );
}

function AuthPage({
  mode,
  csrfToken,
  onAuthenticated
}: {
  mode: "register" | "login";
  csrfToken: string | null;
  onAuthenticated: (user: AccountUser, csrfToken: string, destination: string) => void;
}) {
  const location = useLocation();
  const isRegister = mode === "register";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState<MutationNotice>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (csrfToken === null) {
      setNotice({
        kind: "error",
        message: "Protection is still loading. Wait a moment, then submit again.",
        requestId: null
      });
      return;
    }
    if (isRegister && password !== confirmation) {
      setNotice({
        kind: "error",
        message: "Password confirmation must match the password.",
        requestId: null
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = isRegister
        ? await registerAccount({ email, password }, csrfToken)
        : await loginAccount({ email, password }, csrfToken);
      const destination = result.user.onboardingComplete
        ? isRegister
          ? "/app/today"
          : allowedReturnTo(location.search)
        : "/app/onboarding";
      onAuthenticated(result.user, result.csrfToken, destination);
    } catch (error: unknown) {
      setPassword("");
      setConfirmation("");
      setNotice(
        isRegister
          ? {
              kind: "error",
              message:
                "We couldn’t create that account. Check the fields, or sign in if you may already have one.",
              requestId: error instanceof AccountApiError ? error.requestId : null
            }
          : {
              kind: "error",
              message: "We couldn’t sign you in with those details.",
              requestId: error instanceof AccountApiError ? error.requestId : null
            }
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="account-layout">
      <div className="account-panel">
        <PageIntro
          eyebrow={isRegister ? "Your private workshop" : "Welcome back"}
          title={
            isRegister ? "Create a place to return to." : "Continue from the next useful step."
          }
        >
          {isRegister
            ? "Thirty focused minutes. Honest evidence. No leaderboard."
            : "No perfect streak required. Your curriculum waits for you."}
        </PageIntro>

        <Notice notice={notice} />
        {!isRegister && new URLSearchParams(location.search).get("deleted") === "1" ? (
          <div className="form-notice form-notice--success" role="status">
            <p>Your CodeLift account data was deleted.</p>
          </div>
        ) : null}
        {csrfToken === null ? (
          <p className="form-preparing" role="status">
            Preparing a protected form…
          </p>
        ) : null}

        <form className="account-form" onSubmit={submit} noValidate>
          <Field id={`${mode}-email`} label="Email address">
            <input
              id={`${mode}-email`}
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field
            id={`${mode}-password`}
            label="Password"
            help={isRegister ? "Use at least 12 characters." : undefined}
          >
            <input
              id={`${mode}-password`}
              name="password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          {isRegister ? (
            <Field id="register-password-confirmation" label="Confirm password">
              <input
                id="register-password-confirmation"
                name="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </Field>
          ) : null}

          <button
            className="button button--primary button--full"
            type="submit"
            disabled={csrfToken === null || submitting}
          >
            {submitting
              ? isRegister
                ? "Creating your workshop…"
                : "Signing in…"
              : isRegister
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className="account-switch">
          <Link to={isRegister ? "/login" : "/register"}>
            {isRegister ? "Already have an account? Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
      <WorkshopPromise />
    </section>
  );
}

function WorkshopPromise() {
  return (
    <aside className="workshop-promise" aria-label="CodeLift learning promise">
      <div className="promise-sunrise" aria-hidden="true">
        <span />
      </div>
      <p className="eyebrow">The return matters</p>
      <h2>A calm system for building visible skill.</h2>
      <ul>
        <li>Core and Recovery remain honest, distinct choices.</li>
        <li>Every completion is connected to evidence.</li>
        <li>A missed calendar day never skips your curriculum.</li>
      </ul>
    </aside>
  );
}

const TARGET_ROLE_OPTIONS = [
  "Full-Stack AI Application Engineer",
  "Applied AI Engineer",
  "AI Solutions Engineer"
] as const satisfies readonly OnboardingProfile["targetRoles"][number][];

function profileWithSettingsDefaults(profile: OnboardingProfile): OnboardingProfile {
  return {
    ...profile,
    reviewPreference: profile.reviewPreference ?? "before_mission"
  };
}

function initialProfile(): OnboardingProfile {
  const now = new Date();
  return {
    displayName: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    startDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`,
    commitmentMinutes: 30,
    preferredCodingTime: "20:30",
    routineCue: "my evening routine",
    codingPlace: "my desk",
    implementationIntention:
      "Today at 20:30, after my evening routine, I will code at my desk for 30 minutes.",
    whyItMatters: "",
    githubUsername: "",
    targetRoles: ["Full-Stack AI Application Engineer"],
    aiPrivacyMode: "local_only",
    themePreference: "system",
    motionPreference: "gentle",
    reviewPreference: "before_mission"
  };
}

function OnboardingPage({
  csrfToken,
  onSaved
}: {
  csrfToken: string | null;
  onSaved: (user: AccountUser) => void;
}) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(initialProfile);
  const [intentionEdited, setIntentionEdited] = useState(false);
  const [notice, setNotice] = useState<MutationNotice>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof OnboardingProfile>(field: K, value: OnboardingProfile[K]) {
    setProfile((current) => {
      const next = { ...current, [field]: value };
      if (
        !intentionEdited &&
        (field === "preferredCodingTime" || field === "routineCue" || field === "codingPlace")
      ) {
        next.implementationIntention = `Today at ${next.preferredCodingTime}, after ${next.routineCue}, I will code at ${next.codingPlace} for 30 minutes.`;
      }
      return next;
    });
  }

  function toggleRole(role: OnboardingProfile["targetRoles"][number]) {
    const selected = profile.targetRoles.includes(role);
    const next = selected
      ? profile.targetRoles.filter((candidate) => candidate !== role)
      : [...profile.targetRoles, role];
    update("targetRoles", next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    if (csrfToken === null) {
      setNotice({
        kind: "error",
        message: "Protection is still loading. Your entries remain in this form.",
        requestId: null
      });
      return;
    }
    if (profile.targetRoles.length === 0) {
      setNotice({
        kind: "error",
        message: "Choose at least one target role.",
        requestId: null
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await saveOnboarding(profile, csrfToken);
      onSaved(result.user);
      navigate("/app/today", { replace: true });
    } catch (error: unknown) {
      setNotice(asNotice(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="account-panel onboarding-panel">
      <PageIntro eyebrow="Set up your workshop" title="Build a plan that can survive real life.">
        You can change these choices later. Missing a calendar day never skips a curriculum day.
      </PageIntro>

      <Notice notice={notice} />
      {csrfToken === null ? (
        <p className="form-preparing" role="status">
          Preparing a protected form…
        </p>
      ) : null}

      <form className="account-form onboarding-form" onSubmit={submit}>
        <div className="form-grid">
          <Field id="display-name" label="Display name">
            <input
              id="display-name"
              required
              maxLength={60}
              value={profile.displayName}
              onChange={(event) => update("displayName", event.target.value)}
            />
          </Field>
          <Field id="timezone" label="Timezone">
            <input
              id="timezone"
              required
              maxLength={100}
              value={profile.timezone}
              onChange={(event) => update("timezone", event.target.value)}
            />
          </Field>
          <Field id="start-date" label="Curriculum start date">
            <input
              id="start-date"
              type="date"
              required
              value={profile.startDate}
              onChange={(event) => update("startDate", event.target.value)}
            />
          </Field>
          <Field id="coding-time" label="Preferred coding time">
            <input
              id="coding-time"
              type="time"
              required
              value={profile.preferredCodingTime}
              onChange={(event) => update("preferredCodingTime", event.target.value)}
            />
          </Field>
          <Field id="routine-cue" label="Routine cue">
            <input
              id="routine-cue"
              required
              maxLength={120}
              value={profile.routineCue}
              onChange={(event) => update("routineCue", event.target.value)}
            />
          </Field>
          <Field id="coding-place" label="Coding place">
            <input
              id="coding-place"
              required
              maxLength={120}
              value={profile.codingPlace}
              onChange={(event) => update("codingPlace", event.target.value)}
            />
          </Field>
        </div>

        <Field
          id="implementation-intention"
          label="Implementation intention"
          help="This sentence remains editable. Later field changes will not overwrite your manual edit."
        >
          <textarea
            id="implementation-intention"
            required
            maxLength={300}
            rows={3}
            value={profile.implementationIntention}
            onChange={(event) => {
              setIntentionEdited(true);
              update("implementationIntention", event.target.value);
            }}
          />
        </Field>

        <Field id="why-it-matters" label="Why this matters">
          <textarea
            id="why-it-matters"
            required
            maxLength={500}
            rows={4}
            value={profile.whyItMatters}
            onChange={(event) => update("whyItMatters", event.target.value)}
          />
        </Field>

        <Field
          id="github-username"
          label="GitHub username (optional)"
          help="Leave blank if you do not want to connect portfolio evidence yet."
        >
          <input
            id="github-username"
            maxLength={39}
            value={profile.githubUsername}
            onChange={(event) => update("githubUsername", event.target.value)}
          />
        </Field>

        <fieldset>
          <legend>Target roles</legend>
          <div className="choice-grid">
            {TARGET_ROLE_OPTIONS.map((role) => (
              <label className="choice-card" key={role}>
                <input
                  type="checkbox"
                  checked={profile.targetRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                <span>{role}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Future AI privacy</legend>
          <p className="field-help">
            M2 sends nothing to an AI provider. This preference is not blanket consent.
          </p>
          <label className="choice-card">
            <input
              type="radio"
              name="privacy"
              checked={profile.aiPrivacyMode === "local_only"}
              onChange={() => update("aiPrivacyMode", "local_only")}
            />
            <span>
              <strong>Keep my notes inside CodeLift</strong>
              <small>Recommended</small>
            </span>
          </label>
          <label className="choice-card">
            <input
              type="radio"
              name="privacy"
              checked={profile.aiPrivacyMode === "ask_before_external"}
              onChange={() => update("aiPrivacyMode", "ask_before_external")}
            />
            <span>Ask me before any future external AI use</span>
          </label>
        </fieldset>

        <div className="form-grid">
          <Field id="theme-preference" label="Theme">
            <select
              id="theme-preference"
              value={profile.themePreference}
              onChange={(event) =>
                update(
                  "themePreference",
                  event.target.value as OnboardingProfile["themePreference"]
                )
              }
            >
              <option value="system">Follow system</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Field>
          <Field id="motion-preference" label="Motion">
            <select
              id="motion-preference"
              value={profile.motionPreference}
              onChange={(event) =>
                update(
                  "motionPreference",
                  event.target.value as OnboardingProfile["motionPreference"]
                )
              }
            >
              <option value="system">Follow system</option>
              <option value="reduced">Reduced</option>
              <option value="gentle">Gentle</option>
            </select>
          </Field>
          <Field
            id="review-preference"
            label="Review preference"
            help="Review dates remain evidence-based; choose when the queue appears around a mission."
          >
            <select
              id="review-preference"
              value={profile.reviewPreference ?? "before_mission"}
              onChange={(event) =>
                update(
                  "reviewPreference",
                  event.target.value as NonNullable<OnboardingProfile["reviewPreference"]>
                )
              }
            >
              <option value="before_mission">Before the next mission</option>
              <option value="after_mission">After the mission</option>
            </select>
          </Field>
        </div>

        <button
          className="button button--primary"
          type="submit"
          disabled={csrfToken === null || submitting}
        >
          {submitting ? "Saving your plan…" : "Save and open Today"}
        </button>
      </form>
    </section>
  );
}

function TodayPage({
  user,
  csrfToken,
  onExpired
}: {
  user: AccountUser;
  csrfToken: string | null;
  onExpired: () => void;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; notice: MutationNotice }
    | { status: "ready"; data: AuthenticatedTodayResponse }
  >({ status: "loading" });
  const [mode, setMode] = useState<ProgressMode>("core");
  const [notice, setNotice] = useState<MutationNotice>(null);
  const [working, setWorking] = useState(false);
  const [evidenceKind, setEvidenceKind] = useState("text_explanation");
  const [evidenceLabel, setEvidenceLabel] = useState("");
  const [evidenceValue, setEvidenceValue] = useState("");
  const [confused, setConfused] = useState("");
  const [mentalModelChanged, setMentalModelChanged] = useState("");
  const [retrieveLater, setRetrieveLater] = useState("");
  const [scratch, setScratch] = useState("");

  const load = useCallback(() => {
    setState({ status: "loading" });
    fetchAuthenticatedToday()
      .then((data) => {
        setState({ status: "ready", data });
        setMode(data.progress?.selectedMode ?? "core");
        setConfused(data.progress?.reflection.confused ?? "");
        setMentalModelChanged(data.progress?.reflection.mentalModelChanged ?? "");
        setRetrieveLater(data.progress?.reflection.retrieveLater ?? "");
        if (data.day !== null) {
          setScratch(readScratch(window.localStorage, user.id, data.day.dayNumber));
        }
      })
      .catch((error: unknown) => {
        if (error instanceof AccountApiError && error.isAuthenticationFailure) {
          onExpired();
          return;
        }
        setState({ status: "error", notice: asNotice(error) });
      });
  }, [onExpired, user.id]);

  useEffect(load, [load]);

  function updateProgress(progress: ProgressDayResponse) {
    setState((current) =>
      current.status === "ready"
        ? { status: "ready", data: { ...current.data, progress } }
        : current
    );
  }

  async function mutate(
    action: (token: string) => Promise<ProgressDayResponse>,
    success: string
  ): Promise<boolean> {
    if (csrfToken === null) {
      setNotice({
        kind: "error",
        message:
          "Your security check expired. Your entries are still here. Refresh protection, then submit again.",
        requestId: null
      });
      return false;
    }
    setWorking(true);
    setNotice(null);
    try {
      const progress = await action(csrfToken);
      updateProgress(progress);
      setNotice({ kind: "success", message: success });
      return true;
    } catch (error: unknown) {
      if (error instanceof AccountApiError && error.isAuthenticationFailure) {
        onExpired();
        return false;
      }
      setNotice(asNotice(error));
      return false;
    } finally {
      setWorking(false);
    }
  }

  if (state.status === "loading") {
    return (
      <section className="account-panel account-state" role="status">
        <span className="state-orb" aria-hidden="true" />
        <h1>Preparing today’s protected mission…</h1>
        <p>No private mission content is shown until this request succeeds.</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="account-panel account-state" role="alert">
        <p className="eyebrow">Today unavailable</p>
        <h1>Your saved mission was not replaced with stale content.</h1>
        <Notice notice={state.notice} />
        <button className="button button--primary" type="button" onClick={load}>
          Try again
        </button>
      </section>
    );
  }

  if (state.data.selection === "future_start") {
    return (
      <section className="account-panel account-state">
        <p className="eyebrow">Your plan is ready</p>
        <h1>Your curriculum begins {state.data.futureStartDate}.</h1>
        <p>No progress record was created early. The public preview remains available.</p>
        <Link className="button button--primary" to="/curriculum/1">
          Preview Day 1
        </Link>
      </section>
    );
  }

  if (state.data.selection === "curriculum_complete") {
    return (
      <section className="account-panel account-state">
        <p className="eyebrow">365 verified returns</p>
        <h1>The curriculum is complete.</h1>
        <p>Your next step is a deliberate release and continuation plan.</p>
      </section>
    );
  }

  const day = state.data.day;
  const progress = state.data.progress;
  if (day === null || progress === null) {
    return (
      <section className="account-panel account-state" role="alert">
        <h1>Today could not be verified.</h1>
        <p>The server returned no selected curriculum day. No progress was changed.</p>
      </section>
    );
  }

  const terminal = progress.status === "core_completed" || progress.status === "recovery_completed";
  const inProgress = progress.status === "in_progress";
  const reviewPreference = user.profile?.reviewPreference ?? "before_mission";
  const companionRefreshKey = `${day.dayNumber}:${progress.status}`;

  return (
    <article className="today-layout">
      <header className="today-hero">
        <div>
          <p className="eyebrow">Welcome back, {user.profile?.displayName ?? "learner"}.</p>
          <p className="identity-line">
            You’re building toward{" "}
            {user.profile?.targetRoles[0] ?? "Full-Stack AI Application Engineer"}.
          </p>
          <h1>Today’s mission</h1>
          <p>Your next incomplete curriculum day is ready.</p>
          <blockquote className="intention">{user.profile?.implementationIntention}</blockquote>
        </div>
        <FocusOrbTimer recovery={mode === "recovery"} />
      </header>

      {reviewPreference === "before_mission" ? <TodayCompanion key={companionRefreshKey} /> : null}
      <DayTaskManager dayNumber={day.dayNumber} csrfToken={csrfToken} />

      <section className="mission-position" aria-label="Curriculum position">
        <span>Day {day.dayNumber} of 365</span>
        <span>Week {day.weekNumber}</span>
        <span>Month {day.monthNumber}</span>
        <span>{day.phaseTitle}</span>
      </section>

      <div className="today-grid">
        <section className="mission-card today-mission-card">
          <p className="eyebrow">{day.modeLabel}</p>
          <h2>{day.title}</h2>
          <p>{day.learningSeed}</p>
          <h3>Learning objective</h3>
          <p>{day.learningObjective}</p>
          <h3>Why this matters for AI engineering</h3>
          <p>{day.whyItMattersForAIEngineering}</p>
          <h3>Build task</h3>
          <p>{day.buildTask}</p>
          <div className="artifact-panel">
            <span aria-hidden="true">◆</span>
            <div>
              <h3>Tiny artifact</h3>
              <p>{day.tinyArtifact}</p>
            </div>
          </div>
        </section>

        <section className="mission-card">
          <p className="eyebrow">Thirty-minute path</p>
          <h2>Make the state transition visible</h2>
          <ol className="compact-schedule">
            {day.coreSchedule.map((block) => (
              <li key={`${block.label}-${block.minutes}`}>
                <span>{block.label}</span>
                <strong>{block.minutes} min</strong>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="mission-card principle-card">
        <p className="eyebrow">Computer-systems principle</p>
        <h2>The idea beneath the task</h2>
        <blockquote>{day.corePrinciple}</blockquote>
        <p>
          <strong>Retrieve before looking back:</strong> {day.retrievalQuestion}
        </p>
      </section>

      <div className="today-grid">
        <section className="mission-card">
          <p className="eyebrow">Mental model</p>
          <h2>A compact way to reason about it</h2>
          <p>{day.mentalModel}</p>
        </section>
        <section className="mission-card misconception-card">
          <p className="eyebrow">Common mistake</p>
          <h2>What to notice before it becomes a bug</h2>
          <p>{day.commonMistake}</p>
        </section>
      </div>

      <section className="mission-card knowledge-workspace">
        <p className="eyebrow">Knowledge checks</p>
        <h2>Recall, apply, then explain why.</h2>
        <div className="knowledge-grid">
          {day.knowledgeChecks.map((check) => (
            <article className="knowledge-card" key={`${check.kind}-${check.prompt}`}>
              <p className="eyebrow">{check.kind.replaceAll("_", " ")}</p>
              <h3>{check.prompt}</h3>
              <details>
                <summary>Show hint</summary>
                <p>{check.hint}</p>
                <details>
                  <summary>Show explanation</summary>
                  <p>{check.explanation}</p>
                </details>
              </details>
            </article>
          ))}
        </div>
        <label className="scratch-area" htmlFor={`scratch-${day.dayNumber}`}>
          <span>Private notes / code scratch area</span>
          <textarea
            id={`scratch-${day.dayNumber}`}
            rows={8}
            maxLength={SCRATCH_MAX_LENGTH}
            value={scratch}
            onChange={(event) => {
              const value = event.target.value.slice(0, SCRATCH_MAX_LENGTH);
              setScratch(value);
              writeScratch(window.localStorage, user.id, day.dayNumber, value);
            }}
            placeholder="Reconstruct the idea, write pseudocode, or keep a tiny code draft. This browser-local scratch is not completion evidence."
          />
        </label>
        <p>
          <strong>Teach it back:</strong> {day.teachBackPrompt}
        </p>
      </section>

      <section className="mission-card mission-controls">
        <p className="eyebrow">Choose today’s honest path</p>
        <h2>Core and Recovery stay distinct.</h2>
        {inProgress ? null : <Notice notice={notice} />}
        <fieldset disabled={inProgress || terminal}>
          <legend className="visually-hidden">Mission mode</legend>
          <div className="mode-grid">
            <label className="mode-card mode-card--core">
              <input
                type="radio"
                name="mission-mode"
                value="core"
                checked={mode === "core"}
                onChange={() => setMode("core")}
              />
              <span>
                <strong>Core mission · 30 minutes</strong>
                <small>Complete the full schedule and save evidence.</small>
              </span>
            </label>
            <label className="mode-card mode-card--recovery">
              <input
                type="radio"
                name="mission-mode"
                value="recovery"
                checked={mode === "recovery"}
                onChange={() => setMode("recovery")}
              />
              <span>
                <strong>Recovery win · up to 5 minutes</strong>
                <small>{day.recoveryTask}</small>
              </span>
            </label>
          </div>
        </fieldset>

        <details className="stretch-disclosure">
          <summary>Optional Stretch · add after Core</summary>
          <p>{day.optionalStretchSeed}</p>
        </details>

        {progress.status === "not_started" ||
        progress.status === "opened" ||
        progress.status === "rescheduled" ? (
          <button
            className="button button--primary"
            type="button"
            disabled={working || csrfToken === null}
            onClick={() =>
              mutate(
                (token) =>
                  updateProgressStatus(
                    day.dayNumber,
                    {
                      intent: "start",
                      mode,
                      idempotencyKey: `start-${day.dayNumber}-${mode}`
                    },
                    token
                  ),
                mode === "core"
                  ? "Core mission started. Your work can now be saved."
                  : "Recovery win started. Keep the evidence small and explicit."
              )
            }
          >
            {mode === "core" ? "Start 30-minute Core mission" : "Start Recovery win"}
          </button>
        ) : null}

        <p className="saved-state">
          Status: <strong>{progress.status.replaceAll("_", " ")}</strong>
          {progress.updatedAt === null
            ? " · Nothing saved yet"
            : ` · Last saved ${new Date(progress.updatedAt).toLocaleString()}`}
        </p>
      </section>

      {inProgress ? (
        <section className="mission-card evidence-workspace">
          <p className="eyebrow">Evidence and reflection</p>
          <h2>Record what actually happened.</h2>
          <Notice notice={notice} />
          <div className="form-grid">
            <Field id="evidence-kind" label="Evidence kind">
              <select
                id="evidence-kind"
                value={evidenceKind}
                onChange={(event) => setEvidenceKind(event.target.value)}
              >
                <option value="text_explanation">Text explanation</option>
                <option value="commit_url">Commit URL</option>
                <option value="test_name">Test name</option>
                <option value="screenshot_url">Screenshot URL</option>
                <option value="demo_url">Demo URL</option>
                <option value="local_artifact_path">Local artifact path</option>
              </select>
            </Field>
            <Field id="evidence-label" label="Evidence label">
              <input
                id="evidence-label"
                maxLength={120}
                value={evidenceLabel}
                onChange={(event) => setEvidenceLabel(event.target.value)}
              />
            </Field>
          </div>
          <Field id="evidence-value" label="Evidence value">
            <textarea
              id="evidence-value"
              rows={3}
              maxLength={2_000}
              value={evidenceValue}
              onChange={(event) => setEvidenceValue(event.target.value)}
            />
          </Field>

          <div className="reflection-grid">
            <Field id="reflection-confused" label="What confused me?">
              <textarea
                id="reflection-confused"
                rows={3}
                maxLength={1_000}
                value={confused}
                onChange={(event) => setConfused(event.target.value)}
              />
            </Field>
            <Field id="reflection-model" label="What changed in my mental model?">
              <textarea
                id="reflection-model"
                rows={3}
                maxLength={1_000}
                value={mentalModelChanged}
                onChange={(event) => setMentalModelChanged(event.target.value)}
              />
            </Field>
            <Field id="reflection-retrieve" label="What will I retrieve later?">
              <textarea
                id="reflection-retrieve"
                rows={3}
                maxLength={1_000}
                value={retrieveLater}
                onChange={(event) => setRetrieveLater(event.target.value)}
              />
            </Field>
          </div>

          <div className="button-row">
            <button
              className="button button--secondary"
              type="button"
              disabled={
                working || evidenceLabel.trim().length === 0 || evidenceValue.trim().length === 0
              }
              onClick={() =>
                mutate(
                  (token) =>
                    addProgressEvidence(
                      day.dayNumber,
                      {
                        kind: evidenceKind,
                        label: evidenceLabel,
                        value: evidenceValue,
                        idempotencyKey: `evidence-${crypto.randomUUID()}`
                      },
                      token
                    ),
                  "Mission evidence saved."
                ).then((saved) => {
                  if (saved) {
                    setEvidenceLabel("");
                    setEvidenceValue("");
                  }
                })
              }
            >
              Add evidence
            </button>
            <button
              className="button button--secondary"
              type="button"
              disabled={working}
              onClick={() =>
                mutate(
                  (token) =>
                    saveProgressReflection(
                      day.dayNumber,
                      {
                        confused,
                        mentalModelChanged,
                        retrieveLater,
                        idempotencyKey: `reflection-${crypto.randomUUID()}`
                      },
                      token
                    ),
                  "Reflection draft saved."
                )
              }
            >
              Save reflection
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={working}
              onClick={() =>
                mutate(
                  (token) =>
                    updateProgressStatus(
                      day.dayNumber,
                      {
                        intent: "complete",
                        mode,
                        expectedVersion: progress.version,
                        idempotencyKey: `complete-${day.dayNumber}-${mode}`
                      },
                      token
                    ),
                  mode === "core"
                    ? "Core mission recorded with evidence."
                    : "Recovery win recorded separately. A five-minute return still protects your next step."
                )
              }
            >
              {mode === "core" ? "Complete Core mission" : "Record Recovery win"}
            </button>
          </div>

          {progress.evidence.length === 0 ? null : (
            <div className="saved-evidence">
              <h3>Saved evidence</h3>
              <ul>
                {progress.evidence.map((item) => (
                  <li key={item.id}>
                    <strong>{item.label}</strong>
                    <span>{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : null}

      {terminal ? (
        <section className="mission-card completion-state" role="status">
          <ParticleBurst label="A small evidence-backed completion celebration" />
          <p className="eyebrow">Persisted completion</p>
          <h2>
            {progress.status === "core_completed"
              ? "Core mission recorded with evidence."
              : "Recovery win recorded separately."}
          </h2>
          <p>
            {progress.status === "recovery_completed"
              ? "A five-minute return still protects your next step."
              : "Your next incomplete curriculum day will be selected when you return."}
          </p>
          <button className="button button--primary" type="button" onClick={load}>
            Open the next useful step
          </button>
        </section>
      ) : null}

      {reviewPreference === "after_mission" ? <TodayCompanion key={companionRefreshKey} /> : null}

      <section className="mission-card resource-trail">
        <p className="eyebrow">Course trail</p>
        <h2>Use the official resource, then build.</h2>
        <ul>
          {day.resourceLinks.map((resource) => (
            <li key={resource.id}>
              <a href={resource.url} target="_blank" rel="noopener noreferrer">
                <span>{resource.provider}</span>
                <strong>{resource.title}</strong>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function AccountPage({
  user,
  csrfToken,
  onSaved,
  onExpired,
  onSignedOut
}: {
  user: AccountUser;
  csrfToken: string | null;
  onSaved: (user: AccountUser) => void;
  onExpired: () => void;
  onSignedOut: () => void;
}) {
  const navigate = useNavigate();
  const [notice, setNotice] = useState<MutationNotice>(null);
  const [working, setWorking] = useState(false);
  const [profile, setProfile] = useState<OnboardingProfile>(() =>
    profileWithSettingsDefaults(user.profile ?? initialProfile())
  );

  useEffect(() => {
    if (user.profile !== null) {
      setProfile(profileWithSettingsDefaults(user.profile));
    }
  }, [user.profile]);

  function update<K extends keyof OnboardingProfile>(field: K, value: OnboardingProfile[K]) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function toggleRole(role: OnboardingProfile["targetRoles"][number]) {
    update(
      "targetRoles",
      profile.targetRoles.includes(role)
        ? profile.targetRoles.filter((candidate) => candidate !== role)
        : [...profile.targetRoles, role]
    );
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    if (csrfToken === null) {
      setNotice({
        kind: "error",
        message: "Protection is still loading. Your settings remain in this form.",
        requestId: null
      });
      return;
    }
    if (profile.targetRoles.length === 0) {
      setNotice({
        kind: "error",
        message: "Choose at least one target role.",
        requestId: null
      });
      return;
    }
    setWorking(true);
    try {
      const result = await saveOnboarding(profile, csrfToken);
      onSaved(result.user);
      setNotice({
        kind: "success",
        message: "Settings saved. Your next return will use these choices."
      });
    } catch (error: unknown) {
      if (error instanceof AccountApiError && error.isAuthenticationFailure) {
        onExpired();
        return;
      }
      setNotice(asNotice(error));
    } finally {
      setWorking(false);
    }
  }

  async function signOut() {
    if (csrfToken === null) {
      setNotice({
        kind: "error",
        message: "Protection is still loading. The server session remains active.",
        requestId: null
      });
      return;
    }
    setWorking(true);
    try {
      await logoutAccount(csrfToken);
      onSignedOut();
      navigate("/login", { replace: true });
    } catch (error: unknown) {
      if (error instanceof AccountApiError && error.isAuthenticationFailure) {
        onExpired();
        return;
      }
      setNotice(asNotice(error));
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="account-panel settings-panel">
      <PageIntro eyebrow="Private workspace" title="Account and preferences">
        Edit the plan, privacy, review, and display choices CodeLift saves for your account.
      </PageIntro>
      <Notice notice={notice} />
      {csrfToken === null ? (
        <p className="form-preparing" role="status">
          Preparing a protected settings form…
        </p>
      ) : null}

      <form className="account-form settings-form" onSubmit={saveSettings}>
        <div className="form-grid">
          <Field id="settings-email" label="Email address">
            <input id="settings-email" type="email" value={user.email} readOnly />
          </Field>
          <Field id="settings-display-name" label="Display name">
            <input
              id="settings-display-name"
              required
              maxLength={60}
              value={profile.displayName}
              onChange={(event) => update("displayName", event.target.value)}
            />
          </Field>
          <Field id="settings-timezone" label="Timezone">
            <input
              id="settings-timezone"
              required
              maxLength={100}
              value={profile.timezone}
              onChange={(event) => update("timezone", event.target.value)}
            />
          </Field>
          <Field id="settings-start-date" label="Curriculum start date">
            <input
              id="settings-start-date"
              type="date"
              required
              value={profile.startDate}
              onChange={(event) => update("startDate", event.target.value)}
            />
          </Field>
          <Field id="settings-coding-time" label="Preferred coding time">
            <input
              id="settings-coding-time"
              type="time"
              required
              value={profile.preferredCodingTime}
              onChange={(event) => update("preferredCodingTime", event.target.value)}
            />
          </Field>
          <Field id="settings-routine-cue" label="Routine cue">
            <input
              id="settings-routine-cue"
              required
              maxLength={120}
              value={profile.routineCue}
              onChange={(event) => update("routineCue", event.target.value)}
            />
          </Field>
          <Field id="settings-coding-place" label="Coding place">
            <input
              id="settings-coding-place"
              required
              maxLength={120}
              value={profile.codingPlace}
              onChange={(event) => update("codingPlace", event.target.value)}
            />
          </Field>
          <Field
            id="settings-commitment"
            label="Daily commitment"
            help="Core remains a focused 30-minute mission; Recovery remains a distinct shorter return."
          >
            <input id="settings-commitment" value="30 minutes" readOnly />
          </Field>
        </div>

        <Field
          id="settings-implementation-intention"
          label="Implementation intention"
          help="This is learner-authored; changing another setting will not overwrite it."
        >
          <textarea
            id="settings-implementation-intention"
            required
            maxLength={300}
            rows={3}
            value={profile.implementationIntention}
            onChange={(event) => update("implementationIntention", event.target.value)}
          />
        </Field>

        <Field id="settings-why" label="Why this matters">
          <textarea
            id="settings-why"
            required
            maxLength={500}
            rows={4}
            value={profile.whyItMatters}
            onChange={(event) => update("whyItMatters", event.target.value)}
          />
        </Field>

        <Field
          id="settings-github"
          label="GitHub username (optional)"
          help="Leave blank when you do not want to connect portfolio evidence."
        >
          <input
            id="settings-github"
            maxLength={39}
            value={profile.githubUsername}
            onChange={(event) => update("githubUsername", event.target.value)}
          />
        </Field>

        <fieldset>
          <legend>Target roles</legend>
          <div className="choice-grid">
            {TARGET_ROLE_OPTIONS.map((role) => (
              <label className="choice-card" key={role}>
                <input
                  type="checkbox"
                  checked={profile.targetRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                <span>{role}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>AI privacy</legend>
          <p className="field-help">
            This preference is not blanket consent for sending private notes to an external model.
          </p>
          <label className="choice-card">
            <input
              type="radio"
              name="settings-privacy"
              checked={profile.aiPrivacyMode === "local_only"}
              onChange={() => update("aiPrivacyMode", "local_only")}
            />
            <span>
              <strong>Keep my notes inside CodeLift</strong>
              <small>Recommended</small>
            </span>
          </label>
          <label className="choice-card">
            <input
              type="radio"
              name="settings-privacy"
              checked={profile.aiPrivacyMode === "ask_before_external"}
              onChange={() => update("aiPrivacyMode", "ask_before_external")}
            />
            <span>Ask me before any external AI use</span>
          </label>
        </fieldset>

        <div className="form-grid">
          <Field
            id="settings-review-preference"
            label="Review preference"
            help="The +1/+3/+7/+14/+30 review schedule remains evidence-based."
          >
            <select
              id="settings-review-preference"
              value={profile.reviewPreference ?? "before_mission"}
              onChange={(event) =>
                update(
                  "reviewPreference",
                  event.target.value as NonNullable<OnboardingProfile["reviewPreference"]>
                )
              }
            >
              <option value="before_mission">Show reviews before the next mission</option>
              <option value="after_mission">Show reviews after the mission</option>
            </select>
          </Field>
          <Field id="settings-theme" label="Theme">
            <select
              id="settings-theme"
              value={profile.themePreference}
              onChange={(event) =>
                update(
                  "themePreference",
                  event.target.value as OnboardingProfile["themePreference"]
                )
              }
            >
              <option value="system">Follow system</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Field>
          <Field id="settings-motion" label="Motion">
            <select
              id="settings-motion"
              value={profile.motionPreference}
              onChange={(event) =>
                update(
                  "motionPreference",
                  event.target.value as OnboardingProfile["motionPreference"]
                )
              }
            >
              <option value="system">Follow system</option>
              <option value="reduced">Reduced</option>
              <option value="gentle">Gentle</option>
            </select>
          </Field>
        </div>

        <button
          className="button button--primary"
          type="submit"
          disabled={working || csrfToken === null}
        >
          {working ? "Saving settings…" : "Save settings"}
        </button>
      </form>

      <div className="button-row">
        <button
          className="button button--secondary"
          type="button"
          disabled={working}
          onClick={signOut}
        >
          Sign out
        </button>
      </div>
      <div className="danger-zone">
        <h2>Delete account</h2>
        <p>Permanently remove product data owned by this account.</p>
        <Link className="button button--danger" to="/app/account/delete">
          Delete account
        </Link>
      </div>
    </section>
  );
}

function DeleteAccountPage({
  csrfToken,
  userId,
  onDeleted
}: {
  csrfToken: string | null;
  userId: string;
  onDeleted: (destination: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState<MutationNotice>(null);
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (csrfToken === null) {
      setNotice({
        kind: "error",
        message: "Protection is still loading. Your account remains intact.",
        requestId: null
      });
      return;
    }
    setWorking(true);
    setNotice(null);
    try {
      await deleteAccount({ password, confirmation }, csrfToken);
      clearUserScratchStorage(window.localStorage, userId);
      onDeleted("/login?deleted=1");
    } catch (error: unknown) {
      setNotice(asNotice(error));
      setPassword("");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="account-panel delete-panel">
      <PageIntro eyebrow="Permanent action" title="Delete your CodeLift account?">
        This permanently removes product data owned by this account. This cannot be undone.
      </PageIntro>
      <Notice notice={notice} />
      <form className="account-form" onSubmit={submit}>
        <Field id="delete-password" label="Current password">
          <input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            required
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field
          id="delete-confirmation"
          label="Type DELETE to confirm"
          help="The confirmation is case-sensitive."
        >
          <input
            id="delete-confirmation"
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </Field>
        <div className="button-row">
          <button
            className="button button--danger"
            type="submit"
            disabled={working || confirmation !== "DELETE"}
          >
            Permanently delete my account
          </button>
          <Link className="button button--quiet" to="/app/account">
            Keep my account
          </Link>
        </div>
      </form>
    </section>
  );
}

type AccountOutletContextValue = {
  session: Extract<SessionState, { status: "anonymous" | "authenticated" }>;
  csrfToken: string | null;
  authenticate: (user: AccountUser, csrfToken: string, destination: string) => void;
  updateUser: (user: AccountUser) => void;
  clearSession: (destination?: string) => void;
  expireSession: () => void;
};

export function AccountExperience() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionState>({ status: "checking" });
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [bootstrapKey, setBootstrapKey] = useState(0);
  const [postAuthenticationPath, setPostAuthenticationPath] = useState<string | null>(null);
  const [postSessionDestination, setPostSessionDestination] = useState<string | null>(null);
  const themePreference =
    session.status === "authenticated"
      ? (session.user.profile?.themePreference ?? "system")
      : "system";
  const motionPreference =
    session.status === "authenticated"
      ? (session.user.profile?.motionPreference ?? "system")
      : "system";

  useEffect(() => {
    const root = document.documentElement;

    if (themePreference === "system") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = themePreference;
    }

    if (motionPreference === "system" || motionPreference === "gentle") {
      delete root.dataset.motion;
    } else {
      root.dataset.motion = motionPreference;
    }

    return () => {
      delete root.dataset.theme;
      delete root.dataset.motion;
    };
  }, [motionPreference, themePreference]);

  useEffect(() => {
    const controller = new AbortController();
    setSession({ status: "checking" });
    fetchMe(controller.signal)
      .then((result) => {
        setSession(
          result.authenticated
            ? { status: "authenticated", user: result.user }
            : { status: "anonymous" }
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (error instanceof AccountApiError && error.isAuthenticationFailure) {
          setSession({ status: "expired" });
          return;
        }
        setSession({
          status: "unavailable",
          message:
            error instanceof AccountApiError
              ? error.message
              : "CodeLift could not verify the private workspace.",
          requestId: error instanceof AccountApiError ? error.requestId : null
        });
      });
    return () => controller.abort();
  }, [bootstrapKey]);

  useEffect(() => {
    if (
      session.status === "checking" ||
      session.status === "unavailable" ||
      session.status === "expired" ||
      csrfToken !== null
    ) {
      return;
    }
    const controller = new AbortController();
    fetchCsrf(controller.signal)
      .then((result) => setCsrfToken(result.csrfToken))
      .catch(() => {
        // The individual form retains its entries and explains that protection is pending.
      });
    return () => controller.abort();
  }, [csrfToken, session.status]);

  const pathname = location.pathname;
  const isDevelopmentAdminPath = import.meta.env.DEV && pathname === "/admin";
  let resolvedPath = pathname;
  if (session.status === "anonymous") {
    if (pathname === "/" || pathname.startsWith("/app/") || isDevelopmentAdminPath) {
      resolvedPath = "/login";
    }
  } else if (session.status === "authenticated") {
    if (pathname === "/") {
      resolvedPath = session.user.onboardingComplete ? "/app/today" : "/app/onboarding";
    } else if (!session.user.onboardingComplete && pathname !== "/app/onboarding") {
      resolvedPath = "/app/onboarding";
    } else if (
      session.user.onboardingComplete &&
      (pathname === "/login" || pathname === "/register")
    ) {
      resolvedPath = postAuthenticationPath ?? "/app/today";
    }
  }

  const expireSession = useCallback(() => {
    setCsrfToken(null);
    setSession({ status: "expired" });
  }, []);

  const authenticate = useCallback((user: AccountUser, token: string, destination: string) => {
    setPostAuthenticationPath(destination);
    setSession({ status: "authenticated", user });
    setCsrfToken(token);
  }, []);

  const updateUser = useCallback((user: AccountUser) => {
    setSession({ status: "authenticated", user });
  }, []);

  const clearSession = useCallback((destination?: string) => {
    setPostAuthenticationPath(null);
    setPostSessionDestination(destination ?? null);
    setCsrfToken(null);
    setSession({ status: "anonymous" });
  }, []);

  useEffect(() => {
    if (postAuthenticationPath === pathname) {
      setPostAuthenticationPath(null);
    }
  }, [pathname, postAuthenticationPath]);

  useEffect(() => {
    if (
      postSessionDestination !== null &&
      `${location.pathname}${location.search}` === postSessionDestination
    ) {
      setPostSessionDestination(null);
    }
  }, [location.pathname, location.search, postSessionDestination]);

  if (session.status === "checking") {
    return <CheckingWorkspace />;
  }
  if (session.status === "unavailable") {
    return (
      <UnavailableWorkspace state={session} retry={() => setBootstrapKey((value) => value + 1)} />
    );
  }
  if (session.status === "expired") {
    return (
      <SessionEnded
        onSignIn={() => {
          clearSession();
          navigate("/login", { replace: true });
        }}
      />
    );
  }

  if (
    session.status === "anonymous" &&
    postSessionDestination !== null &&
    `${location.pathname}${location.search}` !== postSessionDestination
  ) {
    return <Navigate replace to={postSessionDestination} />;
  }

  if (resolvedPath !== pathname) {
    const search =
      session.status === "anonymous" && ALLOWED_RETURN_PATHS.has(pathname)
        ? `?returnTo=${encodeURIComponent(pathname)}`
        : "";
    return <Navigate replace to={{ pathname: resolvedPath, search }} />;
  }

  return (
    <Outlet
      context={
        {
          session,
          csrfToken,
          authenticate,
          updateUser,
          clearSession,
          expireSession
        } satisfies AccountOutletContextValue
      }
    />
  );
}

function useAccountOutlet(): AccountOutletContextValue {
  return useOutletContext<AccountOutletContextValue>();
}

export function AccountAuthRoute({ mode }: { mode: "register" | "login" }) {
  const context = useAccountOutlet();
  if (context.session.status !== "anonymous") {
    return <CheckingWorkspace />;
  }

  return (
    <AuthPage
      key={mode}
      mode={mode}
      csrfToken={context.csrfToken}
      onAuthenticated={context.authenticate}
    />
  );
}

export function AccountOnboardingRoute() {
  const context = useAccountOutlet();
  if (context.session.status !== "authenticated") {
    return <CheckingWorkspace />;
  }

  return <OnboardingPage csrfToken={context.csrfToken} onSaved={context.updateUser} />;
}

export function AccountTodayRoute() {
  const context = useAccountOutlet();
  if (context.session.status !== "authenticated") {
    return <CheckingWorkspace />;
  }

  return (
    <TodayPage
      user={context.session.user}
      csrfToken={context.csrfToken}
      onExpired={context.expireSession}
    />
  );
}

export function AccountSettingsRoute() {
  const context = useAccountOutlet();
  if (context.session.status !== "authenticated") {
    return <CheckingWorkspace />;
  }

  return (
    <AccountPage
      user={context.session.user}
      csrfToken={context.csrfToken}
      onSaved={context.updateUser}
      onExpired={context.expireSession}
      onSignedOut={context.clearSession}
    />
  );
}

export function AccountDeletionRoute() {
  const context = useAccountOutlet();
  if (context.session.status !== "authenticated") {
    return <CheckingWorkspace />;
  }

  return (
    <DeleteAccountPage
      csrfToken={context.csrfToken}
      userId={context.session.user.id}
      onDeleted={context.clearSession}
    />
  );
}

export function AccountWorkspaceRoute({ pathname }: { pathname: string }) {
  const context = useAccountOutlet();
  if (context.session.status !== "authenticated") {
    return <CheckingWorkspace />;
  }

  return (
    <WorkspaceExperience
      pathname={pathname}
      csrfToken={context.csrfToken}
      user={context.session.user}
    />
  );
}
