try {
  const admin = db.getSiblingDB("admin");
  if (
    !admin.auth(
      "codelift_admin",
      require("fs").readFileSync("/run/secrets/mongo-admin-password", "utf8").trim()
    )
  )
    throw new Error();
  const action = process.env.MONGO_ACTION;
  if (action === "lock") {
    if (
      admin.runCommand({ hello: 1 }).isWritablePrimary !== true ||
      admin.currentOp().fsyncLock === true
    )
      throw new Error();
    if (admin.fsyncLock().ok !== 1) throw new Error();
  } else if (action === "unlock") {
    if (admin.fsyncUnlock().ok !== 1) throw new Error();
  } else throw new Error();
  print(JSON.stringify({ action, ok: true }));
} catch {
  print("MongoDB backup write-lock operation failed; details suppressed.");
  quit(1);
}
