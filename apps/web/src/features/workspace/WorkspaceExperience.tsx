import type {
  AccountUser,
  CoachAction,
  PlannerRun,
  PortfolioArtifact,
  ReviewItem
} from "@codelift/contracts";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";

import { AccountApiError } from "../account/api/accountApi";
import { AdminPage } from "../admin/AdminPage";
import { GalleryPage } from "../gallery/GalleryPage";
import { SearchRagPage } from "../search/SearchRagPage";
import { TasksPage } from "../tasks/TasksPage";
import { learningApi } from "./api/learningApi";
import {
  CodeGarden,
  EvidenceCard,
  JourneyMap,
  MilestonePeak,
  MomentumOrbit,
  ReviewQueueMini,
  SkillConstellation,
  WeeklyStory
} from "./components/SignatureGraphics";
import { workspacePathsForEnvironment } from "./workspacePaths";

type LoadState<T> =
  { status: "loading" } | { status: "ready"; data: T } | { status: "error"; message: string };

function errorMessage(error: unknown): string {
  return error instanceof AccountApiError
    ? error.message
    : "CodeLift could not verify this workspace view. No saved data was replaced.";
}

function useLoad<T>(loader: (signal: AbortSignal) => Promise<T>) {
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    loader(controller.signal)
      .then((data) => setState({ status: "ready", data }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error", message: errorMessage(error) });
      });
    return () => controller.abort();
  }, [loader, reload]);
  return {
    state,
    reload: () => setReload((value) => value + 1)
  };
}

function WorkspaceIntro({
  eyebrow,
  title,
  children
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <header className="workspace-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{children}</p>
    </header>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <section className="mission-card workspace-state" role="status">
      <span className="state-orb" aria-hidden="true" />
      <h1>Loading {label}…</h1>
      <p>Private data appears only after the protected request succeeds.</p>
    </section>
  );
}

function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <section className="mission-card workspace-state" role="alert">
      <p className="eyebrow">Verified data unavailable</p>
      <h1>This view was not replaced with invented state.</h1>
      <p>{message}</p>
      <button className="button button--primary" type="button" onClick={retry}>
        Try again
      </button>
    </section>
  );
}

