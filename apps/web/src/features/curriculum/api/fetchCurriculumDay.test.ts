import { describe, expect, it, vi } from "vitest";

import { fetchCurriculumDay } from "./fetchCurriculumDay";
import type { CurriculumLoadError } from "./fetchCurriculumDay";
import {
  jsonResponse,
  serviceProblemFixture,
  verifiedMissionFixture
} from "../../../test/fixtures";

describe("fetchCurriculumDay", () => {
  it("requests only the versioned Node curriculum route and parses the shared contract", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(verifiedMissionFixture));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCurriculumDay(1)).resolves.toEqual(verifiedMissionFixture);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/curriculum/1",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json, application/problem+json"
        }
      })
    );
  });

  it("normalizes a verified problem response without exposing arbitrary response data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(serviceProblemFixture, 503))
    );

    const request = fetchCurriculumDay(1);

    await expect(request).rejects.toMatchObject({
      name: "CurriculumLoadError",
      kind: "problem",
      status: 503,
      requestId: "request-test-123",
      message: "The validated curriculum is not ready yet."
    });
  });

  it("rejects a successful response that does not satisfy the shared day schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          dayNumber: 1,
          title: "An incomplete response"
        })
      )
    );

    await expect(fetchCurriculumDay(1)).rejects.toMatchObject({
      kind: "malformed",
      message: expect.stringContaining("did not match the shared CodeLift contract")
    });
  });

  it("normalizes a network failure into a safe retryable error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError("socket details stay private"))
    );

    await expect(fetchCurriculumDay(1)).rejects.toEqual(
      expect.objectContaining<Partial<CurriculumLoadError>>({
        kind: "network",
        status: null,
        requestId: null
      })
    );
  });
});
