import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { test } from "node:test";

const nginxImage = process.env.SELFHOST_NGINX_TEST_IMAGE ?? "codelift-selfhost-web:m16-3b";
function docker(...args) {
  const result = spawnSync("docker", args, { encoding: "utf8", timeout: 60_000 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test("real Nginx preserves the bounded trusted scheme, exact host/origin and limits only access endpoints", async () => {
  const id = `codelift-proxy-test-${process.pid}`;
  const directory = mkdtempSync(join(tmpdir(), "codelift-proxy-test-"));
  const config = resolve("apps/web/nginx.conf");
  try {
    docker("network", "create", "--internal", id);
    docker(
      "run",
      "-d",
      "--name",
      `${id}-api`,
      "--network",
      id,
      "--network-alias",
      "api",
      "--read-only",
      "--cap-drop",
      "ALL",
      "node:24.14.0-bookworm-slim",
      "node",
      "--input-type=module",
      "-e",
      "import http from 'node:http';http.createServer((q,s)=>{s.setHeader('content-type','application/json');s.end(JSON.stringify(q.headers))}).listen(4000,'0.0.0.0')"
    );
    docker(
      "run",
      "-d",
      "--name",
      `${id}-client`,
      "--network",
      id,
      "--read-only",
      "--cap-drop",
      "ALL",
      "node:24.14.0-bookworm-slim",
      "node",
      "-e",
      "setInterval(()=>{},60000)"
    );
    const clientIp = docker(
      "inspect",
      "--format",
      `{{(index .NetworkSettings.Networks "${id}").IPAddress}}`,
      `${id}-client`
    );
    writeFileSync(join(directory, "trusted.conf"), `${clientIp} 1;\n`);
    docker(
      "run",
      "-d",
      "--name",
      `${id}-web`,
      "--network",
      id,
      "--read-only",
      "--tmpfs",
      "/tmp",
      "--tmpfs",
      "/var/cache/nginx",
      "--tmpfs",
      "/var/run",
      "--mount",
      `type=bind,src=${config},dst=/etc/nginx/conf.d/default.conf,readonly`,
      "--mount",
      `type=bind,src=${join(directory, "trusted.conf")},dst=/etc/nginx/codelift-trusted-ingress.conf,readonly`,
      nginxImage
    );
    const probe = (container, path, headers = {}) =>
      JSON.parse(
        docker(
          "exec",
          container,
          "node",
          "-e",
          `require('node:http').get('http://${id}-web:8080${path}',{headers:${JSON.stringify(headers)}},r=>{let body='';r.on('data',x=>body+=x);r.on('end',()=>console.log(JSON.stringify({status:r.statusCode,body})))})`
        )
      );
    for (let attempt = 0; attempt < 30; attempt++) {
      const status = spawnSync("docker", [
        "exec",
        `${id}-client`,
        "node",
        "-e",
        `fetch('http://${id}-web:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`
      ]);
      if (status.status === 0) break;
      await new Promise((done) => setTimeout(done, 500));
    }
    for (const path of ["/health", "/ready", "/api/v1/config"]) {
      const base = {
        Host: "pilot.example.test:8443",
        Origin: "https://pilot.example.test:8443",
        "X-Forwarded-Port": "9443",
        "X-Forwarded-Host": "spoof.example",
        "X-Forwarded-For": "203.0.113.9"
      };
      const fallback = JSON.parse(probe(`${id}-client`, path, base).body);
      assert.equal(fallback["x-forwarded-proto"], "http");
      assert.equal(fallback["x-forwarded-port"], "8080");
      assert.equal(fallback.host, "pilot.example.test:8443");
      assert.equal(fallback.origin, "https://pilot.example.test:8443");
      assert.equal(fallback["x-forwarded-host"], "pilot.example.test:8443");
      const trusted = JSON.parse(
        probe(`${id}-client`, path, { ...base, "X-Forwarded-Proto": "https" }).body
      );
      assert.equal(trusted["x-forwarded-proto"], "https");
      assert.equal(trusted["x-forwarded-port"], "443");
      for (const scheme of ["https,http", "garbage", "HTTPS"]) {
        assert.equal(
          JSON.parse(probe(`${id}-client`, path, { "X-Forwarded-Proto": scheme }).body)[
            "x-forwarded-proto"
          ],
          "http"
        );
      }
      const untrusted = JSON.parse(probe(`${id}-api`, path, { "X-Forwarded-Proto": "https" }).body);
      assert.equal(untrusted["x-forwarded-proto"], "http");
    }
    const statuses = JSON.parse(
      docker(
        "exec",
        `${id}-client`,
        "node",
        "-e",
        `Promise.all(Array.from({length:36},(_,i)=>fetch('http://${id}-web:8080/api/v1/auth/login?probe=synthetic-private-query',{method:'POST',headers:{'X-Forwarded-For':'203.0.113.'+(i+1)}}).then(r=>r.status))).then(x=>console.log(JSON.stringify(x)))`
      )
    );
    assert.ok(statuses.includes(200));
    assert.ok(statuses.includes(429), "authentication bursts are rejected");
    const logs = spawnSync("docker", ["logs", `${id}-web`], { encoding: "utf8" });
    assert.ok(
      !(logs.stdout + logs.stderr).includes("synthetic-private-query"),
      "rate-limit rejection must not log query values"
    );
    assert.equal(
      probe(`${id}-client`, "/api/V1/AUTH/login").status,
      429,
      "Express case-insensitive auth paths share the limiter"
    );
    for (const path of [
      "/app/today",
      "/assets/fixture.js",
      "/api/v1/curriculum",
      "/api/v1/auth/csrf-extra"
    ]) {
      const response = probe(`${id}-client`, path);
      assert.notEqual(response.status, 429, path);
    }
  } finally {
    for (const suffix of ["web", "client", "api"])
      spawnSync("docker", ["rm", "-f", `${id}-${suffix}`], { stdio: "ignore" });
    spawnSync("docker", ["network", "rm", id], { stdio: "ignore" });
    rmSync(directory, { recursive: true, force: true });
  }
});
