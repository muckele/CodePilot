import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { curriculumBlueprintSchema, type CurriculumBlueprint } from "@codelift/contracts";
import { afterEach, describe, expect, it } from "vitest";

import {
  CurriculumSourceError,
  createCurriculumDayIndex,
  enrichCurriculum,
  loadCurriculumBlueprint,
  runCurriculumPreflight,
  validateEnrichedCurriculumDays,
  validateRuntimeCurriculum,
  writeCurriculumPreflightReport
} from "../src/index.js";

const canonicalSourcePath = fileURLToPath(
  new URL("../../../codelift_ai_curriculum_seed_v2_2026.json", import.meta.url)
);
const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "codelift-curriculum-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function readCanonicalBlueprint(): Promise<CurriculumBlueprint> {
  const source = await readFile(canonicalSourcePath, "utf8");
  const decoded = JSON.parse(source) as unknown;
  return curriculumBlueprintSchema.parse(decoded);
}

async function writeFixture(mutate: (blueprint: CurriculumBlueprint) => void): Promise<string> {
  const directory = await createTemporaryDirectory();
  const blueprint = await readCanonicalBlueprint();
  mutate(blueprint);
  const fixturePath = join(directory, "fixture.json");
  await writeFile(fixturePath, JSON.stringify(blueprint), "utf8");
  return fixturePath;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("curriculum blueprint preflight", () => {
  it("validates the canonical source and reports exact integrity evidence", async () => {
    const report = await runCurriculumPreflight(canonicalSourcePath);

    expect(report).toMatchObject({
      validationProfile: "blueprint",
      displayReady: false,
      valid: true,
      sourceSha256: "af4183cc6d139c34e7ebe63949055fa6fe2e89a25c54c707a4c67a219ed9eb99",
      counts: {
        days: 365,
        weeks: 52,
        months: 12,
        catalogResources: 88,
        uniqueCatalogUrls: 87,
        resourceReferences: 841,
        prerequisiteEdges: 364
      },
      failures: []
    });
    expect(report.knownDisplayGaps.map((gap) => gap.code)).toEqual([
      "DISPLAY_FIELDS_NOT_SOURCE_ENCODED",
      "RECOVERY_ESTIMATE_NOT_PER_DAY",
      "RESOURCE_STATUS_NOT_SOURCE_ENCODED"
    ]);
  });

  it.each([
    {
      name: "a duplicate/out-of-sequence day",
      expectedCode: "DAY_SEQUENCE",
      mutate: (blueprint: CurriculumBlueprint) => {
        const day = blueprint.days[1];
        if (day !== undefined) day.dayNumber = 1;
      }
    },
    {
      name: "a non-30-minute Core schedule",
      expectedCode: "CORE_MINUTES",
      mutate: (blueprint: CurriculumBlueprint) => {
        const block = blueprint.days[0]?.coreSchedule[0];
        if (block !== undefined) block.minutes = 4;
      }
    },
    {
      name: "an unknown resource",
      expectedCode: "UNKNOWN_RESOURCE_ID",
      mutate: (blueprint: CurriculumBlueprint) => {
        const day = blueprint.days[0];
        if (day !== undefined) day.resourceIds[0] = "notInCatalog";
      }
    },
    {
      name: "a future prerequisite",
      expectedCode: "PREREQUISITE_NOT_PAST",
      mutate: (blueprint: CurriculumBlueprint) => {
        const day = blueprint.days[1];
        if (day !== undefined) day.prerequisiteDayNumbers = [2];
      }
    },
    {
      name: "a broken month/week mapping",
      expectedCode: "WEEK_MONTH_MAPPING",
      mutate: (blueprint: CurriculumBlueprint) => {
        const week = blueprint.weeks[0];
        if (week !== undefined) week.monthNumber = 2;
      }
    }
  ])("fails closed for $name", async ({ expectedCode, mutate }) => {
    const fixturePath = await writeFixture(mutate);
    const report = await runCurriculumPreflight(fixturePath);

    expect(report.valid).toBe(false);
    expect(report.failures.map((failure) => failure.code)).toContain(expectedCode);
    await expect(loadCurriculumBlueprint(fixturePath)).rejects.toBeInstanceOf(
      CurriculumSourceError
    );
  });

  it("reports malformed JSON and writes the failed machine-readable report", async () => {
    const directory = await createTemporaryDirectory();
    const fixturePath = join(directory, "malformed.json");
    const reportPath = join(directory, "reports", "curriculum-preflight.json");
    await writeFile(fixturePath, '{ "days": [', "utf8");

    const report = await writeCurriculumPreflightReport(fixturePath, reportPath);
    const writtenReport = JSON.parse(await readFile(reportPath, "utf8")) as unknown;

    expect(report.valid).toBe(false);
    expect(report.failures).toContainEqual({
      code: "SOURCE_JSON",
      path: "$",
      message: "Curriculum source is not valid JSON."
    });
    expect(writtenReport).toEqual(report);
  });

  it("reports schema failures for an unsafe HTTP resource fixture", async () => {
    const fixturePath = await writeFixture((blueprint) => {
      const resource = blueprint.resourceCatalog["odinFoundations"];
      if (resource !== undefined) resource.url = "http://example.com/not-safe";
    });

    const report = await runCurriculumPreflight(fixturePath);

    expect(report.valid).toBe(false);
    expect(report.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SOURCE_SCHEMA",
          path: "$.resourceCatalog.odinFoundations.url"
        })
      ])
    );
  });
});

