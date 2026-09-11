import type {
  PortfolioArtifact,
  ProgressSummary,
  ReviewItem,
  SkillRecord
} from "@codelift/contracts";
import { useEffect, useMemo, useState } from "react";

type JourneyStatus =
  | "not_started"
  | "opened"
  | "in_progress"
  | "core_completed"
  | "recovery_completed"
  | "intentionally_skipped"
  | "rescheduled";

export function JourneyMap({
  days,
  compact = false
}: {
  days: readonly {
    dayNumber: number;
    monthNumber: number;
    status: JourneyStatus;
  }[];
  compact?: boolean;
}) {
  const plotted = useMemo(
    () =>
      days.map((day, index) => {
        const progress = index / Math.max(1, days.length - 1);
        return {
          ...day,
          x: 12 + progress * 576,
          y: 74 - Math.sin(progress * Math.PI * 5) * 24 - progress * 28
        };
      }),
    [days]
  );
  const completed = days.filter(
    (day) => day.status === "core_completed" || day.status === "recovery_completed"
  ).length;

  return (
    <figure className={`journey-map${compact ? " journey-map--compact" : ""}`} tabIndex={0}>
      <svg viewBox="0 0 600 104" role="img" aria-labelledby="journey-title journey-desc">
        <title id="journey-title">Journey Map</title>
        <desc id="journey-desc">
          {completed} of 365 days have evidence-backed Core or Recovery completion.
        </desc>
        <path
          className="journey-map__path"
          d={plotted
            .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
            .join(" ")}
        />
        {plotted.map((point) => (
          <circle
            className={`journey-star journey-star--${point.status}`}
            cx={point.x}
            cy={point.y}
            key={point.dayNumber}
            r={
              point.dayNumber % 30 === 0 || point.dayNumber === 365
                ? 2.8
                : point.status === "not_started"
                  ? 1
                  : 1.8
            }
          >
            <title>
              Day {point.dayNumber}: {point.status.replaceAll("_", " ")}
            </title>
          </circle>
        ))}
      </svg>
      <figcaption>
        <strong>{completed}</strong> evidence-backed returns · future days stay visible
      </figcaption>
    </figure>
  );
}

export function MomentumOrbit({ summary }: { summary: ProgressSummary }) {
  const seven = Math.min(100, (summary.rolling7DayReturns / 7) * 100);
  const thirty = Math.min(100, (summary.rolling30DayReturns / 30) * 100);
  return (
    <figure className="momentum-orbit">
      <svg viewBox="0 0 180 180" role="img" aria-labelledby="momentum-title momentum-desc">
        <title id="momentum-title">Momentum Orbit</title>
        <desc id="momentum-desc">
          {summary.rolling7DayReturns} returns in seven days and {summary.rolling30DayReturns}{" "}
          returns in thirty days.
        </desc>
        <circle className="orbit-track" cx="90" cy="90" r="67" />
        <circle
          className="orbit-progress orbit-progress--thirty"
          cx="90"
          cy="90"
          r="67"
          pathLength="100"
          strokeDasharray={`${thirty} 100`}
        />
        <circle className="orbit-track" cx="90" cy="90" r="47" />
        <circle
          className="orbit-progress orbit-progress--seven"
          cx="90"
          cy="90"
          r="47"
          pathLength="100"
          strokeDasharray={`${seven} 100`}
        />
        <text x="90" y="83" textAnchor="middle">
          {summary.totalReturns}
        </text>
        <text className="orbit-label" x="90" y="103" textAnchor="middle">
          total returns
        </text>
      </svg>
      <figcaption>
        <span>7-day: {summary.rolling7DayReturns}</span>
        <span>30-day: {summary.rolling30DayReturns}</span>
        <span>{summary.xp} XP</span>
      </figcaption>
    </figure>
  );
}

export function SkillConstellation({ skills }: { skills: readonly SkillRecord[] }) {
  const visible = skills.slice(0, 18);
  return (
    <figure className="skill-constellation" tabIndex={0}>
      <svg viewBox="0 0 600 260" role="img" aria-labelledby="skills-title skills-desc">
        <title id="skills-title">Skill Constellation</title>
        <desc id="skills-desc">
          {skills.length} skills tracked from introduced through demonstrated.
        </desc>
        {visible.slice(1).map((skill, index) => {
          const previous = visible[index];
          if (previous === undefined) return null;
          const leftX = 45 + (index % 6) * 100;
          const leftY = 45 + Math.floor(index / 6) * 80;
          const rightX = 45 + ((index + 1) % 6) * 100;
          const rightY = 45 + Math.floor((index + 1) / 6) * 80;
          return (
            <line
              className="constellation-line"
              key={`${previous.skill}-${skill.skill}`}
              x1={leftX}
              y1={leftY}
              x2={rightX}
              y2={rightY}
            />
          );
        })}
        {visible.map((skill, index) => {
          const x = 45 + (index % 6) * 100;
          const y = 45 + Math.floor(index / 6) * 80;
          return (
            <g className={`skill-node skill-node--${skill.state}`} key={skill.skill}>
              <circle cx={x} cy={y} r="12" />
              <text x={x} y={y + 25} textAnchor="middle">
                {skill.skill.slice(0, 14)}
              </text>
              <title>
                {skill.skill}: {skill.state}
              </title>
            </g>
          );
        })}
      </svg>
      <figcaption>
        <span>Introduced</span>
        <span>Practiced</span>
        <span>Demonstrated</span>
      </figcaption>
    </figure>
  );
}

