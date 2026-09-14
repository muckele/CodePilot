import assert from "node:assert/strict";
import test from "node:test";

import { createFreshCloneEnvironment } from "./fresh-clone-environment.mjs";

test("keeps nested package scripts bound to the repository pnpm version", () => {
  const sourceEnvironment = {
    PATH: "/example/bin",
    COREPACK_ENABLE_PROJECT_SPEC: "0"
  };

  assert.deepEqual(createFreshCloneEnvironment(sourceEnvironment), {
    PATH: "/example/bin",
    CI: "true",
    COREPACK_ENABLE_PROJECT_SPEC: "1",
    PNPM_DISABLE_SELF_UPDATE_CHECK: "1",
    pnpm_config_verify_deps_before_run: "false"
  });
  assert.equal(sourceEnvironment.COREPACK_ENABLE_PROJECT_SPEC, "0");
});
