import { createHash } from "node:crypto";

import type { CatchUpPlanResponse, PlannerRequest, ProgressMode } from "@codelift/contracts";

const DAY_MS = 86_400_000;
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const;

function utcDate(localDate: string): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new TypeError("Expected an ISO local date.");
  }
  return new Date(Date.UTC(year, month - 1, day));
}

export function addLocalDays(localDate: string, days: number): string {
  const date = utcDate(localDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function differenceInLocalDays(later: string, earlier: string): number {
  return Math.round((utcDate(later).getTime() - utcDate(earlier).getTime()) / DAY_MS);
}

export function reviewDueDates(completedDate: string): readonly {
  intervalDays: (typeof REVIEW_INTERVALS)[number];
  dueDate: string;
}[] {
  return REVIEW_INTERVALS.map((intervalDays) => ({
    intervalDays,
    dueDate: addLocalDays(completedDate, intervalDays)
  }));
}

export function xpForCompletion(mode: ProgressMode): number {
  return mode === "core" ? 30 : 5;
}

export function calculateStreaks(
  returnDates: readonly string[],
  today: string,
  graceTokensAvailable = 0
): {
  currentStreak: number;
  longestStreak: number;
  rolling7DayReturns: number;
  rolling30DayReturns: number;
  graceTokensRemaining: number;
} {
  const uniqueDates = [...new Set(returnDates)].sort();
  let longestStreak = 0;
  let currentRun = 0;
  let previous: string | null = null;
  let longestRunGraceUsed = 0;

  for (const date of uniqueDates) {
    const gap = previous === null ? null : differenceInLocalDays(date, previous);
    if (gap === 1) {
      currentRun += 1;
    } else if (gap === 2 && longestRunGraceUsed < graceTokensAvailable) {
      currentRun += 1;
      longestRunGraceUsed += 1;
    } else {
      currentRun = 1;
      longestRunGraceUsed = 0;
    }
    longestStreak = Math.max(longestStreak, currentRun);
    previous = date;
  }

  const recent = new Set(uniqueDates);
  let currentStreak = 0;
  let cursor = today;
  if (!recent.has(cursor) && recent.has(addLocalDays(cursor, -1))) {
    cursor = addLocalDays(cursor, -1);
  }
  let currentGraceUsed = 0;
  while (recent.has(cursor)) {
    currentStreak += 1;
    cursor = addLocalDays(cursor, -1);
    if (
      !recent.has(cursor) &&
      currentGraceUsed < graceTokensAvailable &&
      recent.has(addLocalDays(cursor, -1))
    ) {
      currentGraceUsed += 1;
      cursor = addLocalDays(cursor, -1);
    }
  }

  const rolling7DayReturns = uniqueDates.filter((date) => {
    const gap = differenceInLocalDays(today, date);
    return gap >= 0 && gap < 7;
  }).length;
  const rolling30DayReturns = uniqueDates.filter((date) => {
    const gap = differenceInLocalDays(today, date);
    return gap >= 0 && gap < 30;
  }).length;

  return {
    currentStreak,
    longestStreak,
    rolling7DayReturns,
    rolling30DayReturns,
    graceTokensRemaining: Math.max(0, graceTokensAvailable - currentGraceUsed)
  };
}

export function skillStateForCompletion(
  mode: ProgressMode,
  hasPortfolioMilestone: boolean
): "introduced" | "practiced" | "demonstrated" {
  if (mode === "recovery") return "introduced";
  return hasPortfolioMilestone ? "demonstrated" : "practiced";
}

export function roadmapPreviewDayNumbers(currentDayNumber: number): readonly number[] {
  const previewLength = Math.min(7, 366 - currentDayNumber);
  return Array.from({ length: previewLength }, (_, index) => currentDayNumber + index);
}

export function buildCatchUpPlan(input: {
  strategy: "continue" | "calendar_catch_up" | "intentionally_skip";
  currentDayNumber: number;
  today: string;
  missedDays: number;
}): CatchUpPlanResponse {
  if (input.strategy === "continue") {
    return {
      strategy: "continue",
      explanation:
        "Continue from the next incomplete curriculum day. A calendar gap does not erase or duplicate learning.",
      maxCoreMissionsPerDay: 1,
      items: [
        {
          dayNumber: input.currentDayNumber,
          scheduledDate: input.today,
          mode: "core",
          reason: "The next incomplete mission remains the default."
        }
      ]
    };
  }

  if (input.strategy === "intentionally_skip") {
    return {
      strategy: "intentionally_skip",
      explanation:
        "The selected day can be intentionally skipped only with a written reason. It is never recorded as Core or Recovery.",
      maxCoreMissionsPerDay: 1,
      items: [
        {
          dayNumber: Math.min(365, input.currentDayNumber + 1),
          scheduledDate: input.today,
          mode: "core",
          reason: "Continue with the next curriculum day after the explicit skip."
        }
      ]
    };
  }

  const itemCount = Math.min(7, Math.max(1, input.missedDays + 1));
  return {
    strategy: "calendar_catch_up",
    explanation:
      "The catch-up plan spaces at most one Core mission per day. Recovery remains an honest alternative, never a converted Core completion.",
    maxCoreMissionsPerDay: 1,
    items: Array.from({ length: itemCount }, (_, index) => ({
      dayNumber: Math.min(365, input.currentDayNumber + index),
      scheduledDate: addLocalDays(input.today, index),
      mode: "core" as const,
      reason:
        index === 0
          ? "Resume the next incomplete day."
          : "One Core mission on the next available day."
    }))
  };
}

function normalizedTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

const retrievalStopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "do",
  "does",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with"
]);

