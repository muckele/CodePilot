import type { CurriculumDayResponse } from "@codelift/contracts";

type CoreScheduleProps = {
  schedule: CurriculumDayResponse["coreSchedule"];
};

export function CoreSchedule({ schedule }: CoreScheduleProps) {
  const totalMinutes = schedule.reduce((total, block) => total + block.minutes, 0);

  return (
    <section className="mission-card schedule-card" aria-labelledby="core-schedule-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Core mission</p>
          <h2 id="core-schedule-title">Your focused session</h2>
        </div>
        <p className="minute-total" aria-label={`Core schedule total: ${totalMinutes} minutes`}>
          <strong>{totalMinutes}</strong>
          <span>minutes</span>
        </p>
      </div>

      <ol className="schedule-list">
        {schedule.map((block, index) => (
          <li key={`${block.label}-${index}`} className="schedule-step">
            <span className="schedule-step__number" aria-hidden="true">
              {index + 1}
            </span>
            <span className="schedule-step__label">{block.label}</span>
            <span className="schedule-step__minutes">{block.minutes} min</span>
          </li>
        ))}
      </ol>

      <p className="schedule-card__note">
        The Core path is the complete 30-minute mission. Recovery stays a distinct, smaller win.
      </p>
    </section>
  );
}
