import { useEffect, useRef } from "react";

type InvalidDayStateProps = {
  requestedDay: string | undefined;
};

export function InvalidDayState({ requestedDay }: InvalidDayStateProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [requestedDay]);

  return (
    <section className="state-panel state-panel--error" aria-labelledby="invalid-day-title">
      <p className="eyebrow">Curriculum boundary</p>
      <h1 id="invalid-day-title" ref={headingRef} tabIndex={-1}>
        Choose a whole-numbered day from 1 to 365.
      </h1>
      <p>
        {requestedDay === undefined
          ? "No curriculum day was provided."
          : `“${requestedDay}” is outside the verified curriculum trail.`}
      </p>
      <a className="button button--primary" href="/curriculum/1">
        Open Day 1
      </a>
    </section>
  );
}
