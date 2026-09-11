import type {
  AdminFeatureFlag,
  AdminMockScenario,
  AdminMockScenarioResponse,
  AdminOverviewResponse,
  AdminResetDemoDataResponse
} from "@codelift/contracts";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { AccountApiError } from "../account/api/accountApi";
import { learningApi } from "../workspace/api/learningApi";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: AdminOverviewResponse }
  | { status: "error"; message: string };

type Notice = { kind: "success" | "error"; message: string } | null;
type ResourceFilter = "all" | "source_verified" | "reachable" | "unknown" | "unreachable";

function errorMessage(error: unknown): string {
  return error instanceof AccountApiError
    ? error.message
    : "The development action did not complete. Existing product data was left unchanged.";
}

function label(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

export function AdminPage({ csrfToken }: { csrfToken: string | null }) {
  const [previewDay, setPreviewDay] = useState(1);
  const [requestedDay, setRequestedDay] = useState("1");
  const [loadKey, setLoadKey] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [notice, setNotice] = useState<Notice>(null);
  const [pendingFlag, setPendingFlag] = useState<AdminFeatureFlag | null>(null);
  const [flagSaving, setFlagSaving] = useState(false);
  const [scenario, setScenario] = useState<AdminMockScenario>("success");
  const [scenarioResult, setScenarioResult] = useState<AdminMockScenarioResponse | null>(null);
  const [scenarioRunning, setScenarioRunning] = useState(false);
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>("all");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [darkTheme, setDarkTheme] = useState(false);
  const [narrowViewport, setNarrowViewport] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetAcknowledged, setResetAcknowledged] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<AdminResetDemoDataResponse | null>(null);
  const loader = useCallback(
    (signal: AbortSignal) => learningApi.admin(previewDay, signal),
    [previewDay]
  );

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
  }, [loadKey, loader]);

  const visibleResources = useMemo(() => {
    if (state.status !== "ready") return [];
    return state.data.resources.items.filter(
      (resource) => resourceFilter === "all" || resource.lastCheckedStatus === resourceFilter
    );
  }, [resourceFilter, state]);

  function selectPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidate = Number(requestedDay);
    if (!Number.isInteger(candidate) || candidate < 1 || candidate > 365) {
      setNotice({ kind: "error", message: "Preview day must be an integer from 1 through 365." });
      return;
    }
    setNotice(null);
    setPreviewDay(candidate);
  }

  async function saveFlag() {
    if (pendingFlag === null || csrfToken === null) return;
    setFlagSaving(true);
    setNotice(null);
    try {
      const updated = await learningApi.updateAdminFeatureFlag(
        pendingFlag.key,
        {
          enabled: !pendingFlag.enabled,
          confirmation: "UPDATE DEVELOPMENT FLAG"
        },
        csrfToken
      );
      setPendingFlag(null);
      setNotice({
        kind: "success",
        message: `${updated.key} is now ${updated.enabled ? "enabled" : "disabled"}.`
      });
      setLoadKey((value) => value + 1);
    } catch (error: unknown) {
      setNotice({ kind: "error", message: errorMessage(error) });
    } finally {
      setFlagSaving(false);
    }
  }

  async function runScenario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (csrfToken === null) return;
    setScenarioRunning(true);
    setNotice(null);
    try {
      setScenarioResult(await learningApi.runAdminMockScenario({ scenario }, csrfToken));
    } catch (error: unknown) {
      setNotice({ kind: "error", message: errorMessage(error) });
    } finally {
      setScenarioRunning(false);
    }
  }

  async function resetDemoData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (csrfToken === null || resetConfirmation !== "RESET DEMO DATA" || !resetAcknowledged) {
      return;
    }
    setResetting(true);
    setNotice(null);
    try {
      const result = await learningApi.resetAdminDemoData(
        { confirmation: "RESET DEMO DATA" },
        csrfToken
      );
      setResetResult(result);
      setResetConfirmation("");
      setResetAcknowledged(false);
      setNotice({
        kind: "success",
        message: `Reset ${result.deletedRecords} current-account demo record${result.deletedRecords === 1 ? "" : "s"}. Your account, profile, active session, and global seeds were preserved.`
      });
      setLoadKey((value) => value + 1);
    } catch (error: unknown) {
      setNotice({ kind: "error", message: errorMessage(error) });
    } finally {
      setResetting(false);
    }
  }

  if (state.status === "loading") {
    return (
      <section className="mission-card workspace-state" role="status">
        <span className="state-orb" aria-hidden="true" />
        <h1>Loading development diagnostics…</h1>
        <p>Admin state appears only after the protected development request succeeds.</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="mission-card workspace-state" role="alert">
        <p className="eyebrow">Development diagnostics unavailable</p>
        <h1>No operational state was invented.</h1>
        <p>{state.message}</p>
        <button
          className="button button--primary"
          type="button"
          onClick={() => setLoadKey((value) => value + 1)}
        >
          Try again
        </button>
      </section>
    );
  }

  const overview = state.data;
  const issueCount =
    overview.curriculum.quality.missing.length + overview.curriculum.quality.duplicates.length;
  const visualPreviewClasses = [
    "admin-visual-preview",
    reducedMotion ? "admin-visual-preview--reduced" : "",
    darkTheme ? "admin-visual-preview--dark" : "",
    narrowViewport ? "admin-visual-preview--narrow" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="workspace-page">
      <header className="workspace-intro">
        <p className="eyebrow">Development-only Admin</p>
        <h1>Inspect content, reliability, and safe test state.</h1>
        <p>
          This protected surface is compiled out of production navigation and routing. The Node API
          returns a generic 404 for every production admin request.
        </p>
      </header>

      <div className="admin-development-boundary" role="status">
        <strong>Development boundary active</strong>
        <span>All mutations require the signed-in session, exact Origin, and CSRF token.</span>
      </div>

      {notice === null ? null : (
        <div
          className={`form-notice form-notice--${notice.kind}`}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          {notice.message}
        </div>
      )}

      <div className="metric-row" aria-label="Development overview">
        <div className="metric">
          <strong>{overview.curriculum.dayCount}</strong>
          <span>seeded days</span>
        </div>
        <div className="metric">
          <strong>{overview.resources.total}</strong>
          <span>resource records</span>
        </div>
        <div className="metric">
          <strong>{issueCount}</strong>
          <span>content issues</span>
        </div>
        <div className="metric">
          <strong>{overview.operations.traces.length + overview.agentRuns.length}</strong>
          <span>AI and agent traces</span>
        </div>
      </div>

      <section className="mission-card" aria-labelledby="admin-curriculum-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Curriculum day preview</p>
            <h2 id="admin-curriculum-heading">
              Day {overview.curriculum.preview.dayNumber}: {overview.curriculum.preview.title}
            </h2>
          </div>
          <form className="admin-inline-form" onSubmit={selectPreview}>
            <label>
              Preview day
              <input
                type="number"
                min="1"
                max="365"
                value={requestedDay}
                onChange={(event) => setRequestedDay(event.target.value)}
              />
            </label>
            <button className="button button--quiet" type="submit">
              Load preview
            </button>
          </form>
        </div>
        <div className="admin-preview-grid">
          <div>
            <h3>Objective</h3>
            <p>{overview.curriculum.preview.learningObjective}</p>
          </div>
          <div>
            <h3>Build task</h3>
            <p>{overview.curriculum.preview.buildTask}</p>
          </div>
          <div>
            <h3>Recovery</h3>
            <p>
              {overview.curriculum.preview.recoveryTask} ·{" "}
              {overview.curriculum.preview.recoveryMinutes} minutes
            </p>
          </div>
          <div>
            <h3>Artifact</h3>
            <p>{overview.curriculum.preview.tinyArtifact}</p>
          </div>
        </div>
        <ul className="plain-list" aria-label="Preview resources">
          {overview.curriculum.preview.resourceLinks.map((resource) => (
            <li key={resource.id}>
              <span className={`admin-status admin-status--${resource.lastCheckedStatus}`}>
                {label(resource.lastCheckedStatus)}
              </span>
              <a href={resource.url} target="_blank" rel="noopener noreferrer">
                {resource.title}
              </a>
              <small>{resource.topicHint}</small>
            </li>
          ))}
        </ul>
      </section>

      <div className="two-column-workspace">
        <section className="mission-card" aria-labelledby="quality-report-heading">
          <p className="eyebrow">Duplicate and missing-field report</p>
          <h2 id="quality-report-heading">
            {overview.curriculum.quality.passed
              ? "Validated seed has no reported gaps."
              : `${issueCount} curriculum issue${issueCount === 1 ? "" : "s"}`}
          </h2>
          {overview.curriculum.quality.passed ? (
            <p className="admin-pass-copy">
              Days 1–365, required content, resource references, source hashes, and duplicate checks
              passed.
            </p>
          ) : (
            <ul className="plain-list">
              {overview.curriculum.quality.missing.map((issue) => (
                <li key={`${issue.path}:${issue.detail}`}>
                  <strong>Missing or stale: {issue.path}</strong>
                  <small>{issue.detail}</small>
                </li>
              ))}
              {overview.curriculum.quality.duplicates.map((issue) => (
                <li key={`${issue.kind}:${issue.value}`}>
                  <strong>
                    Duplicate {label(issue.kind)}: {issue.value}
                  </strong>
                  <small>{issue.locations.join(" · ")}</small>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mission-card" aria-labelledby="seed-migrations-heading">
          <p className="eyebrow">Seed versions and migrations</p>
          <h2 id="seed-migrations-heading">
            Schema {overview.curriculum.schemaVersion} · document v
            {overview.curriculum.documentVersion}
          </h2>
          <p className="admin-hash">Source {overview.curriculum.sourceSha256}</p>
          <ul className="plain-list">
            {overview.seeds.migrations.map((migration) => (
              <li key={migration.id}>
                <span className={`admin-status admin-status--${migration.status}`}>
                  {migration.status}
                </span>
                <strong>
                  {migration.id} · v{migration.version}
                </strong>
                <small>{migration.detail}</small>
              </li>
            ))}
          </ul>
          <details>
            <summary>Registered eval dataset seeds</summary>
            <ul className="plain-list">
              {overview.seeds.evalDatasets.map((dataset) => (
                <li key={dataset.version}>
                  <strong>{dataset.version}</strong>
                  <small>
                    {dataset.caseCount} cases · {dataset.evaluatorVersion} · hash{" "}
                    {dataset.contentHash.slice(0, 12)}
                  </small>
                </li>
              ))}
            </ul>
          </details>
        </section>
      </div>

      <section className="mission-card" aria-labelledby="resource-status-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Resource and link validation</p>
            <h2 id="resource-status-heading">{visibleResources.length} visible resources</h2>
          </div>
          <label>
            Status filter
            <select
              value={resourceFilter}
              onChange={(event) => setResourceFilter(event.target.value as ResourceFilter)}
            >
              <option value="all">All statuses</option>
              <option value="source_verified">Source verified</option>
              <option value="reachable">Reachable</option>
              <option value="unknown">Unknown</option>
              <option value="unreachable">Unreachable</option>
            </select>
          </label>
        </div>
        <div className="admin-resource-counts" aria-label="Resource status counts">
          {Object.entries(overview.resources.statusCounts).map(([status, count]) => (
            <span key={status}>
              <strong>{count}</strong> {label(status)}
            </span>
          ))}
        </div>
        <div className="table-scroll" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">Resource</th>
                <th scope="col">Provider</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Last checked</th>
              </tr>
            </thead>
            <tbody>
              {visibleResources.map((resource) => (
                <tr key={resource.id}>
                  <td>
                    <a href={resource.url}>{resource.title}</a>
                  </td>
                  <td>{resource.provider}</td>
                  <td>{resource.type}</td>
                  <td>{label(resource.lastCheckedStatus)}</td>
                  <td>{resource.lastCheckedAt ?? "Seed verification only"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mission-card" aria-labelledby="feature-flags-heading">
        <p className="eyebrow">Feature and kill-switch controls</p>
        <h2 id="feature-flags-heading">Explicit development flags</h2>
        <ul className="admin-flag-list">
          {overview.featureFlags.map((flag) => (
            <li key={flag.key}>
              <div>
                <strong>{flag.key}</strong>
                <p>{flag.description}</p>
                <small>
                  {flag.enabled ? "Enabled" : "Disabled"} · updated by {flag.updatedBy}
                </small>
              </div>
              {pendingFlag?.key === flag.key ? (
                <div
                  className="admin-confirmation"
                  role="group"
                  aria-label={`Confirm ${flag.key} update`}
                >
                  <p>
                    {flag.enabled ? "Disable" : "Enable"} {flag.key}? This changes a global
                    development control.
                  </p>
                  <div className="button-row">
                    <button
                      className="button button--danger"
                      type="button"
                      disabled={flagSaving || csrfToken === null}
                      onClick={() => void saveFlag()}
                    >
                      {flagSaving ? "Saving flag…" : "Confirm flag update"}
                    </button>
                    <button
                      className="button button--quiet"
                      type="button"
                      disabled={flagSaving}
                      onClick={() => setPendingFlag(null)}
                    >
                      Keep current value
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => setPendingFlag(flag)}
                >
                  {flag.enabled ? "Disable" : "Enable"} {flag.key}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="two-column-workspace">
        <section className="mission-card" aria-labelledby="mock-scenarios-heading">
          <p className="eyebrow">Deterministic mock-provider scenarios</p>
          <h2 id="mock-scenarios-heading">Exercise a failure state without a provider call.</h2>
          <form onSubmit={runScenario}>
            <label>
              Mock scenario
              <select
                value={scenario}
                onChange={(event) => setScenario(event.target.value as AdminMockScenario)}
              >
                {overview.mockScenarios.map((item) => (
                  <option value={item.key} key={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button button--primary"
              type="submit"
              disabled={scenarioRunning || csrfToken === null}
            >
              {scenarioRunning ? "Running fixture…" : "Run deterministic scenario"}
            </button>
          </form>
          {scenarioResult === null ? null : (
            <article className="admin-scenario-result" role="status">
              <p className="eyebrow">{label(scenarioResult.outcome)}</p>
              <h3>{scenarioResult.title}</h3>
              <p>{scenarioResult.detail}</p>
              <ol>
                {scenarioResult.trace.map((step) => (
                  <li key={step}>{label(step)}</li>
                ))}
              </ol>
              <small>Generated content: no · deterministic fixture only</small>
            </article>
          )}
        </section>

        <section className="mission-card" aria-labelledby="visual-controls-heading">
          <p className="eyebrow">Accessibility and visual-state controls</p>
          <h2 id="visual-controls-heading">Inspect presentation constraints.</h2>
          <div className="admin-visual-controls">
            <label>
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={(event) => setReducedMotion(event.target.checked)}
              />
              Reduced motion
            </label>
            <label>
              <input
                type="checkbox"
                checked={narrowViewport}
                onChange={(event) => setNarrowViewport(event.target.checked)}
              />
              Narrow mobile frame
            </label>
            <label>
              <input
                type="checkbox"
                checked={darkTheme}
                onChange={(event) => setDarkTheme(event.target.checked)}
              />
              Dark theme
            </label>
          </div>
          <div className={visualPreviewClasses} data-testid="admin-visual-preview">
            <span className="gallery-orb" aria-hidden="true" />
            <h3>Accessible visual fixture</h3>
            <p>Meaning remains available in text, focus order, and status—not animation alone.</p>
            <button className="button button--secondary" type="button">
              Inspect focus
            </button>
          </div>
          <details>
            <summary>Open named isolated states</summary>
            <ul className="admin-state-links">
              {overview.visualStates.map((item) => (
                <li key={item.key}>
                  <Link to={`/app/gallery#${item.galleryAnchor}`}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </details>
        </section>
      </div>

      <section className="mission-card" aria-labelledby="traces-heading">
        <p className="eyebrow">Eval runs and trace inspection</p>
        <h2 id="traces-heading">Tenant-scoped operational evidence</h2>
        <div className="admin-trace-grid">
          <div>
            <h3>AI traces ({overview.operations.traces.length})</h3>
            {overview.operations.traces.length === 0 ? (
              <p className="empty-state-copy">No AI traces for this account.</p>
            ) : (
              <ul className="plain-list">
                {overview.operations.traces.map((trace) => (
                  <li key={trace.id}>
                    <strong>
                      {trace.feature} · {trace.outcome}
                    </strong>
                    <small>
                      {trace.provider} · {trace.latencyMs} ms · {trace.citationCount} citations
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3>Eval runs ({overview.operations.evalRuns.length})</h3>
            {overview.operations.evalRuns.length === 0 ? (
              <p className="empty-state-copy">No eval runs for this account.</p>
            ) : (
              <ul className="plain-list">
                {overview.operations.evalRuns.map((run) => (
                  <li key={run.id}>
                    <strong>
                      {run.datasetVersion} · {run.passed ? "passed" : "failed"}
                    </strong>
                    <small>
                      score {run.score.toFixed(2)} · {run.cases.length} executable cases · hash{" "}
                      {run.datasetHash.slice(0, 12)}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3>Agent traces ({overview.agentRuns.length})</h3>
            {overview.agentRuns.length === 0 ? (
              <p className="empty-state-copy">No agent runs for this account.</p>
            ) : (
              <div className="eval-case-list">
                {overview.agentRuns.map((run) => (
                  <details className="eval-case" key={run.id}>
                    <summary>
                      {run.mode.replaceAll("_", " ")} · {run.status.replaceAll("_", " ")}
                    </summary>
                    <p>
                      {run.stepsUsed} / {run.maxSteps} steps · terminal {label(run.terminalReason)}
                    </p>
                    <ol>
                      {run.trace.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mission-card admin-reset-card" aria-labelledby="reset-demo-heading">
        <p className="eyebrow">Destructive development action</p>
        <h2 id="reset-demo-heading">Reset current-account demo data</h2>
        <p>
          This transaction removes progress, reflections, evidence, reviews, notes and chunks,
          portfolio records, AI/eval traces, agent runs, and job applications only for this account.
          It preserves the account, profile, active session, curriculum, resources, feature flags,
          and global seeds.
        </p>
        <form onSubmit={resetDemoData}>
          <label>
            Type {overview.reset.confirmationPhrase} exactly
            <input
              value={resetConfirmation}
              onChange={(event) => setResetConfirmation(event.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={resetAcknowledged}
              onChange={(event) => setResetAcknowledged(event.target.checked)}
            />
            I understand this resets only the signed-in account’s product/demo data.
          </label>
          <button
            className="button button--danger"
            type="submit"
            disabled={
              resetting ||
              csrfToken === null ||
              resetConfirmation !== overview.reset.confirmationPhrase ||
              !resetAcknowledged
            }
          >
            {resetting ? "Resetting demo data…" : "Reset current-account demo data"}
          </button>
        </form>
        {resetResult === null ? null : (
          <details>
            <summary>Last reset deletion counts</summary>
            <ul>
              {resetResult.collections.map((entry) => (
                <li key={entry.collection}>
                  {entry.collection}: {entry.deletedCount}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </section>
  );
}