describe("immutable curriculum loading", () => {
  it("requires an explicit absolute source path", async () => {
    await expect(loadCurriculumBlueprint("curriculum.json")).rejects.toThrow(
      "must be explicit and absolute"
    );
  });

  it("builds a frozen source and a mutation-free day index", async () => {
    const loaded = await loadCurriculumBlueprint(canonicalSourcePath);
    const dayOne = loaded.getDay(1);

    expect(loaded.index.size).toBe(365);
    expect(dayOne?.title).toBe("Define the developer identity and learning contract");
    expect(dayOne?.learningObjective).toMatch(/^(?:Build|Implement)\b/);
    expect(dayOne?.knowledgeChecks.map((check) => check.kind)).toEqual([
      "recall",
      "application",
      "explanation"
    ]);
    expect(dayOne?.recoveryMinutes).toBe(5);
    expect(dayOne?.optionalStretchMinutes).toBe(10);
    expect(dayOne?.resourceLinks.every((resource) => resource.url.startsWith("https://"))).toBe(
      true
    );
    expect("set" in loaded.index).toBe(false);
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded.blueprint)).toBe(true);
    expect(Object.isFrozen(dayOne)).toBe(true);
    expect(dayOne === undefined ? true : Reflect.set(dayOne, "title", "mutated")).toBe(false);
    expect(loaded.getDay(0)).toBeUndefined();
    expect(loaded.getDay(366)).toBeUndefined();
  });

  it("validates all 365 enriched runtime days as display-ready", async () => {
    const report = await validateRuntimeCurriculum(canonicalSourcePath);

    expect(report).toMatchObject({
      validationProfile: "runtime",
      displayReady: true,
      valid: true,
      counts: {
        days: 365,
        knowledgeChecks: 1_095,
        resourceLinks: 841,
        recoveryMinutesOverLimit: 0,
        optionalStretchMinutesOverLimit: 0
      },
      semanticValidation: {
        semanticFieldsChecked: 7_046,
        duplicateGroups: 0,
        genericFieldFailures: 0,
        objectiveAnchorFailures: 0,
        commonMistakeAnchorFailures: 0,
        topicHintFailures: 0,
        knowledgeCheckFailures: 0
      },
      failures: []
    });
  });

  it("marks a preflight-invalid source as not display-ready", async () => {
    const fixturePath = await writeFixture((blueprint) => {
      const firstBlock = blueprint.days[0]?.coreSchedule[0];
      if (firstBlock !== undefined) firstBlock.minutes = 1;
    });

    const report = await validateRuntimeCurriculum(fixturePath);

    expect(report).toMatchObject({
      valid: false,
      displayReady: false,
      counts: { days: 0 },
      semanticValidation: { semanticFieldsChecked: 0 }
    });
    expect(report.failures.map((failure) => failure.code)).toContain("CORE_MINUTES");
  });

  it("rejects blank, filler, title-only, and excessively duplicated enrichment", async () => {
    const blueprint = await readCanonicalBlueprint();
    const blankDay = structuredClone(enrichCurriculum(blueprint)[0]);
    if (blankDay === undefined) throw new Error("Canonical fixture must contain Day 1.");
    blankDay.learningObjective = "   ";

    const blankResult = validateEnrichedCurriculumDays([blankDay]);
    expect(blankResult.failures.map((failure) => failure.code)).toContain("RUNTIME_SCHEMA");

    const genericDays = enrichCurriculum(blueprint)
      .slice(0, 3)
      .map((day) => structuredClone(day));
    for (const day of genericDays) {
      day.learningObjective = `Build ${day.title}, then learn more about the topic.`;
      day.commonMistake = `For ${day.title}, use the relevant section instead of concrete evidence.`;
      for (const resource of day.resourceLinks) {
        resource.topicHint = `Read the documentation for ${day.title}.`;
      }
      for (const check of day.knowledgeChecks) {
        check.prompt = `Explain ${day.title}.`;
        check.hint = `Read the docs about ${day.title}.`;
        check.explanation = `The central idea behind ${day.title} is the answer.`;
      }
      day.retrievalPrompts = [
        `Recall ${day.title}.`,
        `Apply ${day.title}.`,
        `Explain ${day.title}.`
      ];
    }

    const genericResult = validateEnrichedCurriculumDays(genericDays);
    const failureCodes = new Set(genericResult.failures.map((failure) => failure.code));
    expect([...failureCodes]).toEqual(
      expect.arrayContaining([
        "BANNED_FILLER",
        "EXCESSIVE_SEMANTIC_DUPLICATION",
        "GENERIC_KNOWLEDGE_CHECK",
        "GENERIC_TOPIC_HINT"
      ])
    );
    expect(genericResult.metrics.duplicateGroups).toBeGreaterThan(0);
    expect(genericResult.metrics.genericFieldFailures).toBeGreaterThan(0);
  });

  it("rejects duplicate keys when an index is constructed independently", async () => {
    const blueprint = await readCanonicalBlueprint();
    const dayOne = blueprint.days[0];
    if (dayOne === undefined) {
      throw new Error("Canonical fixture must contain Day 1.");
    }

    expect(() => createCurriculumDayIndex([dayOne, dayOne])).toThrow(
      "Cannot index duplicate curriculum day 1."
    );
  });
});
