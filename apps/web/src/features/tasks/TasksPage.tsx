import { PRODUCT_PATHS } from "@codelift/config";
import type {
  DashboardResponse,
  ErrorMuseumEntry,
  PortfolioResponse,
  ReviewsResponse,
  RoadmapResponse,
  SkillsResponse
} from "@codelift/contracts";
import { StatePanel, StatusNotice } from "@codelift/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { AccountApiError } from "../account/api/accountApi";
import { learningApi } from "../workspace/api/learningApi";

type TasksData = {
  dashboard: DashboardResponse;
  errors: ErrorMuseumEntry[];
  portfolio: PortfolioResponse;
  reviews: ReviewsResponse;
  roadmap: RoadmapResponse;
  skills: SkillsResponse;
};

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: TasksData }
  | { status: "error"; message: string };

type SearchFacet = "all" | "skill" | "resource" | "project" | "confusion_tag" | "artifact";

type SearchItem = {
  id: string;
  facet: Exclude<SearchFacet, "all">;
  title: string;
  detail: string;
  context: string;
  href: string | null;
  externalHref: string | null;
};

const terminalStatuses = new Set(["core_completed", "recovery_completed", "intentionally_skipped"]);

function loadErrorMessage(error: unknown): string {
  return error instanceof AccountApiError
    ? error.message
    : "CodeLift could not verify the task catalog. No private-note content was searched.";
}

function labelFacet(facet: SearchItem["facet"]): string {
  return facet === "confusion_tag" ? "confusion tag" : facet;
}

function searchItems(data: TasksData): SearchItem[] {
  const items: SearchItem[] = [];

  for (const skill of data.skills.skills) {
    items.push({
      id: `skill:${skill.skill}`,
      facet: "skill",
      title: skill.skill,
      detail: `${skill.state}; introduced on Day ${skill.introducedDay}`,
      context: `${skill.prerequisiteSkills.join(" ")} ${skill.evidenceDayNumbers.join(" ")}`,
      href: PRODUCT_PATHS.skills,
      externalHref: null
    });
  }

  for (const day of data.roadmap.sevenDayPreview) {
    for (const resource of day.resourceLinks) {
      items.push({
        id: `resource:${day.dayNumber}:${resource.id}`,
        facet: "resource",
        title: resource.title,
        detail: `${resource.provider} · Day ${day.dayNumber} · ${resource.lastCheckedStatus.replaceAll("_", " ")}`,
        context: `${resource.id} ${resource.type} ${resource.topicHint} ${day.skillTags.join(" ")}`,
        href: null,
        externalHref: resource.url
      });
    }

    items.push({
      id: `project:${day.dayNumber}`,
      facet: "project",
      title: day.buildTask,
      detail: `Day ${day.dayNumber} build task · ${day.title}`,
      context: `${day.skillTags.join(" ")} ${day.portfolioMilestone ?? ""}`,
      href: PRODUCT_PATHS.roadmap,
      externalHref: null
    });
    items.push({
      id: `artifact:${day.dayNumber}`,
      facet: "artifact",
      title: day.tinyArtifact,
      detail: `Day ${day.dayNumber} tiny artifact · ${day.title}`,
      context: `${day.skillTags.join(" ")} ${day.acceptableEvidenceTypes.join(" ")}`,
      href: PRODUCT_PATHS.portfolio,
      externalHref: null
    });
  }

  for (const artifact of data.portfolio.artifacts) {
    items.push({
      id: `portfolio:${artifact.artifactKey}`,
      facet: "artifact",
      title: artifact.title,
      detail: `Month ${artifact.monthNumber} portfolio artifact · ${artifact.status.replaceAll("_", " ")}`,
      context: `${artifact.artifactKey} ${artifact.skillsProven.join(" ")} ${artifact.testsAndEvals.join(" ")}`,
      href: PRODUCT_PATHS.portfolio,
      externalHref: null
    });
  }

  for (const evidence of data.dashboard.recentEvidence) {
    items.push({
      id: `evidence:${evidence.dayNumber}:${evidence.createdAt}:${evidence.label}`,
      facet: "artifact",
      title: evidence.label,
      detail: `Day ${evidence.dayNumber} evidence · ${evidence.kind.replaceAll("_", " ")}`,
      context: evidence.kind,
      href: PRODUCT_PATHS.today,
      externalHref: null
    });
  }

  for (const entry of data.errors) {
    for (const tag of entry.tags) {
      items.push({
        id: `confusion:${entry.id}:${tag}`,
        facet: "confusion_tag",
        title: tag,
        detail: `${entry.title}${entry.dayNumber === null ? "" : ` · Day ${entry.dayNumber}`}`,
        context: `${entry.bug} ${entry.hypothesis} ${entry.lesson} ${entry.fix} ${entry.test}`,
        href: PRODUCT_PATHS.errors,
        externalHref: null
      });
    }
  }

  return items;
}

