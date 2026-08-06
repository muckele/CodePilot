import {
  curriculumDayResponseSchema,
  type CurriculumBlueprint,
  type CurriculumDayResponse,
  type CurriculumSeedDay
} from "@codelift/contracts";

function lowerFirst(value: string): string {
  return value.length === 0 ? value : `${value[0]?.toLowerCase() ?? ""}${value.slice(1)}`;
}

function trimTerminalPunctuation(value: string): string {
  return value.trim().replace(/[.!?]+$/u, "");
}

function describeSkills(day: CurriculumSeedDay): string {
  return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(
    day.skillTags.slice(0, 3)
  );
}

function milestoneFor(blueprint: CurriculumBlueprint, day: CurriculumSeedDay): string | undefined {
  if (day.dayNumber === 365) {
    return "Public capstone release, mastery audit, and next 90-day plan";
  }
  return blueprint.weeks.find((week) => week.weekNumber === day.weekNumber)?.milestone;
}

export function enrichCurriculumDay(
  blueprint: CurriculumBlueprint,
  day: CurriculumSeedDay
): CurriculumDayResponse {
  const primarySkill = day.skillTags[0] ?? "software engineering";
  const skills = describeSkills(day);
  const buildAction = trimTerminalPunctuation(day.buildTask);
  const artifact = trimTerminalPunctuation(day.tinyArtifact);
  const principle = trimTerminalPunctuation(day.corePrinciple);
  const learningSeed = trimTerminalPunctuation(day.learningSeed);
  const weekContext = trimTerminalPunctuation(day.weekTitle);
  const learningObjective = `Build evidence for “${day.title}.” Complete “${buildAction},” then verify the result against the artifact “${artifact}.”`;
  const whyItMattersForAIEngineering = `AI-enabled products depend on ${skills}. Here, “${principle}” becomes concrete through the artifact “${artifact}.”`;
  const mentalModel = `Connect concept, action, and evidence: ${learningSeed}; then ${lowerFirst(buildAction)}; finally inspect the artifact “${artifact}.”`;
  const commonMistake = `During ${weekContext}, do not treat “${day.retrievalQuestion}” as answered until the artifact “${artifact}” demonstrates the result and you can relate it to “${principle}.”`;
  const applicationPrompt = `Apply ${primarySkill}: alter one constraint in “${buildAction}” and predict how the artifact “${artifact}” should expose the difference.`;
  const explanationPrompt = `Compare “${buildAction}” with a shortcut that ignores “${principle}.” Why would the artifact “${artifact}” reveal the tradeoff?`;
  const portfolioMilestone = milestoneFor(blueprint, day);

  return curriculumDayResponseSchema.parse({
    ...day,
    learningObjective,
    whyItMattersForAIEngineering,
    mentalModel,
    commonMistake,
    recoveryMinutes: 5,
    optionalStretchMinutes: 10,
    resourceLinks: day.resourceLinks.map((resource) => ({
      ...resource,
      topicHint: `Find the ${skills} material needed to ${lowerFirst(buildAction)}. Stop when the artifact is ready for inspection: “${artifact}.”`,
      lastCheckedStatus: "source_verified"
    })),
    knowledgeChecks: [
      {
        id: `day-${day.dayNumber}-recall`,
        kind: "recall",
        prompt: `Within ${weekContext}, ${lowerFirst(day.retrievalQuestion)} Ground the answer in “${principle}” and cite the artifact “${artifact}.”`,
        hint: `Start from the ${weekContext} evidence in the artifact “${artifact}” before reopening the resource.`,
        explanation: `For ${weekContext}, a complete answer connects “${day.retrievalQuestion}” to this principle: ${day.corePrinciple}`
      },
      {
        id: `day-${day.dayNumber}-application`,
        kind: "application",
        prompt: applicationPrompt,
        hint: `Use the action “${buildAction}” and inspect the artifact “${artifact}.”`,
        explanation: `For ${weekContext}, the altered constraint must produce a specific, testable difference in the artifact “${artifact}”; otherwise the prediction is not observable.`
      },
      {
        id: `day-${day.dayNumber}-explanation`,
        kind: "explanation",
        prompt: explanationPrompt,
        hint: `For ${weekContext}, use “${principle}” to compare the reliable path with the shortcut.`,
        explanation: `${mentalModel} Explain the tradeoff using the actual build evidence, without claiming that one choice is universally correct.`
      }
    ],
    teachBackPrompt: `Teach ${lowerFirst(day.title)} in three sentences: explain “${principle},” describe how you will ${lowerFirst(buildAction)}, and point to the artifact “${artifact}” as evidence.`,
    retrievalPrompts: [
      `For ${weekContext}, ${lowerFirst(day.retrievalQuestion)} Connect the answer to “${principle}.”`,
      `Which part of the artifact “${artifact}” proves that “${principle}” held during ${weekContext}?`,
      `How would the result change if you replaced “${buildAction}” with the shortcut described in the common mistake?`
    ],
    acceptableEvidenceTypes: [
      "commit_url",
      "test_name",
      "screenshot_url",
      "demo_url",
      "text_explanation",
      "local_artifact_path"
    ],
    ...(portfolioMilestone === undefined ? {} : { portfolioMilestone })
  });
}

export function enrichCurriculum(blueprint: CurriculumBlueprint): readonly CurriculumDayResponse[] {
  return blueprint.days.map((day) => enrichCurriculumDay(blueprint, day));
}
