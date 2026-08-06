import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, isAbsolute } from "node:path";

import {
  curriculumBlueprintSchema,
  type CurriculumBlueprint,
  type CurriculumResource,
  type CurriculumSeedDay,
  type CurriculumWeek
} from "@codelift/contracts";

export type CurriculumPreflightFailure = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

export type CurriculumKnownDisplayGap = Readonly<{
  code: string;
  affectedRecords: number;
  fields: readonly string[];
  message: string;
}>;

export type CurriculumPreflightCounts = Readonly<{
  days: number;
  weeks: number;
  months: number;
  catalogResources: number;
  uniqueCatalogUrls: number;
  resourceReferences: number;
  prerequisiteEdges: number;
}>;

export type CurriculumPreflightReport = Readonly<{
  reportVersion: "1.0.0";
  validationProfile: "blueprint";
  displayReady: false;
  valid: boolean;
  sourceFile: string;
  sourceBytes: number;
  sourceSha256: string | null;
  counts: CurriculumPreflightCounts;
  failures: readonly CurriculumPreflightFailure[];
  knownDisplayGaps: readonly CurriculumKnownDisplayGap[];
}>;

export type CurriculumSourceInspection = Readonly<{
  report: CurriculumPreflightReport;
  blueprint?: CurriculumBlueprint;
}>;

const EXPECTED_CORE_MINUTES = 30;
const EXPECTED_WEEK_COUNT = 52;
const EXPECTED_DAY_COUNT = 365;
const EXPECTED_CYCLE_SCHEDULES: readonly (readonly number[])[] = [
  [3, 10, 12, 5],
  [3, 8, 14, 5],
  [5, 7, 13, 5],
  [3, 5, 17, 5],
  [3, 7, 15, 5],
  [3, 22, 5],
  [7, 8, 10, 5]
];
const EXPECTED_CYCLE_MODES = [
  "Concept and first example",
  "Guided practice and variation",
  "Closed-note reconstruction",
  "Product connection",
  "Quality, debugging, or security",
  "Integrate and ship the weekly slice",
  "Spaced review and recovery"
] as const;
const DISPLAY_FIELDS = [
  "learningObjective",
  "whyItMattersForAIEngineering",
  "mentalModel",
  "commonMistake",
  "knowledgeChecks",
  "teachBackPrompt",
  "retrievalPrompts"
] as const;

function emptyCounts(): CurriculumPreflightCounts {
  return {
    days: 0,
    weeks: 0,
    months: 0,
    catalogResources: 0,
    uniqueCatalogUrls: 0,
    resourceReferences: 0,
    prerequisiteEdges: 0
  };
}

function createReport(input: {
  sourceFile: string;
  sourceBytes: number;
  sourceSha256: string | null;
  counts: CurriculumPreflightCounts;
  failures: readonly CurriculumPreflightFailure[];
  knownDisplayGaps?: readonly CurriculumKnownDisplayGap[];
}): CurriculumPreflightReport {
  return {
    reportVersion: "1.0.0",
    validationProfile: "blueprint",
    displayReady: false,
    valid: input.failures.length === 0,
    sourceFile: input.sourceFile,
    sourceBytes: input.sourceBytes,
    sourceSha256: input.sourceSha256,
    counts: input.counts,
    failures: input.failures,
    knownDisplayGaps: input.knownDisplayGaps ?? []
  };
}

function expectedMonthForWeek(weekNumber: number): number {
  if (weekNumber <= 4) return 1;
  if (weekNumber <= 8) return 2;
  if (weekNumber <= 13) return 3;
  if (weekNumber <= 17) return 4;
  if (weekNumber <= 21) return 5;
  if (weekNumber <= 26) return 6;
  if (weekNumber <= 30) return 7;
  if (weekNumber <= 34) return 8;
  if (weekNumber <= 39) return 9;
  if (weekNumber <= 43) return 10;
  if (weekNumber <= 47) return 11;
  return 12;
}

function sameResource(left: CurriculumResource, right: CurriculumResource): boolean {
  return (
    left.provider === right.provider &&
    left.title === right.title &&
    left.url === right.url &&
    left.type === right.type
  );
}

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function addFailure(
  failures: CurriculumPreflightFailure[],
  code: string,
  path: string,
  message: string
): void {
  failures.push({ code, path, message });
}

