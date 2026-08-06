import { useEffect, useRef } from "react";

import type { CurriculumLoadError } from "../api/fetchCurriculumDay";

type MissionErrorProps = {
  error: CurriculumLoadError;
  onRetry: () => void;
};

const ERROR_COPY = {
  network: {
    eyebrow: "Local connection interrupted",
    title: "The mission could not be reached."
  },
  problem: {
    eyebrow: "The API declined this request",
    title: "This curriculum day is unavailable."
  },
  malformed: {
    eyebrow: "Contract verification stopped the render",
    title: "The mission could not be verified."
  }
} as const;

export function MissionError({ error, onRetry }: MissionErrorProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const copy = ERROR_COPY[error.kind];

  useEffect(() => {
    headingRef.current?.focus();
  }, [error]);

  return (
    <section
      className="state-panel state-panel--error"
      aria-labelledby="mission-error-title"
      aria-describedby="mission-error-detail"
    >
      <span className="state-symbol" aria-hidden="true">
        !
      </span>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 id="mission-error-title" ref={headingRef} tabIndex={-1}>
        {copy.title}
      </h1>
      <p id="mission-error-detail">{error.message}</p>
      <p className="state-panel__assurance">
        CodeLift did not replace the failed response with copied or unverified mission content.
      </p>
      {error.requestId === null ? null : (
        <p className="request-id">
          Request reference: <code>{error.requestId}</code>
        </p>
      )}
      <button className="button button--primary" type="button" onClick={onRetry}>
        Verify again
      </button>
    </section>
  );
}
