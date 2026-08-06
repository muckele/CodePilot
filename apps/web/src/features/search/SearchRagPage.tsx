import { CURRICULUM_LIMITS, PRIVATE_NOTE_LIMITS, PRODUCT_PATHS } from "@codelift/config";
import type { NoteSource, RagSearchResponse } from "@codelift/contracts";
import { StatePanel, StatusNotice } from "@codelift/ui";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { AccountApiError } from "../account/api/accountApi";
import { learningApi } from "../workspace/api/learningApi";

type NotesState =
  | { status: "loading" }
  | { status: "ready"; sources: NoteSource[] }
  | { status: "error"; message: string };

type Notice = { kind: "success" | "error"; message: string } | null;

function errorMessage(error: unknown): string {
  return error instanceof AccountApiError
    ? error.message
    : "CodeLift could not safely complete that private-note action. Nothing new was recorded.";
}

export function SearchRagPage({ csrfToken }: { csrfToken: string | null }) {
  const [loadKey, setLoadKey] = useState(0);
  const [state, setState] = useState<NotesState>({ status: "loading" });
  const [title, setTitle] = useState("");
  const [dayNumber, setDayNumber] = useState("");
  const [content, setContent] = useState("");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<RagSearchResponse | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [pendingDeletion, setPendingDeletion] = useState<NoteSource | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deletionConfirmationRef = useRef<HTMLButtonElement | null>(null);
  const deleteButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const restoreDeleteButtonRef = useRef<string | null>(null);
  const focusAfterDeletionRef = useRef<string | null>(null);
  const indexedSourcesHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const loader = useCallback((signal: AbortSignal) => learningApi.notes(signal), []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    loader(controller.signal)
      .then(({ sources }) => setState({ status: "ready", sources }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error", message: errorMessage(error) });
      });
    return () => controller.abort();
  }, [loadKey, loader]);

  useEffect(() => {
    if (pendingDeletion !== null) {
      if (!deleting) deletionConfirmationRef.current?.focus();
      return;
    }

    const sourceId = restoreDeleteButtonRef.current;
    if (sourceId === null) return;
    deleteButtonRefs.current.get(sourceId)?.focus();
    restoreDeleteButtonRef.current = null;
  }, [deleting, pendingDeletion]);

  useEffect(() => {
    const deletedSourceId = focusAfterDeletionRef.current;
    if (
      deletedSourceId === null ||
      state.status !== "ready" ||
      state.sources.some((source) => source.id === deletedSourceId)
    ) {
      return;
    }

    indexedSourcesHeadingRef.current?.focus();
    focusAfterDeletionRef.current = null;
  }, [state]);

  async function ingest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (csrfToken === null) return;
    setNotice(null);
    try {
      await learningApi.saveNote(
        {
          title,
          dayNumber: dayNumber ? Number(dayNumber) : null,
          content,
          idempotencyKey: `note-${crypto.randomUUID()}`
        },
        csrfToken
      );
      setTitle("");
      setDayNumber("");
      setContent("");
      setNotice({
        kind: "success",
        message: "The note was chunked, hashed, versioned, embedded, and indexed locally."
      });
      setLoadKey((value) => value + 1);
    } catch (error: unknown) {
      setNotice({ kind: "error", message: errorMessage(error) });
    }
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (csrfToken === null) return;
    setNotice(null);
    try {
      setResult(await learningApi.search({ question, topK: 5 }, csrfToken));
    } catch (error: unknown) {
      setNotice({ kind: "error", message: errorMessage(error) });
    }
  }

  async function confirmDeletion() {
    if (csrfToken === null || pendingDeletion === null) return;
    const deletedSource = pendingDeletion;
    setDeleting(true);
    setNotice(null);
    try {
      await learningApi.deleteNote(deletedSource.id, csrfToken);
      if (result?.citations.some((citation) => citation.sourceId === deletedSource.id) === true) {
        setResult(null);
      }
      focusAfterDeletionRef.current = deletedSource.id;
      setPendingDeletion(null);
      setNotice({
        kind: "success",
        message: `Deleted “${deletedSource.title}” and every derived chunk from your private index.`
      });
      setLoadKey((value) => value + 1);
    } catch (error: unknown) {
      setNotice({ kind: "error", message: errorMessage(error) });
    } finally {
      setDeleting(false);
    }
  }

  if (state.status === "loading") {
    return (
      <StatePanel
        kind="loading"
        title="Loading private-note search…"
        description="Indexed sources appear only after the protected request succeeds."
      />
    );
  }

  if (state.status === "error") {
    return (
      <StatePanel
        kind="error"
        eyebrow="Private index unavailable"
        title="This view was not replaced with invented note state."
        description={state.message}
        action={{ label: "Try again", onClick: () => setLoadKey((value) => value + 1) }}
      />
    );
  }

  return (
    <section className="workspace-page">
      <header className="workspace-intro">
        <p className="eyebrow">Private-note RAG</p>
        <h1>Ask your notes, then inspect the citations.</h1>
        <p>
          Retrieval and deletion are tenant-scoped. Unsupported questions abstain instead of
          fabricating an answer. For task, skill, resource, project, tag, and artifact metadata, use
          the separate <a href={PRODUCT_PATHS.tasks}>Tasks search</a>.
        </p>
      </header>

      <div className="two-column-workspace">
        <form className="mission-card" onSubmit={ingest}>
          <h2>Index a private note</h2>
          <label>
            Title
            <input
              required
              maxLength={PRIVATE_NOTE_LIMITS.titleCharacters}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            Day (optional)
            <input
              type="number"
              min={CURRICULUM_LIMITS.firstDay}
              max={CURRICULUM_LIMITS.lastDay}
              value={dayNumber}
              onChange={(event) => setDayNumber(event.target.value)}
            />
          </label>
          <label>
            Note
            <textarea
              required
              rows={9}
              maxLength={PRIVATE_NOTE_LIMITS.contentCharacters}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </label>
          <button className="button button--secondary" type="submit" disabled={csrfToken === null}>
            Index note locally
          </button>
        </form>

        <form className="mission-card" onSubmit={search}>
          <h2>Search with citations</h2>
          <label>
            Question
            <textarea
              required
              rows={4}
              maxLength={PRIVATE_NOTE_LIMITS.questionCharacters}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </label>
          <button
            className="button button--primary"
            type="submit"
            disabled={csrfToken === null || question.trim().length < 3}
          >
            Retrieve support
          </button>
          {result === null ? null : (
            <article className={`rag-answer${result.abstained ? " rag-answer--abstained" : ""}`}>
              <p className="eyebrow">
                {result.abstained ? "Unsupported / unknown" : "Source-supported"}
              </p>
              <h3>{result.answer}</h3>
              {result.citations.length === 0 ? (
                <p>No indexed chunk met the support threshold.</p>
              ) : (
                <ul>
                  {result.citations.map((citation) => (
                    <li key={citation.chunkId}>
                      <strong>{citation.sourceTitle}</strong>
                      <p>{citation.excerpt}</p>
                      <small>Support score {citation.score.toFixed(2)}</small>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          )}
        </form>
      </div>

      {notice === null ? null : (
        <StatusNotice tone={notice.kind} className={`form-notice form-notice--${notice.kind}`}>
          {notice.message}
        </StatusNotice>
      )}

      <section className="mission-card" aria-labelledby="indexed-sources-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Tenant-scoped storage</p>
            <h2 id="indexed-sources-heading" ref={indexedSourcesHeadingRef} tabIndex={-1}>
              Indexed sources
            </h2>
          </div>
        </div>
        {state.sources.length === 0 ? (
          <p className="empty-state-copy">No private sources are indexed yet.</p>
        ) : (
          <ul className="indexed-source-list">
            {state.sources.map((source) => (
              <li key={source.id}>
                <div>
                  <strong>{source.title}</strong>
                  <small>
                    version {source.version} · {source.chunkCount} chunk
                    {source.chunkCount === 1 ? "" : "s"} · hash {source.contentHash.slice(0, 12)}
                  </small>
                </div>
                {pendingDeletion?.id === source.id ? (
                  <div
                    className="source-deletion-confirmation"
                    role="group"
                    aria-label="Confirm source deletion"
                  >
                    <p>
                      Delete indexed source “{source.title}” and all {source.chunkCount} derived
                      chunk{source.chunkCount === 1 ? "" : "s"}?
                    </p>
                    <div className="button-row">
                      <button
                        ref={deletionConfirmationRef}
                        className="button button--danger"
                        type="button"
                        disabled={deleting || csrfToken === null}
                        onClick={() => void confirmDeletion()}
                      >
                        {deleting ? "Deleting source…" : "Confirm source deletion"}
                      </button>
                      <button
                        className="button button--quiet"
                        type="button"
                        disabled={deleting}
                        onClick={() => {
                          restoreDeleteButtonRef.current = source.id;
                          setPendingDeletion(null);
                        }}
                      >
                        Keep source
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    ref={(element) => {
                      if (element === null) {
                        deleteButtonRefs.current.delete(source.id);
                      } else {
                        deleteButtonRefs.current.set(source.id, element);
                      }
                    }}
                    className="button button--quiet"
                    type="button"
                    onClick={() => {
                      restoreDeleteButtonRef.current = null;
                      setPendingDeletion(source);
                      setNotice(null);
                    }}
                  >
                    Delete {source.title}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
