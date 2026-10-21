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

export async function onRequestPost({ request, env }) {
  if (!env.WEB3FORMS_ACCESS_KEY) {
    return json({ ok: false, error: "not-configured" }, 503);
  }

  const contentType = request.headers.get("content-type") ?? "";
  let data;
  if (contentType.includes("application/json")) {
    try {
      data = await request.json();
    } catch {
      return json({ ok: false, error: "invalid" }, 400);
    }
  } else {
    const form = await request.formData();
    data = Object.fromEntries(form);
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

  const res = await fetch("https://api.web3forms.com/submit", {
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

  let result = {};
  try {
    result = await res.json();
  } catch {
    result = {};
  }

  if (!res.ok || result.success === false) {
    return json({ ok: false, error: "send" }, 502);
  }

  return json({ ok: true });
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "POST, OPTIONS" },
  });
}
