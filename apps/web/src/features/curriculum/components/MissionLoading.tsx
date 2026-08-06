export function MissionLoading() {
  return (
    <section className="state-panel state-panel--loading" aria-labelledby="loading-title">
      <div className="loading-orbit" aria-hidden="true">
        <span />
      </div>
      <p className="eyebrow">Checking the curriculum source</p>
      <h1 id="loading-title">Verifying your mission…</h1>
      <p role="status" aria-live="polite">
        CodeLift is asking the local Node API for a contract-validated curriculum day.
      </p>
      <div className="loading-lines" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}
