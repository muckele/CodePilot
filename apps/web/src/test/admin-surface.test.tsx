import type { AdminOverviewResponse } from "@codelift/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

import { allowedReturnPathsForEnvironment } from "../app/navigation";
import { AppShell } from "../components/AppShell";
import { AdminPage } from "../features/admin/AdminPage";
import { learningApi } from "../features/workspace/api/learningApi";
import { workspacePathsForEnvironment } from "../features/workspace/workspacePaths";
import { verifiedMissionFixture } from "./fixtures";

const now = "2026-08-06T20:00:00.000Z";
const visualStates = [
  ["new-user", "New user"],
  ["active-day", "Active day"],
  ["core-complete", "Core complete"],
  ["recovery-complete", "Recovery complete"],
  ["missed-return", "Missed return"],
  ["grace-token", "Grace token"],
  ["milestone", "Milestone"],
  ["empty", "Empty"],
  ["loading", "Loading"],
  ["api-error", "API error"],
  ["ai-timeout", "AI timeout"],
  ["ai-refusal", "AI refusal"],
  ["ai-schema-error", "AI schema error"],
  ["rag-no-evidence", "RAG no-evidence"],
  ["agent-awaiting-approval", "Agent awaiting approval"],
  ["reduced-motion", "Reduced motion"],
  ["narrow-mobile", "Narrow mobile"],
  ["dark-theme", "Dark theme"]
] as const;

