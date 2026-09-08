import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// Reads only: safe while backup holds fsyncLock; no model/index initialization.
export async function readSnapshot(database, excluded = new Set()) {
  const names = (await database.listCollections({}, { nameOnly: true }).toArray())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith("system.") && !excluded.has(name))
    .sort();
  const hash = createHash("sha256");
  for (const name of names) {
    hash.update(name);
    for await (const document of database.collection(name).find().sort({ _id: 1 }))
      hash.update(JSON.stringify(document));
  }
  return {
    algorithm: "sha256-json-v1",
    fingerprint: hash.digest("hex"),
    collections: names.length
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { loadApiConfig } = await import("/app/apps/api/dist/config.js");
  const { default: mongoose } = await import("/app/apps/api/node_modules/mongoose/index.js");
  const config = loadApiConfig();
  const client = new mongoose.mongo.MongoClient(config.persistence.mongoUri, {
    readPreference: "primary"
  });
  try {
    await client.connect();
    process.stdout.write(
      `${JSON.stringify(await readSnapshot(client.db(config.persistence.databaseName)))}\n`
    );
  } finally {
    await client.close();
  }
}
