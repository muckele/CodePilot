import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import http from "node:http";
import { resolve } from "node:path";
import { test } from "node:test";
import { compose, docker } from "./operations.mjs";

test("actual Mac loopback ingress preserves the trusted HTTPS signal and exact Host/Origin", async () => {
  const id = `codelift-loopback-probe-${process.pid}`;
  compose("stop", "web");
  try {
    docker(
      "run",
      "-d",
      "--name",
      `${id}-api`,
      "--network",
      "codelift-selfhost_ingress",
      "--network-alias",
      "api",
      "--read-only",
      "--cap-drop",
      "ALL",
      "node:24.14.0-bookworm-slim",
      "node",
      "-e",
      "require('node:http').createServer((q,s)=>s.end(JSON.stringify(q.headers))).listen(4000)"
    );
    docker(
      "run",
      "-d",
      "--name",
      `${id}-web`,
      "--network",
      "codelift-selfhost_ingress",
      "--read-only",
      "--tmpfs",
      "/tmp",
      "--tmpfs",
      "/var/cache/nginx",
      "--tmpfs",
      "/var/run",
      "-p",
      "127.0.0.1:8080:8080",
      "--mount",
      `type=bind,src=${resolve("apps/web/nginx.conf")},dst=/etc/nginx/conf.d/default.conf,readonly`,
      "--mount",
      `type=bind,src=${resolve("infra/selfhost/trusted-ingress.conf")},dst=/etc/nginx/codelift-trusted-ingress.conf,readonly`,
      "codelift-selfhost-web:m16-3b"
    );
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        if ((await fetch("http://127.0.0.1:8080/healthz")).ok) break;
      } catch {
        /* startup */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const request = (path, headers) =>
      new Promise((resolve, reject) => {
        http
          .get(`http://127.0.0.1:8080${path}`, { headers }, (response) => {
            let body = "";
            response.on("data", (chunk) => (body += chunk));
            response.on("end", () => {
              try {
                resolve(JSON.parse(body));
              } catch (error) {
                reject(error);
              }
            });
          })
          .once("error", reject);
      });
    for (const path of ["/health", "/ready", "/api/v1/config"]) {
      const headers = {
        Host: "codelift.localhost:8443",
        Origin: "https://codelift.localhost:8443",
        "X-Forwarded-Proto": "https",
        "X-Forwarded-Port": "9443"
      };
      const actual = await request(path, headers);
      assert.equal(actual["x-forwarded-proto"], "https");
      assert.equal(actual["x-forwarded-port"], "443");
      assert.equal(actual.host, headers.Host);
      assert.equal(actual.origin, headers.Origin);
      const fallback = await request(path, { "X-Forwarded-Proto": "https,http" });
      assert.equal(fallback["x-forwarded-proto"], "http");
      assert.equal(fallback["x-forwarded-port"], "8080");
    }
  } finally {
    for (const name of [`${id}-web`, `${id}-api`])
      spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" });
    compose("start", "web");
  }
});
