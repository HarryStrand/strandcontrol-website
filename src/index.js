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

  if (readField(data.company)) {
    return json({ ok: true });
  }

  const name = readField(data.name);
  const email = readField(data.email);
  const subject = readField(data.subject);
  const message = readField(data.message);

  if (!name || !email || !subject || !message) {
    return json({ ok: false, error: "missing" }, 400);
  }
  if (!looksLikeEmail(email) || name.length > 200 || subject.length > 200 || message.length > 8000) {
    return json({ ok: false, error: "invalid" }, 400);
  }

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
        subject,
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

    return env.ASSETS.fetch(request);
  },
};
