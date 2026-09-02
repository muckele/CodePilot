import type {
  CurriculumDayResponse,
  EvalAssertionDefinition,
  EvalAssertionResult,
  EvalScalar,
  ProgressMode
} from "@codelift/contracts";
import { Schema, type Connection, type Model, type Types } from "mongoose";

import type { PlannerGraphState } from "../learning/planner-graph.js";

export interface CurriculumDayRecord {
  dayNumber: number;
  sourceHash: string;
  version: number;
  content: CurriculumDayResponse;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResourceRecord {
  resourceId: string;
  provider: string;
  title: string;
  url: string;
  type: string;
  lastCheckedStatus: "source_verified" | "reachable" | "unknown" | "unreachable";
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface XpEventRecord {
  userId: Types.ObjectId;
  dayNumber: number;
  amount: number;
  reason: string;
  idempotencyKey: string;
  createdAt: Date;
}

export interface AchievementRecord {
  key: string;
  title: string;
  description: string;
  evidenceRule: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserAchievementRecord {
  userId: Types.ObjectId;
  achievementKey: string;
  evidenceKey: string;
  awardedAt: Date;
}

export interface SkillEvidenceRecord {
  userId: Types.ObjectId;
  skill: string;
  dayNumber: number;
  mode: ProgressMode;
  state: "introduced" | "practiced" | "demonstrated";
  evidenceKey: string;
  createdAt: Date;
}

export interface ReviewItemRecord {
  userId: Types.ObjectId;
  sourceDayNumber: number;
  intervalDays: 1 | 3 | 7 | 14 | 30;
  dueDate: string;
  prompt: string;
  question: string;
  status: "due" | "completed" | "snoozed";
  closedNote: boolean;
  confidenceBefore: number | null;
  confidenceAfter: number | null;
  answer: string;
  operationKeys: string[];
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MisconceptionRecord {
  userId: Types.ObjectId;
  sourceDayNumber: number;
  reviewItemId: Types.ObjectId | null;
  text: string;
  corrected: boolean;
  correctedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ErrorMuseumEntryRecord {
  userId: Types.ObjectId;
  dayNumber: number | null;
  title: string;
  bug: string;
  hypothesis: string;
  evidence: string;
  fix: string;
  test: string;
  lesson: string;
  tags: string[];
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PortfolioArtifactRecord {
  userId: Types.ObjectId;
  artifactKey: string;
  title: string;
  monthNumber: number;
  status: "not_started" | "draft" | "evidence_ready" | "published";
  repositoryUrl: string | null;
  demoUrl: string | null;
  screenshotUrls: string[];
  skillsProven: string[];
  testsAndEvals: string[];
  tradeoffs: string[];
  limitations: string[];
  interviewQuestions: string[];
  evidenceLinks: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AiTraceRecord {
  userId: Types.ObjectId;
  feature: string;
  provider: string;
  outcome: "success" | "fallback" | "abstained" | "refused" | "error";
  promptVersion: string;
  latencyMs: number;
  estimatedCostUsd: number;
  inputHash: string;
  citationCount: number;
  metadata: Record<string, string | number | boolean>;
  createdAt: Date;
}

export interface EvalDatasetRecord {
  version: string;
  name: string;
  caseCount: number;
  contentHash: string;
  evaluatorVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvalCaseResultRecord {
  caseId: string;
  category: string;
  critical: boolean;
  scenarioKind: string;
  input: Record<string, unknown>;
  expectedBehavior: string;
  expectedAssertions: EvalAssertionDefinition[];
  observed: Record<string, EvalScalar>;
  assertions: EvalAssertionResult[];
  passed: boolean;
  detail: string;
  latencyMs: number;
  estimatedCostUsd: number;
}

export interface EvalRunRecord {
  userId: Types.ObjectId;
  datasetVersion: string;
  datasetHash: string;
  evaluatorVersion: string;
  providerConfig: {
    provider: string;
    model: string;
    promptVersion: string;
    sampling: string;
    externalCallsAllowed: boolean;
    fixtureProfile: string;
    datasetHashAlgorithm: "sha256";
    redactionPolicy: "synthetic-fixtures-only";
  };
  passed: boolean;
  score: number;
  passingScore: number;
  criticalFailures: string[];
  negativeControlsPassed: boolean;
  durationMs: number;
  estimatedCostUsd: number;
  cases: EvalCaseResultRecord[];
  createdAt: Date;
}

export interface IndexedChunkRecord {
  chunkId: string;
  text: string;
  ordinal: number;
  contentHash: string;
  embedding: number[];
}

export interface IndexedSourceRecord {
  userId: Types.ObjectId;
  title: string;
  dayNumber: number | null;
  content: string;
  contentHash: string;
  version: number;
  chunks: IndexedChunkRecord[];
  operationKeys: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PlannerActionRecord {
  actionId: string;
  date: string;
  dayNumber: number;
  mode: ProgressMode;
  minutes: number;
  rationale: string;
}

export interface PlannerDecisionClaimRecord {
  idempotencyKey: string;
  action: "approve" | "revise";
  note: string;
  ownerId: string;
  checkpointId: string | null;
  leasedAt: Date;
  leaseExpiresAt: Date;
}

export interface AgentRunRecord {
  userId: Types.ObjectId;
  graphVersion: "planner-graph-v1";
  graphState: PlannerGraphState;
  mode: "deterministic_workflow" | "bounded_agent";
  status: "running" | "awaiting_approval" | "approved" | "revision_requested" | "cancelled";
  actions: PlannerActionRecord[];
  budget: {
    maxSteps: number;
    stepsUsed: number;
    maxTokens: number;
    tokensUsed: number;
    maxCostUsd: number;
    estimatedCostUsd: number;
    maxWallTimeMs: number;
    wallTimeMs: number;
  };
  terminalReason:
    | "running"
    | "awaiting_human_approval"
    | "approved_by_human"
    | "revision_requested"
    | "budget_exhausted"
    | "cancelled";
  trace: string[];
  operationKeys: string[];
  decisionClaim: PlannerDecisionClaimRecord | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobApplicationRecord {
  userId: Types.ObjectId;
  company: string;
  role: string;
  status: string;
  evidenceLinks: string[];
  nextAction: string;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureFlagRecord {
  key: string;
  enabled: boolean;
  description: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductModels {
  readonly CurriculumDay: Model<CurriculumDayRecord>;
  readonly Resource: Model<ResourceRecord>;
  readonly XpEvent: Model<XpEventRecord>;
  readonly Achievement: Model<AchievementRecord>;
  readonly UserAchievement: Model<UserAchievementRecord>;
  readonly SkillEvidence: Model<SkillEvidenceRecord>;
  readonly ReviewItem: Model<ReviewItemRecord>;
  readonly Misconception: Model<MisconceptionRecord>;
  readonly ErrorMuseumEntry: Model<ErrorMuseumEntryRecord>;
  readonly PortfolioArtifact: Model<PortfolioArtifactRecord>;
  readonly AiTrace: Model<AiTraceRecord>;
  readonly EvalDataset: Model<EvalDatasetRecord>;
  readonly EvalRun: Model<EvalRunRecord>;
  readonly IndexedSource: Model<IndexedSourceRecord>;
  readonly AgentRun: Model<AgentRunRecord>;
  readonly JobApplication: Model<JobApplicationRecord>;
  readonly FeatureFlag: Model<FeatureFlagRecord>;
}

const curriculumDaySchema = new Schema<CurriculumDayRecord>(
  {
    dayNumber: { type: Number, required: true, min: 1, max: 365, unique: true },
    sourceHash: { type: String, required: true, minlength: 64, maxlength: 64 },
    version: { type: Number, required: true, min: 1 },
    content: { type: Schema.Types.Mixed, required: true }
  },
  { timestamps: true, strict: "throw", versionKey: false }
);

const resourceSchema = new Schema<ResourceRecord>(
  {
    resourceId: { type: String, required: true, unique: true },
    provider: { type: String, required: true },
    title: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, required: true },
    lastCheckedStatus: {
      type: String,
      required: true,
      enum: ["source_verified", "reachable", "unknown", "unreachable"]
    },
    lastCheckedAt: { type: Date, default: null }
  },
  { timestamps: true, strict: "throw", versionKey: false }
);

const xpEventSchema = new Schema<XpEventRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    dayNumber: { type: Number, required: true, min: 1, max: 365 },
    amount: { type: Number, required: true, min: 0, max: 100 },
    reason: { type: String, required: true },
    idempotencyKey: { type: String, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", versionKey: false }
);
xpEventSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });

const achievementSchema = new Schema<AchievementRecord>(
  {
    key: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    evidenceRule: { type: String, required: true }
  },
  { timestamps: true, strict: "throw", versionKey: false }
);

const userAchievementSchema = new Schema<UserAchievementRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    achievementKey: { type: String, required: true },
    evidenceKey: { type: String, required: true },
    awardedAt: { type: Date, required: true }
  },
  { strict: "throw", versionKey: false }
);
userAchievementSchema.index({ userId: 1, achievementKey: 1 }, { unique: true });

const skillEvidenceSchema = new Schema<SkillEvidenceRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    skill: { type: String, required: true },
    dayNumber: { type: Number, required: true, min: 1, max: 365 },
    mode: { type: String, required: true, enum: ["core", "recovery"] },
    state: {
      type: String,
      required: true,
      enum: ["introduced", "practiced", "demonstrated"]
    },
    evidenceKey: { type: String, required: true },
    createdAt: { type: Date, required: true }
  },
  { strict: "throw", versionKey: false }
);
skillEvidenceSchema.index({ userId: 1, evidenceKey: 1 }, { unique: true });

const reviewItemSchema = new Schema<ReviewItemRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    sourceDayNumber: { type: Number, required: true, min: 1, max: 365 },
    intervalDays: { type: Number, required: true, enum: [1, 3, 7, 14, 30] },
    dueDate: { type: String, required: true, index: true },
    prompt: { type: String, required: true },
    question: { type: String, required: true },
    status: { type: String, required: true, enum: ["due", "completed", "snoozed"] },
    closedNote: { type: Boolean, required: true, default: true },
    confidenceBefore: { type: Number, default: null, min: 1, max: 5 },
    confidenceAfter: { type: Number, default: null, min: 1, max: 5 },
    answer: { type: String, required: true, default: "", maxlength: 2_000 },
    operationKeys: { type: [String], default: [] },
    completedAt: { type: Date, default: null }
  },
  { timestamps: true, strict: "throw", versionKey: false }
);
reviewItemSchema.index({ userId: 1, sourceDayNumber: 1, intervalDays: 1 }, { unique: true });

const misconceptionSchema = new Schema<MisconceptionRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    sourceDayNumber: { type: Number, required: true, min: 1, max: 365 },
    reviewItemId: { type: Schema.Types.ObjectId, default: null },
    text: { type: String, required: true, maxlength: 500 },
    corrected: { type: Boolean, required: true, default: false },
    correctedAt: { type: Date, default: null }
  },
  { timestamps: true, strict: "throw", versionKey: false }
);

const errorMuseumEntrySchema = new Schema<ErrorMuseumEntryRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    dayNumber: { type: Number, default: null, min: 1, max: 365 },
    title: { type: String, required: true, maxlength: 120 },
    bug: { type: String, required: true, maxlength: 2_000 },
    hypothesis: { type: String, required: true, maxlength: 2_000 },
    evidence: { type: String, required: true, maxlength: 2_000 },
    fix: { type: String, required: true, maxlength: 2_000 },
    test: { type: String, required: true, maxlength: 2_000 },
    lesson: { type: String, required: true, maxlength: 2_000 },
    tags: { type: [String], default: [] },
    idempotencyKey: { type: String, required: true }
  },
  { timestamps: true, strict: "throw", versionKey: false }
);
errorMuseumEntrySchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });

