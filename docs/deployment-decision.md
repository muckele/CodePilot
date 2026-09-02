# Private-pilot deployment decision packet

Status: **decision required; nothing provisioned or deployed**

Pricing checked: **2026-08-10**; USD estimates exclude tax, domain purchase,
support plans, unusual egress, and optional external AI.

## Required topology

Every option must preserve the repository's production contract:

- one public TLS ingress serving the web container;
- API reachable only from that ingress/private service network;
- managed Mongo replica set with backups; no product dependency on PostgreSQL;
- exact HTTPS `WEB_ORIGIN`, `PERSISTENCE_MODE=required`, invitation-only access,
  mock AI, external provider disabled, agents disabled;
- secret-manager injection, readiness-based rollout, resource caps, centralized
  logs/alerts, and a seed release job;
- no public source maps and no raw invite/reset token in logs.

## Options

| Option                                                               | Shape                                                                                                         | Rough monthly pilot cost | Tradeoff                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -----------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Fly.io + MongoDB Atlas Flex (recommended for a bounded pilot)** | Two same-region Machines: 512 MB nginx web and 1 GB private API; Atlas Flex in a nearby region                |        **about $18–$42** | Lowest expected cost and strong container/private-network fit. Atlas Flex has daily snapshots and retains eight, but no private endpoint or point-in-time restore. Accept a roughly 24-hour RPO only for the pilot and prove an isolated restore before inviting anyone.          |
| **B. Render + MongoDB Atlas Flex**                                   | Starter public web service, Starter private API service, pre-deploy seed job; Atlas Flex                      |        **about $22–$50** | Simple Git-driven operations, managed TLS, health checks, and private services. Two always-on services cost more than a tiny Fly shape; confirm current Starter prices at purchase because Render's pricing page is dynamic.                                                      |
| **C. Railway Hobby/Pro + MongoDB Atlas Flex**                        | Public web service plus private API service with explicit memory/CPU limits; one-off seed command; Atlas Flex |        **about $23–$55** | Fastest UI and usage-based operation, but idle memory is billed. Hobby is single-developer; use Pro if another operator needs workspace access. Set a hard spend limit and validate that the public service cannot route directly to the API except through the intended ingress. |

Cost basis: Fly currently lists roughly $3.32/month for a 512 MB shared-CPU
Machine and $5.92/month for 1 GB in a representative US region. Railway lists
$10/GB-month RAM, $20/vCPU-month CPU, $0.05/GB egress, and a $5 Hobby minimum
that counts toward usage. Atlas Flex is $8–$30/month, includes 5 GB and daily
snapshots, and is capped at $30. MongoDB describes dedicated M10+ as the option
for stronger production controls; it starts near $60/month before backup and
transfer charges. Recheck all calculators immediately before approval.

If private endpoints, point-in-time recovery, configurable backup policies, or
production-grade database diagnostics are mandatory, replace Atlas Flex in any
option with Atlas M10+ and budget **roughly $60–$90+ for Mongo alone**. This is
the safer database choice, but may be disproportionate for five invited users.

First-party pricing and capability references:

- [Fly.io resource pricing](https://fly.io/docs/about/pricing/)
- [Render pricing](https://render.com/pricing) and [instance types](https://render.com/docs/compute-plans)
- [Railway pricing](https://docs.railway.com/pricing/plans)
- [Atlas Flex costs](https://www.mongodb.com/docs/atlas/billing/atlas-flex-costs/)
- [Atlas Flex backups](https://www.mongodb.com/docs/atlas/backup/cloud-backup/flex-cluster-backup/)
- [Atlas Flex limitations](https://www.mongodb.com/docs/atlas/reference/flex-limitations/)
- [Atlas dedicated-versus-Flex guidance](https://www.mongodb.com/docs/atlas/billing/billing-breakdown-optimization/)

## Recommendation and approval needed

Choose **A with Atlas Flex** for the first five users if a documented daily-
snapshot RPO is acceptable; otherwise choose **A with Atlas M10+**. Keep the
Python service off for launch because mock AI is in-process and the critical
journey does not need another failure domain.

Approval must name:

1. hosting option and region;
2. Atlas Flex or M10+, accepted RPO/RTO, retention, and restore target;
3. domain/DNS owner and exact HTTPS origin;
4. monthly spend ceiling and billing owner;
5. secret/backup/incident owners and the first cohort start date.

After approval, provision the minimum shape, capture an isolated restore drill,
run `pnpm mvp:live-check` against the named HTTPS origin, attach redacted
evidence to the release, and only then issue invitations.
