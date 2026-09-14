import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareEmailState } from "./email-state.mjs";

export const stateRoot = "/Users/Matt/Library/Application Support/CodeLift AI Self-Host";
const secretNames = [
  "mongo-admin-password",
  "mongo-app-password",
  "mongo-backup-password",
  "mongo-keyfile",
  "mongo-uri",
  "mongo-backup.yml",
  "backup-private-key.pem"
];

function privateDirectory(path) {
  if (existsSync(path) && (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink()))
    throw new Error("Invalid operator state directory.");
  mkdirSync(path, { recursive: true, mode: 0o700 });
  chmodSync(path, 0o700);
}

export function initializeState(root = stateRoot) {
  privateDirectory(root);
  for (const name of ["secrets", "backups", "ops", "evidence"]) privateDirectory(join(root, name));
  const secret = (name) => join(root, "secrets", name);
  if (readdirSync(join(root, "secrets")).length > 0) {
    for (const name of secretNames) {
      const path = secret(name);
      if (
        !existsSync(path) ||
        !lstatSync(path).isFile() ||
        lstatSync(path).isSymbolicLink() ||
        (lstatSync(path).mode & 0o777) !== 0o600
      )
        throw new Error(
          "Incomplete or invalid operator secrets; do not regenerate an existing deployment."
        );
    }
    for (const name of ["mongo-admin-password", "mongo-app-password", "mongo-backup-password"]) {
      if (!/^[A-Za-z0-9_-]{64}\n$/.test(readFileSync(secret(name), "utf8")))
        throw new Error("Invalid operator credential; restore the original secret.");
    }
    const password = readFileSync(secret("mongo-app-password"), "utf8").trim();
    if (
      readFileSync(secret("mongo-uri"), "utf8").trim() !==
      `mongodb://codelift_app:${password}@mongodb:27017/codelift?replicaSet=rs0&authSource=codelift`
    )
      throw new Error("Invalid operator URI; restore the original secret.");
    if (!existsSync(join(root, "ops", "backup-recipient.pem")))
      throw new Error("Incomplete backup recipient setup.");
    prepareEmailState(root);
    return;
  }
  const writeSecret = (name, content) =>
    writeFileSync(secret(name), content, { mode: 0o600, flag: "wx" });
  const admin = randomBytes(48).toString("base64url");
  const app = randomBytes(48).toString("base64url");
  const backup = randomBytes(48).toString("base64url");
  writeSecret("mongo-admin-password", `${admin}\n`);
  writeSecret("mongo-app-password", `${app}\n`);
  writeSecret("mongo-backup-password", `${backup}\n`);
  writeSecret("mongo-keyfile", `${randomBytes(756).toString("base64")}\n`);
  writeSecret(
    "mongo-uri",
    `mongodb://codelift_app:${app}@mongodb:27017/codelift?replicaSet=rs0&authSource=codelift\n`
  );
  writeSecret("mongo-backup.yml", `password: "${backup}"\n`);
  const result = spawnSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:3072",
      "-nodes",
      "-sha256",
      "-days",
      "3650",
      "-subj",
      "/CN=CodeLift local backup recipient",
      "-keyout",
      secret("backup-private-key.pem"),
      "-out",
      join(root, "ops", "backup-recipient.pem")
    ],
    { stdio: "ignore" }
  );
  if (result.status !== 0)
    throw new Error("OpenSSL recipient initialization failed; operator state is incomplete.");
  chmodSync(secret("backup-private-key.pem"), 0o600);
  chmodSync(join(root, "ops", "backup-recipient.pem"), 0o600);
  writeFileSync(
    join(root, "ops", "compose.env"),
    `SELFHOST_STATE_ROOT='${root}'\nSELFHOST_UID=${process.getuid()}\nSELFHOST_GID=${process.getgid()}\nWEB_ORIGIN=https://codelift.localhost\nTRUST_PROXY_HOPS=1\n`,
    { mode: 0o600, flag: "wx" }
  );
  prepareEmailState(root);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    initializeState();
    process.stdout.write("Operator state initialized; credentials were not displayed.\n");
  } catch {
    process.stderr.write(
      "Operator state initialization failed; inspect permissions and completeness without printing secrets.\n"
    );
    process.exitCode = 1;
  }
}
