(function () {
  const form = document.getElementById("support-form");
  const status = document.getElementById("support-status");
  if (!form || !status) return;

  function applyTopicFromUrl() {
    const select = form.topic;
    if (!select) return;
    const requested = new URLSearchParams(window.location.search).get("topic");
    if (!requested) return;
    const value = requested.trim();
    const known = Array.from(select.options).some((option) => option.value === value);
    if (known) select.value = value;
  }

  applyTopicFromUrl();

  let turnstileWidgetId;

  function renderTurnstile() {
    const container = document.getElementById("support-turnstile");
    if (!container || !window.turnstile || turnstileWidgetId !== undefined) return;
    const sitekey = container.getAttribute("data-sitekey");
    if (!sitekey) return;
    turnstileWidgetId = window.turnstile.render(container, {
      sitekey,
      action: "support",
    });
  }

  window.onSupportTurnstileLoad = renderTurnstile;
  if (window.turnstile) renderTurnstile();

  function turnstileToken() {
    if (turnstileWidgetId === undefined || !window.turnstile) return "";
    return window.turnstile.getResponse(turnstileWidgetId) || "";
  }

  function resetTurnstile() {
    if (turnstileWidgetId === undefined || !window.turnstile) return;
    window.turnstile.reset(turnstileWidgetId);
  }

  const messages = {
    ok: "Thanks. We received your message.",
    missing: "Please fill in every field.",
    invalid: "Please check your email and try again.",
    attachment: "Attach pictures or log files only: up to 3 files, 5 MB each.",
    turnstile: "The spam check did not pass. Please try again.",
    rate: "Too many messages were sent from this network. Please wait a minute and try again.",
    send: "The message could not be sent. Try again in a few minutes.",
    "not-configured": "Support mail is not set up on this published site yet.",
    offline: "This preview cannot send mail. Publish to Cloudflare and add the WEB3FORMS_ACCESS_KEY secret first.",
    network: "The message could not be sent. Try again in a few minutes.",
  };

  // Keep in step with src/support-request.mjs.
  const maxAttachments = 3;
  const maxAttachmentBytes = 5 * 1024 * 1024;
  const attachmentExtensions = new Set([
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "heic",
    "heif",
    "log",
    "txt",
    "json",
    "crash",
    "ips",
    "zip",
  ]);

  function attachmentExtension(name) {
    const base = String(name || "").split(/[/\\]/).pop() || "";
    const dot = base.lastIndexOf(".");
    if (dot <= 0 || dot === base.length - 1) return "";
    return base.slice(dot + 1).toLowerCase();
  }

  function chosenAttachments() {
    const input = form.attachment;
    if (!input || !input.files) return [];
    return Array.from(input.files).filter((file) => file.size > 0 || file.name);
  }

  function attachmentsLookValid(files) {
    if (files.length > maxAttachments) return false;
    return files.every(
      (file) =>
        file.size > 0 &&
        file.size <= maxAttachmentBytes &&
        attachmentExtensions.has(attachmentExtension(file.name)),
    );
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";
    status.className = "form-status";

    const files = chosenAttachments();
    if (!attachmentsLookValid(files)) {
      status.textContent = messages.attachment;
      status.classList.add("is-error");
      return;
    }

    const button = form.querySelector("button[type='submit']");
    button.disabled = true;

    const payload = new FormData();
    payload.set("name", form.name.value);
    payload.set("email", form.email.value);
    payload.set("phone", form.phone.value);
    payload.set("topic", form.topic.value);
    payload.set("subject", form.subject.value);
    payload.set("message", form.message.value);
    payload.set("company", form.company.value);
    payload.set("cf-turnstile-response", turnstileToken());
    files.forEach((file) => payload.append("attachment", file, file.name));

    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: payload,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        form.reset();
        applyTopicFromUrl();
        status.textContent = messages.ok;
        status.classList.add("is-ok");
      } else if (res.status === 404 || res.status === 405 || res.status === 501) {
        status.textContent = messages.offline;
        status.classList.add("is-error");
      } else {
        status.textContent = messages[data.error] || messages.send;
        status.classList.add("is-error");
      }
    } catch {
      status.textContent = messages.network;
      status.classList.add("is-error");
    } finally {
      resetTurnstile();
      button.disabled = false;
    }
  });
})();
