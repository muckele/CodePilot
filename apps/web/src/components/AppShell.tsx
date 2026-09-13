import { type PropsWithChildren, useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";

import { useAccountSession } from "../features/account/AccountSessionContext";
import { AccountApiError } from "../features/account/api/accountApi";

type AppShellProps = PropsWithChildren<{
  modeLabel?: string;
  privateMode?: boolean;
  developmentMode?: boolean;
}>;

export function AppShell({
  children,
  modeLabel = "Free local preview",
  privateMode = false,
  developmentMode = import.meta.env.DEV
}: AppShellProps) {
  const navigate = useNavigate();
  const accountSession = useAccountSession();
  const [signOutPending, setSignOutPending] = useState(false);
  const [signOutFailure, setSignOutFailure] = useState<{
    message: string;
    requestId: string | null;
  } | null>(null);
  const signOutAlert = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (signOutFailure !== null) signOutAlert.current?.focus();
  }, [signOutFailure]);

  async function signOut() {
    if (signOutPending) return;
    setSignOutPending(true);
    setSignOutFailure(null);
    try {
      await accountSession.signOut();
      navigate("/login", { replace: true });
    } catch (error: unknown) {
      setSignOutFailure({
        message:
          error instanceof AccountApiError
            ? error.message
            : "CodeLift could not safely end the server session. Try signing out again.",
        requestId: error instanceof AccountApiError ? error.requestId : null
      });
    } finally {
      setSignOutPending(false);
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <div className="cosmic-backdrop" aria-hidden="true">
        <span className="backdrop-star backdrop-star--one" />
        <span className="backdrop-star backdrop-star--two" />
        <span className="backdrop-star backdrop-star--three" />
        <span className="backdrop-orbit" />
      </div>

      <header className="site-header">
        <Link
          className="brand"
          to={privateMode ? "/app/today" : "/curriculum/1"}
          aria-label={privateMode ? "CodeLift AI private workspace" : "CodeLift AI, Day 1 preview"}
        >
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-mark__sun" />
            <span className="brand-mark__peak" />
          </span>
          <span>
            <span className="brand-name">CodeLift AI</span>
            <span className="brand-tagline">Build evidence, one focused return at a time.</span>
          </span>
        </Link>
        {privateMode ? (
          <nav className="site-nav" aria-label="Private workspace">
            <NavLink to="/app/today" end>
              Today
            </NavLink>
            <NavLink to="/app/tasks" end>
              Tasks
            </NavLink>
            <NavLink to="/app/roadmap" end>
              Roadmap
            </NavLink>
            <NavLink to="/app/reviews" end>
              Reviews
            </NavLink>
            <NavLink to="/app/portfolio" end>
              Portfolio
            </NavLink>
            <details className="nav-menu">
              <summary>Workspace</summary>
              <div className="nav-menu__panel">
                {(
                  [
                    ["/app/skills", "Skills"],
                    ["/app/errors", "Error Museum"],
                    ["/app/search", "Private-note RAG"],
                    ["/app/coach", "AI Coach"],
                    ["/app/planner", "Planner"],
                    ["/app/evals", "Evals"],
                    ["/app/gallery", "Visual gallery"],
                    ["/app/account", "Settings"],
                    ...(developmentMode ? ([["/admin", "Dev admin"]] as const) : []),
                    ["/curriculum/1", "Public preview"]
                  ] as const
                ).map(([href, label]) => (
                  <NavLink to={href} key={href} end>
                    {label}
                  </NavLink>
                ))}
                {accountSession.status === "authenticated" ? (
                  <>
                    <button
                      className="nav-menu__sign-out"
                      type="button"
                      disabled={signOutPending || accountSession.csrfToken === null}
                      onClick={signOut}
                    >
                      {signOutPending ? "Signing out…" : "Sign out"}
                    </button>
                    {signOutFailure === null ? null : (
                      <div
                        ref={signOutAlert}
                        className="nav-menu__alert"
                        role="alert"
                        tabIndex={-1}
                      >
                        <span>{signOutFailure.message}</span>
                        {signOutFailure.requestId === null ? null : (
                          <small>Support reference: {signOutFailure.requestId}</small>
                        )}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </details>
          </nav>
        ) : (
          <span className="site-header__mode">{modeLabel}</span>
        )}
      </header>

      <main id="main-content" className="main-content" tabIndex={-1}>
        {children}
      </main>

      <footer className="site-footer">
        <p>One verified mission. Thirty focused minutes. No perfect streak required.</p>
        <nav className="footer-links" aria-label="Policies and support">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/support">Support</Link>
        </nav>
        <p>
          {privateMode
            ? "Private progress is stored through the protected Node and Mongo boundary."
            : "Preview data comes from the CodeLift curriculum through the Node API."}
        </p>
      </footer>
    </div>
  );
}
