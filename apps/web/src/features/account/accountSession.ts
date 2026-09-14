import type { AccountUser } from "@codelift/contracts";
import { createContext, useContext } from "react";

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

export const AccountSessionContext = createContext<AccountSessionValue | null>(null);

export function useAccountSession(): AccountSessionValue {
  const value = useContext(AccountSessionContext);
  if (value === null) {
    throw new Error("useAccountSession must be used inside AccountSessionProvider.");
  }
  return value;
}

export function useOptionalAccountSession(): AccountSessionValue | null {
  return useContext(AccountSessionContext);
}
