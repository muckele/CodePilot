import { initializeAccountRuntime, type AccountRuntime } from "./account/router.js";
import { createResendTransactionalEmailProvider } from "./account/resend-email.js";
import {
  DisabledTransactionalEmailProvider,
  FakeTransactionalEmailProvider,
  type TransactionalEmailProvider
} from "./account/transactional-email.js";
import { createApp } from "./app.js";
import type { ApiConfig } from "./config.js";
import { initializeCurriculum, type CurriculumRuntime } from "./curriculum/runtime.js";
import type { StructuredRequestLogger } from "./middleware/request-context.js";
import {
  closePersistence,
  initializePersistence,
  type PersistenceRuntime
} from "./persistence/runtime.js";
import { seedGlobalData } from "./seed/global-seed.js";

export interface BootstrapApiOptions {
  readonly config: ApiConfig;
  readonly logger?: StructuredRequestLogger;
}

export interface BootstrappedApi {
  readonly app: ReturnType<typeof createApp>;
  readonly curriculum: CurriculumRuntime;
  readonly persistence: PersistenceRuntime;
  readonly account: AccountRuntime;
  close(): Promise<void>;
}

function createTransactionalEmailProvider(
  config: ApiConfig["email"],
  nodeEnv: ApiConfig["nodeEnv"]
): TransactionalEmailProvider {
  if (config.provider === "resend") {
    return createResendTransactionalEmailProvider(config);
  }
  if (config.provider === "fake") {
    return new FakeTransactionalEmailProvider({ nodeEnv, outboxDir: config.fakeOutboxDir });
  }
  return new DisabledTransactionalEmailProvider();
}

export async function bootstrapApi(options: BootstrapApiOptions): Promise<BootstrappedApi> {
  const emailProvider = createTransactionalEmailProvider(
    options.config.email,
    options.config.nodeEnv
  );
  const curriculum = await initializeCurriculum(options.config.curriculumPath);
  const persistence = await initializePersistence(options.config.persistence);
  if (persistence.status === "ready" && curriculum.status === "ready") {
    await seedGlobalData(persistence.models, curriculum);
  }
  const account = await initializeAccountRuntime(persistence, {
    curriculum,
    sessionConfig: options.config.session,
    registrationConfig: options.config.registration,
    loginCodePepper: options.config.email.loginCodePepper,
    loginCodeDeliveryLeaseMs: options.config.email.requestTimeoutMs + 5_000,
    aiConfig: options.config.ai,
    emailProvider
  });
  const app = createApp({
    config: options.config,
    curriculum,
    account,
    ...(options.logger === undefined ? {} : { logger: options.logger })
  });

  return {
    app,
    curriculum,
    persistence,
    account,
    close() {
      return closePersistence(persistence);
    }
  };
}
