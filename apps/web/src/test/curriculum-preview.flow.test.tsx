/**
 * Browser-facing component flow coverage.
 *
 * This suite mounts the complete routed React application in jsdom and exercises
 * the fetch boundary, error state, retry action, and successful mission render.
 * It is intentionally named `test:component-flow`; it is not a Playwright or
 * deployed-browser test.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { App } from "../app/App";
import { jsonResponse, serviceProblemFixture, verifiedMissionFixture } from "./fixtures";

function renderCurriculumFlow() {
  return render(<App pathname="/curriculum/1" />);
}

describe("curriculum preview component flow", () => {
  it("completes the golden read-only preview flow through the HTTP contract", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(verifiedMissionFixture));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderCurriculumFlow();

    expect(screen.getByRole("status")).toHaveTextContent("local Node API");
    expect(
      await screen.findByRole("heading", { name: verifiedMissionFixture.title })
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/curriculum/1",
      expect.objectContaining({
        method: "GET"
      })
    );
    expect(screen.getByText("Preview mode — progress is not saved yet.")).toBeInTheDocument();
    expect(screen.getByLabelText("Core schedule total: 30 minutes")).toBeInTheDocument();

    const stretch = screen.getByText("Open only if energy remains");
    expect(stretch.closest("details")).not.toHaveAttribute("open");
    await user.click(stretch);
    expect(stretch.closest("details")).toHaveAttribute("open");

    const firstResource = screen.getByRole("link", {
      name: /Open systems guide/i
    });
    firstResource.focus();
    expect(firstResource).toHaveFocus();
    expect(firstResource).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("moves from a verified API problem through retry to the golden mission", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(serviceProblemFixture, 503))
      .mockResolvedValueOnce(jsonResponse(verifiedMissionFixture));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderCurriculumFlow();

    const errorHeading = await screen.findByRole("heading", {
      name: "This curriculum day is unavailable."
    });
    expect(errorHeading).toHaveFocus();
    expect(screen.getByText(serviceProblemFixture.detail ?? "")).toBeInTheDocument();
    expect(screen.getByText("request-test-123")).toBeInTheDocument();
    expect(screen.queryByText(verifiedMissionFixture.title)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Verify again" }));

    expect(
      await screen.findByRole("heading", { name: verifiedMissionFixture.title })
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("This curriculum day is unavailable.")).not.toBeInTheDocument();
  });
});
