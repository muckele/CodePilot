import { closePersistence, initializePersistence } from "../../apps/api/src/persistence/runtime.js";
import { issueInvitation } from "../../apps/api/src/account/access-operator.js";

import { E2E_DATABASE_NAME, E2E_MONGO_URI, guardedE2eDatabaseName } from "./environment.js";

const syntheticAccountEmail = /^e2e-[a-z0-9][a-z0-9-]*-[a-f0-9]{12}@example\.test$/u;

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

export async function deleteE2eSyntheticAccount(email: string): Promise<void> {
  if (!syntheticAccountEmail.test(email)) {
    throw new Error("E2E cleanup requires an explicit synthetic Playwright account email.");
  }

  const runtime = await openE2ePersistence();
  try {
    const user = await runtime.models.User.findOne({ email }).select({ _id: 1, email: 1 }).lean();
    if (user === null) {
      await runtime.models.Invitation.deleteMany({ email });
      return;
    }

    const databaseSession = await runtime.connection.startSession();
    try {
      await databaseSession.withTransaction(async () => {
        // Mongo does not support parallel operations on one transaction. This
        // test-only registry deliberately mirrors the product-owned records.
        await runtime.models.Progress.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await runtime.models.Reflection.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await runtime.models.UserActivity.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await runtime.models.XpEvent.deleteMany({ userId: user._id }, { session: databaseSession });
        await runtime.models.UserAchievement.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await runtime.models.SkillEvidence.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await runtime.models.ReviewItem.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await runtime.models.Misconception.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await runtime.models.ErrorMuseumEntry.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await runtime.models.PortfolioArtifact.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await runtime.models.AiTrace.deleteMany({ userId: user._id }, { session: databaseSession });
        await runtime.models.EvalRun.deleteMany({ userId: user._id }, { session: databaseSession });
        await runtime.models.IndexedSource.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await runtime.models.AgentRun.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await runtime.models.JobApplication.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await runtime.models.Session.deleteMany({ userId: user._id }, { session: databaseSession });
        await runtime.models.Invitation.deleteMany(
          { $or: [{ consumedByUserId: user._id }, { email }] },
          { session: databaseSession }
        );
        await runtime.models.PasswordReset.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        await runtime.models.EmailLoginCode.deleteMany(
          { userId: user._id },
          { session: databaseSession }
        );
        const deleted = await runtime.models.User.deleteOne(
          { _id: user._id, email },
          { session: databaseSession }
        );
        if (deleted.deletedCount !== 1) {
          throw new Error("Synthetic Playwright account ownership changed during cleanup.");
        }
      });
    } finally {
      await databaseSession.endSession();
    }
  } finally {
    await closePersistence(runtime);
  }
}

export async function expireLatestE2EEmailLoginCode(email: string): Promise<void> {
  if (!syntheticAccountEmail.test(email)) {
    throw new Error("E2E expiry requires an explicit synthetic Playwright account email.");
  }
  const runtime = await openE2ePersistence();
  try {
    const user = await runtime.models.User.findOne({ email }).select({ _id: 1 }).lean();
    if (user === null) throw new Error("Cannot expire a code for a missing synthetic account.");
    const result = await runtime.models.EmailLoginCode.findOneAndUpdate(
      { userId: user._id, sentAt: { $ne: null }, revokedAt: null, consumedAt: null },
      { $set: { expiresAt: new Date(Date.now() - 1_000) } },
      { sort: { createdAt: -1 }, returnDocument: "after" }
    );
    if (result === null) {
      throw new Error("Expected one delivered synthetic sign-in code to expire.");
    }
  } finally {
    await closePersistence(runtime);
  }
}

export interface UserOwnedCounts {
  readonly user: number;
  readonly sessions: number;
  readonly userActivities: number;
  readonly invitations: number;
  readonly passwordResets: number;
  readonly emailLoginCodes: number;
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
      userActivities,
      invitations,
      passwordResets,
      emailLoginCodes,
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
      runtime.models.UserActivity.countDocuments({ userId }),
      runtime.models.Invitation.countDocuments({ consumedByUserId: userId }),
      runtime.models.PasswordReset.countDocuments({ userId }),
      runtime.models.EmailLoginCode.countDocuments({ userId }),
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
      userActivities,
      invitations,
      passwordResets,
      emailLoginCodes,
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