const portfolioArtifactSchema = new Schema<PortfolioArtifactRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    artifactKey: { type: String, required: true },
    title: { type: String, required: true },
    monthNumber: { type: Number, required: true, min: 1, max: 12 },
    status: {
      type: String,
      required: true,
      enum: ["not_started", "draft", "evidence_ready", "published"]
    },
    repositoryUrl: { type: String, default: null },
    demoUrl: { type: String, default: null },
    screenshotUrls: { type: [String], default: [] },
    skillsProven: { type: [String], default: [] },
    testsAndEvals: { type: [String], default: [] },
    tradeoffs: { type: [String], default: [] },
    limitations: { type: [String], default: [] },
    interviewQuestions: { type: [String], default: [] },
    evidenceLinks: { type: [String], default: [] }
  },
  { timestamps: true, strict: "throw", versionKey: false }
);
portfolioArtifactSchema.index({ userId: 1, artifactKey: 1 }, { unique: true });

const aiTraceSchema = new Schema<AiTraceRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    feature: { type: String, required: true },
    provider: { type: String, required: true },
    outcome: {
      type: String,
      required: true,
      enum: ["success", "fallback", "abstained", "refused", "error"]
    },
    promptVersion: { type: String, required: true },
    latencyMs: { type: Number, required: true, min: 0 },
    estimatedCostUsd: { type: Number, required: true, min: 0 },
    inputHash: { type: String, required: true, minlength: 64, maxlength: 64 },
    citationCount: { type: Number, required: true, min: 0 },
    metadata: { type: Schema.Types.Mixed, required: true, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", versionKey: false }
);
aiTraceSchema.index({ userId: 1, createdAt: -1 });

