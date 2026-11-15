// Pictures and plain log files only. Web3Forms attaches a single file up to 5 MB
// on the standard uploader; a few small files are forwarded as separate fields.
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const ATTACHMENT_EXTENSIONS = new Set([
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

export function attachmentExtension(name) {
  const base = String(name ?? "").split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

// Returns "attachment" when the upload must be rejected, or null.
export function attachmentError(files) {
  if (!Array.isArray(files) || files.length > MAX_ATTACHMENTS) return "attachment";
  for (const file of files) {
    const size = Number(file?.size);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_ATTACHMENT_BYTES) return "attachment";
    if (!ATTACHMENT_EXTENSIONS.has(attachmentExtension(file?.name))) return "attachment";
  }
  return null;
}

export function attachmentFilename(name, index) {
  const base = String(name ?? "").split(/[/\\]/).pop() ?? "";
  const cleaned = base
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 100);
  return cleaned || `attachment-${index + 1}`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function supportThanks(name) {
  const safe = String(name ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const who = safe ? `, ${safe}` : "";
  return {
    subject: "Thanks for contacting StrandControl",
    text: `Thanks for contacting us${who}.\n\nWe received your message and will get back to you as soon as possible.\n\nStrandControl`,
    html: `<p>Thanks for contacting us${safe ? `, ${escapeHtml(safe)}` : ""}.</p><p>We received your message and will get back to you as soon as possible.</p><p>StrandControl</p>`,
  };
}
