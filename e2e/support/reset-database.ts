import { dropE2eDatabase } from "./database.js";
import { resetE2EEmailOutbox } from "./email-outbox.js";
import { E2E_DATABASE_NAME } from "./environment.js";

await dropE2eDatabase();
await resetE2EEmailOutbox();
process.stdout.write(`Reset guarded Playwright database ${E2E_DATABASE_NAME}.\n`);
