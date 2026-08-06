import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { App } from "../../app/App";
import { jsonResponse, verifiedMissionFixture } from "../../test/fixtures";

function renderRoute(path: string) {
  return render(<App pathname={path} />);
}

describe("CurriculumPreviewPage", () => {
  it("announces a loading state while the Node response is pending", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(
        () =>
          new Promise<Response>(() => {
            // Intentionally unresolved so the loading state remains observable.
          })
      )
    );

    renderRoute("/curriculum/1");

    expect(screen.getByRole("heading", { name: "Verifying your mission…" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("local Node API");
    expect(screen.queryByText(verifiedMissionFixture.title)).not.toBeInTheDocument();
  });

  it("renders every seed-day field with a calculated schedule and safe resources", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(verifiedMissionFixture))
    );
    const user = userEvent.setup();

    renderRoute("/curriculum/1");

    expect(
      await screen.findByRole("heading", { name: verifiedMissionFixture.title })
    ).toBeInTheDocument();
    expect(screen.getByText("Month 1")).toBeInTheDocument();
    expect(screen.getByText("Week 1")).toBeInTheDocument();
    expect(screen.getByText("Day 1 of 365")).toBeInTheDocument();
    expect(screen.getByText(verifiedMissionFixture.phaseTitle)).toBeInTheDocument();
    expect(screen.getByText(verifiedMissionFixture.weekTitle)).toBeInTheDocument();
    expect(screen.getByText(verifiedMissionFixture.modeLabel)).toBeInTheDocument();
    expect(screen.getByText(verifiedMissionFixture.learningSeed)).toBeInTheDocument();
    expect(screen.getByText(verifiedMissionFixture.buildTask)).toBeInTheDocument();
    expect(screen.getByText(verifiedMissionFixture.corePrinciple)).toBeInTheDocument();
    expect(screen.getByText(verifiedMissionFixture.retrievalQuestion)).toBeInTheDocument();
    expect(screen.getByText(verifiedMissionFixture.tinyArtifact)).toBeInTheDocument();
    expect(screen.getByText(verifiedMissionFixture.recoveryTask)).toBeInTheDocument();
    expect(screen.getByText("None — begin here")).toBeInTheDocument();
    expect(screen.getByLabelText("Core schedule total: 30 minutes")).toHaveTextContent("30minutes");

    for (const block of verifiedMissionFixture.coreSchedule) {
      expect(screen.getByText(block.label)).toBeInTheDocument();
      expect(screen.getByText(`${block.minutes} min`)).toBeInTheDocument();
    }

    for (const skill of verifiedMissionFixture.skillTags) {
      expect(screen.getByText(skill)).toBeInTheDocument();
    }

    const stretchSummary = screen.getByText("Open only if energy remains").closest("summary");
    const stretchDetails = stretchSummary?.closest("details");
    expect(stretchDetails).not.toHaveAttribute("open");
    expect(screen.getByText(verifiedMissionFixture.optionalStretchSeed)).not.toBeVisible();
    await user.click(screen.getByText("Open only if energy remains"));
    expect(stretchDetails).toHaveAttribute("open");
    expect(screen.getByText(verifiedMissionFixture.optionalStretchSeed)).toBeVisible();

    for (const resource of verifiedMissionFixture.resourceLinks) {
      const link = screen.getByRole("link", {
        name: new RegExp(resource.title, "i")
      });
      expect(link).toHaveAttribute("href", resource.url);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(within(link).getByText(resource.provider)).toBeInTheDocument();
      expect(within(link).getByText(resource.type)).toBeInTheDocument();
      expect(within(link).getByText(resource.id)).toBeInTheDocument();
    }

    expect(screen.getByText(verifiedMissionFixture.resourceIds.join(", "))).toBeInTheDocument();
    expect(screen.getByText("Preview mode — progress is not saved yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete/i })).not.toBeInTheDocument();
  });

  it("rejects invalid route parameters without making a network request", () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/curriculum/1.5");

    expect(
      screen.getByRole("heading", {
        name: "Choose a whole-numbered day from 1 to 365."
      })
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders the not-found route without asking the API for fallback content", () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/outside-the-preview");

    expect(
      screen.getByRole("heading", {
        name: "That page is not part of this preview."
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Day 1" })).toHaveAttribute(
      "href",
      "/curriculum/1"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves the root route to login for a signed-out learner", async () => {
    window.history.replaceState(null, "", "/");
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse({ authenticated: false }))
        .mockResolvedValueOnce(
          jsonResponse({
            csrfToken: "a".repeat(43),
            expiresAt: "2026-07-25T00:00:00.000Z"
          })
        )
    );

    renderRoute("/");

    expect(
      await screen.findByRole("heading", {
        name: "Continue from the next useful step."
      })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });

  it("shows a contract-specific error instead of partial mission content", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ dayNumber: 1 })));

    renderRoute("/curriculum/1");

    expect(
      await screen.findByRole("heading", { name: "The mission could not be verified." })
    ).toHaveFocus();
    expect(screen.getByText(/did not match the shared CodeLift contract/i)).toBeInTheDocument();
    expect(screen.getByText(/did not replace the failed response/i)).toBeInTheDocument();
    expect(screen.queryByText(verifiedMissionFixture.title)).not.toBeInTheDocument();
  });
});
