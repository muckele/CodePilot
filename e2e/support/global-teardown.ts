import { dropE2eDatabase } from "./database.js";
import { removeE2EEmailOutbox } from "./email-outbox.js";

export default async function globalTeardown(): Promise<void> {
  try {
    await dropE2eDatabase();
  } finally {
    await removeE2EEmailOutbox();
  }
}
