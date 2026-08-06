import { initializeAccountRuntime, type AccountRuntime } from "./account/router.js";
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

export async function bootstrapApi(options: BootstrapApiOptions): Promise<BootstrappedApi> {
  const curriculum = await initializeCurriculum(options.config.curriculumPath);
  const persistence = await initializePersistence(options.config.persistence);
  if (persistence.status === "ready" && curriculum.status === "ready") {
    await seedGlobalData(persistence.models, curriculum);
  }
  const account = await initializeAccountRuntime(persistence, {
    curriculum,
    sessionConfig: options.config.session,
    aiConfig: options.config.ai
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