const overview: AdminOverviewResponse = {
  developmentOnly: true,
  generatedAt: now,
  curriculum: {
    schemaVersion: "2.0.0",
    documentVersion: 2,
    sourceSha256: "a".repeat(64),
    dayCount: 365,
    milestoneCount: 12,
    preview: verifiedMissionFixture,
    quality: { passed: true, missing: [], duplicates: [] }
  },
  resources: {
    total: 1,
    statusCounts: { source_verified: 1, reachable: 0, unknown: 0, unreachable: 0 },
    items: [
      {
        id: "runtime-contracts",
        provider: "Example Foundation",
        title: "Runtime contract reference",
        url: "https://example.org/contracts",
        type: "reference",
        lastCheckedStatus: "source_verified",
        lastCheckedAt: null
      }
    ]
  },
  seeds: {
    evalDatasets: [
      {
        version: "local-behavior-v2",
        evaluatorVersion: "behavioral-evaluator-v2.0.0",
        caseCount: 30,
        contentHash: "b".repeat(64),
        updatedAt: now
      }
    ],
    migrations: [
      {
        id: "curriculum-v2-seed",
        version: "2",
        status: "applied",
        detail: "All 365 curriculum documents match the active source hash.",
        appliedAt: now
      },
      {
        id: "resource-catalog-v2-seed",
        version: "2",
        status: "applied",
        detail: "Every active resource has one validation record.",
        appliedAt: now
      },
      {
        id: "behavioral-eval-dataset-seed",
        version: "local-behavior-v2",
        status: "applied",
        detail: "A hashed eval dataset is registered.",
        appliedAt: now
      }
    ]
  },
  operations: {
    capabilities: [],
    traces: [],
    evalRuns: [],
    estimatedCostUsd: 0,
    killSwitchActive: false
  },
  agentRuns: [],
  featureFlags: [
    {
      key: "ai-kill-switch",
      enabled: false,
      description: "Disables all generative-provider execution.",
      updatedBy: "deterministic-seed",
      updatedAt: now
    },
    {
      key: "bounded-planner",
      enabled: true,
      description: "Enables the approval-gated bounded planner.",
      updatedBy: "deterministic-seed",
      updatedAt: now
    }
  ],
  mockScenarios: [
    {
      key: "success",
      label: "Structured success",
      description: "A strict successful fixture.",
      expectedOutcome: "success"
    },
    {
      key: "timeout",
      label: "Provider timeout",
      description: "A bounded timeout fixture.",
      expectedOutcome: "timeout"
    },
    {
      key: "refusal",
      label: "Provider refusal",
      description: "An explicit refusal fixture.",
      expectedOutcome: "refused"
    },
    {
      key: "schema_error",
      label: "Schema rejection",
      description: "A malformed output fixture.",
      expectedOutcome: "rejected"
    },
    {
      key: "rag_no_evidence",
      label: "RAG no evidence",
      description: "A retrieval abstention fixture.",
      expectedOutcome: "abstained"
    },
    {
      key: "agent_awaiting_approval",
      label: "Agent awaiting approval",
      description: "A proposal-only fixture.",
      expectedOutcome: "awaiting_approval"
    }
  ],
  visualStates: visualStates.map(([key, stateLabel]) => ({
    key,
    label: stateLabel,
    galleryAnchor: `${key}-heading`
  })),
  reset: {
    confirmationPhrase: "RESET DEMO DATA",
    scope: "current_account_product_data",
    preserves: ["account", "profile", "active_session", "global_seed_data"]
  }
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("development Admin surface", () => {
  it("inspects diagnostics and performs explicitly confirmed development controls", async () => {
    const csrfToken = "a".repeat(43);
    vi.spyOn(learningApi, "admin").mockResolvedValue(overview);
    const flagSpy = vi.spyOn(learningApi, "updateAdminFeatureFlag").mockResolvedValue({
      ...overview.featureFlags[0]!,
      enabled: true,
      updatedBy: "development-admin:00000001"
    });
    const scenarioSpy = vi.spyOn(learningApi, "runAdminMockScenario").mockResolvedValue({
      scenario: "timeout",
      outcome: "timeout",
      generated: false,
      title: "Provider deadline reached",
      detail: "The bounded fixture retained deterministic local guidance.",
      trace: ["start_mock_request", "reach_deadline", "use_deterministic_fallback"]
    });
    const resetSpy = vi.spyOn(learningApi, "resetAdminDemoData").mockResolvedValue({
      reset: true,
      scope: "current_account_product_data",
      deletedRecords: 2,
      collections: [
        { collection: "ErrorMuseumEntry", deletedCount: 1 },
        { collection: "IndexedSource", deletedCount: 1 }
      ],
      preserved: ["account", "profile", "active_session", "global_seed_data"]
    });
    const actor = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminPage csrfToken={csrfToken} />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", {
        name: "Inspect content, reliability, and safe test state."
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Day 1:/ })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Validated seed has no reported gaps." })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1 visible resources" })).toBeInTheDocument();
    expect(screen.getAllByText("Runtime contract reference")).toHaveLength(2);
    expect(
      screen.getByRole("heading", { name: "Tenant-scoped operational evidence" })
    ).toBeInTheDocument();

    await actor.click(screen.getByRole("button", { name: "Enable ai-kill-switch" }));
    expect(
      screen.getByRole("group", { name: "Confirm ai-kill-switch update" })
    ).toBeInTheDocument();
    await actor.click(screen.getByRole("button", { name: "Confirm flag update" }));
    await waitFor(() => {
      expect(flagSpy).toHaveBeenCalledWith(
        "ai-kill-switch",
        { enabled: true, confirmation: "UPDATE DEVELOPMENT FLAG" },
        csrfToken
      );
    });

    await actor.selectOptions(screen.getByLabelText("Mock scenario"), "timeout");
    await actor.click(screen.getByRole("button", { name: "Run deterministic scenario" }));
    expect(
      await screen.findByRole("heading", { name: "Provider deadline reached" })
    ).toBeInTheDocument();
    expect(scenarioSpy).toHaveBeenCalledWith({ scenario: "timeout" }, csrfToken);
    expect(screen.getByText(/Generated content: no/)).toBeInTheDocument();

    await actor.click(screen.getByLabelText("Reduced motion"));
    await actor.click(screen.getByLabelText("Narrow mobile frame"));
    await actor.click(screen.getByLabelText("Dark theme"));
    expect(screen.getByTestId("admin-visual-preview")).toHaveClass(
      "admin-visual-preview--reduced",
      "admin-visual-preview--narrow",
      "admin-visual-preview--dark"
    );

    const resetButton = screen.getByRole("button", { name: "Reset current-account demo data" });
    expect(resetButton).toBeDisabled();
    await actor.type(screen.getByLabelText(/Type RESET DEMO DATA exactly/), "RESET DEMO DATA");
    await actor.click(screen.getByLabelText(/I understand this resets only the signed-in account/));
    expect(resetButton).toBeEnabled();
    await actor.click(resetButton);
    await waitFor(() => {
      expect(resetSpy).toHaveBeenCalledWith({ confirmation: "RESET DEMO DATA" }, csrfToken);
    });
    expect(await screen.findByText(/Reset 2 current-account demo records/)).toBeInTheDocument();
  });

  it("excludes Admin routing, return paths, and navigation outside development", () => {
    expect(workspacePathsForEnvironment(true)).toContain("/admin");
    expect(workspacePathsForEnvironment(false)).not.toContain("/admin");
    expect(allowedReturnPathsForEnvironment(true)).toContain("/admin");
    expect(allowedReturnPathsForEnvironment(false)).not.toContain("/admin");

    const { rerender } = render(
      <MemoryRouter>
        <AppShell privateMode developmentMode={false}>
          <p>Production shell</p>
        </AppShell>
      </MemoryRouter>
    );
    expect(screen.queryByRole("link", { name: "Dev admin" })).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <AppShell privateMode developmentMode>
          <p>Development shell</p>
        </AppShell>
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Dev admin" })).toHaveAttribute("href", "/admin");
  });
});
