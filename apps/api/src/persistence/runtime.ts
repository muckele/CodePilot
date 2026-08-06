import mongoose, { type Connection } from "mongoose";

import type { PersistenceConfig } from "../config.js";
import { createModels, type CodeLiftModels } from "./models.js";

export type PersistenceUnavailableReason =
  "not_configured" | "connection_failed" | "index_initialization_failed";

export type PersistenceRuntime =
  | {
      readonly status: "ready";
      readonly connection: Connection;
      readonly models: CodeLiftModels;
    }
  | {
      readonly status: "unavailable";
      readonly reason: PersistenceUnavailableReason;
    };

async function closeQuietly(connection: Connection): Promise<void> {
  try {
    await connection.close();
  } catch {
    // Startup reports only a bounded capability state; internal driver details stay private.
  }
}

export async function initializePersistence(
  config: PersistenceConfig
): Promise<PersistenceRuntime> {
  if (config.mongoUri === null) {
    return {
      status: "unavailable",
      reason: "not_configured"
    };
  }

  const connection = mongoose.createConnection(config.mongoUri, {
    dbName: config.databaseName,
    serverSelectionTimeoutMS: config.serverSelectionTimeoutMs,
    autoIndex: false
  });

  try {
    await connection.asPromise();
  } catch {
    await closeQuietly(connection);
    return {
      status: "unavailable",
      reason: "connection_failed"
    };
  }

  const models = createModels(connection);

  try {
    await Promise.all(
      Object.values(models).map(async (model) => {
        await model.init();
        await model.createIndexes();
      })
    );
  } catch {
    await closeQuietly(connection);
    return {
      status: "unavailable",
      reason: "index_initialization_failed"
    };
  }

  return {
    status: "ready",
    connection,
    models
  };
}

export async function closePersistence(runtime: PersistenceRuntime): Promise<void> {
  if (runtime.status === "ready") {
    await closeQuietly(runtime.connection);
  }
}