function validateWeeks(
  weeks: readonly CurriculumWeek[],
  failures: CurriculumPreflightFailure[]
): void {
  if (weeks.length !== EXPECTED_WEEK_COUNT) {
    addFailure(
      failures,
      "WEEK_COUNT",
      "$.weeks",
      `Expected ${EXPECTED_WEEK_COUNT} week records; received ${weeks.length}.`
    );
  }

  const seenWeekNumbers = new Set<number>();
  weeks.forEach((week, index) => {
    const path = `$.weeks[${index}]`;
    const expectedWeekNumber = index + 1;

    if (week.weekNumber !== expectedWeekNumber) {
      addFailure(
        failures,
        "WEEK_SEQUENCE",
        `${path}.weekNumber`,
        `Expected ordered week number ${expectedWeekNumber}; received ${week.weekNumber}.`
      );
    }

    if (seenWeekNumbers.has(week.weekNumber)) {
      addFailure(
        failures,
        "WEEK_DUPLICATE",
        `${path}.weekNumber`,
        `Week number ${week.weekNumber} is duplicated.`
      );
    }
    seenWeekNumbers.add(week.weekNumber);

    const expectedMonth = expectedMonthForWeek(week.weekNumber);
    if (week.monthNumber !== expectedMonth) {
      addFailure(
        failures,
        "WEEK_MONTH_MAPPING",
        `${path}.monthNumber`,
        `Week ${week.weekNumber} must map to Month ${expectedMonth}; received Month ${week.monthNumber}.`
      );
    }
  });
}

function validateDayResources(
  day: CurriculumSeedDay,
  dayIndex: number,
  catalog: Readonly<Record<string, CurriculumResource>>,
  failures: CurriculumPreflightFailure[]
): void {
  const path = `$.days[${dayIndex}]`;
  const seenResourceIds = new Set<string>();
  const seenLinkIds = new Set<string>();

  day.resourceIds.forEach((resourceId, resourceIndex) => {
    if (seenResourceIds.has(resourceId)) {
      addFailure(
        failures,
        "DAY_RESOURCE_ID_DUPLICATE",
        `${path}.resourceIds[${resourceIndex}]`,
        `Resource ID "${resourceId}" is duplicated on Day ${day.dayNumber}.`
      );
    }
    seenResourceIds.add(resourceId);

    if (catalog[resourceId] === undefined) {
      addFailure(
        failures,
        "UNKNOWN_RESOURCE_ID",
        `${path}.resourceIds[${resourceIndex}]`,
        `Resource ID "${resourceId}" does not exist in the resource catalog.`
      );
    }
  });

  if (day.resourceIds.length !== day.resourceLinks.length) {
    addFailure(
      failures,
      "DAY_RESOURCE_COUNT_MISMATCH",
      `${path}.resourceLinks`,
      `Day ${day.dayNumber} has ${day.resourceIds.length} resource IDs and ${day.resourceLinks.length} embedded links.`
    );
  }

  day.resourceLinks.forEach((resourceLink, resourceIndex) => {
    if (seenLinkIds.has(resourceLink.id)) {
      addFailure(
        failures,
        "DAY_RESOURCE_LINK_DUPLICATE",
        `${path}.resourceLinks[${resourceIndex}].id`,
        `Resource link ID "${resourceLink.id}" is duplicated on Day ${day.dayNumber}.`
      );
    }
    seenLinkIds.add(resourceLink.id);

    if (day.resourceIds[resourceIndex] !== resourceLink.id) {
      addFailure(
        failures,
        "DAY_RESOURCE_ORDER_MISMATCH",
        `${path}.resourceLinks[${resourceIndex}].id`,
        `Embedded resource link "${resourceLink.id}" does not match the resource ID at the same position.`
      );
    }

    const catalogResource = catalog[resourceLink.id];
    if (catalogResource === undefined) {
      addFailure(
        failures,
        "UNKNOWN_RESOURCE_LINK_ID",
        `${path}.resourceLinks[${resourceIndex}].id`,
        `Embedded resource link ID "${resourceLink.id}" does not exist in the catalog.`
      );
    } else if (!sameResource(resourceLink, catalogResource)) {
      addFailure(
        failures,
        "RESOURCE_CATALOG_MISMATCH",
        `${path}.resourceLinks[${resourceIndex}]`,
        `Embedded resource "${resourceLink.id}" does not exactly match its catalog record.`
      );
    }
  });
}

function validateDayPrerequisites(
  day: CurriculumSeedDay,
  dayIndex: number,
  validDayNumbers: ReadonlySet<number>,
  failures: CurriculumPreflightFailure[]
): void {
  const seenPrerequisites = new Set<number>();

  day.prerequisiteDayNumbers.forEach((prerequisite, prerequisiteIndex) => {
    const path = `$.days[${dayIndex}].prerequisiteDayNumbers[${prerequisiteIndex}]`;

    if (seenPrerequisites.has(prerequisite)) {
      addFailure(
        failures,
        "PREREQUISITE_DUPLICATE",
        path,
        `Prerequisite Day ${prerequisite} is duplicated on Day ${day.dayNumber}.`
      );
    }
    seenPrerequisites.add(prerequisite);

    if (!validDayNumbers.has(prerequisite)) {
      addFailure(
        failures,
        "PREREQUISITE_UNKNOWN",
        path,
        `Prerequisite Day ${prerequisite} does not exist.`
      );
    }

    if (prerequisite >= day.dayNumber) {
      addFailure(
        failures,
        "PREREQUISITE_NOT_PAST",
        path,
        `Prerequisite Day ${prerequisite} must be earlier than Day ${day.dayNumber}.`
      );
    }
  });
}