export function TodayCompanion() {
  const loader = useCallback((signal: AbortSignal) => learningApi.dashboard(signal), []);
  const { state, reload } = useLoad(loader);
  if (state.status === "loading") {
    return <Loading label="your progress overview" />;
  }
  if (state.status === "error") {
    return <LoadError message={state.message} retry={reload} />;
  }
  const dashboard = state.data;
  return (
    <section className="today-companion" aria-label="Today progress overview">
      {dashboard.missedCalendarDays > 0 ? (
        <article className="recovery-card">
          <p className="eyebrow">A calendar gap is not a curriculum gap</p>
          <h2>Continue from Day {dashboard.summary.currentDayNumber}.</h2>
          <p>
            No perfect streak required. CodeLift counted {dashboard.missedCalendarDays} calendar gap
            {dashboard.missedCalendarDays === 1 ? "" : "s"} without skipping a mission.
          </p>
          <a className="button button--quiet" href="/app/roadmap">
            Review humane catch-up choices
          </a>
        </article>
      ) : null}
      <div className="signature-grid">
        <JourneyMap days={dashboard.journey} compact />
        <MomentumOrbit summary={dashboard.summary} />
        <article className="mini-focus-card">
          <p className="eyebrow">Retrieval queue</p>
          <ReviewQueueMini reviews={dashboard.reviewsDue} />
          <a href="/app/reviews">Open closed-note reviews</a>
        </article>
        <article className="mini-focus-card">
          <p className="eyebrow">Portfolio focus</p>
          <h3>{dashboard.portfolioFocus?.title ?? "Your first artifact"}</h3>
          <p>
            {dashboard.portfolioFocus?.status.replaceAll("_", " ") ??
              "No portfolio update is required yet."}
          </p>
          <a href="/app/portfolio">Open the Code Garden</a>
        </article>
      </div>
      <WeeklyStory
        summary={dashboard.summary}
        reviewCount={dashboard.reviewsDue.length}
        evidenceCount={dashboard.recentEvidence.length}
      />
      {dashboard.recentEvidence.length > 0 ? (
        <div>
          <h2>Recent evidence</h2>
          <div className="evidence-card-grid">
            {dashboard.recentEvidence.map((evidence) => (
              <EvidenceCard
                {...evidence}
                key={`${evidence.dayNumber}-${evidence.createdAt}-${evidence.label}`}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function DayTaskManager({
  dayNumber,
  csrfToken
}: {
  dayNumber: number;
  csrfToken: string | null;
}) {
  const loader = useCallback(
    (signal: AbortSignal) => learningApi.taskPlan(dayNumber, signal),
    [dayNumber]
  );
  const { state, reload } = useLoad(loader);
  const [title, setTitle] = useState("");
  const [estimate, setEstimate] = useState(10);
  const [actualMinutes, setActualMinutes] = useState(0);
  const [rescheduledFor, setRescheduledFor] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== "ready") return;
    setActualMinutes(state.data.actualMinutes);
    setRescheduledFor(state.data.rescheduledFor ?? "");
    setElapsedSeconds(state.data.timerSeconds);
  }, [state]);

  useEffect(() => {
    if (state.status !== "ready" || state.data.timerState !== "running") return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((value) => Math.min(86_400, value + 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [state]);

  if (state.status === "loading") return <Loading label="today’s task plan" />;
  if (state.status === "error") return <LoadError message={state.message} retry={reload} />;

  const plan = state.data;
  const editableStatus =
    plan.status === "rescheduled"
      ? ("rescheduled" as const)
      : plan.status === "not_started"
        ? ("not_started" as const)
        : ("opened" as const);

  async function save(overrides: {
    subtasks?: typeof plan.subtasks;
    status?: "not_started" | "opened" | "rescheduled";
    timerState?: "paused" | "running";
    timerSeconds?: number;
    rescheduledFor?: string | null;
  }) {
    if (csrfToken === null) return;
    const desiredStatus = overrides.status ?? editableStatus;
    const desiredReschedule =
      desiredStatus === "rescheduled" ? (overrides.rescheduledFor ?? rescheduledFor) || null : null;
    try {
      await learningApi.updateTaskPlan(
        dayNumber,
        {
          status: desiredStatus,
          estimateMinutes: plan.estimateMinutes,
          actualMinutes,
          timerSeconds: overrides.timerSeconds ?? elapsedSeconds,
          timerState: overrides.timerState ?? plan.timerState,
          rescheduledFor: desiredReschedule,
          subtasks: overrides.subtasks ?? plan.subtasks,
          idempotencyKey: `task-${crypto.randomUUID()}`
        },
        csrfToken
      );
      setNotice("Task plan saved. Completion evidence remains a separate requirement.");
      reload();
    } catch (error: unknown) {
      setNotice(errorMessage(error));
    }
  }

  return (
    <section className="mission-card task-manager" aria-labelledby="task-manager-title">
      <p className="eyebrow">Task manager</p>
      <h2 id="task-manager-title">Break the mission into observable steps.</h2>
      <p>
        Estimate {plan.estimateMinutes} minutes · actual {plan.actualMinutes} minutes · timer{" "}
        {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, "0")}
      </p>
      {plan.nextSubtask === null ? (
        <p>No unfinished custom subtask. The curriculum build task remains the next dependency.</p>
      ) : (
        <p>
          <strong>Next dependency-aware step:</strong> {plan.nextSubtask.title}
        </p>
      )}
      <ul className="task-subtasks">
        {plan.subtasks.map((subtask) => (
          <li key={subtask.id}>
            <label>
              <input
                type="checkbox"
                checked={subtask.completed}
                onChange={() =>
                  save({
                    subtasks: plan.subtasks.map((candidate) =>
                      candidate.id === subtask.id
                        ? { ...candidate, completed: !candidate.completed }
                        : candidate
                    )
                  })
                }
              />
              <span>
                {subtask.title} · {subtask.estimateMinutes}m estimate · {subtask.actualMinutes}m
                actual
              </span>
            </label>
          </li>
        ))}
      </ul>
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim().length === 0) return;
          void save({
            status: plan.status === "not_started" ? "opened" : editableStatus,
            subtasks: [
              ...plan.subtasks,
              {
                id: crypto.randomUUID(),
                title: title.trim(),
                estimateMinutes: estimate,
                actualMinutes: 0,
                completed: false
              }
            ]
          }).then(() => setTitle(""));
        }}
      >
        <label>
          New subtask
          <input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          Estimate minutes
          <input
            type="number"
            min="1"
            max="240"
            value={estimate}
            onChange={(event) => setEstimate(Number(event.target.value))}
          />
        </label>
        <button className="button button--quiet" type="submit">
          Add subtask
        </button>
      </form>
      <div className="form-grid">
        <label>
          Actual minutes
          <input
            type="number"
            min="0"
            max="1440"
            value={actualMinutes}
            onChange={(event) => setActualMinutes(Number(event.target.value))}
          />
        </label>
        <button className="button button--quiet" type="button" onClick={() => save({})}>
          Save actual time
        </button>
        <button
          className="button button--quiet"
          type="button"
          onClick={() =>
            save({
              timerState: plan.timerState === "running" ? "paused" : "running",
              timerSeconds: elapsedSeconds
            })
          }
        >
          {plan.timerState === "running" ? "Pause saved timer" : "Resume saved timer"}
        </button>
      </div>
      <div className="form-grid">
        <label>
          Reschedule this curriculum day
          <input
            type="date"
            value={rescheduledFor}
            onChange={(event) => setRescheduledFor(event.target.value)}
          />
        </label>
        <button
          className="button button--quiet"
          type="button"
          disabled={rescheduledFor === ""}
          onClick={() =>
            save({
              status: "rescheduled",
              rescheduledFor
            })
          }
        >
          Save reschedule
        </button>
      </div>
      {notice === null ? null : <p role="status">{notice}</p>}
    </section>
  );
}

function RoadmapPage({ csrfToken }: { csrfToken: string | null }) {
  const loader = useCallback((signal: AbortSignal) => learningApi.roadmap(signal), []);
  const { state, reload } = useLoad(loader);
  const [plan, setPlan] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  if (state.status === "loading") return <Loading label="the 365-day roadmap" />;
  if (state.status === "error") return <LoadError message={state.message} retry={reload} />;

  async function choose(strategy: "continue" | "calendar_catch_up" | "intentionally_skip") {
    if (csrfToken === null) return;
    setWorking(true);
    try {
      const result = await learningApi.catchUp(
        {
          strategy,
          reason,
          idempotencyKey: `catch-up-${strategy}-${crypto.randomUUID()}`
        },
        csrfToken
      );
      setPlan(
        `${result.explanation} ${result.items
          .map((item) => `Day ${item.dayNumber} on ${item.scheduledDate}`)
          .join("; ")}`
      );
      if (strategy === "intentionally_skip") reload();
    } catch (error: unknown) {
      setPlan(errorMessage(error));
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="workspace-page">
      <WorkspaceIntro eyebrow="Roadmap" title="The whole mountain stays visible.">
        Twelve milestones, 365 ordered missions, and a one-Core-per-day recovery plan.
      </WorkspaceIntro>
      <JourneyMap days={state.data.days} />
      <div className="milestone-grid">
        {state.data.milestones.map((milestone) => (
          <MilestonePeak
            key={milestone.monthNumber}
            title={`Month ${milestone.monthNumber} · ${milestone.title}`}
            completed={milestone.completedDays}
            total={milestone.totalDays}
          />
        ))}
      </div>
      <section className="mission-card">
        <p className="eyebrow">Seven-day preview</p>
        <h2>One useful next step per day</h2>
        <ol className="roadmap-preview">
          {state.data.sevenDayPreview.map((day) => (
            <li key={day.dayNumber}>
              <span>Day {day.dayNumber}</span>
              <strong>{day.title}</strong>
              <small>{day.tinyArtifact}</small>
            </li>
          ))}
        </ol>
      </section>
      <section className="mission-card">
        <p className="eyebrow">Autonomy without auto-skip</p>
        <h2>Choose how to continue.</h2>
        <label className="form-field" htmlFor="skip-reason">
          <span>Written reason (required only for an intentional skip)</span>
          <textarea
            id="skip-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <div className="button-row">
          <button
            className="button button--primary"
            type="button"
            disabled={working || csrfToken === null}
            onClick={() => choose("continue")}
          >
            Continue next incomplete
          </button>
          <button
            className="button button--secondary"
            type="button"
            disabled={working || csrfToken === null}
            onClick={() => choose("calendar_catch_up")}
          >
            Build catch-up plan
          </button>
          <button
            className="button button--quiet"
            type="button"
            disabled={working || csrfToken === null || reason.trim().length === 0}
            onClick={() => choose("intentionally_skip")}
          >
            Intentionally skip with reason
          </button>
        </div>
        {plan === null ? null : (
          <p className="form-notice form-notice--success" role="status">
            {plan}
          </p>
        )}
      </section>
    </section>
  );
}

function ReviewForm({
  review,
  csrfToken,
  onSaved
}: {
  review: ReviewItem;
  csrfToken: string | null;
  onSaved: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [before, setBefore] = useState(3);
  const [after, setAfter] = useState(3);
  const [misconception, setMisconception] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (csrfToken === null) return;
    try {
      await learningApi.submitReview(
        review.id,
        {
          answer,
          confidenceBefore: before,
          confidenceAfter: after,
          misconception,
          idempotencyKey: `review-${review.id}-${crypto.randomUUID()}`
        },
        csrfToken
      );
      onSaved();
    } catch (error: unknown) {
      setNotice(errorMessage(error));
    }
  }
  return (
    <form className="review-card" onSubmit={submit}>
      <p className="eyebrow">
        Day {review.sourceDayNumber} · +{review.intervalDays} day review
      </p>
      <h2>{review.prompt}</h2>
      <p className="closed-note-label">Closed-note mode · explanation is hidden</p>
      <label>
        Confidence before retrieval · {before}/5
        <input
          type="range"
          min="1"
          max="5"
          value={before}
          onChange={(event) => setBefore(Number(event.target.value))}
        />
      </label>
      <label>
        Reconstruct the answer
        <textarea
          required
          rows={5}
          maxLength={2_000}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
        />
      </label>
      <label>
        Confidence after retrieval · {after}/5
        <input
          type="range"
          min="1"
          max="5"
          value={after}
          onChange={(event) => setAfter(Number(event.target.value))}
        />
      </label>
      <label>
        Misconception noticed (optional)
        <textarea
          rows={2}
          maxLength={500}
          value={misconception}
          onChange={(event) => setMisconception(event.target.value)}
        />
      </label>
      {notice === null ? null : <p role="alert">{notice}</p>}
      <button
        className="button button--primary"
        type="submit"
        disabled={csrfToken === null || answer.trim().length === 0}
      >
        Save retrieval evidence
      </button>
    </form>
  );
}

function PeriodicReflectionPanel({ csrfToken }: { csrfToken: string | null }) {
  const loader = useCallback((signal: AbortSignal) => learningApi.periodicReflections(signal), []);
  const { state, reload } = useLoad(loader);
  const [dayNumber, setDayNumber] = useState(7);
  const [weeklySummary, setWeeklySummary] = useState("");
  const [monthlyRetrospective, setMonthlyRetrospective] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  if (state.status === "loading") return <Loading label="periodic reflections" />;
  if (state.status === "error") {
    return <LoadError message={state.message} retry={reload} />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (csrfToken === null) return;
    try {
      await learningApi.savePeriodicReflection(
        dayNumber,
        {
          weeklySummary,
          monthlyRetrospective,
          idempotencyKey: `retrospective-${crypto.randomUUID()}`
        },
        csrfToken
      );
      setNotice("Periodic reflection saved as learner-authored evidence.");
      reload();
    } catch (error: unknown) {
      setNotice(errorMessage(error));
    }
  }

  return (
    <section className="mission-card periodic-reflection">
      <p className="eyebrow">Weekly story / monthly retrospective</p>
      <h2>Interpret evidence without inventing progress.</h2>
      <form onSubmit={submit}>
        <label>
          Curriculum day represented
          <input
            type="number"
            min="1"
            max="365"
            value={dayNumber}
            onChange={(event) => setDayNumber(Number(event.target.value))}
          />
        </label>
        <label>
          Weekly reflection
          <textarea
            rows={4}
            maxLength={2_000}
            value={weeklySummary}
            onChange={(event) => setWeeklySummary(event.target.value)}
            placeholder="What evidence did I create, what misconception changed, and what is the next implementation intention?"
          />
        </label>
        <label>
          Monthly retrospective
          <textarea
            rows={5}
            maxLength={4_000}
            value={monthlyRetrospective}
            onChange={(event) => setMonthlyRetrospective(event.target.value)}
            placeholder="Which artifacts demonstrate growth, which skill needs retrieval, and what tradeoff will I change next month?"
          />
        </label>
        <button
          className="button button--secondary"
          type="submit"
          disabled={
            csrfToken === null ||
            (weeklySummary.trim().length === 0 && monthlyRetrospective.trim().length === 0)
          }
        >
          Save periodic reflection
        </button>
      </form>
      {notice === null ? null : <p role="status">{notice}</p>}
      <ul className="plain-list">
        {state.data.reflections.map((reflection) => (
          <li key={reflection.dayNumber}>
            <strong>Day {reflection.dayNumber}</strong> ·{" "}
            {reflection.weeklySummary || reflection.monthlyRetrospective}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReviewsPage({ csrfToken }: { csrfToken: string | null }) {
  const loader = useCallback((signal: AbortSignal) => learningApi.reviews(signal), []);
  const { state, reload } = useLoad(loader);
  if (state.status === "loading") return <Loading label="closed-note reviews" />;
  if (state.status === "error") return <LoadError message={state.message} retry={reload} />;
  return (
    <section className="workspace-page">
      <WorkspaceIntro eyebrow="Spaced retrieval" title="Prove what you can reconstruct.">
        Reviews return at approximately +1, +3, +7, +14, and +30 days. Confidence is evidence
        context, not a score of human worth.
      </WorkspaceIntro>
      {state.data.due.length === 0 ? (
        <section className="mission-card empty-state">
          <h2>No review is due today.</h2>
          <p>You can continue the next mission without manufacturing busywork.</p>
        </section>
      ) : (
        <div className="review-grid">
          {state.data.due.map((review) => (
            <ReviewForm key={review.id} review={review} csrfToken={csrfToken} onSaved={reload} />
          ))}
        </div>
      )}
      <section className="mission-card">
        <h2>Upcoming retrievals</h2>
        <ul className="plain-list">
          {state.data.upcoming.slice(0, 12).map((review) => (
            <li key={review.id}>
              <strong>{review.dueDate}</strong> · Day {review.sourceDayNumber} · {review.prompt}
            </li>
          ))}
        </ul>
      </section>
      <PeriodicReflectionPanel csrfToken={csrfToken} />
    </section>
  );
}

function SkillsPage() {
  const loader = useCallback((signal: AbortSignal) => learningApi.skills(signal), []);
  const { state, reload } = useLoad(loader);
  if (state.status === "loading") return <Loading label="the skill constellation" />;
  if (state.status === "error") return <LoadError message={state.message} retry={reload} />;
  return (
    <section className="workspace-page">
      <WorkspaceIntro eyebrow="Skills" title="Mastery is more than completion.">
        Skills move from introduced to practiced to demonstrated only through stored evidence.
      </WorkspaceIntro>
      <div className="metric-row">
        {Object.entries(state.data.counts).map(([label, count]) => (
          <div className="metric" key={label}>
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <SkillConstellation skills={state.data.skills} />
      <ul className="skill-list">
        {state.data.skills.map((skill) => (
          <li key={skill.skill}>
            <strong>{skill.skill}</strong>
            <span className={`state-pill state-pill--${skill.state}`}>{skill.state}</span>
            <small>Evidence days: {skill.evidenceDayNumbers.join(", ")}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PortfolioEditor({
  artifact,
  csrfToken,
  onSaved
}: {
  artifact: PortfolioArtifact;
  csrfToken: string | null;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(artifact.status);
  const [repositoryUrl, setRepositoryUrl] = useState(artifact.repositoryUrl ?? "");
  const [demoUrl, setDemoUrl] = useState(artifact.demoUrl ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (csrfToken === null) return;
    try {
      await learningApi.updatePortfolio(
        artifact.artifactKey,
        {
          status,
          repositoryUrl: repositoryUrl || null,
          demoUrl: demoUrl || null,
          screenshotUrls: artifact.screenshotUrls,
          skillsProven: artifact.skillsProven,
          testsAndEvals: artifact.testsAndEvals,
          tradeoffs: artifact.tradeoffs,
          limitations: artifact.limitations,
          interviewQuestions: artifact.interviewQuestions,
          evidenceLinks: artifact.evidenceLinks
        },
        csrfToken
      );
      onSaved();
    } catch (error: unknown) {
      setNotice(errorMessage(error));
    }
  }
  return (
    <form className="portfolio-card" onSubmit={submit}>
      <p className="eyebrow">Month {artifact.monthNumber}</p>
      <h2>{artifact.title}</h2>
      <label>
        Status
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as PortfolioArtifact["status"])}
        >
          <option value="not_started">Not started</option>
          <option value="draft">Draft</option>
          <option value="evidence_ready">Evidence ready</option>
          <option value="published">Published</option>
        </select>
      </label>
      <label>
        Repository URL
        <input
          type="url"
          value={repositoryUrl}
          onChange={(event) => setRepositoryUrl(event.target.value)}
        />
      </label>
      <label>
        Demo URL
        <input type="url" value={demoUrl} onChange={(event) => setDemoUrl(event.target.value)} />
      </label>
      <p>
        {artifact.skillsProven.length} skills · {artifact.testsAndEvals.length} tests/evals ·{" "}
        {artifact.evidenceLinks.length} evidence links
      </p>
      {notice === null ? null : <p role="alert">{notice}</p>}
      <button className="button button--quiet" type="submit" disabled={csrfToken === null}>
        Save artifact
      </button>
    </form>
  );
}

function CareerTracker({ csrfToken }: { csrfToken: string | null }) {
  const loader = useCallback((signal: AbortSignal) => learningApi.jobApplications(signal), []);
  const { state, reload } = useLoad(loader);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("researching");
  const [evidenceLinks, setEvidenceLinks] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  if (state.status === "loading") return <Loading label="career evidence" />;
  if (state.status === "error") return <LoadError message={state.message} retry={reload} />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (csrfToken === null) return;
    try {
      await learningApi.createJobApplication(
        {
          company,
          role,
          status,
          evidenceLinks: evidenceLinks
            .split(",")
            .map((link) => link.trim())
            .filter(Boolean),
          nextAction,
          idempotencyKey: `job-${crypto.randomUUID()}`
        },
        csrfToken
      );
      setCompany("");
      setRole("");
      setEvidenceLinks("");
      setNextAction("");
      setNotice("Application evidence saved without inventing an outcome.");
      reload();
    } catch (error: unknown) {
      setNotice(errorMessage(error));
    }
  }

  return (
    <section className="mission-card career-tracker">
      <p className="eyebrow">Career evidence</p>
      <h2>Track applications as an experiment, not a verdict.</h2>
      <form className="form-grid" onSubmit={submit}>
        <label>
          Company
          <input
            required
            maxLength={160}
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
        </label>
        <label>
          Role
          <input
            required
            maxLength={160}
            value={role}
            onChange={(event) => setRole(event.target.value)}
          />
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {["researching", "drafting", "applied", "screen", "interview", "offer", "closed"].map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              )
            )}
          </select>
        </label>
        <label>
          Portfolio evidence URLs, comma separated
          <input value={evidenceLinks} onChange={(event) => setEvidenceLinks(event.target.value)} />
        </label>
        <label>
          Next action
          <input
            required
            maxLength={500}
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
          />
        </label>
        <button className="button button--secondary" type="submit" disabled={csrfToken === null}>
          Save application
        </button>
      </form>
      {notice === null ? null : <p role="status">{notice}</p>}
      <ul className="plain-list">
        {state.data.applications.map((application) => (
          <li key={application.id}>
            <strong>
              {application.company} · {application.role}
            </strong>{" "}
            · {application.status} · next: {application.nextAction}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PortfolioPage({ csrfToken }: { csrfToken: string | null }) {
  const loader = useCallback((signal: AbortSignal) => learningApi.portfolio(signal), []);
  const { state, reload } = useLoad(loader);
  if (state.status === "loading") return <Loading label="the portfolio" />;
  if (state.status === "error") return <LoadError message={state.message} retry={reload} />;
  return (
    <section className="workspace-page">
      <WorkspaceIntro eyebrow="Portfolio" title="Grow the story from real evidence.">
        Tests add leaves, documentation adds roots, and a deployment adds the sunrise.
      </WorkspaceIntro>
      <CodeGarden artifacts={state.data.artifacts} />
      <CareerTracker csrfToken={csrfToken} />
      <div className="portfolio-grid">
        {state.data.artifacts.map((artifact) => (
          <PortfolioEditor
            key={artifact.artifactKey}
            artifact={artifact}
            csrfToken={csrfToken}
            onSaved={reload}
          />
        ))}
      </div>
    </section>
  );
}

function ErrorMuseumPage({ csrfToken }: { csrfToken: string | null }) {
  const loader = useCallback((signal: AbortSignal) => learningApi.errors(signal), []);
  const { state, reload } = useLoad(loader);
  const [form, setForm] = useState({
    title: "",
    dayNumber: "",
    bug: "",
    hypothesis: "",
    evidence: "",
    fix: "",
    test: "",
    lesson: "",
    tags: ""
  });
  const [notice, setNotice] = useState<string | null>(null);
  if (state.status === "loading") return <Loading label="the Error Museum" />;
  if (state.status === "error") return <LoadError message={state.message} retry={reload} />;

  function update(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (csrfToken === null) return;
    try {
      await learningApi.saveError(
        {
          title: form.title,
          dayNumber: form.dayNumber ? Number(form.dayNumber) : null,
          bug: form.bug,
          hypothesis: form.hypothesis,
          evidence: form.evidence,
          fix: form.fix,
          test: form.test,
          lesson: form.lesson,
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          idempotencyKey: `error-${crypto.randomUUID()}`
        },
        csrfToken
      );
      setForm({
        title: "",
        dayNumber: "",
        bug: "",
        hypothesis: "",
        evidence: "",
        fix: "",
        test: "",
        lesson: "",
        tags: ""
      });
      setNotice("You fixed a bug by using evidence, not guessing.");
      reload();
    } catch (error: unknown) {
      setNotice(errorMessage(error));
    }
  }
  return (
    <section className="workspace-page">
      <WorkspaceIntro eyebrow="Error Museum" title="Keep the lesson, not the shame.">
        A fixed bug becomes a searchable artifact: hypothesis, evidence, fix, test, and transferable
        lesson.
      </WorkspaceIntro>
      <form className="mission-card error-form" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Title
            <input
              required
              maxLength={120}
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
            />
          </label>
          <label>
            Curriculum day (optional)
            <input
              type="number"
              min="1"
              max="365"
              value={form.dayNumber}
              onChange={(event) => update("dayNumber", event.target.value)}
            />
          </label>
        </div>
        {(["bug", "hypothesis", "evidence", "fix", "test", "lesson"] as const).map((field) => (
          <label key={field}>
            {field[0]?.toUpperCase()}
            {field.slice(1)}
            <textarea
              required
              rows={3}
              maxLength={2_000}
              value={form[field]}
              onChange={(event) => update(field, event.target.value)}
            />
          </label>
        ))}
        <label>
          Tags, comma separated
          <input value={form.tags} onChange={(event) => update("tags", event.target.value)} />
        </label>
        {notice === null ? null : <p role="status">{notice}</p>}
        <button className="button button--primary" type="submit" disabled={csrfToken === null}>
          Add evidence-backed bug
        </button>
      </form>
      <div className="error-museum">
        {state.data.entries.map((entry) => (
          <article className="error-card" key={entry.id}>
            <p className="eyebrow">
              {entry.dayNumber === null ? "Learning artifact" : `Day ${entry.dayNumber}`}
            </p>
            <h2>{entry.title}</h2>
            {(["bug", "hypothesis", "evidence", "fix", "test", "lesson"] as const).map((field) => (
              <div key={field}>
                <h3>{field}</h3>
                <p>{entry[field]}</p>
              </div>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}

function CoachPage({ csrfToken, user }: { csrfToken: string | null; user: AccountUser }) {
  const [dayNumber, setDayNumber] = useState(1);
  const [action, setAction] = useState<CoachAction>("explain");
  const [learnerText, setLearnerText] = useState("");
  const [allowExternal, setAllowExternal] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof learningApi.coach>> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (csrfToken === null) return;
    try {
      setResult(
        await learningApi.coach({ action, dayNumber, learnerText, allowExternal }, csrfToken)
      );
      setNotice(null);
    } catch (error: unknown) {
      setNotice(errorMessage(error));
    }
  }
  return (
    <section className="workspace-page">
      <WorkspaceIntro
        eyebrow="Bounded AI Coach"
        title="Generated guidance, honest evidence boundary."
      >
        The coach can explain, ask, reflect, and suggest one tiny step. It cannot claim
        understanding, diagnose health, or promise employment.
      </WorkspaceIntro>
      <div className="two-column-workspace">
        <form className="mission-card" onSubmit={submit}>
          <label>
            Curriculum day
            <input
              type="number"
              min="1"
              max="365"
              value={dayNumber}
              onChange={(event) => setDayNumber(Number(event.target.value))}
            />
          </label>
          <label>
            Coach action
            <select
              value={action}
              onChange={(event) => setAction(event.target.value as CoachAction)}
            >
              <option value="explain">Explain the concept</option>
              <option value="socratic">Ask a Socratic question</option>
              <option value="reflect">Summarize a reflection</option>
              <option value="next_step">Suggest one tiny step</option>
              <option value="weekly_recap">Factual weekly recap</option>
              <option value="portfolio_story">Portfolio connection</option>
            </select>
          </label>
          <label>
            Learner-authored context (optional)
            <textarea
              rows={7}
              maxLength={4_000}
              value={learnerText}
              onChange={(event) => setLearnerText(event.target.value)}
            />
          </label>
          <label className="choice-card">
            <input
              type="checkbox"
              checked={allowExternal}
              disabled={user.profile?.aiPrivacyMode !== "ask_before_external"}
              onChange={(event) => setAllowExternal(event.target.checked)}
            />
            <span>
              Permit this one request to use the configured external provider
              <small>Profile mode: {user.profile?.aiPrivacyMode.replaceAll("_", " ")}</small>
            </span>
          </label>
          <button className="button button--primary" type="submit" disabled={csrfToken === null}>
            Generate bounded guidance
          </button>
          {notice === null ? null : <p role="alert">{notice}</p>}
        </form>
        <article className="mission-card coach-output" aria-live="polite">
          {result === null ? (
            <>
              <p className="eyebrow">Mock-first and private by default</p>
              <h2>Choose a bounded action.</h2>
              <p>A deterministic response works with no paid key or downloaded model.</p>
            </>
          ) : (
            <>
              <p className="eyebrow">Generated · {result.provider}</p>
              <h2>{result.heading}</h2>
              <p>{result.explanation}</p>
              <h3>Socratic question</h3>
              <p>{result.socraticQuestion}</p>
              <h3>Next tiny step</h3>
              <p>{result.nextTinyStep}</p>
              <p className="evidence-boundary">{result.evidenceBoundary}</p>
              <small>{result.safetyNote}</small>
            </>
          )}
        </article>
      </div>
    </section>
  );
}

function PlannerPage({ csrfToken }: { csrfToken: string | null }) {
  const currentMonday = new Date();
  currentMonday.setDate(currentMonday.getDate() - ((currentMonday.getDay() + 6) % 7));
  const [weekStart, setWeekStart] = useState(currentMonday.toISOString().slice(0, 10));
  const [minutes, setMinutes] = useState(210);
  const [priorities, setPriorities] = useState("reviews, portfolio evidence");
  const [run, setRun] = useState<PlannerRun | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (csrfToken === null) return;
    try {
      setRun(
        await learningApi.createPlan(
          {
            weekStart,
            availableMinutes: minutes,
            priorities: priorities
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            idempotencyKey: `planner-${crypto.randomUUID()}`
          },
          csrfToken
        )
      );
    } catch (error: unknown) {
      setNotice(errorMessage(error));
    }
  }
  async function decide(decision: "approve" | "revise") {
    if (csrfToken === null || run === null) return;
    try {
      setRun(
        await learningApi.decidePlan(
          run.id,
          decision,
          {
            note: decision === "revise" ? "Please create a smaller plan." : "",
            expectedStatus: "awaiting_approval",
            idempotencyKey: `planner-${decision}-${crypto.randomUUID()}`
          },
          csrfToken
        )
      );
    } catch (error: unknown) {
      setNotice(errorMessage(error));
    }
  }
  return (
    <section className="workspace-page">
      <WorkspaceIntro
        eyebrow="Approval-gated planner"
        title="Plan narrowly. Stop before side effects."
      >
        Before Month 11, CodeLift uses deterministic planning. Later agent mode retains typed
        budgets, a kill switch, duplicate detection, and human approval. Current approval accepts a
        proposal only; it does not save task state or change an external system.
      </WorkspaceIntro>
      <div className="two-column-workspace">
        <form className="mission-card" onSubmit={submit}>
          <label>
            Week starts
            <input
              type="date"
              value={weekStart}
              onChange={(event) => setWeekStart(event.target.value)}
            />
          </label>
          <label>
            Available minutes
            <input
              type="number"
              min="30"
              max="840"
              step="30"
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
            />
          </label>
          <label>
            Priorities, comma separated
            <textarea
              rows={3}
              value={priorities}
              onChange={(event) => setPriorities(event.target.value)}
            />
          </label>
          <button className="button button--primary" type="submit" disabled={csrfToken === null}>
            Propose a read-only week
          </button>
          {notice === null ? null : <p role="alert">{notice}</p>}
        </form>
        <article className="mission-card">
          {run === null ? (
            <>
              <h2>No plan proposed yet.</h2>
              <p>Nothing can schedule or message on your behalf from this state.</p>
            </>
          ) : (
            <>
              <p className="eyebrow">
                {run.mode.replaceAll("_", " ")} · {run.status.replaceAll("_", " ")}
              </p>
              <h2>Proposed week</h2>
              <p className="evidence-boundary">
                Approval policy: <strong>{run.approvalBehavior.replaceAll("_", " ")}</strong>.
                Accepting this proposal records your decision and does not persist these actions as
                tasks or calendar events.
              </p>
              <ol className="plain-list">
                {run.actions.map((action) => (
                  <li key={action.actionId}>
                    <strong>{action.date}</strong> · Day {action.dayNumber} · {action.minutes}{" "}
                    minutes
                    <small>{action.rationale}</small>
                  </li>
                ))}
              </ol>
              <dl className="budget-grid">
                <div>
                  <dt>Steps</dt>
                  <dd>
                    {run.budget.stepsUsed}/{run.budget.maxSteps}
                  </dd>
                </div>
                <div>
                  <dt>Estimated cost</dt>
                  <dd>${run.budget.estimatedCostUsd.toFixed(2)}</dd>
                </div>
                <div>
                  <dt>Terminal reason</dt>
                  <dd>{run.terminalReason.replaceAll("_", " ")}</dd>
                </div>
              </dl>
              <details className="trace-viewer">
                <summary>Inspect node and tool trace</summary>
                <ol className="plain-list" aria-label="Planner execution trace">
                  {run.trace.map((entry, index) => (
                    <li key={`${index}-${entry}`}>{entry}</li>
                  ))}
                </ol>
              </details>
              {run.status === "awaiting_approval" ? (
                <div className="button-row">
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={() => decide("approve")}
                  >
                    Accept proposal only
                  </button>
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() => decide("revise")}
                  >
                    Request smaller revision
                  </button>
                </div>
              ) : null}
            </>
          )}
        </article>
      </div>
    </section>
  );
}

function OperationsPage({ csrfToken }: { csrfToken: string | null }) {
  const loader = useCallback((signal: AbortSignal) => learningApi.operations(signal), []);
  const { state, reload } = useLoad(loader);
  const [runNotice, setRunNotice] = useState<string | null>(null);
  if (state.status === "loading") return <Loading label="AI operations" />;
  if (state.status === "error") return <LoadError message={state.message} retry={reload} />;
  async function runEval() {
    if (csrfToken === null) return;
    try {
      const result = await learningApi.runEval(csrfToken);
      setRunNotice(
        `Behavioral eval ${result.run.passed ? "passed" : "failed"} at ${(result.run.score * 100).toFixed(0)}% across ${result.run.cases.length} observed cases${
          result.run.criticalFailures.length === 0
            ? "."
            : `; critical failures: ${result.run.criticalFailures.join(", ")}.`
        }`
      );
      reload();
    } catch (error: unknown) {
      setRunNotice(errorMessage(error));
    }
  }
  const latestRun = state.data.evalRuns[0] ?? null;
  return (
    <section className="workspace-page">
      <WorkspaceIntro
        eyebrow="Evals and observability"
        title="Inspect reliability, privacy, latency, and cost."
      >
        Traces minimize sensitive content: hashes and configuration metadata are stored, not raw
        private prompts.
      </WorkspaceIntro>
      <div className="metric-row">
        <div className="metric">
          <strong>{state.data.traces.length}</strong>
          <span>recent traces</span>
        </div>
        <div className="metric">
          <strong>{state.data.evalRuns.length}</strong>
          <span>local eval runs</span>
        </div>
        <div className="metric">
          <strong>${state.data.estimatedCostUsd.toFixed(2)}</strong>
          <span>estimated cost</span>
        </div>
        <div className="metric">
          <strong>{state.data.killSwitchActive ? "On" : "Off"}</strong>
          <span>kill switch</span>
        </div>
      </div>
      <section className="mission-card">
        <h2>Provider capability matrix</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Available</th>
                <th>Structured</th>
                <th>Tools</th>
                <th>Embeddings</th>
                <th>Privacy</th>
              </tr>
            </thead>
            <tbody>
              {state.data.capabilities.map((provider) => (
                <tr key={provider.provider}>
                  <th>{provider.provider}</th>
                  <td>{provider.available ? "Yes" : "No"}</td>
                  <td>{provider.structuredOutput ? "Yes" : "No"}</td>
                  <td>{provider.tools ? "Yes" : "No"}</td>
                  <td>{provider.embeddings ? "Yes" : "No"}</td>
                  <td>{provider.privacy.replaceAll("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="button button--primary" type="button" onClick={runEval}>
          Run behavioral local eval
        </button>
        {runNotice === null ? null : <p role="status">{runNotice}</p>}
      </section>
      <div className="two-column-workspace">
        <section className="mission-card">
          <h2>Recent eval runs</h2>
          <ul className="plain-list">
            {state.data.evalRuns.map((run) => (
              <li key={run.id}>
                <strong>{run.datasetVersion}</strong> · {(run.score * 100).toFixed(0)}% ·{" "}
                {run.passed ? "passed" : "failed"}
                <small>
                  {run.cases.length} observed cases · evaluator {run.evaluatorVersion} · dataset
                  hash {run.datasetHash.slice(0, 12)} · {run.durationMs} ms · $
                  {run.estimatedCostUsd.toFixed(4)}
                </small>
              </li>
            ))}
          </ul>
        </section>
        <section className="mission-card">
          <h2>Recent traces</h2>
          <ul className="plain-list">
            {state.data.traces.slice(0, 12).map((trace) => (
              <li key={trace.id}>
                <strong>{trace.feature}</strong> · {trace.provider} · {trace.outcome} ·{" "}
                {trace.latencyMs} ms
                <small>input hash {trace.inputHash.slice(0, 12)}</small>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {latestRun === null ? null : (
        <section className="mission-card">
          <p className="eyebrow">Latest executable dataset evidence</p>
          <h2>Expected behavior compared with observed output</h2>
          <dl className="budget-grid">
            <div>
              <dt>Critical failures</dt>
              <dd>
                {latestRun.criticalFailures.length === 0
                  ? "None"
                  : latestRun.criticalFailures.join(", ")}
              </dd>
            </div>
            <div>
              <dt>Negative controls</dt>
              <dd>{latestRun.negativeControlsPassed ? "Passed" : "Failed"}</dd>
            </div>
            <div>
              <dt>Fixture provider</dt>
              <dd>{latestRun.providerConfig.provider}</dd>
            </div>
            <div>
              <dt>Redaction policy</dt>
              <dd>{latestRun.providerConfig.redactionPolicy.replaceAll("_", " ")}</dd>
            </div>
          </dl>
          <div className="eval-case-list">
            {latestRun.cases.map((entry) => (
              <details className="eval-case" key={entry.caseId}>
                <summary>
                  <strong>{entry.caseId}</strong> · {entry.category} ·{" "}
                  {entry.passed ? "passed" : "failed"}
                  {entry.critical ? " · critical" : ""}
                </summary>
                <p>{entry.expectedBehavior}</p>
                <p>
                  <strong>Scenario:</strong> {entry.scenarioKind} · {entry.latencyMs} ms · $
                  {entry.estimatedCostUsd.toFixed(4)}
                </p>
                <details>
                  <summary>Input and observed values</summary>
                  <h3>Input</h3>
                  <pre>{JSON.stringify(entry.input, null, 2)}</pre>
                  <h3>Observed</h3>
                  <pre>{JSON.stringify(entry.observed, null, 2)}</pre>
                </details>
                <ul className="plain-list">
                  {entry.assertions.map((assertion) => (
                    <li key={assertion.assertionId}>
                      <strong>
                        {assertion.passed ? "Pass" : "Fail"}: {assertion.assertionId}
                      </strong>
                      <small>
                        {assertion.field} {assertion.operator.replaceAll("_", " ")} expected{" "}
                        {JSON.stringify(assertion.expected)}; observed{" "}
                        {JSON.stringify(assertion.actual)}
                      </small>
                      <small>{assertion.detail}</small>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

export function WorkspaceExperience({
  pathname,
  csrfToken,
  user
}: {
  pathname: string;
  csrfToken: string | null;
  user: AccountUser;
}) {
  if (pathname === "/app/roadmap") return <RoadmapPage csrfToken={csrfToken} />;
  if (pathname === "/app/reviews") return <ReviewsPage csrfToken={csrfToken} />;
  if (pathname === "/app/skills") return <SkillsPage />;
  if (pathname === "/app/portfolio") return <PortfolioPage csrfToken={csrfToken} />;
  if (pathname === "/app/errors") return <ErrorMuseumPage csrfToken={csrfToken} />;
  if (pathname === "/app/tasks") return <TasksPage />;
  if (pathname === "/app/search") return <SearchRagPage csrfToken={csrfToken} />;
  if (pathname === "/app/coach") {
    return <CoachPage csrfToken={csrfToken} user={user} />;
  }
  if (pathname === "/app/planner") return <PlannerPage csrfToken={csrfToken} />;
  if (pathname === "/app/evals") return <OperationsPage csrfToken={csrfToken} />;
  if (pathname === "/app/gallery") return <GalleryPage />;
  if (pathname === "/admin") return <AdminPage csrfToken={csrfToken} />;
  return null;
}

export const WORKSPACE_PATHS = workspacePathsForEnvironment(import.meta.env.DEV);
