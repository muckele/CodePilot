require("fs").writeFileSync(
  "/tmp/restore-config.yml",
  `password: ${JSON.stringify(require("fs").readFileSync("/run/secrets/mongo-admin-password", "utf8").trim())}\n`,
  { mode: 0o600 }
);
