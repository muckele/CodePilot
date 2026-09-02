import { closePersistence, initializePersistence } from "../../apps/api/src/persistence/runtime.js";
import { issueInvitation } from "../../apps/api/src/account/access-operator.js";

import { E2E_DATABASE_NAME, E2E_MONGO_URI, guardedE2eDatabaseName } from "./environment.js";

async function openE2ePersistence() {
  guardedE2eDatabaseName(E2E_MONGO_URI);
  const runtime = await initializePersistence({
    mode: "required",
    mongoUri: E2E_MONGO_URI,
    databaseName: E2E_DATABASE_NAME,
    serverSelectionTimeoutMs: 5_000
  });
  if (runtime.status !== "ready") {
    throw new Error(`Playwright Mongo is unavailable (${runtime.reason}).`);
  }
  return runtime;
}

export async function dropE2eDatabase(): Promise<void> {
  const runtime = await openE2ePersistence();
  try {
    await runtime.connection.dropDatabase();
  } finally {
    await closePersistence(runtime);
  }
}

export async function issueE2eInvitation(email: string): Promise<string> {
  const runtime = await openE2ePersistence();
  try {
    return (
      await issueInvitation({
        models: runtime.models,
        email,
        issuer: "playwright-e2e",
        ttlMs: 60 * 60 * 1_000
      })
    ).token;
  } finally {
    await closePersistence(runtime);
  }
}

export interface UserOwnedCounts {
  readonly user: number;
  readonly sessions: number;
  readonly invitations: number;
  readonly passwordResets: number;
  readonly progress: number;
  readonly reflections: number;
  readonly xpEvents: number;
  readonly userAchievements: number;
  readonly skillEvidence: number;
  readonly reviews: number;
  readonly misconceptions: number;
  readonly errors: number;
  readonly portfolioArtifacts: number;
  readonly aiTraces: number;
  readonly evalRuns: number;
  readonly indexedSources: number;
  readonly indexedChunks: number;
  readonly agentRuns: number;
  readonly jobApplications: number;
}

export async function userOwnedCounts(userId: string): Promise<UserOwnedCounts> {
  const runtime = await openE2ePersistence();
  try {
    const [
      user,
      sessions,
      invitations,
      passwordResets,
      progress,
      reflections,
      xpEvents,
      userAchievements,
      skillEvidence,
      reviews,
      misconceptions,
      errors,
      portfolioArtifacts,
      aiTraces,
      evalRuns,
      indexedSources,
      agentRuns,
      jobApplications,
      sources
    ] = await Promise.all([
      runtime.models.User.countDocuments({ _id: userId }),
      runtime.models.Session.countDocuments({ userId }),
      runtime.models.Invitation.countDocuments({ consumedByUserId: userId }),
      runtime.models.PasswordReset.countDocuments({ userId }),
      runtime.models.Progress.countDocuments({ userId }),
      runtime.models.Reflection.countDocuments({ userId }),
      runtime.models.XpEvent.countDocuments({ userId }),
      runtime.models.UserAchievement.countDocuments({ userId }),
      runtime.models.SkillEvidence.countDocuments({ userId }),
      runtime.models.ReviewItem.countDocuments({ userId }),
      runtime.models.Misconception.countDocuments({ userId }),
      runtime.models.ErrorMuseumEntry.countDocuments({ userId }),
      runtime.models.PortfolioArtifact.countDocuments({ userId }),
      runtime.models.AiTrace.countDocuments({ userId }),
      runtime.models.EvalRun.countDocuments({ userId }),
      runtime.models.IndexedSource.countDocuments({ userId }),
      runtime.models.AgentRun.countDocuments({ userId }),
      runtime.models.JobApplication.countDocuments({ userId }),
      runtime.models.IndexedSource.find({ userId }).select({ chunks: 1 }).lean()
    ]);
    return {
      user,
      sessions,
      invitations,
      passwordResets,
      progress,
      reflections,
      xpEvents,
      userAchievements,
      skillEvidence,
      reviews,
      misconceptions,
      errors,
      portfolioArtifacts,
      aiTraces,
      evalRuns,
      indexedSources,
      indexedChunks: sources.reduce((total, source) => total + source.chunks.length, 0),
      agentRuns,
      jobApplications
    };
  } finally {
    await closePersistence(runtime);
  }
}
