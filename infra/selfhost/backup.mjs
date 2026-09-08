import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  createWriteStream,
  existsSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

const filenamePattern = /^codelift-\d{8}T\d{9}Z-[a-f0-9]{40}\.archive\.gz\.cms$/;

export function digestFile(path) {
  const descriptor = openSync(path, "r");
  try {
    const hash = createHash("sha256");
    const buffer = Buffer.alloc(65536);
    let bytes;
    while ((bytes = readSync(descriptor, buffer, 0, buffer.length, null)) > 0)
      hash.update(buffer.subarray(0, bytes));
    return hash.digest("hex");
  } finally {
    closeSync(descriptor);
  }
}

export async function encryptBackup({
  root,
  sourceSha,
  snapshot,
  input,
  date = new Date(),
  sourceCompletion = Promise.resolve(0)
}) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha))
    throw new Error("A full source revision is required for backup.");
  const timestamp = date.toISOString().replace(/[-:.]/g, "");
  const filename = `codelift-${timestamp}-${sourceSha}.archive.gz.cms`;
  const target = join(root, "backups", filename);
  const partial = `${target}.partial`;
  if ([partial, target, `${target}.sha256`, `${target}.json`].some((path) => existsSync(path))) {
    throw new Error("Backup filename already exists; retained artifacts were not changed.");
  }
  const encryption = spawn(
    "openssl",
    [
      "cms",
      "-encrypt",
      "-binary",
      "-aes-256-gcm",
      "-stream",
      "-outform",
      "DER",
      join(root, "ops", "backup-recipient.pem")
    ],
    { stdio: ["pipe", "pipe", "ignore"] }
  );
  const completion = new Promise((resolve, reject) => {
    encryption.once("error", () => reject(new Error("Backup encryption could not start.")));
    encryption.once("close", (status) =>
      status === 0 ? resolve() : reject(new Error("Backup encryption failed."))
    );
  });
  const tasks = [
    sourceCompletion.then((status) => {
      if (status !== 0) throw new Error("Backup source did not complete.");
    }),
    pipeline(input, encryption.stdin),
    pipeline(encryption.stdout, createWriteStream(partial, { flags: "wx", mode: 0o600 })),
    completion
  ];
  try {
    await Promise.all(tasks);
    const metadata = {
      filename,
      createdAt: date.toISOString(),
      sourceSha,
      snapshot,
      encryption: "CMS AES-256-GCM / RSA-3072 recipient",
      compression: "mongodump gzip",
      consistency: "primary fsync write lock; database-only; no credential collections",
      sha256: digestFile(partial),
      encryptedBytes: statSync(partial).size
    };
    renameSync(partial, target);
    writeFileSync(`${target}.sha256`, `${metadata.sha256}  ${filename}\n`, {
      flag: "wx",
      mode: 0o600
    });
    writeFileSync(`${target}.json`, `${JSON.stringify(metadata, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600
    });
    return metadata;
  } catch {
    encryption.kill("SIGTERM");
    await Promise.allSettled(tasks);
    for (const path of [partial, target, `${target}.sha256`, `${target}.json`])
      rmSync(path, { force: true });
    throw new Error("Backup failed; partial ciphertext removed and no plaintext retained.");
  }
}

export function verifyBackup(root, filename) {
  if (!filenamePattern.test(filename)) throw new Error("Invalid backup filename.");
  const path = join(root, "backups", filename);
  for (const file of [path, `${path}.sha256`]) {
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Invalid backup artifact.");
  }
  const actual = digestFile(path);
  if (readFileSync(`${path}.sha256`, "utf8") !== `${actual}  ${filename}\n`)
    throw new Error("Backup integrity verification failed.");
  return actual;
}

export function readBackupSnapshot(root, filename) {
  const sha256 = verifyBackup(root, filename);
  try {
    const path = join(root, "backups", `${filename}.json`);
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw new Error();
    const metadata = JSON.parse(readFileSync(path, "utf8"));
    const snapshot = metadata.snapshot;
    if (
      metadata.filename !== filename ||
      metadata.sha256 !== sha256 ||
      snapshot?.algorithm !== "sha256-json-v1" ||
      !/^[a-f0-9]{64}$/.test(snapshot.fingerprint) ||
      !Number.isInteger(snapshot.collections) ||
      snapshot.collections < 0
    )
      throw new Error();
    return snapshot;
  } catch {
    throw new Error(
      "Backup snapshot manifest is missing or invalid; create a new verified backup."
    );
  }
}

export function pruneBackups(root, keep = 8) {
  if (!Number.isInteger(keep) || keep < 1 || keep > 30)
    throw new Error("Backup retention must be 1 through 30.");
  const directory = join(root, "backups");
  const candidates = readdirSync(directory)
    .filter((name) => filenamePattern.test(name))
    .sort()
    .reverse();
  for (const filename of candidates.slice(keep)) {
    for (const suffix of ["", ".sha256", ".json"])
      rmSync(join(directory, `${filename}${suffix}`), { force: true });
  }
  return candidates.slice(0, keep);
}