const evalDatasetSchema = new Schema<EvalDatasetRecord>(
  {
    version: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    caseCount: { type: Number, required: true, min: 1 },
    contentHash: { type: String, required: true, minlength: 64, maxlength: 64 },
    evaluatorVersion: { type: String, required: true }
  },
  { timestamps: true, strict: "throw", versionKey: false }
);

const evalAssertionDefinitionSchema = new Schema<EvalAssertionDefinition>(
  {
    assertionId: { type: String, required: true },
    field: { type: String, required: true },
    operator: {
      type: String,
      required: true,
      enum: [
        "equals",
        "not_equals",
        "contains",
        "not_contains",
        "includes",
        "not_includes",
        "gte",
        "lte",
        "unique"
      ]
    },
    // Mixed's built-in `required` validator rejects null even though null is a
    // valid EvalScalar. A default preserves an explicitly observed null (for
    // example, when execution fails before producing an asserted field) so the
    // failing run remains persistable evidence.
    expected: { type: Schema.Types.Mixed, default: null }
  },
  { _id: false, strict: "throw", versionKey: false }
);

const evalAssertionResultSchema = new Schema<EvalAssertionResult>(
  {
    assertionId: { type: String, required: true },
    field: { type: String, required: true },
    operator: {
      type: String,
      required: true,
      enum: [
        "equals",
        "not_equals",
        "contains",
        "not_contains",
        "includes",
        "not_includes",
        "gte",
        "lte",
        "unique"
      ]
    },
    expected: { type: Schema.Types.Mixed, default: null },
    actual: { type: Schema.Types.Mixed, default: null },
    passed: { type: Boolean, required: true },
    detail: { type: String, required: true }
  },
  { _id: false, strict: "throw", versionKey: false }
);