function meaningfulRetrievalTokens(value: string): string[] {
  return normalizedTokens(value).filter((token) => !retrievalStopWords.has(token));
}

export function deterministicEmbedding(value: string, dimensions = 64): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (const token of normalizedTokens(value)) {
    const digest = createHash("sha256").update(token).digest();
    const index = digest.readUInt16BE(0) % dimensions;
    const sign = digest[2] === undefined || digest[2] % 2 === 0 ? 1 : -1;
    vector[index] = (vector[index] ?? 0) + sign;
  }
  const norm = Math.sqrt(vector.reduce((total, number) => total + number * number, 0));
  return norm === 0 ? vector : vector.map((number) => number / norm);
}

export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  const size = Math.min(left.length, right.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < size; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return Math.max(0, Math.min(1, dot / Math.sqrt(leftNorm * rightNorm)));
}

export function lexicalSimilarity(question: string, text: string): number {
  const query = new Set(meaningfulRetrievalTokens(question));
  const candidate = new Set(meaningfulRetrievalTokens(text));
  if (query.size === 0 || candidate.size === 0) return 0;
  let overlap = 0;
  for (const token of query) {
    if (candidate.has(token)) overlap += 1;
  }
  return overlap / query.size;
}

export function scoreRagRelevance(input: {
  question: string;
  text: string;
  queryEmbedding: readonly number[];
  textEmbedding: readonly number[];
}): {
  lexical: number;
  semantic: number;
  score: number;
  supported: boolean;
} {
  const lexical = lexicalSimilarity(input.question, input.text);
  const semantic = cosineSimilarity(input.queryEmbedding, input.textEmbedding);
  const score = Math.min(1, lexical * 0.7 + semantic * 0.3);
  return {
    lexical,
    semantic,
    score,
    supported: lexical > 0 && score >= 0.2
  };
}

export function chunkText(
  content: string,
  maxCharacters = 700
): readonly {
  chunkId: string;
  text: string;
  ordinal: number;
  contentHash: string;
  embedding: number[];
}[] {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current.length > 0 && current.length + paragraph.length + 2 > maxCharacters) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current.length === 0 ? paragraph : `${current}\n\n${paragraph}`;
    }
  }
  if (current.length > 0) chunks.push(current);
  if (chunks.length === 0) chunks.push(content.trim());

  return chunks.map((text, ordinal) => {
    const contentHash = createHash("sha256").update(text).digest("hex");
    return {
      chunkId: `chunk-${ordinal}-${contentHash.slice(0, 12)}`,
      text,
      ordinal,
      contentHash,
      embedding: deterministicEmbedding(text)
    };
  });
}

export function buildPlannerActions(input: {
  request: PlannerRequest;
  currentDayNumber: number;
}): readonly {
  actionId: string;
  date: string;
  dayNumber: number;
  mode: ProgressMode;
  minutes: number;
  rationale: string;
}[] {
  const maxCoreDays = Math.min(7, Math.max(1, Math.floor(input.request.availableMinutes / 30)));
  return Array.from({ length: maxCoreDays }, (_, index) => {
    const dayNumber = Math.min(365, input.currentDayNumber + index);
    return {
      actionId: `plan-${dayNumber}-${index}`,
      date: addLocalDays(input.request.weekStart, index),
      dayNumber,
      mode: "core" as const,
      minutes: 30,
      rationale:
        index === 0
          ? "Start with the next incomplete dependency-aware mission."
          : "Keep the plan to one Core mission per day and preserve room for review."
    };
  });
}
