try {
  const secret = (name) => require("fs").readFileSync(`/run/secrets/${name}`, "utf8").trim();
  const admin = db.getSiblingDB("admin");
  if (!admin.auth("codelift_admin", secret("mongo-admin-password"))) throw new Error();
  const config = admin.runCommand({ replSetGetConfig: 1 }).config;
  if (
    config._id !== "rs0" ||
    config.members.length !== 1 ||
    config.members[0].host !== "mongodb:27017"
  )
    throw new Error();
  if (admin.runCommand({ replSetGetStatus: 1 }).members[0].stateStr !== "PRIMARY")
    throw new Error();
  let unauthenticatedDenied = false;
  const unauth = new Mongo("mongodb://mongodb:27017/?directConnection=true").getDB("codelift");
  try {
    unauth.runCommand({ find: "users", limit: 1 });
  } catch (error) {
    unauthenticatedDenied = error.code === 13;
  }
  if (!unauthenticatedDenied) throw new Error();
  const backup = new Mongo("mongodb://mongodb:27017/?directConnection=true");
  if (!backup.getDB("admin").auth("codelift_backup", secret("mongo-backup-password")))
    throw new Error();
  if (backup.getDB("codelift").runCommand({ listCollections: 1, nameOnly: true }).ok !== 1)
    throw new Error();
  let backupWriteDenied = false;
  try {
    backup
      .getDB("codelift")
      .runCommand({ insert: "selfhost_probe", documents: [{ _id: "must-not-exist" }] });
  } catch (error) {
    backupWriteDenied = error.code === 13;
  }
  if (!backupWriteDenied) throw new Error();
  print(
    JSON.stringify({ unauthenticatedDenied, backupWriteDenied, replicaSet: "rs0", primary: true })
  );
} catch {
  print("MongoDB auth/RBAC/replica verification failed; details suppressed.");
  quit(1);
}
