(function () {
  const form = document.getElementById("support-form");
  const status = document.getElementById("support-status");
  if (!form || !status) return;

  const messages = {
    ok: "Thanks. We received your message.",
    missing: "Please fill in every field.",
    invalid: "Please check your email and try again.",
    send: "The message could not be sent. Try again in a few minutes.",
    "not-configured": "Support mail is not set up on this published site yet.",
    offline: "This preview cannot send mail. Publish to Cloudflare and add the WEB3FORMS_ACCESS_KEY secret first.",
    network: "The message could not be sent. Try again in a few minutes.",
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";
    status.className = "form-status";

    const button = form.querySelector("button[type='submit']");
    button.disabled = true;

    const payload = {
      name: form.name.value,
      email: form.email.value,
      subject: form.subject.value,
      message: form.message.value,
      company: form.company.value,
    };

    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        form.reset();
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
      button.disabled = false;
    }
  });
})();
