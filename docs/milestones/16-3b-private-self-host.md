# M16.3B — Private self-host local checkpoint

This deployment-only slice starts from verified source baseline
`5e85e6463f30f2d5c069941e282335784718659c` on the isolated
`codex/selfhost-private-mvp` branch. CodeLift AI remains the product; CodePilot
remains the repository/project. No public exposure is part of the slice.

| Acceptance area      | Local evidence                                                                                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| topology             | exactly web/API/authenticated MongoDB 8.0.26; only loopback 8080 published; no Python, PostgreSQL or Docker socket                                                                     |
| resource bounds      | 0.25 CPU/128 MiB web, 1 CPU/512 MiB API, 1 CPU/1536 MiB Mongo, 0.5 GiB WiredTiger cache; bounded logs, tmpfs, read-only root filesystems, graceful stops                               |
| Mongo security       | member key, SCRAM/RBAC, private `rs0`, explicit durable volume; app `readWrite:codelift`, backup `read:codelift`, authenticated health                                                 |
| initialization       | empty/existing/restarted state, matching secrets/users, repeated init and unexpected topology rejection tested                                                                         |
| application boundary | production/invite-only/mock/required persistence; file-backed URI; index/topology startup, transactions/rollback, tenant export                                                        |
| proxy behavior       | actual Mac loopback plus isolated real-Nginx tests; exact Host/Origin, bounded HTTPS signal/443 mapping and fallback; versioned auth endpoint limiter                                  |
| operator state       | exact macOS application-state root, mode-0700 directories and mode-0600 secrets, individual mounts only                                                                                |
| backup/restore       | database-only consistent write-locked dump, gzip, recipient AES-256-GCM, SHA-256, eight-backup limit, no plaintext retained; isolated restore/cleanup and candidate fingerprint checks |
| persistence          | Mongo restart, API/web restart and Compose down/up without deleting candidate storage                                                                                                  |
| source verification  | focused RED/GREEN, 75 API unit tests, 56 affected container tests, self-host tests, lint/types/format and unchanged controlling artifacts                                              |

Local operational acceptance is complete. The containing clean commit must
still receive the authoritative aggregate and exact-SHA CI before the controller
can return the final checkpoint verdict. No numeric result from the previous
source revision is applied automatically to this change.

The successful development restore took 10,677 ms for a 308,521-byte encrypted
backup. Exact measurements, command outputs, final SHA, disk start/minimum/end,
and source state belong to the ignored implementation/evidence report. These
measurements do not establish a production RPO or RTO.

Keyfile authentication, a single local replica member, same-device ciphertext,
and an on-device decryption key are explicit limitations. HTTPS/Funnel, actual
production origin/proxy count, secure-cookie browser testing, off-device backup,
and reboot/sleep/power behavior remain deferred. Docker Desktop restart would
disrupt unrelated BigCapital work and was not attempted. This milestone does
not claim `FULL_PRIVATE_SELF_HOSTED_MVP_PASS`.

Operations and failure recovery: [private self-host runbook](../runbooks/self-host.md).
