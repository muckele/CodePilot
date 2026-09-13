import type { OnboardingProfile, ProgressMode, ProgressStatus } from "@codelift/contracts";
import { Schema, type Connection, type Model, type Types } from "mongoose";
import { createProductModels, type ProductModels } from "./product-models.js";

export interface UserRecord {
  email: string;
  passwordHash: string;
  profile: OnboardingProfile | null;
  onboardedAt: Date | null;
  schemaVersion: number;
  writeFence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionRecord {
  tokenHash: string;
  csrfHash: string;
  userId: Types.ObjectId | null;
  issuedAt: Date;
  lastSeenAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  expiresAt: Date;
  schemaVersion: number;
}

export interface InvitationRecord {
  tokenHash: string;
  purpose: "registration";
  email: string;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  consumedByUserId: Types.ObjectId | null;
  createdBy: string;
  createdAt: Date;
}

export interface PasswordResetRecord {
  tokenHash: string;
  purpose: "password_reset";
  userId: Types.ObjectId;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  createdBy: string;
  deliveryMethod?: "email" | "operator";
  sentAt?: Date | null;
  createdAt: Date;
}

export interface EmailLoginCodeRecord {
  userId: Types.ObjectId;
  purpose: "email_login";
  codeDigest: string;
  expiresAt: Date;
  sentAt: Date | null;
  consumedAt: Date | null;
  revokedAt: Date | null;
  failedAttempts: number;
  createdAt: Date;
}

export type PilotAggregateEvent =
  | "account_export_succeeded"
  | "account_deletion_succeeded"
  | "password_reset_requested"
  | "password_reset_email_sent"
  | "password_reset_email_failed"
  | "email_login_code_requested"
  | "email_login_code_email_sent"
  | "email_login_code_email_failed"
  | "email_login_code_succeeded"
  | "email_login_code_failed";

export interface PilotAggregateRecord {
  date: string;
  event: PilotAggregateEvent;
  count: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserActivityRecord {
  userId: Types.ObjectId;
  date: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvidenceRecord {
  _id: Types.ObjectId;
  kind:
    | "commit_url"
    | "test_name"
    | "screenshot_url"
    | "demo_url"
    | "text_explanation"
    | "local_artifact_path";
  label: string;
  value: string;
  idempotencyKey: string;
  createdAt: Date;
}

export interface TaskSubtaskRecord {
  id: string;
  title: string;
  estimateMinutes: number;
  actualMinutes: number;
  completed: boolean;
}

export interface ProgressRecord {
  userId: Types.ObjectId;
  dayNumber: number;
  status: ProgressStatus;
  selectedMode: ProgressMode | null;
  evidence: EvidenceRecord[];
  operationKeys: string[];
  version: number;
  startedAt: Date | null;
  completedAt: Date | null;
  statusReason: string | null;
  rescheduledFor: string | null;
  estimateMinutes: number;
  actualMinutes: number;
  timerSeconds: number;
  timerState: "paused" | "running";
  subtasks: TaskSubtaskRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReflectionRecord {
  userId: Types.ObjectId;
  dayNumber: number;
  confused: string;
  mentalModelChanged: string;
  retrieveLater: string;
  weeklySummary: string;
  monthlyRetrospective: string;
  operationKeys: string[];
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CodeLiftModels extends ProductModels {
  readonly User: Model<UserRecord>;
  readonly Session: Model<SessionRecord>;
  readonly Invitation: Model<InvitationRecord>;
  readonly PasswordReset: Model<PasswordResetRecord>;
  readonly EmailLoginCode: Model<EmailLoginCodeRecord>;
  readonly PilotAggregate: Model<PilotAggregateRecord>;
  readonly UserActivity: Model<UserActivityRecord>;
  readonly Progress: Model<ProgressRecord>;
  readonly Reflection: Model<ReflectionRecord>;
}

const onboardingProfileSchema = new Schema<OnboardingProfile>(
  {
    displayName: { type: String, required: true, minlength: 1, maxlength: 60 },
    timezone: { type: String, required: true, minlength: 1, maxlength: 100 },
    startDate: { type: String, required: true },
    commitmentMinutes: { type: Number, required: true, enum: [30] },
    preferredCodingTime: { type: String, required: true },
    routineCue: { type: String, required: true, minlength: 1, maxlength: 120 },
    codingPlace: { type: String, required: true, minlength: 1, maxlength: 120 },
    implementationIntention: { type: String, required: true, minlength: 1, maxlength: 300 },
    whyItMatters: { type: String, required: true, minlength: 1, maxlength: 500 },
    githubUsername: { type: String, required: false, default: "", maxlength: 39 },
    targetRoles: {
      type: [String],
      required: true,
      validate: {
        validator: (value: string[]) => value.length >= 1 && value.length <= 3,
        message: "Choose between one and three target roles."
      }
    },
    aiPrivacyMode: {
      type: String,
      required: true,
      enum: ["local_only", "ask_before_external"]
    },
    themePreference: {
      type: String,
      required: true,
      enum: ["system", "light", "dark"]
    },
    motionPreference: {
      type: String,
      required: true,
      enum: ["system", "reduced", "gentle"]
    },
    reviewPreference: {
      type: String,
      required: false,
      enum: ["before_mission", "after_mission"],
      default: "before_mission"
    }
  },
  {
    _id: false,
    strict: "throw"
  }
);

const userSchema = new Schema<UserRecord>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      maxlength: 254,
      index: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    profile: {
      type: onboardingProfileSchema,
      default: null
    },
    onboardedAt: {
      type: Date,
      default: null
    },
    schemaVersion: {
      type: Number,
      required: true,
      default: 1
    },
    writeFence: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    }
  },
  {
    timestamps: true,
    strict: "throw",
    optimisticConcurrency: true
  }
);

const sessionSchema = new Schema<SessionRecord>(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    csrfHash: {
      type: String,
      required: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    issuedAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    idleExpiresAt: { type: Date, required: true },
    absoluteExpiresAt: { type: Date, required: true },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }
    },
    schemaVersion: {
      type: Number,
      required: true,
      default: 1
    }
  },
  {
    strict: "throw",
    versionKey: false
  }
);

