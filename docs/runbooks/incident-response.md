# Incident response

1. **Contain:** disable the affected feature or provider; preserve the mock/free
   learning path. For auth, tenant leakage, unsafe agent action, or secret
   exposure, stop release immediately.
2. **Identify:** use request IDs, trace IDs, hashed inputs, route names, and
   account-scoped record IDs. Do not expand logging to raw private content.
3. **Eradicate:** repair the trust-boundary root cause, revoke exposed secrets,
   and delete poisoned indexed sources if applicable.
4. **Recover:** run focused regression tests, full integration, local eval,
   security check, build, and a fresh browser journey.
5. **Review:** record timeline, impact, residual risk, and an ADR or threat-model
   update. Notify affected users honestly if their data crossed a boundary.

Never use the numeric quality score to waive an auth bypass, cross-user
disclosure, data loss, unsafe tool action, or fabricated success.
