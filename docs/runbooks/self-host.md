# Private local self-host operations

This M16.3B checkpoint runs CodeLift AI (repository/project: CodePilot) on the
approved Mac. It creates no public exposure and is not a live HTTPS pilot.
The existing development and managed-production Compose definitions retain
their separate purposes.

## Local topology and state

`infra/compose.selfhost.yaml` runs exactly web, API, and MongoDB in steady state.
Only web publishes `127.0.0.1:8080:8080`. API 4000 and Mongo 27017 have no host
bindings. Mongo and API use an internal backend network; web also has a separate
ingress network. No Python, PostgreSQL, Docker socket, home-directory mount,
external AI, or agent service is present.

| Service | CPU ceiling | Memory ceiling | Persistent state               |
| ------- | ----------- | -------------- | ------------------------------ |
| web     | 0.25        | 128 MiB        | none                           |
| API     | 1           | 512 MiB        | none                           |
| MongoDB | 1           | 1536 MiB       | `codelift_selfhost_mongo_data` |

Mongo uses the pinned 8.0.26 image, a single `rs0` primary, a 0.5 GiB WiredTiger
cache, 128 MiB oplog, authentication, SCRAM/RBAC, and a random member keyfile.
The administrative account initializes the replica and users. The application
has only `readWrite` on `codelift`; the backup account has only `read` on that
database. Repeated initialization verifies topology, privileges, and matching
secrets and refuses unexpected existing state. It never rotates credentials.

The member key is mounted read-only and copied into a narrowly permissioned
tmpfs file before the official Mongo entrypoint drops privileges. Keyfile
authentication is an acceptable private single-member boundary; it does not
provide X.509 identity management, database transport TLS, high availability,
or protection against a compromised host/Docker administrator.

On an empty volume, a bounded localhost-only bootstrap creates the root user
through a database-client script that reads the mounted password internally.
The official entrypoint is never given a root password or its `_FILE` input:
its interpolation helper can put that value in a short-lived subprocess's
arguments. Existing volumes skip root creation and preserve their credentials.

The exact operator root is:

```text
/Users/Matt/Library/Application Support/CodeLift AI Self-Host
  secrets/   individual Mongo secrets, backup key, and optional email files
  backups/   encrypted archives, SHA-256 sidecars, content-free metadata
  ops/       public backup recipient, explicit Compose settings, Buildx state
  evidence/  redacted checks and disk/backup/restore measurements
```

Directories are mode 0700 and secret files are mode 0600. Never copy the root
into the repository or a cloud-synced user directory. Application helpers mount
only the particular files they need. The API, seed, and dump helper run with
the operator UID/GID so Docker Desktop can read those exact private mounts.
Their filesystems are read-only and they have no Linux capabilities.

## Transactional email state

Initialization writes only nonsecret disabled settings:

```text
EMAIL_PROVIDER=disabled
EMAIL_FROM=disabled@localhost
EMAIL_REQUEST_TIMEOUT_MS=5000
RESEND_API_KEY_HOST_FILE=/dev/null
EMAIL_LOGIN_CODE_PEPPER_HOST_FILE=/dev/null
```

It creates no Resend key or login-code pepper. In disabled mode, self-service
email endpoints report that operator recovery is required; password login,
existing sessions, learner routes, operator resets, `/health`, and `/ready`
remain available. Do not add a live Resend probe to either readiness endpoint.

Enabling email is a separate, explicitly authorized operator action. First
create or obtain the Resend key through the provider’s protected interface and
store it in a mode-0600, operator-owned, non-symlink regular file outside both
this repository and the self-host state root. Never paste the value into chat,
put it in a command argument, save it in shell history, or copy it into
`compose.env`. Then configure only by passing the source file path:

```bash
node infra/selfhost/cli.mjs email-configure \
  --from sender@verified.example \
  --key-file '/absolute/protected/path/resend-api-key' \
  --timeout-ms 5000
node infra/selfhost/cli.mjs up
node infra/selfhost/cli.mjs check
```

Add `--reply-to reply@verified.example` only when that mailbox is approved.
`email-configure` validates and atomically copies the key into protected
operator state and creates a separate random 32-byte login-code pepper. It
never accepts a pepper from the provider key or command line. Compose mounts
the exact two resulting files into the API only. Seed, web, Mongo, backup, and
restore services receive neither email secret.

Before enabling delivery for learners, verify provider account ownership,
sender/domain and DNS state, restart/readiness, sanitized alert routing, and one
separately authorized synthetic live delivery. No such provider mutation or
live send is part of repository source verification.

To disable delivery, remove the runtime capability through the state helper and
recreate API/web with the disabled configuration:

```bash
node infra/selfhost/cli.mjs email-disable
node infra/selfhost/cli.mjs up
node infra/selfhost/cli.mjs check
```

Do not delete or edit protected files by hand. Key rotation keeps one rollback
copy until an authorized synthetic delivery proves the replacement:

