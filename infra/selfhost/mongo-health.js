try {
  const admin = db.getSiblingDB("admin");
  if (
    !admin.auth(
      "codelift_admin",
      require("fs").readFileSync("/run/secrets/mongo-admin-password", "utf8").trim()
    )
  )
    quit(1);
  const hello = admin.runCommand({ hello: 1 });
  quit(
    hello.ok === 1 &&
      hello.setName === "rs0" &&
      hello.isWritablePrimary === true &&
      admin.runCommand({ connectionStatus: 1 }).authInfo.authenticatedUsers.length === 1
      ? 0
      : 1
  );
} catch {
  quit(1);
}
