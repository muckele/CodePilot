import type { CurriculumDayResponse } from "@codelift/contracts";

import { CoreSchedule } from "./CoreSchedule";
import { MissionIllustration } from "./MissionIllustration";
import { RecoveryAndStretch } from "./RecoveryAndStretch";
import { ResourceTrail } from "./ResourceTrail";

type CurriculumMissionProps = {
  mission: CurriculumDayResponse;
};

export function CurriculumMission({ mission }: CurriculumMissionProps) {
  return (
    <article className="mission-layout" aria-labelledby="mission-title">
      <section className="mission-hero">
        <div className="mission-hero__content">
          <div className="mission-badges" aria-label="Curriculum position">
            <span>Month {mission.monthNumber}</span>
            <span>Week {mission.weekNumber}</span>
            <span>Day {mission.dayNumber} of 365</span>
          </div>
          <p className="eyebrow">{mission.modeLabel}</p>
          <h1 id="mission-title">{mission.title}</h1>
          <p className="mission-hero__lede">{mission.learningSeed}</p>

          <div className="preview-disclosure" role="note" aria-label="Preview mode">
            <span className="preview-disclosure__icon" aria-hidden="true">
              ◇
            </span>
            <span>
              <strong>Preview mode — progress is not saved yet.</strong>
              <span>
                This mission is read-only and comes from the validated curriculum blueprint.
              </span>
            </span>
          </div>
        </div>

        <MissionIllustration dayNumber={mission.dayNumber} />
      </section>

      <section className="context-strip" aria-label="Curriculum context">
        <dl>
          <div>
            <dt>Phase</dt>
            <dd>{mission.phaseTitle}</dd>
          </div>
          <div>
            <dt>Week focus</dt>
            <dd>{mission.weekTitle}</dd>
          </div>
          <div>
            <dt>Prerequisites</dt>
            <dd>
              {mission.prerequisiteDayNumbers.length === 0
                ? "None — begin here"
                : mission.prerequisiteDayNumbers.map((day) => `Day ${day}`).join(", ")}
            </dd>
          </div>
        </dl>
      </section>

      <div className="mission-grid mission-grid--primary">
        <CoreSchedule schedule={mission.coreSchedule} />

        <section className="mission-card build-card" aria-labelledby="build-task-title">
          <p className="eyebrow">Build task</p>
          <h2 id="build-task-title">Turn the concept into evidence</h2>
          <p className="build-card__task">{mission.buildTask}</p>
          <div className="artifact-panel">
            <span className="artifact-panel__icon" aria-hidden="true">
              ◆
            </span>
            <div>
              <h3>Today&apos;s tiny artifact</h3>
              <p>{mission.tinyArtifact}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="mission-grid mission-grid--thinking">
        <section className="mission-card principle-card" aria-labelledby="principle-title">
          <p className="eyebrow">Computer-systems principle</p>
          <h2 id="principle-title">The idea beneath the task</h2>
          <blockquote>{mission.corePrinciple}</blockquote>
        </section>

        <section className="mission-card retrieve-card" aria-labelledby="retrieve-title">
          <p className="eyebrow">Closed-note retrieval</p>
          <h2 id="retrieve-title">Explain before you look back</h2>
          <p>{mission.retrievalQuestion}</p>
          <span className="retrieve-card__prompt">Say or write one specific answer.</span>
        </section>
      </div>

      <RecoveryAndStretch
        recoveryTask={mission.recoveryTask}
        optionalStretchSeed={mission.optionalStretchSeed}
      />

      <section className="mission-card skills-card" aria-labelledby="skills-title">
        <div>
          <p className="eyebrow">Skills in this mission</p>
          <h2 id="skills-title">Concepts you are beginning to connect</h2>
        </div>
        <ul aria-label="Mission skill tags">
          {mission.skillTags.map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
        </ul>
      </section>

      <ResourceTrail resourceIds={mission.resourceIds} resources={mission.resourceLinks} />

      <aside className="source-note" aria-label="Curriculum source status">
        <span aria-hidden="true">✓</span>
        <p>
          <strong>Contract-verified blueprint preview.</strong> Final teaching enrichment,
          completion controls, notes, and learner progress are intentionally deferred.
        </p>
      </aside>
    </article>
  );
}
