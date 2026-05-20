# Scraper Monitoring Runbook

The Python scraper writes one compact JSON line per run to stdout and appends a JSONL run-history artifact. Cron should redirect stdout/stderr once to the scraper log; do not wrap the command with `tee` or a second logger, because systemd/cron already captures the same line.

Default local history path:

```bash
scraper/run_history.jsonl
```

Production cron installed by `scraper/install_cron.sh` uses:

```bash
/tmp/precio-real-scraper-run-history.jsonl
```

## Run Summary

Each history row contains:

- `started_at` and `finished_at`
- `queries` and `candidates`
- `attempted`, `succeeded`, `failed`, and `success_rate`
- `retailers`, keyed by source, with per-source success rate and last successful price
- `failure_classes` and `top_failure_reasons`
- `latest_successful_observation` with source, URL, price, currency, and `observed_at`

Dry-run smoke test, with no production posting:

```bash
python3 -m scraper.scraper \
  --dry-run \
  --max-queries 1 \
  --run-history-path /tmp/precio-real-scraper-dry-run.jsonl
```

The command emits one JSON line with `event:"scraper_run"`. The dry-run history row should have `dry_run:true`; `attempted`, `succeeded`, and `failed` remain zero because no `/api/observe` calls are made.

## Freshness Alert

Cron should use a conservative threshold of 6 hours. The scraper runs every 2 hours, so 6 hours allows two missed runs plus routine network jitter before alerting.

```bash
python3 -m scraper.scraper \
  --run-history-path /tmp/precio-real-scraper-run-history.jsonl \
  --check-freshness \
  --freshness-threshold-hours 6
```

Exit codes:

- `0`: scraper completed and the latest successful observation is fresh.
- `2`: scraper completed but history is missing, has no successful observation, or latest success is older than the threshold.
- Other nonzero: Python/runtime failure before normal summary handling.

For alerting, parse the final JSON line. `freshness.status` is `fresh`, `stale`, or `missing`; `freshness.age_seconds` gives the current age when a latest success exists.

## Diagnosis

DB down:

- Symptom: `failure_classes.database_unavailable` increases, scraper logs contain `[observe] api_unavailable status=503`, and `/api/ready` returns 503.
- Check: `curl -fsS http://127.0.0.1:8402/api/ready`.
- Action: inspect `precio-real-postgres.service`, `precio-real-api.service`, and Docker compose health. Keep secrets out of tickets and PRs.

Selector drift:

- Symptom: source-specific failures appear as `selector_drift` in retailer fixture smoke checks, or candidate counts drop unexpectedly while ML/API health remains normal.
- Check: `python3 -m pytest scraper/tests/test_retailer_extractors.py -q`.
- Action: update extractor fixtures/selectors in a selector-owned issue. Do not mix broad selector edits into monitoring-only work.

Anti-bot blocks:

- Symptom: ML discovery logs ban status 403/429, `skipped_banned` is nonzero, and throttle state records a ban window.
- Check: inspect the JSON run line for `skipped_banned`, then review `scraper/throttle_state.json` on the host.
- Action: let the throttle window expire, reduce request rate if repeated, and avoid manual tight loops against the source.

API rate limits:

- Symptom: `failure_classes.api_rate_limited` or repeated 429 logs.
- Check: compare the run timestamp with deploys or manual backfills that may have increased request volume.
- Action: pause extra jobs, keep cron at the documented cadence, and resume after the source/API limit clears.

## Rollback

If monitoring causes false alerts, remove `--check-freshness` from cron while keeping `--run-history-path` enabled. If run-history writes fail because of filesystem permissions, move the history path to a writable location such as `/tmp/precio-real-scraper-run-history.jsonl` and rerun the dry-run smoke test.
