// One-off operational verification, mounted only into a helper. Never a route.
import assert from "node:assert/strict";
import { readSnapshot } from "./snapshot.mjs";

const { loadApiConfig } = await import("/app/apps/api/dist/config.js");
const { initializePersistence, closePersistence } =
  await import("/app/apps/api/dist/persistence/runtime.js");
const { initializeCurriculum } = await import("/app/apps/api/dist/curriculum/runtime.js");
const { AccountService } = await import("/app/apps/api/dist/account/service.js");
const config = loadApiConfig();
const runtime = await initializePersistence(config.persistence);
assert.equal(runtime.status, "ready", "application topology and index initialization");
try {
  const { models, connection } = runtime;
  const action = process.argv[2] ?? "verify";
  let committedDocumentWrites = 0;
  assert.ok(["create", "verify", "fingerprint"].includes(action));
  const emails = [
    "codelift-selfhost-drill-a@example.invalid",
    "codelift-selfhost-drill-b@example.invalid"
  ];
  if (action === "create") {
    for (const [index, email] of emails.entries()) {
      const user = await models.User.findOneAndUpdate(
        { email },
        { $setOnInsert: { email, passwordHash: "synthetic-unusable-selfhost-drill-hash" } },
        { upsert: true, returnDocument: "after" }
      );
      await models.Reflection.updateOne(
        { userId: user._id, dayNumber: 1 },
        {
          $setOnInsert: {
            userId: user._id,
            dayNumber: 1,
            confused: `synthetic-tenant-${index}-reflection`,
            mentalModelChanged: "synthetic restore fixture",
            retrieveLater: "synthetic transaction verification"
          }
        },
        { upsert: true }
      );
      await models.Progress.updateOne(
        { userId: user._id, dayNumber: 1 },
        {
          $setOnInsert: {
            userId: user._id,
            dayNumber: 1,
            status: "in_progress",
            selectedMode: "core"
          }
        },
        { upsert: true }
      );
      await models.EmailLoginCode.updateOne(
        { userId: user._id, purpose: "email_login" },
        {
          $setOnInsert: {
            userId: user._id,
            purpose: "email_login",
            codeDigest: Buffer.alloc(32, index + 1),
            expiresAt: new Date("2036-09-13T00:00:00.000Z"),
            sentAt: new Date("2026-09-13T00:00:00.000Z"),
            consumedAt: null,
            revokedAt: null,
            failedAttempts: 0,
            createdAt: new Date("2026-09-13T00:00:00.000Z")
          }
        },
        { upsert: true }
      );
      await connection.db
        .collection("selfhost_probe")
        .updateOne(
          { _id: `synthetic-${index}` },
          { $setOnInsert: { committed: true } },
          { upsert: true }
        );
    }
  }
  if (action !== "fingerprint") {
    const curriculum = await initializeCurriculum(config.curriculumPath);
    assert.equal(curriculum.status, "ready");
    const account = await AccountService.create({
      models,
      curriculum,
      sessionConfig: config.session,
      registrationConfig: config.registration
    });
    for (const [index, email] of emails.entries()) {
      const user = await models.User.findOne({ email });
      assert.ok(user, "synthetic tenant survives");
      const exported = await account.exportAccount(user._id.toString());
      assert.equal(exported.account.email, email);
      assert.equal(exported.sourceRecords.reflections.length, 1);
      assert.equal(
        exported.sourceRecords.reflections[0].confused,
        `synthetic-tenant-${index}-reflection`
      );
      assert.ok(!JSON.stringify(exported).includes(`synthetic-tenant-${1 - index}-reflection`));
      assert.equal(exported.sourceRecords.progress.length, 1);
      assert.ok(!JSON.stringify(exported).includes("synthetic-unusable-selfhost-drill-hash"));
    }
    const indexes = await models.User.collection.indexes();
    assert.ok(indexes.some((index) => index.unique && index.key.email === 1));
    const sessionIndexes = await models.Session.collection.indexes();
    assert.ok(sessionIndexes.some((index) => index.expireAfterSeconds === 0));
    const emailLoginCodeIndexes = await models.EmailLoginCode.collection.indexes();
    assert.ok(
      emailLoginCodeIndexes.some(
        (index) => index.key.userId === 1 && index.key.purpose === 1 && index.key.createdAt === -1
      )
    );
    assert.ok(
      emailLoginCodeIndexes.some(
        (index) => index.key.expiresAt === 1 && index.expireAfterSeconds === 7 * 24 * 60 * 60
      )
    );
    const session = await connection.startSession();
    try {
      for (const committed of [false, true]) {
        const writes = await session.withTransaction(async () => {
          let modified = 0;
          for (const id of ["synthetic-0", "synthetic-1"]) {
            const result = await connection.db
              .collection("selfhost_probe")
              .updateOne({ _id: id }, { $set: { committed } }, { session });
            assert.equal(result.modifiedCount, 1);
            modified += result.modifiedCount;
          }
          return modified;
        });
        committedDocumentWrites += writes;
        assert.equal(
          await connection.db.collection("selfhost_probe").countDocuments({ committed }),
          2
        );
      }
      await assert.rejects(
        session.withTransaction(async () => {
          await connection.db
            .collection("selfhost_probe")
            .updateMany({}, { $set: { committed: false } }, { session });
          throw new Error("synthetic abort");
        }),
        /synthetic abort/
      );
    } finally {
      await session.endSession();
    }
    assert.equal(
      await connection.db.collection("selfhost_probe").countDocuments({ committed: true }),
      2
    );
  }
  // API startup intentionally reseeds globals and updates their timestamps.
  // Persistence compares user state; restore still compares the full snapshot.
  const globalCollections = new Set(
    [
      models.CurriculumDay,
      models.Resource,
      models.Achievement,
      models.FeatureFlag,
      models.EvalDataset
    ].map((model) => model.collection.name)
  );
  const snapshot = await readSnapshot(connection.db);
  const persisted = await readSnapshot(connection.db, globalCollections);
  process.stdout.write(
    `${JSON.stringify({ transaction: action !== "fingerprint", committedDocumentWrites, tenantIsolation: action !== "fingerprint", accountExport: action !== "fingerprint", indexes: action !== "fingerprint", emailLoginCodeIndexes: action !== "fingerprint", collections: snapshot.collections, fingerprint: snapshot.fingerprint, persistenceFingerprint: persisted.fingerprint })}\n`
  );
} finally {
  await closePersistence(runtime);
}
