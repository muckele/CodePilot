// Substitute only the operator-path boundary for safety regressions. Docker,
// encryption, retention, restore and cleanup still execute their real code.
import { registerHooks } from "node:module";
const stateModule = new URL("../state.mjs", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    if (result.url !== stateModule) return result;
    return {
      url: `data:text/javascript,${encodeURIComponent(`export const stateRoot=${JSON.stringify(process.env.CODELIFT_TEST_OPERATOR_ROOT)}; export function initializeState(){throw new Error('Unexpected initialization in path-isolation test');}`)}`,
      shortCircuit: true
    };
  }
});
