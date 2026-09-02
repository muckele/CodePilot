# Known limitations

- The deterministic 64-dimensional embedding and lexical reranking path is a
  zero-cost reliability baseline, not a claim of state-of-the-art semantic
  search. Provider/model comparisons require a fixed dataset and explicit opt-in.
- The private-pilot note corpus is intentionally bounded to 100 sources and
  2 MiB of UTF-8 source text per account. Account exports stop at 1,000 records
  per collection and an 8 MiB pre-serialization budget (with a final 10 MiB
  response cap); larger legacy accounts require a support-controlled isolated
  export rather than an in-process limit increase.
- `AI_PROVIDER=local` expects an Ollama-compatible endpoint; CodeLift does not
  download a model in the base install. The PEFT route is a decision lab and
  never trains by default.
- Client navigation uses React Router in CSR mode. Deployments must serve the
  application HTML for direct curriculum, account, and workspace route loads;
  server loaders, SSR, and RSC routing are intentionally not enabled.
- Resource reachability is point-in-time evidence. A site may later reorganize
  or block automated checks, so `unknown` is preserved separately from malformed
  or missing.
- The development admin console is deliberately disabled in production until a
  dedicated admin role and authorization policy exist.
- Weekly planner approval currently records an accepted proposal and its audit
  trace; it does not write proposed actions into curriculum tasks or an external
  calendar. The UI labels this `proposal_only`. Enabling the tested write-tool
  boundary requires a separately authorized persistence policy and product model.
- No hosted production environment is provisioned by this repository. Compose,
  container health checks, CI, deployment guidance, and local production builds
  are included; infrastructure credentials and domain/TLS ownership remain an
  operator decision.
- Operator-issued invitation and reset URLs are intentionally out-of-band. The
  product has no email delivery, verified-email flow, or self-service recovery;
  a learner must contact the invitation operator through the trusted channel
  used for pilot enrollment.
- Public signup is not release-ready. It additionally requires verified email,
  automated recovery/delivery, abuse and bot controls, public support staffing,
  revised legal/privacy review, capacity/cost controls, and a larger-scale
  observability and incident program. Production `open` registration is
  rejected until those controls are deliberately implemented.
- Atlas Flex is a possible bounded-pilot database, not a blanket production
  recommendation. It has daily snapshots but no private endpoint, configurable
  snapshot schedule, continuous backup, or point-in-time recovery. Choose a
  dedicated managed tier if the accepted RPO/RTO or network policy requires it.
- The repository emits structured privacy-minimized logs and documents alert
  thresholds but does not provision an observability vendor or on-call route.
  A live pilot must verify both.
- The task timer persists state when paused/resumed; browser suspension can make
  wall-clock elapsed time differ from focused time, so actual minutes remain an
  explicit learner-authored value.