export function TasksPage() {
  const [loadKey, setLoadKey] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [facet, setFacet] = useState<SearchFacet>("all");
  const loader = useCallback(async (signal: AbortSignal): Promise<TasksData> => {
    const [dashboard, errorResponse, portfolio, reviews, roadmap, skills] = await Promise.all([
      learningApi.dashboard(signal),
      learningApi.errors(signal),
      learningApi.portfolio(signal),
      learningApi.reviews(signal),
      learningApi.roadmap(signal),
      learningApi.skills(signal)
    ]);
    return {
      dashboard,
      errors: errorResponse.entries,
      portfolio,
      reviews,
      roadmap,
      skills
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    loader(controller.signal)
      .then((data) => setState({ status: "ready", data }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error", message: loadErrorMessage(error) });
      });
    return () => controller.abort();
  }, [loadKey, loader]);

  const allItems = useMemo(
    () => (state.status === "ready" ? searchItems(state.data) : []),
    [state]
  );
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return allItems.filter((item) => {
      if (facet !== "all" && item.facet !== facet) return false;
      if (normalizedQuery.length === 0) return true;
      return `${item.title} ${item.detail} ${item.context}`
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
  }, [allItems, facet, query]);

  if (state.status === "loading") {
    return (
      <StatePanel
        kind="loading"
        title="Loading the verified task catalog…"
        description="Backlog and review data appear only after every protected request succeeds."
      />
    );
  }

  if (state.status === "error") {
    return (
      <StatePanel
        kind="error"
        eyebrow="Verified task data unavailable"
        title="The backlog was not replaced with invented state."
        description={state.message}
        action={{ label: "Try again", onClick: () => setLoadKey((value) => value + 1) }}
      />
    );
  }

  const statusByDay = new Map(state.data.roadmap.days.map((day) => [day.dayNumber, day.status]));
  const backlog = state.data.roadmap.sevenDayPreview.filter(
    (day) => !terminalStatuses.has(statusByDay.get(day.dayNumber) ?? "not_started")
  );
  const queuedReviews = [...state.data.reviews.due, ...state.data.reviews.upcoming];

  return (
    <section className="workspace-page">
      <header className="workspace-intro">
        <p className="eyebrow">Task backlog and review queue</p>
        <h1>Find the next useful piece of work.</h1>
        <p>
          This page combines verified curriculum, review, skill, project, confusion-tag, and
          artifact metadata. It never reads private note bodies or indexed RAG chunks.
        </p>
      </header>

      <div className="metric-row" aria-label="Task queue summary">
        <div className="metric">
          <strong>{backlog.length}</strong>
          <span>seven-day backlog</span>
        </div>
        <div className="metric">
          <strong>{state.data.reviews.due.length}</strong>
          <span>reviews due</span>
        </div>
        <div className="metric">
          <strong>{state.data.reviews.upcoming.length}</strong>
          <span>reviews upcoming</span>
        </div>
        <div className="metric">
          <strong>{allItems.length}</strong>
          <span>metadata records</span>
        </div>
      </div>

      <div className="two-column-workspace">
        <section className="mission-card" aria-labelledby="backlog-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Verified seven-day window</p>
              <h2 id="backlog-heading">Backlog</h2>
            </div>
            <Link className="button button--quiet" to={PRODUCT_PATHS.roadmap}>
              Full roadmap
            </Link>
          </div>
          {backlog.length === 0 ? (
            <p className="empty-state-copy">No unfinished day appears in the current preview.</p>
          ) : (
            <ol className="task-backlog">
              {backlog.map((day) => (
                <li key={day.dayNumber}>
                  <span className="task-backlog__day">Day {day.dayNumber}</span>
                  <div>
                    <strong>{day.title}</strong>
                    <p>{day.buildTask}</p>
                    <small>
                      {(statusByDay.get(day.dayNumber) ?? "not_started").replaceAll("_", " ")} ·{" "}
                      {day.skillTags.join(" · ")}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mission-card" aria-labelledby="review-queue-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Retrieval practice</p>
              <h2 id="review-queue-heading">Review queue</h2>
            </div>
            <Link className="button button--quiet" to={PRODUCT_PATHS.reviews}>
              Open reviews
            </Link>
          </div>
          {queuedReviews.length === 0 ? (
            <p className="empty-state-copy">No due or upcoming reviews are queued.</p>
          ) : (
            <ul className="plain-list">
              {queuedReviews.map((review) => (
                <li key={review.id}>
                  <span className={`queue-status queue-status--${review.status}`}>
                    {review.status}
                  </span>
                  <strong>{review.prompt}</strong>
                  <small>
                    Day {review.sourceDayNumber} · due {review.dueDate} · {review.intervalDays}-day
                    interval
                  </small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mission-card metadata-search" aria-labelledby="metadata-search-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Structured catalog only</p>
            <h2 id="metadata-search-heading">Cross-content search</h2>
            <p>
              Filter curriculum and evidence metadata here. For grounded answers from private
              indexed notes, use <Link to={PRODUCT_PATHS.search}>Private-note RAG</Link>.
            </p>
          </div>
        </div>
        <div className="metadata-search__controls">
          <label>
            Search task and learning metadata
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try validation, API, retrieval…"
            />
          </label>
          <label>
            Filter by content type
            <select value={facet} onChange={(event) => setFacet(event.target.value as SearchFacet)}>
              <option value="all">All structured content</option>
              <option value="skill">Skills</option>
              <option value="resource">Resources</option>
              <option value="project">Projects</option>
              <option value="confusion_tag">Confusion tags</option>
              <option value="artifact">Artifacts</option>
            </select>
          </label>
        </div>
        <StatusNotice as="p">
          {visibleItems.length} matching metadata record{visibleItems.length === 1 ? "" : "s"}.
        </StatusNotice>
        {visibleItems.length === 0 ? (
          <p className="empty-state-copy">No structured metadata matches those filters.</p>
        ) : (
          <ul className="metadata-results">
            {visibleItems.map((item) => (
              <li key={item.id}>
                <span className="metadata-results__facet">{labelFacet(item.facet)}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  {item.externalHref === null ? (
                    item.href === null ? null : (
                      <Link to={item.href}>Open {labelFacet(item.facet)}</Link>
                    )
                  ) : (
                    <a href={item.externalHref} target="_blank" rel="noopener noreferrer">
                      Open verified resource
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
