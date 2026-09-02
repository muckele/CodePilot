import type { ClientSession } from "mongoose";

import type { CodeLiftModels } from "./models.js";

export async function withActiveAccountWrite<T>(
  models: CodeLiftModels,
  userId: string,
  missingAccountError: () => Error,
  write: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await models.User.db.startSession();
  let completed = false;
  let result: T | undefined;

  try {
    await session.withTransaction(async () => {
      const activeAccount = await models.User.updateOne(
        { _id: userId },
        { $inc: { writeFence: 1 } },
        { session }
      );
      if (activeAccount.matchedCount !== 1) {
        throw missingAccountError();
      }

      result = await write(session);
      completed = true;
    });
  } finally {
    await session.endSession();
  }

  if (!completed) {
    throw new Error("The active-account write transaction did not complete.");
  }
  return result as T;
}
