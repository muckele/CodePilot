# Private-pilot hypothesis and measurement plan

## Private-pilot hypothesis

A returning developer can register through an invitation, complete onboarding,
begin a realistic 30-minute mission, save valid evidence/reflection, and return
without shame or curriculum auto-skip.

For an invitation-only cohort of 5–20 returning developers, the working target
is that at least half of registered learners produce one valid mission
completion within seven days, without requiring a paid model, exposing one
learner's data to another, or reporting completion before evidence and
reflection are persisted.

This is a product-learning hypothesis, not a promise of employment, mastery,
income, credential value, or a particular educational outcome. The pilot is
mock-first, educational, and deliberately small.

## Success indicators

Evaluate a fixed cohort window beginning when invitations are issued. Do not
change thresholds after seeing the cohort's results.

| Indicator                                              | Continue threshold                     | Launch/expand threshold                | Stop or investigate                                                 |
| ------------------------------------------------------ | -------------------------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| invitation → registration                              | at least 60%                           | at least 75%                           | under 40%                                                           |
| registration → onboarding                              | at least 70%                           | at least 85%                           | under 50%                                                           |
| onboarding → first mission started                     | at least 60%                           | at least 75%                           | under 40%                                                           |
| first mission started → valid Core/Recovery completion | at least 50%                           | at least 65%                           | under 30%                                                           |
| registered → first valid completion within 7 days      | at least 40%                           | at least 50%                           | under 25%                                                           |
| next-day return                                        | at least 30%                           | at least 40%                           | under 20%                                                           |
| seven-day return                                       | at least 20%                           | at least 30%                           | under 10%                                                           |
| persisted save reliability                             | no confirmed lost save                 | no confirmed lost save                 | any reproducible lost or false-success save                         |
| AI/provider reliability                                | error + fallback rate under 10%        | under 5%                               | over 20% for 15 minutes with at least 10 interactions               |
| export and deletion                                    | every tested request succeeds honestly | every tested request succeeds honestly | any false success, wrong-tenant record, or surviving active session |

Core and Recovery completions are reported separately. Recovery is a valid
return behavior, not silently relabeled Core. Time-to-first-completion is a
cohort average and is not used to rank or profile individuals.

## Five research questions

1. Was the first useful action obvious?
2. Did the mission fit the promised time?
3. What nearly stopped you?
4. Did Core versus Recovery feel honest and non-shaming?
5. What would make you return tomorrow?

Record interview notes outside the product in an access-controlled research
document. Do not paste private reflections, raw note text, credentials, invite
links, reset links, or account exports into analytics or issue trackers.

## Privacy-preserving measurement

The operator command reads MongoDB directly and emits only cohort aggregates:

```bash
MONGO_URI='<managed replica-set URI>' \
  pnpm mvp:metrics --since 2026-08-10T00:00:00Z

MONGO_URI='<managed replica-set URI>' \
  pnpm mvp:metrics --since 2026-08-10T00:00:00Z --json
```

`--minimum-cohort` defaults to 5 and cannot be set below 5. Below that
threshold, the report suppresses all metrics.
Output contains no email, display name, account ID, note, evidence, reflection,
token, password material, or per-user row. Successful export/deletion counts
use expiring daily aggregates so those lifecycle events survive account
deletion without retaining identity.

Both boundaries are UTC midnights and every count uses the half-open interval
`[since, until)`. When `--until` is omitted it defaults to the current UTC
midnight, so the report includes only fully closed UTC days. Registration uses
the account creation timestamp; onboarding uses the immutable first successful
onboarding timestamp; and mission start/completion use their own persisted
timestamps. A first completion counts only when it is at or after registration
and strictly before both `registration + 7 days` and `until`.

D1 and D7 return mean successful authenticated activity on the next and
seventh UTC calendar dates after the registration date, respectively—not 24-
or 168-hour elapsed-time thresholds. The source record contains only owner ID,
UTC date, and first/last timestamps for that date; it contains no route, query,
content, or other private learner value. The unique owner/date upsert is fenced
against account deletion, is included in the owner's export, and is deleted
with the account. The report emits only thresholded cohort totals.

Persisted-save totals count progress/reflection records first created in the
window. AI reliability and estimated cost use traces created in the window.
Lifecycle aggregates include daily buckets whose UTC date is at or after
`since` and strictly before `until`. The fixed-window report returns
`agentKillSwitchEnabled: null`: the current mutable flag has no historical
event log and therefore cannot truthfully be reconstructed for an earlier
closed window. Verify its current state through the live release controls.

## Launch, continue, and stop decisions

### Launch hypothesis

Invite the first cohort only after the source-bound release gate passes and the
chosen environment has verified TLS, exact origin, managed Mongo connectivity,
secret injection, alerts, a successful isolated backup restore, and a passing
guarded live check. Start with five learners. Add no external AI provider.

### Continue hypothesis

Continue the same cohort when there is no critical security/data-integrity
event, no reproducible lost save, the qualitative questions reveal no harmful
misunderstanding, and at least three of the first five funnel/return indicators
meet the continue threshold. Fix usability issues before adding invitations.

### Stop criteria

Immediately close registration and stop new invitations for any auth bypass,
cross-user disclosure, secret or access-token exposure, confirmed data loss,
false deletion/export success, unsafe tool action, inability to restore a
backup, or legal/privacy representation that is materially inaccurate. Pause
cohort expansion if the quantitative stop thresholds hold after data-quality
checks or if two or more learners cannot complete the critical journey without
operator intervention. A high quality score never waives these criteria.
