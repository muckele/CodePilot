import type { CodeLiftModels } from "../persistence/models.js";

export interface PilotMetricsWindow {
  readonly since: Date;
  readonly until: Date;
  readonly minimumCohortSize: number;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.round((numerator / denominator) * 10_000) / 10_000;
}

const dayMilliseconds = 24 * 60 * 60 * 1_000;

function requireUtcMidnight(value: Date, name: "since" | "until"): void {
  if (
    Number.isNaN(value.getTime()) ||
    value.getUTCHours() !== 0 ||
    value.getUTCMinutes() !== 0 ||
    value.getUTCSeconds() !== 0 ||
    value.getUTCMilliseconds() !== 0
  ) {
    throw new Error(`${name} must be a valid UTC midnight boundary.`);
  }
}

function utcDateAfter(value: Date, days: number): string {
  const midnight = Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  return new Date(midnight + days * dayMilliseconds).toISOString().slice(0, 10);
}

export async function buildPilotMetrics(models: CodeLiftModels, window: PilotMetricsWindow) {
  requireUtcMidnight(window.since, "since");
  requireUtcMidnight(window.until, "until");
  if (window.since.getTime() >= window.until.getTime()) {
    throw new Error("since must be earlier than until.");
  }
  const range = { $gte: window.since, $lt: window.until };
  const [users, invitations] = await Promise.all([
    models.User.find({ createdAt: range }).select("_id onboardedAt createdAt").lean(),
    models.Invitation.countDocuments({ createdAt: range })
  ]);
  const base = {
    schemaVersion: "codelift.mvp-metrics.v1" as const,
    window: {
      since: window.since.toISOString(),
      until: window.until.toISOString()
    },
    minimumCohortSize: window.minimumCohortSize,
    cohortSize: users.length
  };

  if (users.length < window.minimumCohortSize) {
    return {
      ...base,
      suppressed: true as const,
      reason: "Cohort is below the configured privacy threshold."
    };
  }

  const ownerIds = users.map((user) => user._id);
  const [progress, reflections, activity, traces, aggregates] = await Promise.all([
    models.Progress.find({
      userId: { $in: ownerIds },
      $or: [{ createdAt: range }, { startedAt: range }, { completedAt: range }]
    })
      .select("userId dayNumber status startedAt completedAt createdAt updatedAt")
      .lean(),
    models.Reflection.find({ userId: { $in: ownerIds }, createdAt: range })
      .select("userId createdAt")
      .lean(),
    models.UserActivity.find({ userId: { $in: ownerIds }, firstSeenAt: range })
      .select("userId date firstSeenAt")
      .lean(),
    models.AiTrace.find({ userId: { $in: ownerIds }, createdAt: range })
      .select("feature outcome estimatedCostUsd createdAt")
      .lean(),
    models.PilotAggregate.find({
      date: {
        $gte: window.since.toISOString().slice(0, 10),
        $lt: window.until.toISOString().slice(0, 10)
      }
    })
      .select("event count")
      .lean()
  ]);

  const usersById = new Map(users.map((user) => [user._id.toString(), user]));
  const firstMissionByOwner = new Map<string, (typeof progress)[number]>();
  for (const record of progress.filter((candidate) => candidate.dayNumber === 1)) {
    const user = usersById.get(record.userId.toString());
    if (
      user !== undefined &&
      record.startedAt !== null &&
      record.startedAt.getTime() >= user.createdAt.getTime() &&
      record.startedAt.getTime() < window.until.getTime()
    ) {
      firstMissionByOwner.set(record.userId.toString(), record);
    }
  }
  const completed = [...firstMissionByOwner.values()].filter((record) => {
    if (record.status !== "core_completed" && record.status !== "recovery_completed") {
      return false;
    }
    const user = usersById.get(record.userId.toString());
    if (user === undefined || record.completedAt === null) return false;
    const deadline = Math.min(
      user.createdAt.getTime() + 7 * dayMilliseconds,
      window.until.getTime()
    );
    return (
      record.completedAt.getTime() >= user.createdAt.getTime() &&
      record.completedAt.getTime() < deadline
    );
  });
  const completionMinutes = completed.flatMap((record) => {
    const user = usersById.get(record.userId.toString());
    if (user === undefined || record.completedAt === null) return [];
    return [(record.completedAt.getTime() - user.createdAt.getTime()) / 60_000];
  });
  const activityDays = new Set(
    activity.map((record) => `${record.userId.toString()}:${record.date}`)
  );
  const returnedOnUtcDay = (daysAfterRegistration: number) =>
    users.filter((user) =>
      activityDays.has(
        `${user._id.toString()}:${utcDateAfter(user.createdAt, daysAfterRegistration)}`
      )
    ).length;
  const aggregateCount = (event: "account_export_succeeded" | "account_deletion_succeeded") =>
    aggregates
      .filter((record) => record.event === event)
      .reduce((total, record) => total + record.count, 0);
  const traceErrors = traces.filter((trace) => trace.outcome === "error").length;
  const traceFallbacks = traces.filter((trace) => trace.outcome === "fallback").length;
  const ragTraces = traces.filter((trace) => trace.feature === "rag-search");
  const ragAbstentions = ragTraces.filter((trace) => trace.outcome === "abstained").length;

  return {
    ...base,
    suppressed: false as const,
    funnel: {
      invited: invitations,
      registered: users.length,
      onboarded: users.filter(
        (user) =>
          user.onboardedAt !== null &&
          user.onboardedAt.getTime() >= user.createdAt.getTime() &&
          user.onboardedAt.getTime() < window.until.getTime()
      ).length,
      firstMissionStarted: firstMissionByOwner.size,
      firstValidCompletion: completed.length
    },
    completion: {
      core: completed.filter((record) => record.status === "core_completed").length,
      recovery: completed.filter((record) => record.status === "recovery_completed").length,
      averageMinutesToFirstValidCompletion:
        completionMinutes.length === 0
          ? null
          : Math.round(
              completionMinutes.reduce((total, minutes) => total + minutes, 0) /
                completionMinutes.length
            )
    },
    return: {
      nextDay: returnedOnUtcDay(1),
      sevenDay: returnedOnUtcDay(7)
    },
    reliability: {
      persistedSaveRecords:
        progress.filter(
          (record) =>
            record.createdAt.getTime() >= window.since.getTime() &&
            record.createdAt.getTime() < window.until.getTime()
        ).length + reflections.length,
      aiInteractionCount: traces.length,
      aiErrorRate: ratio(traceErrors, traces.length),
      providerFallbackRate: ratio(traceFallbacks, traces.length),
      ragAbstentionRate: ratio(ragAbstentions, ragTraces.length),
      // The mutable current flag has no historical event log, so a fixed-window
      // report must not present its present value as past-window evidence.
      agentKillSwitchEnabled: null,
      estimatedProviderCostUsd:
        Math.round(traces.reduce((total, trace) => total + trace.estimatedCostUsd, 0) * 1_000_000) /
        1_000_000
    },
    lifecycle: {
      exportSuccesses: aggregateCount("account_export_succeeded"),
      deletionSuccesses: aggregateCount("account_deletion_succeeded")
    }
  };
}
