import {
  FocusOrbTimer,
  MilestonePeak,
  ParticleBurst
} from "../workspace/components/SignatureGraphics";

function StateCard({
  id,
  title,
  description,
  className = "",
  children
}: {
  id: string;
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className={`gallery-state-card${className.length === 0 ? "" : ` ${className}`}`}
      data-gallery-state={id}
      aria-labelledby={`${id}-heading`}
    >
      <header>
        <p className="eyebrow">Isolated product state</p>
        <h2 id={`${id}-heading`}>{title}</h2>
        <p>{description}</p>
      </header>
      <div className="gallery-state-card__stage">{children}</div>
    </article>
  );
}

export function GalleryPage() {
  return (
    <section className="workspace-page">
      <header className="workspace-intro">
        <p className="eyebrow">Internal state gallery</p>
        <h1>Every important state, without a network dependency.</h1>
        <p>
          These deterministic fixtures isolate progress, failure, safety, motion, viewport, and
          theme behavior so the team can inspect them without changing learner data.
        </p>
      </header>

      <nav className="gallery-index" aria-label="Gallery states">
        {[
          ["new-user", "New user"],
          ["active-day", "Active day"],
          ["core-complete", "Core complete"],
          ["recovery-complete", "Recovery complete"],
          ["missed-return", "Missed return"],
          ["grace-token", "Grace token"],
          ["milestone", "Milestone"],
          ["empty", "Empty"],
          ["loading", "Loading"],
          ["api-error", "API error"],
          ["ai-timeout", "AI timeout"],
          ["ai-refusal", "AI refusal"],
          ["ai-schema-error", "AI schema error"],
          ["rag-no-evidence", "RAG no-evidence"],
          ["agent-awaiting-approval", "Agent awaiting approval"],
          ["reduced-motion", "Reduced motion"],
          ["narrow-mobile", "Narrow mobile"],
          ["dark-theme", "Dark theme"]
        ].map(([id, title]) => (
          <a href={`#${id}-heading`} key={id}>
            {title}
          </a>
        ))}
      </nav>

      <div className="gallery-state-grid">
        <StateCard
          id="new-user"
          title="New user"
          description="A gentle starting point with no assumed history."
        >
          <div className="gallery-mini-panel">
            <span className="gallery-orb" aria-hidden="true" />
            <h3>Your first useful return starts here.</h3>
            <p>Choose Core or Recovery after you read today’s verified mission.</p>
            <button className="button button--primary" type="button">
              Open Day 1
            </button>
          </div>
        </StateCard>

        <StateCard
          id="active-day"
          title="Active day"
          description="An opened mission with elapsed work kept separate from completion."
        >
          <div className="gallery-mini-panel">
            <p className="eyebrow">Day 42 · Core</p>
            <h3>Validate an AI response boundary</h3>
            <progress aria-label="Core mission progress" value="18" max="30" />
            <p>18 of 30 focused minutes recorded. Evidence is still required.</p>
            <FocusOrbTimer />
          </div>
        </StateCard>

        <StateCard
          id="core-complete"
          title="Core complete"
          description="A factual celebration after evidence-backed Core completion."
        >
          <div className="gallery-completion gallery-completion--core" role="status">
            <ParticleBurst label="Core completion evidence celebration" />
            <div>
              <h3>Core evidence recorded.</h3>
              <p>+30 XP · one verified return · no mastery inferred.</p>
            </div>
          </div>
        </StateCard>

        <StateCard
          id="recovery-complete"
          title="Recovery complete"
          description="A full win for a bounded five-minute return."
        >
          <div className="gallery-completion gallery-completion--recovery" role="status">
            <span className="gallery-recovery-mark" aria-hidden="true">
              ↗
            </span>
            <div>
              <h3>Recovery evidence recorded.</h3>
              <p>+10 XP · momentum protected · tomorrow stays small.</p>
            </div>
          </div>
        </StateCard>

        <StateCard
          id="missed-return"
          title="Missed return"
          description="A humane re-entry state with no streak shame."
        >
          <div className="recovery-card">
            <p className="eyebrow">Welcome back</p>
            <h3>You missed two calendar days. Nothing is broken.</h3>
            <p>Continue with one five-minute Recovery mission or resume today’s Core.</p>
            <div className="button-row">
              <button className="button button--primary" type="button">
                Start Recovery
              </button>
              <button className="button button--quiet" type="button">
                Keep Core
              </button>
            </div>
          </div>
        </StateCard>

        <StateCard
          id="grace-token"
          title="Grace token"
          description="An explicit token state that never rewrites evidence history."
        >
          <div className="gallery-token">
            <span aria-hidden="true">◆</span>
            <div>
              <strong>1 grace token available</strong>
              <p>Use it to protect pacing; the missed day remains honestly recorded.</p>
            </div>
          </div>
        </StateCard>

        <StateCard
          id="milestone"
          title="Milestone"
          description="A portfolio-oriented checkpoint tied to completed days."
        >
          <MilestonePeak title="Reliable API boundaries" completed={27} total={30} />
        </StateCard>

        <StateCard
          id="empty"
          title="Empty"
          description="An intentional empty state with a useful next action."
        >
          <div className="gallery-empty-state">
            <span aria-hidden="true">◇</span>
            <h3>No private notes are indexed.</h3>
            <p>Add a note before asking RAG for source-supported answers.</p>
            <button className="button button--secondary" type="button">
              Index a note
            </button>
          </div>
        </StateCard>

        <StateCard
          id="loading"
          title="Loading"
          description="Protected data stays absent until its request verifies."
        >
          <div className="gallery-system-state" role="status">
            <span className="state-orb" aria-hidden="true" />
            <h3>Loading your verified workspace…</h3>
            <p>No placeholder learner claims are rendered.</p>
          </div>
        </StateCard>

        <StateCard
          id="api-error"
          title="API error"
          description="A retryable boundary failure that preserves existing data."
        >
          <div className="gallery-system-state gallery-system-state--error" role="alert">
            <p className="eyebrow">Verified data unavailable</p>
            <h3>The API response could not be trusted.</h3>
            <p>Your saved work was not replaced. Support reference: req_gallery_api</p>
            <button className="button button--primary" type="button">
              Try again
            </button>
          </div>
        </StateCard>

        <StateCard
          id="ai-timeout"
          title="AI timeout"
          description="A bounded latency failure with a deterministic next step."
        >
          <div className="gallery-system-state gallery-system-state--error" role="alert">
            <p className="eyebrow">Coach timed out</p>
            <h3>No generated guidance was accepted.</h3>
            <p>Continue with the verified curriculum task or retry the mock/local provider.</p>
          </div>
        </StateCard>

        <StateCard
          id="ai-refusal"
          title="AI refusal"
          description="A refusal is shown as an outcome, never disguised as advice."
        >
          <div className="gallery-system-state" role="status">
            <p className="eyebrow">Provider refusal</p>
            <h3>The coach declined this request.</h3>
            <p>No answer or learning evidence was invented. Reframe the question to the mission.</p>
          </div>
        </StateCard>

        <StateCard
          id="ai-schema-error"
          title="AI schema error"
          description="Malformed structured output fails closed at runtime."
        >
          <div className="gallery-system-state gallery-system-state--error" role="alert">
            <p className="eyebrow">Unverified model output</p>
            <h3>The response did not match the shared schema.</h3>
            <p>Extra or missing fields are rejected before they reach the coaching UI.</p>
          </div>
        </StateCard>

        <StateCard
          id="rag-no-evidence"
          title="RAG no-evidence"
          description="Low-support retrieval abstains with zero citations."
        >
          <div className="rag-answer rag-answer--abstained" role="status">
            <p className="eyebrow">Unsupported / unknown</p>
            <h3>Your indexed notes do not support an answer.</h3>
            <p>
              No indexed chunk met the support threshold. Add evidence or ask a narrower question.
            </p>
          </div>
        </StateCard>

        <StateCard
          id="agent-awaiting-approval"
          title="Agent awaiting approval"
          description="A bounded plan stops before making an external or scheduling decision."
        >
          <div className="gallery-system-state" role="status">
            <p className="eyebrow">Human decision required</p>
            <h3>Three read-only actions are awaiting approval.</h3>
            <p>Nothing can schedule or message on your behalf from this state.</p>
            <div className="button-row">
              <button className="button button--primary" type="button">
                Approve plan
              </button>
              <button className="button button--quiet" type="button">
                Request revision
              </button>
            </div>
          </div>
        </StateCard>

        <StateCard
          id="reduced-motion"
          title="Reduced motion"
          description="Celebration and state meaning remain visible without animation."
          className="gallery-reduced-motion"
        >
          <div className="gallery-completion" data-motion="reduced">
            <ParticleBurst label="Static reduced-motion completion marker" />
            <div>
              <h3>Motion paused by preference.</h3>
              <p>Color, text, and status still carry the complete meaning.</p>
            </div>
          </div>
        </StateCard>

        <StateCard
          id="narrow-mobile"
          title="Narrow mobile"
          description="A 320-pixel content frame for small-screen inspection."
        >
          <div className="gallery-mobile-frame" data-viewport="320px">
            <p className="eyebrow">Day 42</p>
            <h3>One tiny next step</h3>
            <p>Write the failing boundary test, then save one evidence link.</p>
            <button className="button button--primary button--full" type="button">
              Start 5 minutes
            </button>
          </div>
        </StateCard>

        <StateCard
          id="dark-theme"
          title="Dark theme"
          description="An explicit dark fixture independent of system preference."
        >
          <div className="gallery-dark-frame" data-theme="dark">
            <span className="gallery-orb" aria-hidden="true" />
            <p className="eyebrow">Cosmic Sunrise</p>
            <h3>Readable contrast after sunset.</h3>
            <p>Surfaces, focus, success, and failure keep their semantic distinction.</p>
            <button className="button button--secondary" type="button">
              Inspect focus
            </button>
          </div>
        </StateCard>
      </div>
    </section>
  );
}
