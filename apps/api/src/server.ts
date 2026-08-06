import { bootstrapApi } from "./bootstrap.js";
import { loadApiConfig } from "./config.js";

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownServerError";
}

async function main(): Promise<void> {
  const config = loadApiConfig();
  const runtime = await bootstrapApi({ config });
  const { app, curriculum, persistence } = runtime;
  const server = app.listen(config.port, () => {
    process.stdout.write(
      `${JSON.stringify({
        event: "api.started",
        port: config.port,
        curriculumStatus: curriculum.status,
        persistenceStatus: persistence.status
      })}\n`
    );
  });

  server.on("error", (error: unknown) => {
    process.stderr.write(
      `${JSON.stringify({
        event: "api.server_error",
        error: errorName(error)
      })}\n`
    );
    process.exitCode = 1;
  });

  const shutDown = (signal: "SIGINT" | "SIGTERM"): void => {
    process.stdout.write(`${JSON.stringify({ event: "api.stopping", signal })}\n`);
    server.close(() => {
      runtime
        .close()
        .then(() => {
          process.exitCode = 0;
        })
        .catch(() => {
          process.exitCode = 1;
        });
    });
  };

  process.once("SIGINT", () => {
    shutDown("SIGINT");
  });
  process.once("SIGTERM", () => {
    shutDown("SIGTERM");
  });
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({
      event: "api.start_failed",
      error: errorName(error)
    })}\n`
  );
  process.exitCode = 1;
});
