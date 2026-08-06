# Known limitations

- The deterministic 64-dimensional embedding and lexical reranking path is a
  zero-cost reliability baseline, not a claim of state-of-the-art semantic
  search. Provider/model comparisons require a fixed dataset and explicit opt-in.
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
- The task timer persists state when paused/resumed; browser suspension can make
  wall-clock elapsed time differ from focused time, so actual minutes remain an
  explicit learner-authored value.
