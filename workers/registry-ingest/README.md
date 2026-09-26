# registry-ingest (Cloudflare Worker)

Accepts anonymous registry POSTs from the public site and upserts
`data/records.json` on **main** and **gh-pages** via the GitHub Contents API.

The GitHub PAT (`REGISTRY_GH_TOKEN`) lives only as a Worker secret — never in
committed JS/HTML on main or gh-pages.

## Deploy (free Cloudflare account)

1. Install Wrangler (once): `npm i -g wrangler` or use `npx wrangler`.
2. Log in: `npx wrangler login`
3. Edit `wrangler.toml` and set `account_id` (from the Cloudflare dashboard).
4. Put secrets (paste when prompted — do not commit them):

   ```bash
   cd workers/registry-ingest
   npx wrangler secret put REGISTRY_GH_TOKEN
   npx wrangler secret put REGISTRY_INGEST_KEY
   ```

   - `REGISTRY_GH_TOKEN` — same fine-grained PAT as the Actions secret
     (Contents read/write on `sam-t-dev/homeless-registry`).
   - `REGISTRY_INGEST_KEY` — same shared ingest key as in
     `registry-ingest-config.js` / the Actions secret.

5. Deploy:

   ```bash
   npx wrangler deploy
   ```

6. Copy the printed `*.workers.dev` URL into repo root
   `registry-api-config.js` on **both** `main` and `gh-pages`:

   ```js
   window.REGISTRY_API_URL = "https://registry-ingest.<account>.workers.dev";
   ```

   Or give the URL to the agent to push.

## API

`POST /` with JSON:

```json
{ "record": { "id": "...", "country": "...", "countryCode": "AU", "city": "...", "category": "...", "duration": "...", "needs": [], "timestamp": "..." }, "ingestKey": "..." }
```

Success: `{ "ok": true, "results": [...] }`  
Errors: `{ "ok": false, "error": "..." }`

CORS allows `https://sam-t-dev.github.io` and `localhost` / `127.0.0.1`.
