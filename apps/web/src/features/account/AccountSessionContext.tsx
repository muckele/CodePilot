import type { AccountUser } from "@codelift/contracts";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { AccountApiError, fetchCsrf, fetchMe, logoutAccount } from "./api/accountApi";

export type AccountSessionState =
  | { status: "checking" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: AccountUser }
  | { status: "expired" }
  | { status: "unavailable"; message: string; requestId: string | null };

export interface AccountSessionValue {
  readonly status: "loading" | "anonymous" | "authenticated";
  readonly user: AccountUser | null;
  readonly csrfToken: string | null;
  readonly state: AccountSessionState;
  authenticate(user: AccountUser, csrfToken: string): void;
  updateUser(user: AccountUser): void;
  clearSession(): void;
  expireSession(): void;
  signOut(): Promise<void>;
  refresh(): void;
}

const AccountSessionContext = createContext<AccountSessionValue | null>(null);

export function AccountSessionProvider({
  children,
  enabled
}: PropsWithChildren<{ enabled: boolean }>) {
  const [state, setState] = useState<AccountSessionState>({ status: "checking" });
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [bootstrapKey, setBootstrapKey] = useState(0);

  const themePreference =
    state.status === "authenticated" ? (state.user.profile?.themePreference ?? "system") : "system";
  const motionPreference =
    state.status === "authenticated"
      ? (state.user.profile?.motionPreference ?? "system")
      : "system";

  useEffect(() => {
    const root = document.documentElement;
    if (themePreference === "system") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = themePreference;
    }
    if (motionPreference === "system" || motionPreference === "gentle") {
      delete root.dataset.motion;
    } else {
      root.dataset.motion = motionPreference;
    }
    return () => {
      delete root.dataset.theme;
      delete root.dataset.motion;
    };
  }, [motionPreference, themePreference]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState({ status: "checking" });
    fetchMe(controller.signal)
      .then((result) => {
        setState(
          result.authenticated
            ? { status: "authenticated", user: result.user }
            : { status: "anonymous" }
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof AccountApiError && error.isAuthenticationFailure) {
          setState({ status: "expired" });
          return;
        }
        setState({
          status: "unavailable",
          message:
            error instanceof AccountApiError
              ? error.message
              : "CodeLift could not verify the private workspace.",
          requestId: error instanceof AccountApiError ? error.requestId : null
        });
      });
    return () => controller.abort();
  }, [bootstrapKey, enabled]);

  useEffect(() => {
    if (
      !enabled ||
      state.status === "checking" ||
      state.status === "unavailable" ||
      state.status === "expired" ||
      csrfToken !== null
    ) {
      return;
    }
    const controller = new AbortController();
    fetchCsrf(controller.signal)
      .then((result) => setCsrfToken(result.csrfToken))
      .catch(() => {
        // Each protected form explains when browser protection is still pending.
      });
    return () => controller.abort();
  }, [csrfToken, enabled, state.status]);

  const authenticate = useCallback((user: AccountUser, token: string) => {
    setState({ status: "authenticated", user });
    setCsrfToken(token);
  }, []);

  const updateUser = useCallback((user: AccountUser) => {
    setState({ status: "authenticated", user });
  }, []);

  const clearSession = useCallback(() => {
    setCsrfToken(null);
    setState({ status: "anonymous" });
  }, []);

  const expireSession = useCallback(() => {
    setCsrfToken(null);
    setState({ status: "expired" });
  }, []);

  const signOut = useCallback(async () => {
    if (csrfToken === null) {
      throw new AccountApiError({
        kind: "request-validation",
        message: "Protection is still loading. The server session remains active."
      });
    }
    await logoutAccount(csrfToken);
    clearSession();
  }, [clearSession, csrfToken]);

  const refresh = useCallback(() => {
    setCsrfToken(null);
    setBootstrapKey((value) => value + 1);
  }, []);

  const status =
    state.status === "authenticated"
      ? "authenticated"
      : state.status === "anonymous"
        ? "anonymous"
        : "loading";
  const value = useMemo<AccountSessionValue>(
    () => ({
      status,
      user: state.status === "authenticated" ? state.user : null,
      csrfToken,
      state,
      authenticate,
      updateUser,
      clearSession,
      expireSession,
      signOut,
      refresh
    }),
    [
      authenticate,
      clearSession,
      csrfToken,
      expireSession,
      refresh,
      signOut,
      state,
      status,
      updateUser
    ]
  );

  return <AccountSessionContext.Provider value={value}>{children}</AccountSessionContext.Provider>;
}

export function useAccountSession(): AccountSessionValue {
  const value = useContext(AccountSessionContext);
  if (value === null) {
    throw new Error("useAccountSession must be used inside AccountSessionProvider.");
  }
  return value;
}
