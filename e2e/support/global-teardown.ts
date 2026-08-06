import { dropE2eDatabase } from "./database.js";

export default async function globalTeardown(): Promise<void> {
  await dropE2eDatabase();
}
