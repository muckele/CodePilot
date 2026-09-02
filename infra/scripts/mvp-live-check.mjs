import process from "node:process";

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? undefined : process.argv[index + 1];
}

function requiredOption(name) {
  const value = option(name);
  if (value === undefined || value.startsWith("--")) throw new Error(`--${name} is required.`);
  return value;
}

function validatedBaseUrl(value) {
  const parsed = new URL(value);
  const loopback =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) {
    throw new Error("Live checks require HTTPS; HTTP is allowed only for loopback rehearsal.");
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname !== "/" && parsed.pathname !== "")
  ) {
    throw new Error(
      "--base-url must be an exact origin without credentials, path, query, or fragment."
    );
  }
  return parsed.origin;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function checkedFetch(url, label, init) {
  const response = await fetch(url, { redirect: "error", ...init });
  assert(response.ok, `${label} returned HTTP ${response.status}.`);
  return response;
}

function securityHeaders(response) {
  const csp = response.headers.get("content-security-policy") ?? "";
  assert(csp.includes("frame-ancestors 'none'"), "CSP must block framing.");
  assert(!csp.includes("'unsafe-inline'"), "CSP unexpectedly allows unsafe-inline.");
  assert(response.headers.get("x-content-type-options") === "nosniff", "nosniff header missing.");
  assert(response.headers.has("referrer-policy"), "Referrer-Policy header missing.");
  assert(response.headers.has("permissions-policy"), "Permissions-Policy header missing.");
}

function cookieFrom(response) {
  const values =
    typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  const raw = values[0] ?? response.headers.get("set-cookie");
  if (raw === null || raw === undefined) throw new Error("Session cookie was not returned.");
  return { value: raw.split(";", 1)[0], raw };
}

const baseUrl = validatedBaseUrl(requiredOption("base-url"));
const observations = { baseUrl, syntheticJourney: "not_requested" };

const webHealth = await checkedFetch(`${baseUrl}/healthz`, "web health");
securityHeaders(webHealth);
const [apiHealth, readiness, deepLink, configuration, index] = await Promise.all([
  checkedFetch(`${baseUrl}/health`, "API health"),
  checkedFetch(`${baseUrl}/ready`, "API readiness"),
  checkedFetch(`${baseUrl}/privacy`, "SPA deep-link fallback"),
  checkedFetch(`${baseUrl}/api/v1/config`, "MVP configuration"),
  checkedFetch(`${baseUrl}/`, "web index")
]);
securityHeaders(deepLink);
assert(
  (deepLink.headers.get("content-type") ?? "").includes("text/html"),
  "Deep link did not serve HTML."
);
assert(
  !(deepLink.headers.get("cache-control") ?? "").includes("immutable"),
  "SPA fallback is immutable."
);
assert(
  !(index.headers.get("cache-control") ?? "").includes("immutable"),
  "index.html is immutable."
);
const config = await configuration.json();
assert(config.registrationMode === "invite_only", "Production registration is not invite_only.");
assert(config.aiProvider === "mock", "Private-pilot AI provider is not mock.");
assert(config.externalAiEnabled === false, "External AI is enabled.");
assert(config.agentEnabled === false, "Agent execution is enabled.");
observations.apiHealth = await apiHealth.json();
observations.readiness = await readiness.json();
observations.configuration = config;

const html = await index.text();
const assetPath = html.match(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/)?.[1];
assert(assetPath !== undefined, "No hashed JS/CSS asset was found in index.html.");
const asset = await checkedFetch(`${baseUrl}${assetPath}`, "hashed asset");
assert(
  (asset.headers.get("cache-control") ?? "").includes("immutable"),
  "Hashed asset is not immutable."
);

