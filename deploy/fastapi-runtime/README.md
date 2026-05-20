# Precio Real FastAPI/Postgres Runtime

This directory versions the live ingestion runtime used by the scraper when it posts observations to `/api/observe`. It is intentionally separate from the Cloudflare Worker backend so the VPS FastAPI/Postgres stack can be rebuilt after a reboot or host replacement without reading files from `/opt`.

Current production ports:

- FastAPI: `127.0.0.1:8402`
- Postgres: host port `54330` published to container port `5432`

## Files

- `app/main.py`: FastAPI health and observe endpoints.
- `schema.sql`: idempotent Postgres schema for `products` and `prices`.
- `compose.yml`: Postgres and API services with explicit restart policies.
- `env.example`: sanitized variable names and formats.
- `systemd/*.service`: templates for deterministic boot recovery.

## Local Recreate

```bash
cd deploy/fastapi-runtime
cp env.example .env
```

Edit `.env` with a generated local password. Do not commit `.env`.

```bash
docker compose up -d postgres
docker compose ps postgres
docker compose up -d api
curl -fsS http://127.0.0.1:8402/api/health
```

`docker compose up -d postgres` should leave Postgres healthy. The compose file sets `restart: unless-stopped` so Docker restarts the database after daemon or VPS reboots unless an operator intentionally stopped it.

## Observe Smoke Test

Use synthetic data only. This proves `/api/observe` returns 200 without inserting real customer or production payloads.

```bash
curl -fsS -X POST http://127.0.0.1:8402/api/observe \
  -H 'content-type: application/json' \
  --data '{
    "url": "https://articulo.mercadolibre.com.ar/MLA-999999999-precio-real-smoke.invalid",
    "title": "Precio Real synthetic smoke product",
    "seller": "precio-real-smoke",
    "image_url": "https://http2.mlstatic.com/smoke.jpg",
    "price": 12345.67,
    "currency": "ARS"
  }'
```

Expected response:

```json
{"ok":true,"inserted":true,"deduped":false,"product_id":1,"observed_at":1760000000}
```

The second call with the same price inside 10 minutes may return `"deduped": true`; that is expected.

Cleanup the synthetic row:

```bash
docker compose exec postgres sh -lc 'psql \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -c "DELETE FROM prices WHERE product_id IN (SELECT id FROM products WHERE url = '\''https://articulo.mercadolibre.com.ar/MLA-999999999-precio-real-smoke.invalid'\''); DELETE FROM products WHERE url = '\''https://articulo.mercadolibre.com.ar/MLA-999999999-precio-real-smoke.invalid'\'';"'
```

## Aranserver Rollout Checklist

Rollout checklist for the production host:

1. Build from a clean checkout or release artifact.
2. Copy this directory to `/opt/precio-real-api` or update the existing checkout in place.
3. Create `/opt/precio-real-api/.env` from `env.example` with server-only secrets.
4. Run `docker compose config` from `/opt/precio-real-api`.
5. Run `docker compose up -d postgres` and wait for a healthy status.
6. Run `docker compose up -d api`.
7. Install or refresh the systemd units:

```bash
sudo cp systemd/precio-real-postgres.service /etc/systemd/system/
sudo cp systemd/precio-real-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable precio-real-postgres.service precio-real-api.service
sudo systemctl restart precio-real-postgres.service precio-real-api.service
```

8. Run the health check and synthetic observe smoke test.
9. Confirm the scraper points at `http://127.0.0.1:8402/api/observe`.
10. Confirm the Cloudflare Worker public API still reads from its expected backend and has not been switched unintentionally.

## Rollback

Keep the Cloudflare Worker backend and this FastAPI ingestion runtime aligned during rollback:

1. If FastAPI ingestion fails, stop only the API service first: `sudo systemctl stop precio-real-api.service`. Leave Postgres running unless the database itself is corrupt.
2. Repoint the scraper to the last known-good ingestion URL or pause scraper cron/jobs to avoid silent observation failures.
3. If a previous `/opt/precio-real-api` release is available, restore that release and its matching `.env`, then run `docker compose config` before starting services.
4. Do not deploy Cloudflare Worker schema/API changes while the VPS runtime is rolled back. If Worker changes already shipped, roll the Worker back to the release that matches the active ingestion schema.
5. Re-run `/api/health` and the synthetic `/api/observe` smoke test before resuming scraper jobs.

Secrets, real customer data, tokens, and raw production payloads must remain outside the repo.
