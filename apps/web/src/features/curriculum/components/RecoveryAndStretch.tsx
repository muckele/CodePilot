type RecoveryAndStretchProps = {
  recoveryTask: string;
  optionalStretchSeed: string;
};

export function RecoveryAndStretch({ recoveryTask, optionalStretchSeed }: RecoveryAndStretchProps) {
  return (
    <section className="choice-section" aria-labelledby="mission-paths-title">
      <div className="section-heading section-heading--simple">
        <div>
          <p className="eyebrow">Choose with autonomy</p>
          <h2 id="mission-paths-title">Recovery and Stretch paths</h2>
        </div>
      </div>

      <div className="choice-grid">
        <article className="choice-card choice-card--recovery">
          <div className="choice-card__heading">
            <span className="choice-icon" aria-hidden="true">
              ↗
            </span>
            <div>
              <p className="choice-kicker">Recovery win · up to 5 minutes</p>
              <h3>A smaller return still protects the next step.</h3>
            </div>
          </div>
          <p>{recoveryTask}</p>
          <p className="choice-card__boundary">
            Recovery is recorded separately from a completed Core mission.
          </p>
        </article>

        <details className="choice-card choice-card--stretch">
          <summary>
            <span>
              <span className="choice-kicker">Optional Stretch · up to 10 minutes</span>
              <span className="choice-summary-title">Open only if energy remains</span>
            </span>
            <span className="disclosure-icon" aria-hidden="true">
              +
            </span>
          </summary>
          <div className="stretch-content">
            <p>{optionalStretchSeed}</p>
            <p className="choice-card__boundary">
              Stretch is optional and never required for mission completion.
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}
