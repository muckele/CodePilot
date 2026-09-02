import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PersistenceConfig } from "../config.js";

const dependencies = vi.hoisted(() => ({
  createConnection: vi.fn(),
  createModels: vi.fn()
}));

vi.mock("mongoose", () => ({
  default: {
    createConnection: dependencies.createConnection
  }
}));

vi.mock("../persistence/models.js", () => ({
  createModels: dependencies.createModels
}));

import { initializePersistence } from "../persistence/runtime.js";

const config: PersistenceConfig = {
  mode: "required",
  mongoUri: "mongodb://mongo.invalid/codelift_test",
  databaseName: "codelift_test",
  serverSelectionTimeoutMs: 50
};

function installConnection(helloReply: unknown) {
  const command = vi.fn().mockResolvedValue(helloReply);
  const close = vi.fn().mockResolvedValue(undefined);
  const init = vi.fn().mockResolvedValue(undefined);
  const createIndexes = vi.fn().mockResolvedValue(undefined);
  const connection = {
    asPromise: vi.fn().mockResolvedValue(undefined),
    close,
    db: {
      admin: () => ({ command })
    }
  };

  dependencies.createConnection.mockReturnValue(connection);
  dependencies.createModels.mockReturnValue({ TestModel: { init, createIndexes } });

  return { close, command, createIndexes, init };
}

describe("persistence runtime topology readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["a standalone server", { logicalSessionTimeoutMinutes: 30 }],
    ["a replica set without session support", { setName: "rs0" }],
    ["an empty replica-set identity", { setName: "", logicalSessionTimeoutMinutes: 30 }],
    ["a zero session timeout", { setName: "rs0", logicalSessionTimeoutMinutes: 0 }]
  ])("rejects %s before creating indexes", async (_label, helloReply) => {
    const connection = installConnection(helloReply);

    await expect(initializePersistence(config)).resolves.toEqual({
      status: "unavailable",
      reason: "topology_unsupported"
    });
    expect(connection.close).toHaveBeenCalledOnce();
    expect(connection.init).not.toHaveBeenCalled();
    expect(connection.createIndexes).not.toHaveBeenCalled();
  });

  it("accepts a replica set with logical-session support", async () => {
    const connection = installConnection({
      setName: "rs0",
      logicalSessionTimeoutMinutes: 30
    });

    await expect(initializePersistence(config)).resolves.toMatchObject({ status: "ready" });
    expect(connection.command).toHaveBeenCalledWith({ hello: 1 });
    expect(connection.init).toHaveBeenCalledOnce();
    expect(connection.createIndexes).toHaveBeenCalledOnce();
    expect(connection.close).not.toHaveBeenCalled();
  });

  it("keeps a failed topology check behind a bounded unavailable reason", async () => {
    const connection = installConnection({
      setName: "rs0",
      logicalSessionTimeoutMinutes: 30
    });
    connection.command.mockRejectedValueOnce(new Error("driver details must not escape"));

    await expect(initializePersistence(config)).resolves.toEqual({
      status: "unavailable",
      reason: "topology_check_failed"
    });
    expect(connection.close).toHaveBeenCalledOnce();
    expect(connection.init).not.toHaveBeenCalled();
    expect(connection.createIndexes).not.toHaveBeenCalled();
  });
});
