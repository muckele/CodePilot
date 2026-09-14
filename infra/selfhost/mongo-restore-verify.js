try {
  const admin = db.getSiblingDB("admin");
  if (
    !admin.auth(
      "codelift_admin",
      require("fs").readFileSync("/run/secrets/mongo-admin-password", "utf8").trim()
    )
  )
    throw new Error();
  const app = db.getSiblingDB("codelift");
  if (admin.runCommand({ hello: 1 }).setName !== "rs0") throw new Error();
  if (!app.users.getIndexes().some((index) => index.unique === true && index.key.email === 1))
    throw new Error();
  if (!app.sessions.getIndexes().some((index) => index.expireAfterSeconds === 0)) throw new Error();
  if (!app.getCollectionNames().includes("emaillogincodes")) throw new Error();
  const emailLoginCodeIndexes = app.emaillogincodes.getIndexes();
  if (
    !emailLoginCodeIndexes.some(
      (index) => index.key.userId === 1 && index.key.purpose === 1 && index.key.createdAt === -1
    )
  )
    throw new Error();
  if (
    !emailLoginCodeIndexes.some(
      (index) => index.key.expiresAt === 1 && index.expireAfterSeconds === 7 * 24 * 60 * 60
    )
  )
    throw new Error();
  if (app.selfhost_probe.countDocuments({ committed: true }) !== 2) throw new Error();
  print(
    JSON.stringify({
      restoredIndexesBeforeAppStartup: true,
      restoredEmailLoginCodeIndexesBeforeAppStartup: true,
      replicaSet: "rs0",
      representativeData: true
    })
  );
} catch {
  print("Restored MongoDB metadata verification failed; details suppressed.");
  quit(1);
}
