import { evalDatasetSchema, type EvalDataset } from "@codelift/contracts";
import { describe, expect, it } from "vitest";

import {
  BEHAVIORAL_EVALUATOR_VERSION,
  evaluateAssertion,
  evaluatorNegativeControlsPass,
  runBehavioralEvaluation
} from "../src/index.js";

function fixtureDataset(): EvalDataset {
  return evalDatasetSchema.parse({
    version: "negative-control-test-v1",
    evaluatorVersion: BEHAVIORAL_EVALUATOR_VERSION,
    name: "Evaluator negative-control fixtures",
    passingScore: 1,
    providerConfig: {
      provider: "test-fixture",
      model: "none",
      promptVersion: "test-v1",
      sampling: "none",
      externalCallsAllowed: false,
      fixtureProfile: "synthetic"
    },
    cases: Array.from({ length: 30 }, (_, index) => ({
      caseId: `case-${String(index + 1).padStart(2, "0")}`,
      category: "schema",
      critical: true,
      scenario: {
        kind: "output_safety",
        input: { untrustedOutput: `<fixture-${index + 1}>` }
      },
      expectedBehavior: "The executor must report the required observed boolean.",
      assertions: [
        {
          assertionId: "required-observation",
          field: "requiredBehavior",
          operator: "equals",
          expected: true
        }
      ]
    }))
  });
}

describe("behavioral evaluator integrity", () => {
  it("passes a fully observed executable dataset", async () => {
    const report = await runBehavioralEvaluation({
      dataset: fixtureDataset(),
      datasetPath: "synthetic.json",
      datasetHash: "a".repeat(64),
      execute: async () => ({ observed: { requiredBehavior: true } }),
      now: () => new Date("2026-08-06T12:00:00.000Z")
    });

    expect(report).toMatchObject({
      passed: true,
      score: 1,
      criticalFailures: [],
      negativeControlsPassed: true
    });
    expect(report.cases).toHaveLength(30);
    expect(report.cases.every((entry) => entry.observed.requiredBehavior === true)).toBe(true);
  });

  it("lowers the score and fails the critical gate when behavior is deliberately broken", async () => {
    const report = await runBehavioralEvaluation({
      dataset: fixtureDataset(),
      datasetPath: "synthetic.json",
      datasetHash: "b".repeat(64),
      execute: async (_scenario, definition) => ({
        observed: { requiredBehavior: definition.caseId !== "case-01" }
      })
    });

    expect(report.score).toBe(29 / 30);
    expect(report.passed).toBe(false);
    expect(report.criticalFailures).toEqual(["case-01"]);
    expect(report.cases[0]).toMatchObject({ passed: false, critical: true });
    expect(report.cases[0]?.assertions[0]).toMatchObject({
      actual: false,
      expected: true,
      passed: false
    });
  });

  it("fails a valid but deliberately impossible expected-behavior fixture", async () => {
    const dataset = fixtureDataset();
    const brokenFixture = evalDatasetSchema.parse({
      ...dataset,
      cases: dataset.cases.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              assertions: entry.assertions.map((assertion) => ({
                ...assertion,
                expected: false
              }))
            }
          : entry
      )
    });
    const report = await runBehavioralEvaluation({
      dataset: brokenFixture,
      datasetPath: "broken-expected.json",
      datasetHash: "c".repeat(64),
      execute: async () => ({ observed: { requiredBehavior: true } })
    });

    expect(report.passed).toBe(false);
    expect(report.score).toBeLessThan(1);
    expect(report.criticalFailures).toContain("case-01");
  });

  it("rejects duplicate IDs and malformed scenario input before execution", () => {
    const dataset = fixtureDataset();
    expect(() =>
      evalDatasetSchema.parse({
        ...dataset,
        cases: dataset.cases.map((entry, index) =>
          index === 1 ? { ...entry, caseId: dataset.cases[0]?.caseId } : entry
        )
      })
    ).toThrow(/Duplicate eval caseId/);
    expect(() =>
      evalDatasetSchema.parse({
        ...dataset,
        cases: dataset.cases.map((entry, index) =>
          index === 0
            ? {
                ...entry,
                scenario: {
                  ...entry.scenario,
                  input: { untrustedOutput: "", unexpected: true }
                }
              }
            : entry
        )
      })
    ).toThrow();
    expect(() =>
      evalDatasetSchema.parse({
        ...dataset,
        cases: dataset.cases.map((entry, index) =>
          index === 0
            ? {
                ...entry,
                assertions: [entry.assertions[0], entry.assertions[0]]
              }
            : entry
        )
      })
    ).toThrow(/Duplicate assertionId/);
    expect(() =>
      evalDatasetSchema.parse({
        ...dataset,
        cases: dataset.cases.map((entry, index) =>
          index === 0
            ? {
                ...entry,
                assertions: [
                  {
                    assertionId: "invalid-numeric-operator",
                    field: "requiredBehavior",
                    operator: "gte",
                    expected: "one"
                  }
                ]
              }
            : entry
        )
      })
    ).toThrow(/requires a numeric expected value/);
  });

  it("keeps built-in assertion-engine negative controls active", () => {
    expect(evaluatorNegativeControlsPass()).toBe(true);
    expect(
      evaluateAssertion(
        {
          assertionId: "missing-null",
          field: "missing",
          operator: "equals",
          expected: null
        },
        {}
      )
    ).toMatchObject({ actual: null, passed: false });
  });
});
