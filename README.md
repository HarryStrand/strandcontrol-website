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

Static files are served from the repo root. `POST /api/support` is handled by `src/index.js`, which forwards a valid message to [Web3Forms](https://web3forms.com/). `/dartopia/` is `dartopia/index.html`. The same pattern is used for `/privacy/` and `/support/`. A request without the trailing slash redirects to the slash form. Unknown paths return `404.html`.

### `WEB3FORMS_ACCESS_KEY`

The access key is a Worker secret. Do not commit it.

Dashboard: [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) → **strandcontrol-website** → **Settings** → **Variables and Secrets** → **Add** → type **Secret**, name `WEB3FORMS_ACCESS_KEY`, then **Deploy**.

Or from the repo root:

```bash
npx wrangler secret put WEB3FORMS_ACCESS_KEY
```

`wrangler secret put` creates a new version and deploys it immediately. Until the secret exists, a valid `POST /api/support` returns `503` with `{ "ok": false, "error": "not-configured" }`.
