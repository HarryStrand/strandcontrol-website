# StrandControl website

Static site for [strandcontrol.com](https://strandcontrol.com/): studio home, Dartopia, privacy, and support.

## Local preview

Static pages only:

```bash
python3 -m http.server 8877
```

Then open `http://127.0.0.1:8877/` and `http://127.0.0.1:8877/dartopia`.

The support form is served by the Worker. From the repo root:

```bash
npx wrangler dev
```

## Cloudflare Workers

[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) deploys this repo as the `strandcontrol-website` Worker. There is no build step.

- Production (`main`): `npx wrangler deploy`
- Other branches: `npx wrangler versions upload`

Static files are served from the repo root. `POST /api/support` is handled by `src/index.js`, which forwards a valid message to [Web3Forms](https://web3forms.com/). File attachments stay hidden until `SUPPORT_ATTACHMENTS` is `true`. After Web3Forms accepts a message, the Worker emails the address on the form to say thanks and that we’ll reply as soon as we can. `/dartopia/` is `dartopia/index.html`. The same pattern is used for `/privacy/` and `/support/`. A request without the trailing slash redirects to the slash form. Unknown paths return `404.html`.

### `WEB3FORMS_ACCESS_KEY`

The access key is a Worker secret. Do not commit it.

Dashboard: [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) → **strandcontrol-website** → **Settings** → **Variables and Secrets** → **Add** → type **Secret**, name `WEB3FORMS_ACCESS_KEY`, then **Deploy**.

Or from the repo root:

```bash
npx wrangler secret put WEB3FORMS_ACCESS_KEY
```

`wrangler secret put` creates a new version and deploys it immediately. Until the secret exists, a valid `POST /api/support` returns `503` with `{ "ok": false, "error": "not-configured" }`. A message with no attachment sends on the free Web3Forms plan.

### Attachments

Web3Forms only accepts file uploads on the Pro plan, and an access key cannot be asked which plan it is on. The file field stays hidden while `SUPPORT_ATTACHMENTS` is `false`. After upgrading that key to Pro, set the var to `true` in `wrangler.jsonc` and deploy. The field then allows up to 3 pictures or log files, 5 MB each. If a message includes files while the var is still `false`, the text is sent and the files are left off.

### Thank-you email

The reply is sent from `support@strandcontrol.com` through the `EMAIL` binding. Onboard the domain once so those messages can reach the person who wrote in:

```bash
npx wrangler email sending enable strandcontrol.com
```

That adds the Email Sending DNS records on `strandcontrol.com`. Replies to the thank-you come back to `support@strandcontrol.com`, so that address needs to be a mailbox you read. If the thank-you cannot be sent, the support message is still delivered and the failure is written to the Worker logs. Sending to an address that is not already verified in the account needs Email Sending on a Workers paid plan.