const evalCaseResultSchema = new Schema<EvalCaseResultRecord>(
  {
    caseId: { type: String, required: true },
    category: { type: String, required: true },
    critical: { type: Boolean, required: true },
    scenarioKind: {
      type: String,
      required: true,
      enum: ["coach", "rag", "tool_guard", "planner", "output_safety"]
    },
    input: { type: Schema.Types.Mixed, required: true },
    expectedBehavior: { type: String, required: true },
    expectedAssertions: { type: [evalAssertionDefinitionSchema], required: true },
    observed: { type: Schema.Types.Mixed, required: true },
    assertions: { type: [evalAssertionResultSchema], required: true },
    passed: { type: Boolean, required: true },
    detail: { type: String, required: true },
    latencyMs: { type: Number, required: true, min: 0 },
    estimatedCostUsd: { type: Number, required: true, min: 0 }
  },
  { _id: false, strict: "throw", versionKey: false }
);

const evalRunSchema = new Schema<EvalRunRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    datasetVersion: { type: String, required: true },
    datasetHash: { type: String, required: true, minlength: 64, maxlength: 64 },
    evaluatorVersion: { type: String, required: true },
    providerConfig: {
      provider: { type: String, required: true },
      model: { type: String, required: true },
      promptVersion: { type: String, required: true },
      sampling: { type: String, required: true },
      externalCallsAllowed: { type: Boolean, required: true },
      fixtureProfile: { type: String, required: true },
      datasetHashAlgorithm: { type: String, required: true, enum: ["sha256"] },
      redactionPolicy: {
        type: String,
        required: true,
        enum: ["synthetic-fixtures-only"]
      }
    },
    passed: { type: Boolean, required: true },
    score: { type: Number, required: true, min: 0, max: 1 },
    passingScore: { type: Number, required: true, min: 0, max: 1 },
    criticalFailures: { type: [String], required: true, default: [] },
    negativeControlsPassed: { type: Boolean, required: true },
    durationMs: { type: Number, required: true, min: 0 },
    estimatedCostUsd: { type: Number, required: true, min: 0 },
    cases: { type: [evalCaseResultSchema], required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", versionKey: false }
);

