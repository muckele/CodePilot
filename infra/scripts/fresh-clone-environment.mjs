export function createFreshCloneEnvironment(sourceEnvironment) {
  return {
    ...sourceEnvironment,
    CI: "true",
    COREPACK_ENABLE_PROJECT_SPEC: "1",
    PNPM_DISABLE_SELF_UPDATE_CHECK: "1",
    pnpm_config_verify_deps_before_run: "false"
  };
}
