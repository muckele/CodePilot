# ADR 0002 — Use native routing for the M1 preview

- Status: Superseded by [ADR 0007](0007-react-router-client-routing.md)
- Date: 2026-07-24
- Scope: Milestone 1 web client

## Context

Milestone 1 has three browser outcomes:

- `/` maps to the trusted Day 1 preview and replaces the address with
  `/curriculum/1`;
- `/curriculum/:dayNumber` renders a validated mission or a bounded invalid-day
  state;
- every other path renders the preview's not-found state.

The first implementation used React Router. A live registry audit found a
high-severity advisory in the installed v7 line. The latest v6 line removed the
high finding but retained moderate redirect and SSR advisories in features this
client did not use. The M1 client is CSR-only, has no loader/action/SSR/RSC
boundary, and never builds internal navigation targets from user input.

## Decision

Use the browser platform for this small route surface:

- read `window.location.pathname` once at application startup;
- parse only the explicit curriculum path shape;
- pass the captured day segment to the validated curriculum page;
- use `history.replaceState` for the root-to-Day-1 canonical address;
- use hard-coded native anchors for internal links.

Do not retain a general routing dependency in M1.

## Consequences

Benefits:

- no known dependency vulnerabilities at M1 sign-off;
- less browser code and a smaller production bundle;
- no user-controlled redirect target;
- route behavior is simple enough to cover exhaustively with focused tests.

Tradeoffs:

- internal links perform normal document navigation;
- the client does not react to arbitrary `pushState` or `popstate` changes
  without a document navigation;
- a future authenticated multi-view product will need a deliberate routing
  decision.

When a later milestone truly needs nested layouts, data routers, guarded
navigation, or client-side transition state, reassess current router options
and their advisory state rather than restoring the removed dependency by
default.