const indexedChunkSchema = new Schema<IndexedChunkRecord>(
  {
    chunkId: { type: String, required: true },
    text: { type: String, required: true, maxlength: 4_000 },
    ordinal: { type: Number, required: true, min: 0 },
    contentHash: { type: String, required: true, minlength: 64, maxlength: 64 },
    embedding: { type: [Number], required: true }
  },
  { _id: false, strict: "throw", versionKey: false }
);

const indexedSourceSchema = new Schema<IndexedSourceRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true, maxlength: 120 },
    dayNumber: { type: Number, default: null, min: 1, max: 365 },
    content: { type: String, required: true, maxlength: 20_000 },
    contentHash: { type: String, required: true, minlength: 64, maxlength: 64 },
    version: { type: Number, required: true, min: 1 },
    chunks: { type: [indexedChunkSchema], required: true },
    operationKeys: { type: [String], default: [] }
  },
  { timestamps: true, strict: "throw", versionKey: false }
);
indexedSourceSchema.index({ userId: 1, contentHash: 1 });

const plannerActionSchema = new Schema<PlannerActionRecord>(
  {
    actionId: { type: String, required: true },
    date: { type: String, required: true },
    dayNumber: { type: Number, required: true, min: 1, max: 365 },
    mode: { type: String, required: true, enum: ["core", "recovery"] },
    minutes: { type: Number, required: true, min: 5, max: 40 },
    rationale: { type: String, required: true }
  },
  { _id: false, strict: "throw", versionKey: false }
);

const plannerDecisionClaimSchema = new Schema<PlannerDecisionClaimRecord>(
  {
    idempotencyKey: { type: String, required: true, minlength: 8, maxlength: 128 },
    action: { type: String, required: true, enum: ["approve", "revise"] },
    note: { type: String, default: "", maxlength: 500 },
    ownerId: { type: String, required: true, match: /^[a-f0-9]{24}$/u },
    checkpointId: { type: String, default: null, maxlength: 240 },
    leasedAt: { type: Date, required: true },
    leaseExpiresAt: { type: Date, required: true }
  },
  { _id: false, strict: "throw", versionKey: false }
);

