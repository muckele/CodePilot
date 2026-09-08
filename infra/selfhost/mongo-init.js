const fs = require("fs");
const admin = db.getSiblingDB("admin");
const secret = (name) => fs.readFileSync(`/run/secrets/${name}`, "utf8").trim();
const maxAttempts = Number(process.env.MONGO_INIT_MAX_ATTEMPTS ?? "120");
const setName = process.env.MONGO_REPLICA_SET ?? "rs0";
const member = process.env.MONGO_REPLICA_MEMBER ?? "mongodb:27017";

try {
  let connected = false;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (admin.auth("codelift_admin", secret("mongo-admin-password"))) {
        const options = admin.runCommand({ getCmdLineOpts: 1 });
        if (
          (options.parsed?.replication?.replSetName ?? options.parsed?.replication?.replSet) ===
          setName
        ) {
          connected = true;
          break;
        }
      }
    } catch {
      /* The official entrypoint may still be creating the first admin. */
    }
    sleep(1000);
  }
  if (!connected)
    throw new Error(
      "Authenticated MongoDB did not become reachable before the bounded wait expired."
    );
  let existing;
  try {
    existing = admin.runCommand({ replSetGetConfig: 1 });
  } catch (error) {
    if (error.code !== 94 && error.codeName !== "NotYetInitialized")
      throw new Error("MongoDB replica-set state could not be inspected.");
  }
  if (existing?.ok === 1) {
    const config = existing.config;
    if (
      config._id !== setName ||
      config.members.length !== 1 ||
      config.members[0]._id !== 0 ||
      config.members[0].host !== member ||
      config.members[0].arbiterOnly === true
    )
      throw new Error("MongoDB existing topology does not match the expected single member.");
    print("MongoDB replica set is already configured.");
  } else {
    if (existing !== undefined && existing.code !== 94)
      throw new Error("MongoDB replica-set state could not be inspected.");
    if (
      admin.runCommand({ replSetInitiate: { _id: setName, members: [{ _id: 0, host: member }] } })
        .ok !== 1
    )
      throw new Error("MongoDB replica-set initialization failed.");
    print("MongoDB replica-set initialization requested.");
  }
  let primary = false;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (admin.runCommand({ hello: 1 }).isWritablePrimary === true) {
      primary = true;
      break;
    }
    sleep(1000);
  }
  if (!primary)
    throw new Error("MongoDB replica set did not elect a primary before the bounded wait expired.");
  const users = [
    {
      database: "codelift",
      user: "codelift_app",
      file: "mongo-app-password",
      role: "readWrite",
      roleDb: "codelift"
    },
    {
      database: "admin",
      user: "codelift_backup",
      file: "mongo-backup-password",
      role: "read",
      roleDb: "codelift"
    }
  ];
  for (const entry of users) {
    const target = db.getSiblingDB(entry.database);
    const user = target.getUser(entry.user);
    const roles = [{ role: entry.role, db: entry.roleDb }];
    if (user === null) target.createUser({ user: entry.user, pwd: secret(entry.file), roles });
    else if (
      user.roles.length !== 1 ||
      user.roles[0].role !== entry.role ||
      user.roles[0].db !== entry.roleDb
    )
      throw new Error("An existing MongoDB account has unexpected privileges.");
    const check = new Mongo(
      `mongodb://${process.env.MONGO_HOST ?? "mongodb"}:27017/?directConnection=true`
    ).getDB(entry.database);
    if (!check.auth(entry.user, secret(entry.file)))
      throw new Error("Existing MongoDB account does not match its mounted secret.");
  }
  print(`MongoDB replica set ${setName} and authenticated application/backup accounts are ready.`);
} catch (error) {
  const safeMessages = [
    "Authenticated MongoDB did not",
    "MongoDB existing topology",
    "MongoDB replica-set",
    "MongoDB replica set did",
    "An existing MongoDB account",
    "Existing MongoDB account"
  ];
  print(
    safeMessages.some((prefix) => String(error.message).startsWith(prefix))
      ? error.message
      : "Authenticated MongoDB initialization failed; secret details suppressed."
  );
  quit(1);
}
