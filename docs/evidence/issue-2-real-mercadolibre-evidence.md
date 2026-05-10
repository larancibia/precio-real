# Issue #2 real Mercado Libre evidence plan

GitHub issue: `larancibia/portfolio-os#2`

## Goal

Capture repeatable evidence that the installed Chrome extension can observe real Mercado Libre Argentina product detail pages (PDPs), post the DOM-observed price to production `/api/observe`, render a badge, and read the production `/api/price` response. Do not use synthetic fixture catalog rows as press evidence.

## Evidence storage

Keep generated evidence outside git. The capture script defaults to:

```bash
../portfolio-os-2-real-evidence-artifacts/<timestamp>/
```

Expected files:

- `api/health.json` and `api/stats.json`: production API smoke snapshots with capture timestamps.
- `source-search-pages.json`: live Mercado Libre search pages used to discover PDP links.
- `urls.txt`: normalized PDP URLs opened by Chrome.
- `observations.jsonl`: one JSON record per opened PDP.
- `api/price-NN.json`: production `/api/price` response for each observed PDP.
- `screenshots/page-NN.png`: viewport screenshot for the first evidence examples.
- `screenshots/badge-NN.png`: badge crop when the badge rendered.
- `summary.json`: aggregate counts for issue/PR comments.

## Automated capture

Run from the repo root:

```bash
node scripts/capture-ml-evidence.mjs --limit 30 --screenshots 5 --headed
```

Use `--headless` only for a smoke run. Headed Chrome is preferred for press evidence because it exercises the installed unpacked extension in a visible browser window and makes Mercado Libre bot challenges easier to detect.

If Mercado Libre shows a CAPTCHA/security wall, rerun with a manual pause:

```bash
node scripts/capture-ml-evidence.mjs --limit 30 --screenshots 5 --headed --pause-on-captcha --captcha-wait-ms 300000
```

Solve the challenge in the Chrome window. The script keeps polling the same tab and only records the row as evidence if the final page exposes a real PDP state.

The script uses only local Chrome DevTools Protocol and Node built-ins. It does not read secrets, deploy, or write evidence into the git worktree.

## Manual fallback

If Mercado Libre blocks automation or Chrome cannot load the extension:

1. Open Chrome with the unpacked extension from `extension/`.
2. Create an evidence directory outside git, for example `../portfolio-os-2-real-evidence-artifacts/manual-YYYYMMDDTHHMMSSZ/`.
3. Save API smoke snapshots:

   ```bash
   curl -fsS https://precio-real.firemandeveloper.com/api/health > ../portfolio-os-2-real-evidence-artifacts/manual-YYYYMMDDTHHMMSSZ/api-health.json
   curl -fsS https://precio-real.firemandeveloper.com/api/stats > ../portfolio-os-2-real-evidence-artifacts/manual-YYYYMMDDTHHMMSSZ/api-stats.json
   ```

4. Search Mercado Libre manually and open at least 30 real PDP URLs.
5. For each PDP, wait for the Precio Real badge or record the blocker if no badge appears.
6. For at least 5 PDPs, save:
   - full page screenshot,
   - badge screenshot,
   - `/api/price?url=<canonical PDP URL>` response with capture timestamp,
   - URL, observed price, badge text, and any browser console/network error.
7. Write one JSONL row per PDP using the same field names as `observations.jsonl` where possible.

## Acceptance mapping

- 30+ real PDPs opened: `summary.json.summary.attempted >= 30` and `urls.txt` links come from live Mercado Libre search pages or a manually verified URL file.
- Extension installed: `observations.jsonl.extension_loaded == true`.
- Real DOM observation: `observations.jsonl.observed_price` is numeric and `/api/observe` appears with a 2xx network status.
- Badge examples: at least 5 rows have `page_screenshot`, `badge_screenshot`, and non-null `badge`.
- API timestamp examples: at least 5 rows have `api_price_captured_at` and an `api/price-NN.json` file.
- No fixture evidence: do not use `backend/scripts/seed*` output or seeded `/api/trending` rows as press proof unless independently opened as live Mercado Libre PDPs in Chrome.
