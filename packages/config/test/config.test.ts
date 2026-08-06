import { describe, expect, it } from "vitest";

import {
  AUTHENTICATED_RETURN_PATHS,
  CURRICULUM_LIMITS,
  HTTP_LIMITS,
  PRIVATE_NOTE_LIMITS,
  PRODUCT_PATHS
} from "../src/index.js";

describe("shared product configuration", () => {
  it("keeps curriculum and private-note limits explicit", () => {
    expect(CURRICULUM_LIMITS).toEqual({ firstDay: 1, lastDay: 365 });
    expect(PRIVATE_NOTE_LIMITS).toEqual({
      titleCharacters: 120,
      contentCharacters: 20_000,
      questionCharacters: 1_000
    });
    expect(HTTP_LIMITS.jsonBody).toBe("32kb");
  });

  it("publishes unique local product paths without query or fragment data", () => {
    const paths = Object.values(PRODUCT_PATHS);

    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.every((path) => path.startsWith("/"))).toBe(true);
    expect(paths.every((path) => !path.includes("?") && !path.includes("#"))).toBe(true);
  });

  it("keeps development-only admin out of the default return-path allowlist", () => {
    expect(AUTHENTICATED_RETURN_PATHS).toContain(PRODUCT_PATHS.tasks);
    expect(AUTHENTICATED_RETURN_PATHS).not.toContain(PRODUCT_PATHS.admin);
  });
});