function validateDays(
  blueprint: CurriculumBlueprint,
  failures: CurriculumPreflightFailure[]
): void {
  const { days, weeks, resourceCatalog } = blueprint;

  if (days.length !== EXPECTED_DAY_COUNT) {
    addFailure(
      failures,
      "DAY_COUNT",
      "$.days",
      `Expected ${EXPECTED_DAY_COUNT} days; received ${days.length}.`
    );
  }

  const validDayNumbers = new Set(days.map((day) => day.dayNumber));
  const seenDayNumbers = new Set<number>();
  const weeksByNumber = new Map(weeks.map((week) => [week.weekNumber, week]));

  days.forEach((day, index) => {
    const path = `$.days[${index}]`;
    const expectedDayNumber = index + 1;

    if (day.dayNumber !== expectedDayNumber) {
      addFailure(
        failures,
        "DAY_SEQUENCE",
        `${path}.dayNumber`,
        `Expected ordered Day ${expectedDayNumber}; received Day ${day.dayNumber}.`
      );
    }

    if (seenDayNumbers.has(day.dayNumber)) {
      addFailure(
        failures,
        "DAY_DUPLICATE",
        `${path}.dayNumber`,
        `Day number ${day.dayNumber} is duplicated.`
      );
    }
    seenDayNumbers.add(day.dayNumber);

    const coreMinutes = day.coreSchedule.reduce((sum, block) => sum + block.minutes, 0);
    if (coreMinutes !== EXPECTED_CORE_MINUTES) {
      addFailure(
        failures,
        "CORE_MINUTES",
        `${path}.coreSchedule`,
        `Day ${day.dayNumber} Core schedule totals ${coreMinutes}; expected ${EXPECTED_CORE_MINUTES}.`
      );
    }

    if (day.dayNumber <= 364) {
      const expectedWeekNumber = Math.ceil(day.dayNumber / 7);
      if (day.weekNumber !== expectedWeekNumber) {
        addFailure(
          failures,
          "DAY_WEEK_MAPPING",
          `${path}.weekNumber`,
          `Day ${day.dayNumber} must map to Week ${expectedWeekNumber}; received Week ${day.weekNumber}.`
        );
      }

      const cycleIndex = (day.dayNumber - 1) % 7;
      const expectedSchedule = EXPECTED_CYCLE_SCHEDULES[cycleIndex];
      const actualSchedule = day.coreSchedule.map((block) => block.minutes);
      if (expectedSchedule !== undefined && !sameNumbers(actualSchedule, expectedSchedule)) {
        addFailure(
          failures,
          "CORE_RHYTHM",
          `${path}.coreSchedule`,
          `Day ${day.dayNumber} does not use the required cycle-position Core schedule.`
        );
      }

      const expectedMode = EXPECTED_CYCLE_MODES[cycleIndex];
      if (expectedMode !== undefined && day.modeLabel !== expectedMode) {
        addFailure(
          failures,
          "MODE_RHYTHM",
          `${path}.modeLabel`,
          `Day ${day.dayNumber} must use mode "${expectedMode}".`
        );
      }

      const week = weeksByNumber.get(day.weekNumber);
      if (week === undefined) {
        addFailure(
          failures,
          "DAY_WEEK_UNKNOWN",
          `${path}.weekNumber`,
          `Day ${day.dayNumber} references missing Week ${day.weekNumber}.`
        );
      } else {
        if (day.monthNumber !== week.monthNumber) {
          addFailure(
            failures,
            "DAY_MONTH_MISMATCH",
            `${path}.monthNumber`,
            `Day ${day.dayNumber} month does not match Week ${week.weekNumber}.`
          );
        }
        if (day.phaseTitle !== week.phaseTitle) {
          addFailure(
            failures,
            "DAY_PHASE_MISMATCH",
            `${path}.phaseTitle`,
            `Day ${day.dayNumber} phase does not match Week ${week.weekNumber}.`
          );
        }
        if (day.weekTitle !== week.title) {
          addFailure(
            failures,
            "DAY_WEEK_TITLE_MISMATCH",
            `${path}.weekTitle`,
            `Day ${day.dayNumber} week title does not match Week ${week.weekNumber}.`
          );
        }
      }
    } else if (
      day.dayNumber !== 365 ||
      day.weekNumber !== 53 ||
      day.monthNumber !== 12 ||
      day.modeLabel !== "Final evidence day"
    ) {
      addFailure(
        failures,
        "FINAL_DAY",
        path,
        "Day 365 must be the Month 12, Week 53 final evidence day."
      );
    }

    validateDayResources(day, index, resourceCatalog, failures);
    validateDayPrerequisites(day, index, validDayNumbers, failures);
  });
}

