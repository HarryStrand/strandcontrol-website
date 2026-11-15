import assert from "node:assert/strict";
import test from "node:test";
import {
  attachmentError,
  attachmentFilename,
  attachmentsEnabled,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  supportThanks,
} from "../src/support-request.mjs";

test("allows pictures and log files within the size cap", () => {
  assert.equal(attachmentError([]), null);
  assert.equal(
    attachmentError([
      { name: "board.PNG", size: 1200 },
      { name: "dartopia.log", size: MAX_ATTACHMENT_BYTES },
      { name: "notes/crash.ips", size: 40 },
    ]),
    null,
  );
});

test("rejects too many files, empty files, oversized files, and other types", () => {
  const files = Array.from({ length: MAX_ATTACHMENTS + 1 }, (_, index) => ({
    name: `shot-${index}.jpg`,
    size: 10,
  }));
  assert.equal(attachmentError(files), "attachment");
  assert.equal(attachmentError([{ name: "empty.log", size: 0 }]), "attachment");
  assert.equal(
    attachmentError([{ name: "huge.zip", size: MAX_ATTACHMENT_BYTES + 1 }]),
    "attachment",
  );
  assert.equal(attachmentError([{ name: "script.exe", size: 10 }]), "attachment");
  assert.equal(attachmentError([{ name: "photo", size: 10 }]), "attachment");
  assert.equal(attachmentError([{ name: "notes.log.exe", size: 10 }]), "attachment");
});

test("keeps a safe attachment filename", () => {
  assert.equal(attachmentFilename("../../board shot.png", 0), "board shot.png");
  assert.equal(attachmentFilename("..\r\nname.log", 1), "name.log");
  assert.equal(attachmentFilename("", 2), "attachment-3");
});

test("attachments stay off unless the switch is exactly true", () => {
  assert.equal(attachmentsEnabled("true"), true);
  assert.equal(attachmentsEnabled(" TRUE "), true);
  assert.equal(attachmentsEnabled("false"), false);
  assert.equal(attachmentsEnabled(""), false);
  assert.equal(attachmentsEnabled(undefined), false);
});

test("thank-you copy thanks them and does not treat the name as HTML", () => {
  const message = supportThanks("Ada <script>");
  assert.equal(message.subject, "Thanks for contacting StrandControl");
  assert.match(message.text, /Thanks for contacting us, Ada <script>\./);
  assert.match(message.text, /get back to you as soon as possible/);
  assert.match(message.html, /Ada &lt;script&gt;/);
  assert.doesNotMatch(message.html, /<script>/);
  assert.match(supportThanks("").text, /^Thanks for contacting us\./);
});