const agentRunSchema = new Schema<AgentRunRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    graphVersion: { type: String, required: true, enum: ["planner-graph-v1"] },
    graphState: { type: Schema.Types.Mixed, required: true },
    mode: {
      type: String,
      required: true,
      enum: ["deterministic_workflow", "bounded_agent"]
    },
    status: {
      type: String,
      required: true,
      enum: ["running", "awaiting_approval", "approved", "revision_requested", "cancelled"]
    },
    actions: { type: [plannerActionSchema], required: true },
    budget: {
      maxSteps: { type: Number, required: true },
      stepsUsed: { type: Number, required: true },
      maxTokens: { type: Number, required: true },
      tokensUsed: { type: Number, required: true },
      maxCostUsd: { type: Number, required: true },
      estimatedCostUsd: { type: Number, required: true },
      maxWallTimeMs: { type: Number, required: true },
      wallTimeMs: { type: Number, required: true }
    },
    terminalReason: {
      type: String,
      required: true,
      enum: [
        "running",
        "awaiting_human_approval",
        "approved_by_human",
        "revision_requested",
        "budget_exhausted",
        "cancelled"
      ]
    },
    trace: { type: [String], required: true },
    operationKeys: { type: [String], default: [] },
    decisionClaim: {
      type: plannerDecisionClaimSchema,
      default: null,
      select: false
    },
    approvedAt: { type: Date, default: null }
  },
  { timestamps: true, strict: "throw", versionKey: false }
);

const jobApplicationSchema = new Schema<JobApplicationRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    company: { type: String, required: true },
    role: { type: String, required: true },
    status: { type: String, required: true },
    evidenceLinks: { type: [String], default: [] },
    nextAction: { type: String, required: true },
    idempotencyKey: { type: String, required: true }
  },
  { timestamps: true, strict: "throw", versionKey: false }
);
jobApplicationSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });

const featureFlagSchema = new Schema<FeatureFlagRecord>(
  {
    key: { type: String, required: true, unique: true },
    enabled: { type: Boolean, required: true },
    description: { type: String, required: true },
    updatedBy: { type: String, required: true }
  },
  { timestamps: true, strict: "throw", versionKey: false }
);

export function createProductModels(connection: Connection): ProductModels {
  return {
    CurriculumDay: connection.model<CurriculumDayRecord>("CurriculumDay", curriculumDaySchema),
    Resource: connection.model<ResourceRecord>("Resource", resourceSchema),
    XpEvent: connection.model<XpEventRecord>("XpEvent", xpEventSchema),
    Achievement: connection.model<AchievementRecord>("Achievement", achievementSchema),
    UserAchievement: connection.model<UserAchievementRecord>(
      "UserAchievement",
      userAchievementSchema
    ),
    SkillEvidence: connection.model<SkillEvidenceRecord>("SkillEvidence", skillEvidenceSchema),
    ReviewItem: connection.model<ReviewItemRecord>("ReviewItem", reviewItemSchema),
    Misconception: connection.model<MisconceptionRecord>("Misconception", misconceptionSchema),
    ErrorMuseumEntry: connection.model<ErrorMuseumEntryRecord>(
      "ErrorMuseumEntry",
      errorMuseumEntrySchema
    ),
    PortfolioArtifact: connection.model<PortfolioArtifactRecord>(
      "PortfolioArtifact",
      portfolioArtifactSchema
    ),
    AiTrace: connection.model<AiTraceRecord>("AiTrace", aiTraceSchema),
    EvalDataset: connection.model<EvalDatasetRecord>("EvalDataset", evalDatasetSchema),
    EvalRun: connection.model<EvalRunRecord>("EvalRun", evalRunSchema),
    IndexedSource: connection.model<IndexedSourceRecord>("IndexedSource", indexedSourceSchema),
    AgentRun: connection.model<AgentRunRecord>("AgentRun", agentRunSchema),
    JobApplication: connection.model<JobApplicationRecord>("JobApplication", jobApplicationSchema),
    FeatureFlag: connection.model<FeatureFlagRecord>("FeatureFlag", featureFlagSchema)
  };
}
