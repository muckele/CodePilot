import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

function render(overrides = {}) {
  return spawnSync(
    "docker",
    [
      "compose",
      "-f",
      "infra/compose.selfhost.yaml",
      "--profile",
      "tools",
      "config",
      "--format",
      "json"
    ],
    {
      env: {
        PATH: process.env.PATH,
        SELFHOST_STATE_ROOT: "/nonexistent/codelift-state-fixture",
        SELFHOST_UID: "501",
        SELFHOST_GID: "20",
        WEB_ORIGIN: "https://codelift.localhost",
        TRUST_PROXY_HOPS: "1",
        ...overrides
      },
      encoding: "utf8"
    }
  );
}

test("rendered self-host deployment exposes only loopback web and gives private services bounded storage/resources", () => {
  const result = render();
  assert.equal(result.status, 0, "self-host Compose must render");
  const config = JSON.parse(result.stdout);
  assert.deepEqual(
    Object.entries(config.services)
      .filter(([, value]) => !value.profiles)
      .map(([name]) => name)
      .sort(),
    ["api", "mongodb", "web"]
  );
  for (const [name, service] of Object.entries(config.services)) {
    assert.ok(!["postgres", "ai", "python"].includes(name));
    assert.ok(service.security_opt.includes("no-new-privileges:true"));
    assert.ok(service.read_only);
    assert.ok(service.mem_limit <= 1536 * 1024 * 1024);
    assert.ok(service.cpus <= 1);
    assert.equal(service.logging.options["max-size"], "5m");
    assert.equal(service.logging.options["max-file"], "3");
    assert.ok(
      !(service.volumes ?? []).some((mount) => /docker\.sock|\/Users\/Matt$/.test(mount.source))
    );
    if (name !== "web") assert.equal(service.ports, undefined);
  }
  assert.deepEqual(
    config.services.web.ports.map(({ host_ip, published, target }) => [host_ip, published, target]),
    [["127.0.0.1", "8080", 8080]]
  );
  assert.equal(config.volumes.mongo_data.name, "codelift_selfhost_mongo_data");
  const environment = config.services.api.environment;
  assert.equal(environment.MONGO_URI, undefined);
  assert.equal(environment.MONGO_URI_FILE, "/run/secrets/mongo-uri");
  assert.equal(environment.NODE_ENV, "production");
  assert.equal(environment.PERSISTENCE_MODE, "required");
  assert.equal(environment.REGISTRATION_MODE, "invite_only");
  assert.equal(environment.AI_PROVIDER, "mock");
  assert.equal(environment.AI_EXTERNAL_ENABLED, "false");
  assert.equal(environment.AI_AGENT_ENABLED, "false");
  assert.equal(config.networks.backend.internal, true);
});

test("rendered self-host production services restart after an orderly host shutdown", () => {
  const result = render();
  assert.equal(result.status, 0, "self-host Compose must render");
  const config = JSON.parse(result.stdout);

  for (const name of ["web", "api", "mongodb"])
    assert.equal(
      config.services[name].restart,
      "always",
      `${name} must restart after host shutdown`
    );
});

test("self-host Compose requires an explicit origin, proxy count and operator identity", () => {
  for (const name of [
    "TRUST_PROXY_HOPS",
    "WEB_ORIGIN",
    "SELFHOST_STATE_ROOT",
    "SELFHOST_UID",
    "SELFHOST_GID"
  ])
    assert.notEqual(render({ [name]: "" }).status, 0, name);
});