const invitationSchema = new Schema<InvitationRecord>(
  {
    tokenHash: { type: String, required: true, unique: true, index: true, select: false },
    purpose: { type: String, required: true, enum: ["registration"] },
    email: { type: String, required: true, maxlength: 254, index: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    consumedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    createdBy: { type: String, required: true, maxlength: 80 }
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", versionKey: false }
);
invitationSchema.index({ email: 1, expiresAt: 1 });
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const passwordResetSchema = new Schema<PasswordResetRecord>(
  {
    tokenHash: { type: String, required: true, unique: true, index: true, select: false },
    purpose: { type: String, required: true, enum: ["password_reset"] },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    createdBy: { type: String, required: true, maxlength: 80 },
    deliveryMethod: {
      type: String,
      required: false,
      enum: ["email", "operator"]
    },
    sentAt: { type: Date, required: false }
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", versionKey: false }
);
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

const emailLoginCodeSchema = new Schema<EmailLoginCodeRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    purpose: { type: String, required: true, enum: ["email_login"] },
    codeDigest: {
      type: String,
      required: true,
      match: /^[0-9a-f]{64}$/,
      select: false
    },
    expiresAt: { type: Date, required: true },
    sentAt: { type: Date, default: null },
    consumedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    failedAttempts: { type: Number, required: true, default: 0, min: 0, max: 5 }
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", versionKey: false }
);
emailLoginCodeSchema.index({ userId: 1, purpose: 1, createdAt: -1 });
emailLoginCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

const pilotAggregateSchema = new Schema<PilotAggregateRecord>(
  {
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    event: {
      type: String,
      required: true,
      enum: [
        "account_export_succeeded",
        "account_deletion_succeeded",
        "password_reset_requested",
        "password_reset_email_sent",
        "password_reset_email_failed",
        "email_login_code_requested",
        "email_login_code_email_sent",
        "email_login_code_email_failed",
        "email_login_code_succeeded",
        "email_login_code_failed"
      ]
    },
    count: { type: Number, required: true, min: 0 },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 400 * 24 * 60 * 60 * 1_000)
    }
  },
  { timestamps: true, strict: "throw", versionKey: false }
);
pilotAggregateSchema.index({ date: 1, event: 1 }, { unique: true });
pilotAggregateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const userActivitySchema = new Schema<UserActivityRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true }
  },
  { timestamps: true, strict: "throw", versionKey: false }
);
userActivitySchema.index({ userId: 1, date: 1 }, { unique: true });
userActivitySchema.index({ firstSeenAt: 1 });