const email = option("synthetic-email");
const password = option("synthetic-password");
const invitationToken = option("invitation-token");
const supplied = [email, password, invitationToken].filter((value) => value !== undefined).length;
if (supplied !== 0 && supplied !== 3) {
  throw new Error(
    "Synthetic journey requires --synthetic-email, --synthetic-password, and --invitation-token together."
  );
}
if (supplied === 3) {
  assert(
    process.argv.includes("--allow-synthetic-cleanup"),
    "Synthetic cleanup guard is required."
  );
  assert(
    /^codelift-smoke-[A-Za-z0-9._+-]+@example\.invalid$/.test(email),
    "Synthetic email must use the guarded codelift-smoke-* @example.invalid form."
  );
  let cookie;
  let csrf;
  const csrfResponse = await checkedFetch(`${baseUrl}/api/v1/auth/csrf`, "CSRF bootstrap");
  const initialCookie = cookieFrom(csrfResponse);
  cookie = initialCookie.value;
  assert(/;\s*HttpOnly(?:;|$)/iu.test(initialCookie.raw), "Session cookie is not HttpOnly.");
  assert(
    /;\s*SameSite=Lax(?:;|$)/iu.test(initialCookie.raw),
    "Session cookie is not SameSite=Lax."
  );
  if (new URL(baseUrl).protocol === "https:") {
    assert(/;\s*Secure(?:;|$)/iu.test(initialCookie.raw), "HTTPS session cookie is not Secure.");
    assert(cookie.startsWith("__Host-"), "HTTPS session cookie does not use the __Host- prefix.");
  }
  csrf = (await csrfResponse.json()).csrfToken;
  const mutation = async (path, method, body, label) => {
    const response = await checkedFetch(`${baseUrl}${path}`, label, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: baseUrl,
        "X-CSRF-Token": csrf
      },
      body: JSON.stringify(body)
    });
    const nextCookie = response.headers.get("set-cookie");
    if (nextCookie !== null) cookie = nextCookie.split(";", 1)[0];
    return response;
  };
  const registered = await mutation(
    "/api/v1/auth/register",
    "POST",
    { email, password, invitationToken },
    "invited registration"
  );
  csrf = (await registered.json()).csrfToken;
  await mutation(
    "/api/v1/me/onboarding",
    "PUT",
    {
      displayName: "Synthetic Pilot Check",
      timezone: "UTC",
      startDate: new Date().toISOString().slice(0, 10),
      commitmentMinutes: 30,
      preferredCodingTime: "12:00",
      routineCue: "the guarded live check starts",
      codingPlace: "the isolated synthetic workspace",
      implementationIntention:
        "At 12:00, after the guarded check starts, I will work for 30 minutes.",
      whyItMatters: "This verifies the private-pilot access boundary.",
      githubUsername: "",
      targetRoles: ["Full-Stack AI Application Engineer"],
      aiPrivacyMode: "local_only",
      themePreference: "system",
      motionPreference: "reduced",
      reviewPreference: "before_mission"
    },
    "synthetic onboarding"
  );
  const today = await checkedFetch(`${baseUrl}/api/v1/me/today`, "synthetic Today", {
    headers: { Cookie: cookie }
  });
  const todayPayload = await today.json();
  const dayNumber = todayPayload?.day?.dayNumber;
  assert(Number.isInteger(dayNumber), "Synthetic Today did not return a mission day.");
  await mutation(
    `/api/v1/progress/${dayNumber}/status`,
    "PUT",
    {
      intent: "start",
      mode: "recovery",
      idempotencyKey: "mvp-live-recovery-start"
    },
    "synthetic Recovery start"
  );
  await mutation(
    `/api/v1/progress/${dayNumber}/evidence`,
    "POST",
    {
      kind: "text_explanation",
      label: "Guarded live-check evidence",
      value: "The synthetic account reached and persisted its Recovery mission boundary.",
      idempotencyKey: "mvp-live-recovery-evidence"
    },
    "synthetic Recovery evidence"
  );
  const reflected = await mutation(
    `/api/v1/progress/${dayNumber}/reflection`,
    "PUT",
    {
      confused: "The guarded smoke keeps every mutation explicit.",
      mentalModelChanged: "A live claim needs persisted evidence, not only health probes.",
      retrieveLater: "Which release SHA and request IDs support this check?",
      idempotencyKey: "mvp-live-recovery-reflection"
    },
    "synthetic Recovery reflection"
  );
  const reflectedPayload = await reflected.json();
  const completed = await mutation(
    `/api/v1/progress/${dayNumber}/status`,
    "PUT",
    {
      intent: "complete",
      mode: "recovery",
      idempotencyKey: "mvp-live-recovery-complete",
      expectedVersion: reflectedPayload.version
    },
    "synthetic Recovery completion"
  );
  assert((await completed.json()).status === "recovery_completed", "Recovery did not complete.");

  await mutation("/api/v1/auth/logout", "POST", {}, "synthetic logout");
  const postLogoutCsrf = await checkedFetch(`${baseUrl}/api/v1/auth/csrf`, "post-logout CSRF");
  cookie = cookieFrom(postLogoutCsrf).value;
  csrf = (await postLogoutCsrf.json()).csrfToken;
  const loggedIn = await mutation(
    "/api/v1/auth/login",
    "POST",
    { email, password },
    "synthetic return login"
  );
  csrf = (await loggedIn.json()).csrfToken;
  const returnedToday = await checkedFetch(`${baseUrl}/api/v1/me/today`, "returned Today", {
    headers: { Cookie: cookie }
  });
  const returnedTodayPayload = await returnedToday.json();
  assert(
    returnedTodayPayload.selection === "next_incomplete" &&
      returnedTodayPayload.day?.dayNumber === dayNumber + 1,
    "Today did not advance after the persisted Recovery completion."
  );
  const exported = await checkedFetch(`${baseUrl}/api/v1/me/export`, "synthetic export", {
    headers: { Cookie: cookie }
  });
  const exportedPayload = await exported.json();
  assert(
    exportedPayload.sourceRecords?.progress?.some(
      (record) => record.dayNumber === dayNumber && record.status === "recovery_completed"
    ) === true,
    "Account export did not contain the persisted Recovery completion."
  );
  await mutation("/api/v1/me", "DELETE", { password, confirmation: "DELETE" }, "synthetic cleanup");
  observations.syntheticJourney = "passed_and_deleted";
}

process.stdout.write(`${JSON.stringify({ passed: true, observations }, null, 2)}\n`);