function buildCounts(blueprint: CurriculumBlueprint): CurriculumPreflightCounts {
  const catalogResources = Object.values(blueprint.resourceCatalog);
  return {
    days: blueprint.days.length,
    weeks: blueprint.weeks.length,
    months: new Set(blueprint.days.map((day) => day.monthNumber)).size,
    catalogResources: catalogResources.length,
    uniqueCatalogUrls: new Set(catalogResources.map((resource) => resource.url)).size,
    resourceReferences: blueprint.days.reduce((sum, day) => sum + day.resourceLinks.length, 0),
    prerequisiteEdges: blueprint.days.reduce(
      (sum, day) => sum + day.prerequisiteDayNumbers.length,
      0
    )
  };
}

function buildKnownDisplayGaps(
  counts: CurriculumPreflightCounts
): readonly CurriculumKnownDisplayGap[] {
  return [
    {
      code: "DISPLAY_FIELDS_NOT_SOURCE_ENCODED",
      affectedRecords: counts.days,
      fields: DISPLAY_FIELDS,
      message:
        "The canonical blueprint is not display-ready; generated teaching fields and three typed knowledge checks are deferred."
    },
    {
      code: "RECOVERY_ESTIMATE_NOT_PER_DAY",
      affectedRecords: counts.days,
      fields: ["recoveryMinutes"],
      message:
        "The source declares a global five-minute Recovery maximum but has no per-day structured duration estimate."
    },
    {
      code: "RESOURCE_STATUS_NOT_SOURCE_ENCODED",
      affectedRecords: counts.catalogResources,
      fields: ["lastCheckedAt", "lastCheckedStatus"],
      message:
        "Catalog URLs are source data; bounded runtime link-check status is not encoded in the blueprint."
    }
  ];
}

function formatSchemaPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return "$";

  return path.reduce<string>((result, segment) => {
    if (typeof segment === "number") return `${result}[${segment}]`;
    if (typeof segment === "symbol") return `${result}[${String(segment)}]`;
    return `${result}.${segment}`;
  }, "$");
}

export async function inspectCurriculumSource(
  sourcePath: string
): Promise<CurriculumSourceInspection> {
  if (!isAbsolute(sourcePath)) {
    throw new TypeError("Curriculum source path must be explicit and absolute.");
  }

  const sourceFile = basename(sourcePath);
  let bytes: Buffer;
  try {
    bytes = await readFile(sourcePath);
  } catch {
    const failures = [
      {
        code: "SOURCE_READ",
        path: "$",
        message: "Curriculum source could not be read."
      }
    ];
    return {
      report: createReport({
        sourceFile,
        sourceBytes: 0,
        sourceSha256: null,
        counts: emptyCounts(),
        failures
      })
    };
  }

  const sourceSha256 = createHash("sha256").update(bytes).digest("hex");
  let decoded: unknown;
  try {
    decoded = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    const failures = [
      {
        code: "SOURCE_JSON",
        path: "$",
        message: "Curriculum source is not valid JSON."
      }
    ];
    return {
      report: createReport({
        sourceFile,
        sourceBytes: bytes.byteLength,
        sourceSha256,
        counts: emptyCounts(),
        failures
      })
    };
  }

  const parsed = curriculumBlueprintSchema.safeParse(decoded);
  if (!parsed.success) {
    const failures = parsed.error.issues.map((issue) => ({
      code: "SOURCE_SCHEMA",
      path: formatSchemaPath(issue.path),
      message: issue.message
    }));
    return {
      report: createReport({
        sourceFile,
        sourceBytes: bytes.byteLength,
        sourceSha256,
        counts: emptyCounts(),
        failures
      })
    };
  }

  const failures: CurriculumPreflightFailure[] = [];
  validateWeeks(parsed.data.weeks, failures);
  validateDays(parsed.data, failures);
  const counts = buildCounts(parsed.data);

  return {
    blueprint: parsed.data,
    report: createReport({
      sourceFile,
      sourceBytes: bytes.byteLength,
      sourceSha256,
      counts,
      failures,
      knownDisplayGaps: buildKnownDisplayGaps(counts)
    })
  };
}

export async function runCurriculumPreflight(
  sourcePath: string
): Promise<CurriculumPreflightReport> {
  return (await inspectCurriculumSource(sourcePath)).report;
}
