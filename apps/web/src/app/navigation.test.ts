import { describe, expect, it } from "vitest";

import { allowedReturnTo } from "./navigation";

describe("allowedReturnTo", () => {
  it("accepts only an exactly allowlisted local path", () => {
    expect(allowedReturnTo("?returnTo=%2Fapp%2Faccount")).toBe("/app/account");
    expect(allowedReturnTo("?returnTo=%2Fapp%2Ftasks")).toBe("/app/tasks");
  });

  it.each([
    ["an external URL", "?returnTo=https%3A%2F%2Fattacker.example%2Fcollect"],
    ["a protocol-relative URL", "?returnTo=%2F%2Fattacker.example%2Fcollect"],
    ["a double-encoded allowlisted path", "?returnTo=%252Fapp%252Faccount"],
    ["an allowlisted path with a query", "?returnTo=%2Fapp%2Faccount%3Fexport%3D1"],
    ["an allowlisted path with a fragment", "?returnTo=%2Fapp%2Faccount%23delete"]
  ])("rejects %s", (_label, search) => {
    expect(allowedReturnTo(search)).toBe("/app/today");
  });
});
