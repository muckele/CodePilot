import { AUTHENTICATED_RETURN_PATHS, PRODUCT_PATHS } from "@codelift/config";

export function allowedReturnPathsForEnvironment(development: boolean): Set<string> {
  return new Set([
    ...AUTHENTICATED_RETURN_PATHS,
    ...(development ? ([PRODUCT_PATHS.admin] as const) : [])
  ]);
}

export const ALLOWED_RETURN_PATHS = allowedReturnPathsForEnvironment(import.meta.env.DEV);

export function allowedReturnTo(search = window.location.search): string {
  const candidate = new URLSearchParams(search).get("returnTo");
  return candidate !== null && ALLOWED_RETURN_PATHS.has(candidate)
    ? candidate
    : PRODUCT_PATHS.today;
}
