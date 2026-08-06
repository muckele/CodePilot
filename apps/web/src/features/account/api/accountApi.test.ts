import { describe, expect, it, vi } from "vitest";

import { fetchMe, registerAccount, updateProgressStatus } from "./accountApi";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": status >= 400 ? "application/problem+json" : "application/json"
    }
  });
}

describe("account API boundary", () => {
  it("uses cookie credentials and no-store for session bootstrap", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ authenticated: false }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchMe()).resolves.toEqual({ authenticated: false });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/me",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        cache: "no-store"
      })
    );
  });

  it("serializes only the shared registration contract and sends CSRF", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          authenticated: true,
          user: {
            id: "64f000000000000000000001",
            email: "mathew@example.com",
            onboardingComplete: false,
            profile: null,
            createdAt: "2026-07-24T20:00:00.000Z"
          },
          csrfToken: "b".repeat(43)
        },
        201
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await registerAccount(
      {
        email: "MATHEW@example.com",
        password: "Correct horse battery staple!"
      },
      "a".repeat(43)
    );

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init).toEqual(
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-CSRF-Token": "a".repeat(43)
        })
      })
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      email: "mathew@example.com",
      password: "Correct horse battery staple!"
    });
  });

  it("rejects unsafe requests without a CSRF token before fetch", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateProgressStatus(
        1,
        {
          intent: "start",
          mode: "core",
          idempotencyKey: "start-day-one"
        },
        undefined as unknown as string
      )
    ).rejects.toMatchObject({
      name: "AccountApiError",
      kind: "request-validation"
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves typed problem details and request correlation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          {
            type: "https://codelift.ai/problems/progress-conflict",
            title: "Progress conflict",
            status: 409,
            detail: "Reload Today before trying again.",
            requestId: "request-123"
          },
          409
        )
      )
    );

    await expect(
      updateProgressStatus(
        1,
        {
          intent: "start",
          mode: "core",
          idempotencyKey: "start-day-one"
        },
        "a".repeat(43)
      )
    ).rejects.toEqual(
      expect.objectContaining({
        kind: "problem",
        status: 409,
        problemType: "https://codelift.ai/problems/progress-conflict",
        requestId: "request-123"
      })
    );
  });
});