```bash
node infra/selfhost/cli.mjs email-rotate-key \
  --key-file '/absolute/protected/path/replacement-resend-api-key'
node infra/selfhost/cli.mjs email-finalize-key-rotation
```

If validation fails before finalization, restore the prior key with:

```bash
node infra/selfhost/cli.mjs email-rollback-key
```

Pepper loss or suspected exposure invalidates every active sign-in code. The
only supported rotation first creates a fresh encrypted backup, stops the API,
atomically replaces the pepper, runs the internal database invalidation, and
restarts API/web:

```bash
node infra/selfhost/cli.mjs email-rotate-pepper --invalidate-active-codes
```

Never reuse the provider key as the pepper. Password resets use independent
random bearer tokens and remain covered by their own revocation rules.

## Initialize, build, and start

Use repository-pinned Node 24.14.0 and pnpm 11.9.0. OpenSSL must already be
available with CMS AES-256-GCM support; this workflow installs no cryptographic
software. Run from the repository root:

```bash
node infra/selfhost/cli.mjs init
node infra/selfhost/cli.mjs build
node infra/selfhost/cli.mjs up
node infra/selfhost/cli.mjs seed
node infra/selfhost/cli.mjs fixture
node infra/selfhost/cli.mjs check
```

`init` generates 48-byte random passwords, a 756-byte random member key, and
an RSA-3072 public-certificate recipient without displaying secret material.
It fails on partial/corrupt state; preserve and repair the original secrets
instead of deleting the directory or regenerating credentials. The build uses
its own operator-owned Buildx configuration to avoid modifying shared Docker
configuration. Build and restore entry points record APFS available bytes and
refuse to begin below 35 GiB. All operation checks stop at 31 GiB, providing a
margin above the 30 GiB hard floor. Do not autonomously delete personal data or
unrelated Docker resources to gain headroom.

`up` runs authenticated initialization before starting API/web and waits for
readiness. `seed` performs the idempotent seed twice. `fixture` creates two
synthetic `.invalid` tenants, reflections/progress, and transaction probes;
run it only for this local verification checkpoint. `check` tests real account
export and tenant isolation, transactions/rollback, health, RBAC, ports,
resource controls, and secret absence from source plus bounded inspect/log
output. It prints only a redacted report. Secure production cookies remain
enabled; this HTTP loopback transport is not a production login browser test.

The generated `ops/compose.env` selects `WEB_ORIGIN=https://codelift.localhost`
and `TRUST_PROXY_HOPS=1` solely for this checkpoint. The origin is an explicit
HTTPS placeholder and no TLS listener is provisioned. Production stays
`PERSISTENCE_MODE=required`, invitation-only, mock, with external AI and agents
disabled. `MONGO_URI_FILE` loads the authenticated private service URI; specifying
both it and `MONGO_URI` fails closed. Never put a credential-bearing URI in
shell arguments or Compose environment values.

## Proxy boundary

The default web image trusts no incoming scheme header. A deployment may mount
an exact-address allowlist at `/etc/nginx/codelift-trusted-ingress.conf` after
verifying its ingress boundary. The private Mac profile permits only Docker
Desktop's observed ingress-network gateway `172.26.0.1/32`, behind the fixed
loopback binding. An exact lowercase `X-Forwarded-Proto: https` from that
address maps to HTTPS and external port 443. Missing, malformed, multi-value,
or untrusted signals fall back to Nginx's actual scheme/listening port. An
incoming `X-Forwarded-Port` is not independently trusted. Exact Host (including
port) and Origin are preserved; forwarded Host is derived from Host.

Edge-limited authentication/access endpoints (`login`, `register`,
`reset-password`, `csrf`)
share a 6-request/minute Nginx zone with a burst of 20 and status 429. Existing
API limiters continue to apply. Static assets, page navigation, and curriculum
API routes have an empty limiter key and do not consume this zone. The zone
uses the socket address, so a caller cannot evade it with a forged client chain.
Until real ingress is verified, all local callers intentionally share its
budget; no production client-IP claim is made.

Do not install Tailscale or enable Funnel for this checkpoint. The later HTTPS
gate must measure actual Host, Origin, scheme/port and client chain, set the
real `WEB_ORIGIN` and proven proxy-hop count, and run the secure browser journey.
Do not assume that the future proxy count is two or broaden the trust allowlist
without a real request test.

The ingress subnet/gateway is fixed in this private Compose definition so a
down/up cycle cannot silently change the trusted peer. A conflicting local
Docker subnet must fail deployment and be resolved deliberately with both
configuration and a new loopback probe; do not broaden the allowlist.

## Encrypted backup and isolated restore

```bash
node infra/selfhost/cli.mjs backup
node infra/selfhost/cli.mjs restore '<filename from the backup report>'
```

