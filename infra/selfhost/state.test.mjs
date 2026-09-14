import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("operator initialization creates private, stable secrets and a working independent recipient", async () => {
  const module = await import("./state.mjs").catch(() => ({}));
  assert.equal(typeof module.initializeState, "function", "operator initializer is available");
  const parent = mkdtempSync(join(tmpdir(), "codelift-state-test-"));
  const root = join(parent, "state");
  try {
    module.initializeState(root);
    for (const directory of [
      root,
      ...["secrets", "backups", "ops", "evidence"].map((name) => join(root, name))
    ]) {
      assert.equal(statSync(directory).mode & 0o777, 0o700);
    }
    const secrets = readdirSync(join(root, "secrets"));
    const before = secrets.map((name) => {
      const path = join(root, "secrets", name);
      assert.equal(statSync(path).mode & 0o777, 0o600);
      return createHash("sha256").update(readFileSync(path)).digest("hex");
    });
    module.initializeState(root);
    assert.deepEqual(
      secrets.map((name) =>
        createHash("sha256")
          .update(readFileSync(join(root, "secrets", name)))
          .digest("hex")
      ),
      before
    );
    assert.match(
      readFileSync(join(root, "secrets", "mongo-keyfile"), "utf8"),
      /^[A-Za-z0-9+/]{1000,1024}\n?$/
    );
    const uri = new URL(readFileSync(join(root, "secrets", "mongo-uri"), "utf8").trim());
    assert.equal(uri.hostname, "mongodb");
    assert.equal(uri.searchParams.get("replicaSet"), "rs0");
    assert.equal(uri.searchParams.get("authSource"), "codelift");
    assert.ok(uri.password.length >= 43);
    assert.deepEqual(readdirSync(join(root, "backups")), []);
    const encrypted = spawnSync(
      "openssl",
      [
        "cms",
        "-encrypt",
        "-binary",
        "-aes-256-gcm",
        "-outform",
        "DER",
        join(root, "ops", "backup-recipient.pem")
      ],
      { input: "synthetic backup roundtrip" }
    );
    assert.equal(encrypted.status, 0);
    const decrypted = spawnSync(
      "openssl",
      [
        "cms",
        "-decrypt",
        "-binary",
        "-inform",
        "DER",
        "-inkey",
        join(root, "secrets", "backup-private-key.pem"),
        "-recip",
        join(root, "ops", "backup-recipient.pem")
      ],
      { input: encrypted.stdout }
    );
    assert.equal(decrypted.status, 0);
    assert.equal(decrypted.stdout.toString(), "synthetic backup roundtrip");
    writeFileSync(join(root, "secrets", "mongo-app-password"), "corrupt", { mode: 0o600 });
    assert.throws(() => module.initializeState(root), /invalid|incomplete/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("email state is disabled by default and configuration is private, idempotent, and rotatable", async () => {
  const { initializeState } = await import("./state.mjs");
  const email = await import("./email-state.mjs").catch(() => ({}));
  assert.equal(
    typeof email.configureEmailState,
    "function",
    "email state operations are available"
  );
  const parent = mkdtempSync(join(tmpdir(), "codelift-email-state-test-"));
  const root = join(parent, "state");
  const sourceKey = join(parent, "operator-resend-key");
  try {
    initializeState(root);
    assert.deepEqual(email.validateEmailState(root), {
      provider: "disabled",
      from: null,
      replyTo: null,
      requestTimeoutMs: 5000,
      rotationPending: false
    });
    assert.equal(existsSync(join(root, "secrets", "resend-api-key")), false);
    assert.equal(existsSync(join(root, "secrets", "email-login-code-pepper")), false);

    const coreSecrets = readdirSync(join(root, "secrets"));
    const before = new Map(
      coreSecrets.map((name) => [
        name,
        createHash("sha256")
          .update(readFileSync(join(root, "secrets", name)))
          .digest("hex")
      ])
    );
    writeFileSync(sourceKey, `re_${"a".repeat(32)}\n`, { mode: 0o600 });
    const configured = email.configureEmailState({
      root,
      from: "security@pilot.example.test",
      replyTo: "support@pilot.example.test",
      keyFile: sourceKey
    });
    assert.equal(configured.changed, true);
    assert.equal(
      email.configureEmailState({
        root,
        from: "security@pilot.example.test",
        replyTo: "support@pilot.example.test",
        keyFile: sourceKey
      }).changed,
      false
    );
    for (const name of coreSecrets) {
      assert.equal(
        createHash("sha256")
          .update(readFileSync(join(root, "secrets", name)))
          .digest("hex"),
        before.get(name),
        `${name} remains unchanged`
      );
    }
    for (const name of ["resend-api-key", "email-login-code-pepper"]) {
      assert.equal(statSync(join(root, "secrets", name)).mode & 0o777, 0o600);
    }
    assert.match(
      readFileSync(join(root, "secrets", "email-login-code-pepper"), "utf8"),
      /^[A-Za-z0-9_-]{43}$/u
    );
    const composeEnvironment = readFileSync(join(root, "ops", "compose.env"), "utf8");
    assert.match(composeEnvironment, /^EMAIL_PROVIDER=resend$/mu);
    assert.match(composeEnvironment, /^EMAIL_FROM=security@pilot\.example\.test$/mu);
    assert.match(composeEnvironment, /^EMAIL_REPLY_TO=support@pilot\.example\.test$/mu);
    assert.match(composeEnvironment, /^EMAIL_REQUEST_TIMEOUT_MS=5000$/mu);
    assert.match(composeEnvironment, /^RESEND_API_KEY_HOST_FILE=/mu);
    assert.match(composeEnvironment, /^EMAIL_LOGIN_CODE_PEPPER_HOST_FILE=/mu);
    assert.ok(!composeEnvironment.includes(readFileSync(sourceKey, "utf8")));
    assert.ok(!composeEnvironment.includes(`re_${"a".repeat(32)}`));
    assert.equal(
      readFileSync(join(root, "secrets", "resend-api-key"), "utf8"),
      `re_${"a".repeat(32)}`
    );
    assert.ok(
      !composeEnvironment.includes(
        readFileSync(join(root, "secrets", "email-login-code-pepper"), "utf8")
      )
    );

    writeFileSync(sourceKey, `re_${"b".repeat(32)}`, { mode: 0o600 });
    assert.equal(email.rotateEmailKey({ root, keyFile: sourceKey }).rotationPending, true);
    assert.equal(
      readFileSync(join(root, "secrets", "resend-api-key"), "utf8"),
      `re_${"b".repeat(32)}`
    );
    assert.equal(
      readFileSync(join(root, "secrets", "resend-api-key.rollback"), "utf8"),
      `re_${"a".repeat(32)}`
    );
    email.finalizeEmailKeyRotation(root);
    assert.equal(existsSync(join(root, "secrets", "resend-api-key.rollback")), false);

    writeFileSync(sourceKey, `re_${"c".repeat(32)}`, { mode: 0o600 });
    email.rotateEmailKey({ root, keyFile: sourceKey });
    email.rollbackEmailKey(root);
    assert.equal(
      readFileSync(join(root, "secrets", "resend-api-key"), "utf8"),
      `re_${"b".repeat(32)}`
    );
    assert.equal(existsSync(join(root, "secrets", "resend-api-key.rollback")), false);

    assert.throws(() => email.rotateEmailPepper({ root }), /invalidate-active-codes/u);
    const pepperBefore = readFileSync(join(root, "secrets", "email-login-code-pepper"));
    email.rotateEmailPepper({ root, invalidateActiveCodes: true });
    assert.notDeepEqual(
      readFileSync(join(root, "secrets", "email-login-code-pepper")),
      pepperBefore
    );

    email.disableEmailState(root);
    assert.equal(email.validateEmailState(root).provider, "disabled");
    assert.equal(existsSync(join(root, "secrets", "resend-api-key")), false);
    assert.equal(existsSync(join(root, "secrets", "email-login-code-pepper")), false);
    assert.equal(email.disableEmailState(root).changed, false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("email state rejects unsafe key sources, direct secrets, and inconsistent rotation state", async () => {
  const { initializeState } = await import("./state.mjs");
  const email = await import("./email-state.mjs").catch(() => ({}));
  assert.equal(typeof email.validateResendKeySource, "function", "key validation is available");
  const parent = mkdtempSync(join(tmpdir(), "codelift-email-state-invalid-test-"));
  const root = join(parent, "state");
  const key = join(parent, "key");
  try {
    initializeState(root);
    writeFileSync(key, `re_${"a".repeat(32)}`, { mode: 0o600 });
    assert.throws(() => email.validateResendKeySource("relative-key"), /absolute/u);
    assert.throws(
      () => email.validateResendKeySource(join(process.cwd(), "synthetic-committed-key")),
      /outside the repository/u
    );
    chmodSync(key, 0o644);
    assert.throws(() => email.validateResendKeySource(key), /mode 0600/u);
    chmodSync(key, 0o600);
    assert.throws(() => email.validateResendKeySource(key, process.getuid() + 1), /owner/u);
    writeFileSync(key, `re_${"a".repeat(16)}\nsecond-line`, { mode: 0o600 });
    assert.throws(() => email.validateResendKeySource(key), /single-line/u);
    writeFileSync(key, `re_${"a".repeat(600)}`, { mode: 0o600 });
    assert.throws(() => email.validateResendKeySource(key), /bounded/u);
    rmSync(key);
    symlinkSync(join(root, "secrets", "mongo-uri"), key);
    assert.throws(() => email.validateResendKeySource(key), /symlink/u);

    const environmentPath = join(root, "ops", "compose.env");
    writeFileSync(
      environmentPath,
      `${readFileSync(environmentPath, "utf8")}RESEND_API_KEY=forbidden\n`,
      { mode: 0o600 }
    );
    assert.throws(() => email.validateEmailState(root), /direct secret/u);
    writeFileSync(
      environmentPath,
      readFileSync(environmentPath, "utf8").replace(
        "RESEND_API_KEY=forbidden\n",
        "EMAIL_LOGIN_CODE_PEPPER=forbidden\n"
      ),
      { mode: 0o600 }
    );
    assert.throws(() => email.validateEmailState(root), /direct secret/u);
    writeFileSync(
      environmentPath,
      readFileSync(environmentPath, "utf8")
        .replace("EMAIL_LOGIN_CODE_PEPPER=forbidden\n", "")
        .replace("EMAIL_PROVIDER=disabled", "EMAIL_PROVIDER=resend"),
      { mode: 0o600 }
    );
    assert.throws(() => email.validateEmailState(root), /EMAIL_FROM|exact operator secret files/u);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
