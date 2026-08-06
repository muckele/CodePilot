import { dropE2eDatabase } from "./database.js";
import { E2E_DATABASE_NAME } from "./environment.js";

await dropE2eDatabase();
process.stdout.write(`Reset guarded Playwright database ${E2E_DATABASE_NAME}.\n`);
