import type { CurriculumRuntime } from "../curriculum/runtime.js";
import type { CodeLiftModels } from "../persistence/models.js";
import { loadLocalEvalDataset } from "../ai/local-eval.js";

const achievementSeeds = [
  {
    key: "first-return",
    title: "First verified return",
    description: "Recorded the first evidence-backed curriculum return.",
    evidenceRule: "One terminal Core or Recovery progress record."
  },
  {
    key: "ten-core-missions",
    title: "Ten Core missions",
    description: "Completed ten 30-minute Core missions with evidence.",
    evidenceRule: "Ten distinct core_completed progress records."
  },
  {
    key: "evidence-debugger",
    title: "Evidence debugger",
    description: "Turned a fixed bug into a reusable Error Museum entry.",
    evidenceRule: "One complete ErrorMuseumEntry with a named test."
  }
] as const;

const featureFlagSeeds = [
  {
    key: "ai-kill-switch",
    enabled: false,
    description: "Disables all generative-provider execution while preserving mock guidance."
  },
  {
    key: "bounded-planner",
    enabled: true,
    description: "Enables approval-gated deterministic planning and the Month 11 agent mode."
  },
  {
    key: "external-ai",
    enabled: false,
    description: "Allows explicitly opted-in backend provider calls when configured."
  }
] as const;

export async function seedGlobalData(
  models: CodeLiftModels,
  curriculum: CurriculumRuntime
): Promise<void> {
  if (curriculum.status !== "ready") {
    throw new Error("Cannot seed product data without a validated curriculum.");
  }

  await models.CurriculumDay.bulkWrite(
    curriculum.days.map((day) => ({
      updateOne: {
        filter: { dayNumber: day.dayNumber },
        update: {
          $set: {
            sourceHash: curriculum.sourceSha256,
            version: 2,
            content: day
          }
        },
        upsert: true
      }
    })),
    { ordered: false }
  );

  await models.Resource.bulkWrite(
    Object.entries(curriculum.resources).map(([resourceId, resource]) => ({
      updateOne: {
        filter: { resourceId },
        update: {
          $set: {
            provider: resource.provider,
            title: resource.title,
            url: resource.url,
            type: resource.type,
            lastCheckedStatus: "source_verified"
          },
          $setOnInsert: {
            lastCheckedAt: null
          }
        },
        upsert: true
      }
    })),
    { ordered: false }
  );

  await models.Achievement.bulkWrite(
    achievementSeeds.map((achievement) => ({
      updateOne: {
        filter: { key: achievement.key },
        update: { $set: achievement },
        upsert: true
      }
    }))
  );

  await models.FeatureFlag.bulkWrite(
    featureFlagSeeds.map((flag) => ({
      updateOne: {
        filter: { key: flag.key },
        update: {
          $setOnInsert: {
            ...flag,
            updatedBy: "deterministic-seed"
          }
        },
        upsert: true
      }
    }))
  );

  const evalDataset = await loadLocalEvalDataset();
  await models.EvalDataset.updateOne(
    { version: evalDataset.dataset.version },
    {
      $set: {
        name: evalDataset.dataset.name,
        caseCount: evalDataset.dataset.cases.length,
        contentHash: evalDataset.hash,
        evaluatorVersion: evalDataset.dataset.evaluatorVersion
      }
    },
    { upsert: true }
  );
}

export async function validateSeededGlobalData(models: CodeLiftModels): Promise<{
  valid: boolean;
  counts: Record<string, number>;
  failures: string[];
}> {
  const [curriculumDays, resources, achievements, featureFlags, evalDatasets] = await Promise.all([
    models.CurriculumDay.countDocuments(),
    models.Resource.countDocuments(),
    models.Achievement.countDocuments(),
    models.FeatureFlag.countDocuments(),
    models.EvalDataset.countDocuments()
  ]);
  const failures: string[] = [];
  if (curriculumDays !== 365)
    failures.push(`Expected 365 CurriculumDay records; found ${curriculumDays}.`);
  if (resources < 88) failures.push(`Expected at least 88 Resource records; found ${resources}.`);
  if (achievements < achievementSeeds.length) failures.push("Achievement seed is incomplete.");
  if (featureFlags < featureFlagSeeds.length) failures.push("FeatureFlag seed is incomplete.");
  if (evalDatasets < 1) failures.push("EvalDataset seed is missing.");

  return {
    valid: failures.length === 0,
    counts: {
      curriculumDays,
      resources,
      achievements,
      featureFlags,
      evalDatasets
    },
    failures
  };
}