export function CodeGarden({ artifacts }: { artifacts: readonly PortfolioArtifact[] }) {
  return (
    <div
      className="code-garden"
      role="img"
      aria-label="Code Garden portfolio visualization"
      tabIndex={0}
    >
      {artifacts.slice(0, 13).map((artifact, index) => {
        const maturity =
          artifact.status === "published"
            ? 4
            : artifact.status === "evidence_ready"
              ? 3
              : artifact.status === "draft"
                ? 2
                : 1;
        return (
          <div className={`garden-plant garden-plant--${maturity}`} key={artifact.artifactKey}>
            <span className="garden-plant__sun" aria-hidden="true" />
            <span className="garden-plant__leaf garden-plant__leaf--left" />
            <span className="garden-plant__leaf garden-plant__leaf--right" />
            <span className="garden-plant__stem" />
            <strong>{index + 1}</strong>
            <span className="visually-hidden">
              {artifact.title}: {artifact.status.replaceAll("_", " ")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function MilestonePeak({
  title,
  completed,
  total
}: {
  title: string;
  completed: number;
  total: number;
}) {
  return (
    <figure className="milestone-peak">
      <svg viewBox="0 0 280 150" role="img" aria-label={`${title}: ${completed} of ${total} days`}>
        <circle className="milestone-peak__sun" cx="220" cy="35" r="20" />
        <path className="milestone-peak__back" d="M0 140 L80 52 L130 105 L195 28 L280 140 Z" />
        <path className="milestone-peak__front" d="M0 140 L105 80 L155 140 Z" />
        <path
          className="milestone-peak__progress"
          d="M20 133 Q90 112 135 91 T250 45"
          pathLength="100"
          strokeDasharray={`${total === 0 ? 0 : (completed / total) * 100} 100`}
        />
      </svg>
      <figcaption>
        <strong>{title}</strong>
        <span>
          {completed} / {total} days
        </span>
      </figcaption>
    </figure>
  );
}

export function WeeklyStory({
  summary,
  reviewCount,
  evidenceCount
}: {
  summary: ProgressSummary;
  reviewCount: number;
  evidenceCount: number;
}) {
  return (
    <article className="weekly-story">
      <p className="eyebrow">Factual weekly story</p>
      <h3>You returned {summary.rolling7DayReturns} times this week.</h3>
      <p>
        CodeLift recorded {evidenceCount} recent evidence item
        {evidenceCount === 1 ? "" : "s"} and {reviewCount} due review
        {reviewCount === 1 ? "" : "s"}. No mastery is inferred from attendance.
      </p>
    </article>
  );
}

export function AchievementShelf({
  achievements
}: {
  achievements: readonly {
    key: string;
    title: string;
    description: string;
    earned: boolean;
  }[];
}) {
  return (
    <ul className="achievement-shelf" aria-label="Achievement Shelf">
      {achievements.map((achievement) => (
        <li
          className={achievement.earned ? "achievement achievement--earned" : "achievement"}
          key={achievement.key}
        >
          <span aria-hidden="true">{achievement.earned ? "◆" : "◇"}</span>
          <strong>{achievement.title}</strong>
          <small>{achievement.description}</small>
        </li>
      ))}
    </ul>
  );
}

export function FocusOrbTimer({ recovery = false }: { recovery?: boolean }) {
  const totalSeconds = recovery ? 5 * 60 : 30 * 60;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [remaining, running]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = ((totalSeconds - remaining) / totalSeconds) * 100;
  return (
    <div className="focus-timer">
      <div
        className="focus-orb focus-orb--interactive"
        style={{ "--focus-progress": `${progress}%` } as React.CSSProperties}
        role="timer"
        aria-label={`${minutes} minutes ${seconds} seconds remaining`}
      >
        <span className="focus-orb__minutes">
          {minutes}:{String(seconds).padStart(2, "0")}
        </span>
        <span className="focus-orb__label">{recovery ? "Recovery" : "Focus"}</span>
      </div>
      <div className="focus-timer__controls">
        <button className="button button--quiet" type="button" onClick={() => setRunning(!running)}>
          {running ? "Pause timer" : remaining === totalSeconds ? "Start timer" : "Resume timer"}
        </button>
        <button
          className="button button--quiet"
          type="button"
          onClick={() => {
            setRunning(false);
            setRemaining(totalSeconds);
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export function ParticleBurst({ label }: { label: string }) {
  return (
    <div className="particle-burst" role="img" aria-label={label}>
      {Array.from({ length: 8 }, (_, index) => (
        <span key={index} style={{ "--particle-index": index } as React.CSSProperties} />
      ))}
    </div>
  );
}

export function EvidenceCard({
  dayNumber,
  label,
  kind,
  createdAt
}: {
  dayNumber: number;
  label: string;
  kind: string;
  createdAt: string;
}) {
  return (
    <article className="evidence-card">
      <span aria-hidden="true">◇</span>
      <div>
        <p>Day {dayNumber}</p>
        <strong>{label}</strong>
        <small>
          {kind.replaceAll("_", " ")} · {new Date(createdAt).toLocaleDateString()}
        </small>
      </div>
    </article>
  );
}

export function ReviewQueueMini({
  reviews
}: {
  reviews: readonly Pick<ReviewItem, "id" | "prompt">[];
}) {
  return (
    <div className="review-mini">
      <strong>{reviews.length} due</strong>
      <span>{reviews[0]?.prompt ?? "No review is due. Keep the next mission useful."}</span>
    </div>
  );
}