Backup takes an exclusive operator lock, verifies the primary, and holds
Mongo's `fsync` write lock for a bounded database-only `mongodump` (maximum
120 seconds). Reads continue; writes briefly wait. The dump authenticates with
the read-only account via a mounted configuration file, selects `rs0` and the
primary, and streams gzip output directly into OpenSSL CMS AES-256-GCM recipient
encryption. Only ciphertext, an exact SHA-256 sidecar, and date/revision/size plus
a content-free snapshot-fingerprint manifest are retained. The fingerprint is
read under the same write lock, without application/index initialization.
The decryption key is never supplied to the dump or
encryption subprocess, and is stored separately from the ciphertext.

Full-instance `mongodump --oplog` includes database users and role definitions.
This workflow deliberately dumps only `codelift` while writes are locked, so
authentication credentials are excluded and no oplog replay is needed. Restore
recreates authentication from operator secrets, then restores application
collections. This consistency tradeoff is suitable for a small private instance
that accepts the brief write pause. See MongoDB's
[mongodump reference](https://www.mongodb.com/docs/database-tools/mongodump/)
and [OpenSSL CMS reference](https://docs.openssl.org/master/man1/openssl-cms/).

The newest eight backups are retained; expiry removes only matching CodeLift
ciphertext and its two sidecars. No schedule or off-device upload is configured.
SHA-256 detects storage corruption; authenticated encryption checks the content
before restore. It does not protect against deletion by a compromised operator.
Loss of this Mac or of the decryption private key can make local backups
unrecoverable. An approved off-device destination and independent key recovery
are required before a full private self-host release.

Restore verifies the hash, starts an isolated authenticated Mongo replica with
a distinct named volume and internal network, and publishes no host port. It
decrypts only into container tmpfs, restores, verifies indexes before application
startup can create them, checks both tenants through the actual account export
service, and tests transactions. Restored data must match the manifest captured
at backup time, even if the candidate has since changed; a separate candidate
before/after comparison proves isolation. Pre-fix archives without a snapshot
manifest are retained unchanged but fail closed in this verifier; create a new
verified backup instead of inferring a historical manifest from current data.
Restore uses the same bounded socket-wait initializer as normal deployment.
The isolated drill starts with TTL deletion disabled so records that have
expired since backup cannot disappear before historical fidelity is checked.
TTL index definitions are still restored and inspected. This setting never
changes the candidate Mongo instance, where normal TTL deletion remains active.

On success it removes only the restore container/volume/network and retains no
plaintext archive. Teardown steps are independent: failure removing staging
does not skip stopping the container or the other cleanup attempts. Evidence
is written only after actual resource state is inspected; any cleanup error
fails the operation and records exact retained resource names and whether
plaintext removal is verified. A verification-failed drill retains its stopped
container/volume/network for diagnosis. Consult the actual evidence before
cleanup or retry; never infer that an attempted removal succeeded. Restore
never targets the candidate database.

If a backup operator is terminated abruptly, inspect the candidate's write-lock
state before resuming. `node infra/selfhost/cli.mjs unlock` is the explicit
recovery command for a lock left by this backup process. Remove the empty
`ops/backup.lock` directory only after establishing that no backup is running
and unlocking. Never run overlapping backups or maintenance writes.

## Persistence, verification, and deferred gates

```bash
node infra/selfhost/cli.mjs persistence
node --test --test-concurrency=1 infra/selfhost/*.test.mjs
```

The runtime tests require initialized operator state and the built/running
self-host images. Persistence restarts Mongo, restarts API/web, and performs
Compose down/up while comparing the same persisted synthetic data. It does not
delete the candidate volume. Never use `docker compose down -v` here. Docker
Desktop restart remains deferred while unrelated BigCapital containers run.

Restore tests put ciphertext, retention and evidence in a new private temporary
artifact root per invocation; they do not run retention against operator
backups. Cleanup derives names from that invocation's unique ID and checks
matching Docker ownership labels, never shared retained-drill evidence.
The safety regression uses a synthetic operator root with eight pre-existing
encrypted artifacts and stale diagnostic resources. The TTL regression waits
through a full interval and therefore takes over a minute. The entire self-host
suite is intentionally serial: the integration tests share an exclusive
operator lock and named local stack, so parallel invocations are invalid rather
than evidence of product failure. Email coverage validates disabled defaults,
strict files, rotation/rollback, pepper invalidation, production Compose secret
mounts, restored reset/code indexes, and runtime provider-outage isolation. It
uses synthetic providers only and never sends live email.

After a source commit, run the authoritative release-quality aggregate once
for that exact clean revision and obtain exact-SHA CI. Prior source evidence
does not automatically cover these changes. Public HTTPS, live secure-cookie
browser testing, real proxy-hop/client-IP validation, off-device backup,
reboot/sleep/power behavior, and the full private self-host release verdict are
later gates. No router, firewall, power, public binding, domain, or Tailscale
change is part of this checkpoint.
