# StrandControl website

Static site for [strandcontrol.com](https://strandcontrol.com/): studio home, Dartopia, privacy, and support.

## Local preview

```bash
python3 -m http.server 8877
```

Then open `http://127.0.0.1:8877/` and `http://127.0.0.1:8877/dartopia`.

## Cloudflare Pages

Create a Pages project from this repo.

- **Build command:** none
- **Build output directory:** `/`
- **Custom domain:** `strandcontrol.com`

`/dartopia` is `dartopia/index.html`. Same pattern for `/privacy` and `/support`.
