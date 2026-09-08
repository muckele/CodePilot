// The credential stays inside this client; never interpolate it into argv/env.
try {
  const password = require("fs").readFileSync("/run/secrets/mongo-admin-password", "utf8").trim();
  if (!/^[A-Za-z0-9_-]{64}$/.test(password)) throw new Error();
  db.getSiblingDB("admin").createUser({
    user: "codelift_admin",
    pwd: password,
    roles: [{ role: "root", db: "admin" }]
  });
} catch {
  print("MongoDB root bootstrap failed; secret details suppressed.");
  quit(1);
}
