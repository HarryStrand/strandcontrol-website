function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readField(value) {
  return String(value ?? "").trim();
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Labels must match the options in support/index.html, in the same order.
const SUPPORT_TOPICS = new Map([
  ["general", "General feedback"],
  ["help", "Help using the product"],
  ["problem", "Problem with the product"],
  ["improvement", "Suggest an improvement"],
  ["feature", "Request a new feature"],
  ["comments", "Comments about the product"],
  ["privacy", "Privacy question or concern"],
  ["other", "Other"],
]);

function looksLikePhone(value) {
  // Optional and free-form (extensions, international numbers). Cap the length
  // and reject control characters so the value stays a single email line.
  return value.length <= 40 && !/[\u0000-\u001F\u007F]/.test(value);
}

// Cloudflare's always-pass test sitekey. Production does not use it.
// localhost is accepted only when wrangler dev overrides TURNSTILE_SITE_KEY
// with this value (see .dev.vars.example). The real site key never honors local hosts.
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const TURNSTILE_ACTION = "support";
const TURNSTILE_HOSTS = new Set(["strandcontrol.com", "strandcontrol.workers.dev"]);

function turnstileHostnameAllowed(hostname, env) {
  if (TURNSTILE_HOSTS.has(hostname)) return true;
  const siteKey = readField(env.TURNSTILE_SITE_KEY);
  return (
    siteKey === TURNSTILE_TEST_SITE_KEY &&
    (hostname === "localhost" || hostname === "127.0.0.1")
  );
}

async function enforceSupportRateLimit(request, env) {
  if (!env.SUPPORT_RATE_LIMITER) return null;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  try {
    const { success } = await env.SUPPORT_RATE_LIMITER.limit({ key: `support:${ip}` });
    if (!success) return json({ ok: false, error: "rate" }, 429);
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "support rate limit check failed",
        error: error instanceof Error ? error.name : "Error",
      }),
    );
  }
  return null;
}

// Returns a Response when the submission must be rejected, or null to continue.
// A missing TURNSTILE_SECRET_KEY skips the check so the form still sends during rollout.
async function verifyTurnstile(request, env, token) {
  const secret = readField(env.TURNSTILE_SECRET_KEY);
  if (!secret) {
    console.warn(
      JSON.stringify({
        message: "TURNSTILE_SECRET_KEY is not set; skipping Turnstile verification",
      }),
    );
    return null;
  }

  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return json({ ok: false, error: "turnstile" }, 403);
  }

  let result;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: request.headers.get("CF-Connecting-IP") ?? "",
      }),
    });
    if (!res.ok) throw new Error("siteverify");
    result = await res.json();
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "turnstile siteverify failed",
        error: error instanceof Error ? error.name : "Error",
      }),
    );
    return json({ ok: false, error: "turnstile" }, 403);
  }

  const testingKey = result?.metadata?.result_with_testing_key === true;
  if (testingKey) {
    if (result.success === true && readField(env.TURNSTILE_SITE_KEY) === TURNSTILE_TEST_SITE_KEY) {
      return null;
    }
    return json({ ok: false, error: "turnstile" }, 403);
  }

  if (
    result?.success !== true ||
    result.action !== TURNSTILE_ACTION ||
    !turnstileHostnameAllowed(result.hostname, env)
  ) {
    console.error(
      JSON.stringify({
        message: "turnstile rejected",
        errorCodes: Array.isArray(result?.["error-codes"]) ? result["error-codes"] : [],
      }),
    );
    return json({ ok: false, error: "turnstile" }, 403);
  }

  return null;
}

// Same checks as the former Pages Function. The access key is consulted
// only after the body is valid, so a missing secret still returns field
// errors, and 503 is reserved for a submission that would otherwise be sent.
async function handleSupportPost(request, env) {
  const contentType = request.headers.get("content-type") ?? "";
  let data;
  if (contentType.includes("application/json")) {
    try {
      data = await request.json();
    } catch {
      return json({ ok: false, error: "invalid" }, 400);
    }
  } else {
    try {
      const form = await request.formData();
      data = Object.fromEntries(form);
    } catch {
      return json({ ok: false, error: "invalid" }, 400);
    }
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return json({ ok: false, error: "invalid" }, 400);
  }

  const limited = await enforceSupportRateLimit(request, env);
  if (limited) return limited;

  if (readField(data.company)) {
    return json({ ok: true });
  }

  const name = readField(data.name);
  const email = readField(data.email);
  const phone = readField(data.phone);
  const topic = readField(data.topic);
  const subject = readField(data.subject);
  const message = readField(data.message);
  const topicLabel = SUPPORT_TOPICS.get(topic);

  if (!name || !email || !topic || !subject || !message) {
    return json({ ok: false, error: "missing" }, 400);
  }
  if (
    !looksLikeEmail(email) ||
    !topicLabel ||
    (phone && !looksLikePhone(phone)) ||
    name.length > 200 ||
    subject.length > 200 ||
    message.length > 8000
  ) {
    return json({ ok: false, error: "invalid" }, 400);
  }

  const turnstile = await verifyTurnstile(request, env, readField(data["cf-turnstile-response"]));
  if (turnstile) return turnstile;

  if (!env.WEB3FORMS_ACCESS_KEY) {
    return json({ ok: false, error: "not-configured" }, 503);
  }

  let res;
  try {
    res = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        access_key: env.WEB3FORMS_ACCESS_KEY,
        name,
        email,
        ...(phone ? { phone } : {}),
        topic: topicLabel,
        subject: `${topicLabel}: ${subject}`,
        message,
      }),
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "support submit failed",
        error: error instanceof Error ? error.name : "Error",
      }),
    );
    return json({ ok: false, error: "send" }, 502);
  }

  let result = {};
  try {
    result = await res.json();
  } catch {
    result = {};
  }

  if (!res.ok || result.success === false) {
    console.error(
      JSON.stringify({
        message: "support submit failed",
        upstreamStatus: res.status,
      }),
    );
    return json({ ok: false, error: "send" }, 502);
  }

  return json({ ok: true });
}

function handleSupportOptions() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "POST, OPTIONS" },
  });
}

function methodNotAllowed() {
  return new Response(null, {
    status: 405,
    headers: { Allow: "POST, OPTIONS" },
  });
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname.replace(/\/+$/, "") || "/";

    if (pathname === "/api/support") {
      if (request.method === "POST") return handleSupportPost(request, env);
      if (request.method === "OPTIONS") return handleSupportOptions();
      return methodNotAllowed();
    }

    return serveAsset(request, env);
  },
};

async function serveAsset(request, env) {
  const response = await env.ASSETS.fetch(request);
  const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  if (path !== "/support") return response;
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html")) return response;
  const siteKey = readField(env.TURNSTILE_SITE_KEY);
  if (!siteKey) return response;
  return new HTMLRewriter()
    .on("#support-turnstile", {
      element(element) {
        element.setAttribute("data-sitekey", siteKey);
      },
    })
    .transform(response);
}
