# ADR 0007 — Use React Router for client routing and protected-route layouts

- Status: Accepted
- Date: 2026-08-06
- Scope: Web client
- Supersedes: [ADR 0002](0002-native-preview-routing.md)

## Context

ADR 0002 deliberately kept the Milestone 1 public preview router-free while it
had only a root redirect, one curriculum parameter, and a not-found page. The
current product now has authentication, onboarding, account deletion, and many
protected workspace views. Its URL is application state: internal transitions,
direct loads, and browser back/forward must all select the same route without a
custom history event layer.

The controlling product specification also names React Router as part of the
web stack. The installed client is CSR-only; it does not use React Router
loaders, actions, server rendering, React Server Components, or user-controlled
redirect construction.

## Decision

Use `react-router-dom` for the browser route boundary:

- `BrowserRouter` owns production history and `MemoryRouter` preserves the
  explicit `App({ pathname })` component-test entry point;
- declarative `Routes` and `Route` entries own public curriculum, account, and
  protected workspace paths, including the not-found boundary;
- a persistent account layout performs session bootstrap before rendering an
  `Outlet`, so protected content stays absent until authentication resolves and
  route changes do not restart bootstrap;
- `Navigate` and `useNavigate` perform guarded and post-mutation redirects;
- `Link` and `NavLink` perform internal application navigation and preserve
  browser back/forward behavior;
- the public `/curriculum/:requestedDay` route stays outside the account layout
  and therefore never requires session or CSRF bootstrap.

The login redirect remains closed by construction. `returnTo` is decoded by
`URLSearchParams` and accepted only when the resulting string is an exact member
of `ALLOWED_RETURN_PATHS`. External, protocol-relative, query-bearing,
fragment-bearing, and double-encoded values fall back to `/app/today`.

## Consequences

Benefits:

- URLs, internal links, programmatic transitions, and browser history share one
  routing source of truth;
- route guards retain the existing authenticated/onboarding behavior without a
  custom `pushState` event;
- active navigation state comes from `NavLink` rather than duplicated pathname
  comparisons;
- public and protected route boundaries remain explicit and independently
  testable.

Tradeoffs:

- the production bundle includes React Router and its dependency advisories
  remain part of the normal locked-install security audit;
- every deployment must retain the documented HTML fallback for direct client
  route loads;
- server loaders/actions and SSR/RSC routing remain intentionally out of scope.