const evidenceSchema = new Schema<EvidenceRecord>(
  {
    kind: {
      type: String,
      required: true,
      enum: [
        "commit_url",
        "test_name",
        "screenshot_url",
        "demo_url",
        "text_explanation",
        "local_artifact_path"
      ]
    },
    label: { type: String, required: true, minlength: 1, maxlength: 120 },
    value: { type: String, required: true, minlength: 1, maxlength: 2_000 },
    idempotencyKey: { type: String, required: true, minlength: 8, maxlength: 128 },
    createdAt: { type: Date, required: true }
  },
  {
    _id: true,
    strict: "throw",
    versionKey: false
  }
);

const progressSchema = new Schema<ProgressRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    dayNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 365
    },
    status: {
      type: String,
      required: true,
      enum: [
        "not_started",
        "opened",
        "in_progress",
        "core_completed",
        "recovery_completed",
        "intentionally_skipped",
        "rescheduled"
      ],
      default: "not_started"
    },
    selectedMode: {
      type: String,
      enum: ["core", "recovery", null],
      default: null
    },
    evidence: {
      type: [evidenceSchema],
      default: []
    },
    operationKeys: {
      type: [String],
      default: []
    },
    version: {
      type: Number,
      required: true,
      default: 0
    },
    startedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    statusReason: {
      type: String,
      default: null,
      maxlength: 500
    },
    rescheduledFor: {
      type: String,
      default: null
    },
    estimateMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 240,
      default: 30
    },
    actualMinutes: {
      type: Number,
      required: true,
      min: 0,
      max: 1_440,
      default: 0
    },
    timerSeconds: {
      type: Number,
      required: true,
      min: 0,
      max: 86_400,
      default: 0
    },
    timerState: {
      type: String,
      required: true,
      enum: ["paused", "running"],
      default: "paused"
    },
    subtasks: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            title: { type: String, required: true, maxlength: 160 },
            estimateMinutes: { type: Number, required: true, min: 1, max: 240 },
            actualMinutes: { type: Number, required: true, min: 0, max: 1_440 },
            completed: { type: Boolean, required: true }
          },
          { _id: false, strict: "throw", versionKey: false }
        )
      ],
      default: []
    }
  },
  {
    timestamps: true,
    strict: "throw",
    versionKey: false
  }
);
progressSchema.index({ userId: 1, dayNumber: 1 }, { unique: true });

const reflectionSchema = new Schema<ReflectionRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    dayNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 365
    },
    confused: { type: String, required: false, default: "", maxlength: 1_000 },
    mentalModelChanged: { type: String, required: false, default: "", maxlength: 1_000 },
    retrieveLater: { type: String, required: false, default: "", maxlength: 1_000 },
    weeklySummary: { type: String, required: false, default: "", maxlength: 2_000 },
    monthlyRetrospective: {
      type: String,
      required: false,
      default: "",
      maxlength: 4_000
    },
    operationKeys: {
      type: [String],
      default: []
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    strict: "throw",
    versionKey: false
  }
);
reflectionSchema.index({ userId: 1, dayNumber: 1 }, { unique: true });

export function createModels(connection: Connection): CodeLiftModels {
  return {
    ...createProductModels(connection),
    User: connection.model<UserRecord>("User", userSchema),
    Session: connection.model<SessionRecord>("Session", sessionSchema),
    Invitation: connection.model<InvitationRecord>("Invitation", invitationSchema),
    PasswordReset: connection.model<PasswordResetRecord>("PasswordReset", passwordResetSchema),
    EmailLoginCode: connection.model<EmailLoginCodeRecord>("EmailLoginCode", emailLoginCodeSchema),
    PilotAggregate: connection.model<PilotAggregateRecord>("PilotAggregate", pilotAggregateSchema),
    UserActivity: connection.model<UserActivityRecord>("UserActivity", userActivitySchema),
    Progress: connection.model<ProgressRecord>("ProgressLog", progressSchema),
    Reflection: connection.model<ReflectionRecord>("Reflection", reflectionSchema)
  };
}
