export const E2E_BASE_URL = process.env.CODELIFT_E2E_BASE_URL ?? "http://127.0.0.1:5173";
export const E2E_API_URL = process.env.CODELIFT_E2E_API_URL ?? "http://127.0.0.1:4000";
export const E2E_MONGO_URI =
  process.env.CODELIFT_E2E_MONGO_URI ??
  "mongodb://127.0.0.1:27018/codelift_e2e_test?replicaSet=rs0&directConnection=true";

export function guardedE2eDatabaseName(uri = E2E_MONGO_URI): string {
  const databaseName = new URL(uri).pathname.slice(1);
  if (!/^[A-Za-z0-9_-]+_e2e_test$/u.test(databaseName)) {
    throw new Error("Playwright Mongo database names must end in _e2e_test.");
  }
  return databaseName;
}

export const E2E_DATABASE_NAME = guardedE2eDatabaseName();
