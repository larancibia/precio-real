"""
precio-real scraper — MercadoLibre Argentina product discovery + price posting.

Fetches top products from ML Argentina categories and posts prices to
the /api/observe endpoint. Designed to run every 2 hours via crontab.

Usage:
    python -m scraper.scraper
    python -m scraper.scraper --api-base https://api.precio-real.crisolabs.com
    python -m scraper.scraper --dry-run
    python -m scraper.scraper --dry-run --max-queries 0

Env vars (optional overrides):
    PRECIO_REAL_API_BASE   → API base URL (default: https://api.precio-real.crisolabs.com)
    PRECIO_REAL_DRY_RUN    → set to "1" to skip POSTing to /api/observe
"""

from __future__ import annotations

import logging
import json
import os
import re
import time
import urllib.parse
from datetime import datetime, timezone
from typing import Optional

import httpx

from scraper.antibot import DomainThrottle, ThrottleManager, random_headers
from scraper.monitoring import (
    DEFAULT_RUN_HISTORY_PATH,
    build_run_summary,
    classify_http_failure,
    evaluate_freshness,
    load_latest_successful_observation,
    source_from_url,
    write_run_summary,
)

log = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────

API_BASE_URL = "https://api.precio-real.crisolabs.com"
ML_API_BASE = "https://api.mercadolibre.com"
ML_DOMAIN = "api.mercadolibre.com"
TIMEOUT_SEC = 15.0
THROTTLE_STATE_PATH = os.path.join(os.path.dirname(__file__), "throttle_state.json")
LIMIT_PER_QUERY = 20
ML_ITEM_ATTRIBUTES = "id,title,price,currency_id,permalink,thumbnail"
ML_RETRY_ATTEMPTS = 3
ML_RETRY_BASE_SEC = 1.5

# Category search queries — mirrors backend/src/lib/discovery-queries.ts
DISCOVERY_QUERIES: list[str] = [
    # Electrónica / tech
    "celular",
    "notebook",
    "televisor",
    "auriculares",
    "smart tv",
    "smartwatch",
    "tablet",
    "monitor",
    "playstation",
    "xbox",
    "consola",
    "nintendo switch",
    "camara",
    "parlante bluetooth",
    "impresora",
    "auriculares inalambricos",
    "drone",
    "ssd",
    "memoria ram",
    "router wifi",
    "joystick",
    # Línea blanca
    "heladera",
    "lavarropas",
    "lavavajillas",
    "aire acondicionado",
    "cafetera",
    "microondas",
    "freidora de aire",
    "aspiradora",
    "ventilador",
    "anafe",
    "secarropas",
    "termotanque",
    "horno electrico",
    "licuadora",
    "batidora",
    "procesadora",
    "sandwichera",
    "pava electrica",
    "tostadora",
    "freezer",
    "secador de pelo",
    "plancha de pelo",
    # Hogar
    "colchon",
    "sillon",
    "escritorio",
    "silla gamer",
    "sommier",
    "silla de oficina",
    "lampara led",
    # Deportes
    "bicicleta",
    "monopatin electrico",
    "zapatillas",
    "pelota",
    "carpa",
    "mochila",
    "bicicleta fija",
    "cinta de correr",
    "pesas",
    # Mascotas
    "alimento perro",
    "alimento gato",
    # Auto / moto
    "bateria auto",
    "gps auto",
    "casco moto",
    # Moda / belleza
    "perfume",
    "reloj",
    "campera",
    # Herramientas
    "taladro",
    "amoladora",
    "compresor de aire",
    # Infantil
    "juguetes",
    "cochecito",
]


# ── Pure helpers ─────────────────────────────────────────────────────────────

def extract_mla_id(url: str) -> Optional[str]:
    """Extract normalized MLA ID (e.g. 'MLA1234567890') from a ML URL.

    Handles two formats:
      /MLA-1234567890-slug     → MLA1234567890
      /p/MLA28066215           → MLA28066215
    """
    m = re.search(r"[/]([Mm][Ll][Aa])-?(\d+)", url)
    if m:
        return f"MLA{m.group(2)}"
    return None


def normalize_ml_url(url: str) -> str:
    """Canonicalize a MercadoLibre URL.

    Strips query string, fragment; lowercases hostname; removes trailing
    slash from non-root paths. Mirrors the TypeScript normalizeMLUrl.
    """
    parsed = urllib.parse.urlparse(url.strip())
    host = parsed.netloc.lower()
    path = parsed.path
    if len(path) > 1 and path.endswith("/"):
        path = path.rstrip("/")
    return urllib.parse.urlunparse((parsed.scheme, host, path, "", "", ""))


def build_observe_payload(item: dict) -> Optional[dict]:
    """Build /api/observe JSON payload from an ML search/items result dict.

    Returns None if the item is missing required fields (permalink, valid price).
    """
    permalink = item.get("permalink")
    if not isinstance(permalink, str):
        return None

    price = item.get("price")
    try:
        price = float(price)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if not price or price <= 0:
        return None

    seller_obj = item.get("seller")
    seller: Optional[str] = None
    if isinstance(seller_obj, dict):
        raw = seller_obj.get("nickname")
        seller = str(raw) if raw else None

    thumbnail = item.get("thumbnail")
    image_url: Optional[str] = str(thumbnail) if isinstance(thumbnail, str) else None

    currency = item.get("currency_id") or "ARS"

    return {
        "url": normalize_ml_url(permalink),
        "title": item.get("title"),
        "seller": seller,
        "image_url": image_url,
        "price": round(price, 2),
        "currency": currency,
    }


# ── I/O helpers (accept injectable client for tests) ─────────────────────────


class SourceFetchError(RuntimeError):
    """Fetch failure with a normalized class for run-history aggregation."""

    def __init__(self, failure_class: str, message: str):
        super().__init__(message)
        self.failure_class = failure_class

def _get_with_retry(
    client: httpx.Client,
    url: str,
    throttle: Optional[DomainThrottle] = None,
) -> httpx.Response:
    """GET with retry on 5xx. Records 429/403 bans without hammering ML."""
    for attempt in range(ML_RETRY_ATTEMPTS):
        resp = client.get(url, timeout=TIMEOUT_SEC)
        status_code = getattr(resp, "status_code", 200)
        if not isinstance(status_code, int):
            status_code = 200
        if status_code in (429, 403):
            if throttle is not None:
                throttle.record_ban()
            raise SourceFetchError(
                classify_http_failure(status_code),
                f"ML API returned ban status {status_code}",
            )
        elif status_code >= 500:
            if attempt < ML_RETRY_ATTEMPTS - 1:
                delay = ML_RETRY_BASE_SEC * (2 ** attempt)
                log.debug("[retry] status=%d url=%s sleeping=%.1fs", status_code, url, delay)
                time.sleep(delay)
                continue
            raise SourceFetchError(
                classify_http_failure(status_code),
                f"ML API returned server status {status_code}",
            )
        elif status_code >= 400:
            raise SourceFetchError(
                classify_http_failure(status_code),
                f"ML API returned client status {status_code}",
            )
        resp.raise_for_status()
        if throttle is not None:
            throttle.record_success()
        return resp
    resp.raise_for_status()  # last attempt
    return resp  # unreachable, satisfies type checker


def discover_products(
    query: str,
    limit: int = LIMIT_PER_QUERY,
    *,
    client: httpx.Client,
    throttle: Optional[DomainThrottle] = None,
    failures: Optional[list[dict]] = None,
) -> list[dict]:
    """Query ML Argentina search API and return the results list."""
    url = (
        f"{ML_API_BASE}/sites/MLA/search"
        f"?q={urllib.parse.quote(query)}&limit={limit}"
    )
    try:
        resp = _get_with_retry(client, url, throttle=throttle)
        data = resp.json()
        return data.get("results") or []
    except SourceFetchError as exc:
        if failures is not None:
            failures.append({
                "source": ML_DOMAIN,
                "ok": False,
                "failure_class": exc.failure_class,
            })
        log.warning("[discover] query=%r error=%s", query, exc)
        return []
    except Exception as exc:
        if failures is not None:
            failures.append({
                "source": ML_DOMAIN,
                "ok": False,
                "failure_class": "source_network_error",
            })
        log.warning("[discover] query=%r error=%s", query, exc)
        return []


def fetch_item_price(
    mla_id: str,
    *,
    client: httpx.Client,
    throttle: Optional[DomainThrottle] = None,
) -> Optional[dict]:
    """Fetch a single ML item by ID via /items/<ID>.

    Returns the raw response dict (with at least price + permalink) or None.
    """
    if not re.match(r"^[Mm][Ll][Aa]\d+$", mla_id):
        return None

    upper_id = mla_id.upper()
    url = f"{ML_API_BASE}/items/{upper_id}?attributes={ML_ITEM_ATTRIBUTES}"
    try:
        resp = _get_with_retry(client, url, throttle=throttle)
        data = resp.json()
        if not isinstance(data.get("price"), (int, float)):
            return None
        if not isinstance(data.get("permalink"), str):
            return None
        return data
    except Exception as exc:
        log.warning("[fetch_item] id=%s error=%s", upper_id, exc)
        return None


def post_observe(
    api_base: str,
    payload: dict,
    *,
    client: httpx.Client,
) -> tuple[bool, bool, bool]:
    """POST payload to /api/observe.

    Returns (ok, inserted, deduped).
    """
    result = _post_observe_result(api_base, payload, client=client)
    return bool(result["ok"]), bool(result["inserted"]), bool(result["deduped"])


def _post_observe_result(
    api_base: str,
    payload: dict,
    *,
    client: httpx.Client,
) -> dict:
    """POST payload to /api/observe and return monitoring metadata."""
    url = f"{api_base}/api/observe"
    try:
        resp = client.post(url, json=payload, timeout=TIMEOUT_SEC)
        resp.raise_for_status()
        data = resp.json()
        inserted = bool(data.get("inserted"))
        deduped = bool(data.get("deduped"))
        return {
            "ok": True,
            "inserted": inserted,
            "deduped": deduped,
            "observed_at": int(data.get("observed_at") or time.time()),
        }
    except httpx.HTTPStatusError as exc:
        response = exc.response
        status_code = response.status_code
        request_id = response.headers.get("x-request-id", "-")
        error_code = "-"
        try:
            body = response.json()
            if isinstance(body, dict):
                request_id = str(body.get("request_id") or request_id)
                error = body.get("error")
                if isinstance(error, dict):
                    error_code = str(error.get("code") or error_code)
        except ValueError:
            pass
        failure_class = classify_http_failure(status_code, None if error_code == "-" else error_code)
        if status_code == 503:
            log.warning(
                "[observe] api_unavailable url=%s status=%s error_code=%s request_id=%s",
                payload.get("url"),
                status_code,
                error_code,
                request_id,
            )
        else:
            log.warning(
                "[observe] http_error url=%s status=%s error_code=%s request_id=%s",
                payload.get("url"),
                status_code,
                error_code,
                request_id,
            )
        return {
            "ok": False,
            "inserted": False,
            "deduped": False,
            "failure_class": failure_class,
        }
    except Exception as exc:
        log.warning("[observe] url=%s error=%s", payload.get("url"), exc)
        return {
            "ok": False,
            "inserted": False,
            "deduped": False,
            "failure_class": "api_network_error",
        }


# ── Orchestration ─────────────────────────────────────────────────────────────

def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def run_scraper(
    queries: list[str] = DISCOVERY_QUERIES,
    *,
    api_base: str = API_BASE_URL,
    client: Optional[httpx.Client] = None,
    dry_run: bool = False,
    throttle_manager: Optional[ThrottleManager] = None,
    run_history_path: Optional[os.PathLike[str] | str] = DEFAULT_RUN_HISTORY_PATH,
) -> dict:
    """Run discovery across all queries, deduplicate, and POST new prices.

    Uses ThrottleManager to respect per-domain ban windows and apply
    randomized delays between requests. Persists throttle state to disk.

    Returns a stats dict: queries, candidates, posted, inserted, deduped, failed, skipped_banned.
    """
    started_at = _utc_now_iso()
    own_client = client is None
    if own_client:
        headers = random_headers()
        headers["Accept"] = "application/json"
        client = httpx.Client(headers=headers, follow_redirects=True)

    if throttle_manager is None:
        throttle_manager = ThrottleManager()
        throttle_manager.load_state(THROTTLE_STATE_PATH)

    ml_throttle = throttle_manager.get(ML_DOMAIN, min_delay=2.0, max_delay=5.0)

    stats = {
        "queries": len(queries),
        "candidates": 0,
        "posted": 0,
        "inserted": 0,
        "deduped": 0,
        "failed": 0,
        "skipped_banned": 0,
    }
    observations: list[dict] = []

    # Check if ML API is currently banned
    if ml_throttle.is_banned():
        log.warning(
            "[scraper] ML API domain %s is banned until %.0f — skipping discovery",
            ML_DOMAIN,
            ml_throttle.ban_until,
        )
        stats["skipped_banned"] = len(queries)
        throttle_manager.save_state(THROTTLE_STATE_PATH)
        if run_history_path is not None:
            write_run_summary(
                run_history_path,
                build_run_summary(
                    started_at=started_at,
                    finished_at=_utc_now_iso(),
                    dry_run=dry_run,
                    queries=stats["queries"],
                    candidates=stats["candidates"],
                    skipped_banned=stats["skipped_banned"],
                    observations=observations,
                ),
            )
        if own_client:
            client.close()  # type: ignore[union-attr]
        return stats

    seen_urls: set[str] = set()
    payloads: list[dict] = []

    for idx, query in enumerate(queries):
        # Re-check ban between queries (might get banned mid-run)
        if ml_throttle.is_banned():
            log.warning("[scraper] ML API banned mid-run — stopping discovery")
            stats["skipped_banned"] += len(queries) - idx
            break

        # Throttle between requests
        delay = time.time() - ml_throttle.last_request_at
        min_wait = ml_throttle.min_delay
        if delay < min_wait:
            time.sleep(min_wait - delay + (time.time() % 1) * 0.5)

        items = discover_products(
            query,
            limit=LIMIT_PER_QUERY,
            client=client,
            throttle=ml_throttle,
            failures=observations,
        )

        for item in items:
            payload = build_observe_payload(item)
            if payload is None:
                continue
            norm_url = payload["url"]
            if norm_url in seen_urls:
                continue
            seen_urls.add(norm_url)
            payloads.append(payload)

    stats["candidates"] = len(payloads)
    stats["failed"] = sum(1 for observation in observations if observation.get("ok") is not True)

    if not dry_run:
        for payload in payloads:
            observe_result = _post_observe_result(api_base, payload, client=client)
            observations.append({
                "source": source_from_url(payload.get("url") or ""),
                "ok": observe_result["ok"],
                "inserted": observe_result["inserted"],
                "deduped": observe_result["deduped"],
                "failure_class": observe_result.get("failure_class"),
                "observed_at": observe_result.get("observed_at"),
                "price": payload.get("price"),
                "currency": payload.get("currency"),
                "url": payload.get("url"),
            })
            if observe_result["ok"]:
                stats["posted"] += 1
                if observe_result["inserted"]:
                    stats["inserted"] += 1
                elif observe_result["deduped"]:
                    stats["deduped"] += 1
            else:
                stats["failed"] += 1

    log.info(
        "[scraper] queries=%d candidates=%d posted=%d inserted=%d deduped=%d failed=%d skipped_banned=%d",
        stats["queries"],
        stats["candidates"],
        stats["posted"],
        stats["inserted"],
        stats["deduped"],
        stats["failed"],
        stats["skipped_banned"],
    )

    # Persist throttle state for next run
    throttle_manager.save_state(THROTTLE_STATE_PATH)

    if run_history_path is not None:
        write_run_summary(
            run_history_path,
            build_run_summary(
                started_at=started_at,
                finished_at=_utc_now_iso(),
                dry_run=dry_run,
                queries=stats["queries"],
                candidates=stats["candidates"],
                skipped_banned=stats["skipped_banned"],
                observations=observations,
            ),
        )

    if own_client:
        client.close()  # type: ignore[union-attr]

    return stats


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    import argparse

    log_level = os.environ.get("PRECIO_REAL_LOG_LEVEL", "WARNING").upper()
    logging.basicConfig(
        level=getattr(logging, log_level, logging.WARNING),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    parser = argparse.ArgumentParser(description="precio-real ML scraper")
    parser.add_argument(
        "--api-base",
        default=os.environ.get("PRECIO_REAL_API_BASE", API_BASE_URL),
        help="Base URL of the precio-real API",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=os.environ.get("PRECIO_REAL_DRY_RUN", "") == "1",
        help="Discover products but skip POSTing to /api/observe",
    )
    parser.add_argument(
        "--max-queries",
        type=int,
        default=None,
        help="Limit discovery queries; use 0 for a no-network dry-run smoke test",
    )
    parser.add_argument(
        "--run-history-path",
        default=os.environ.get("PRECIO_REAL_RUN_HISTORY_PATH", str(DEFAULT_RUN_HISTORY_PATH)),
        help="JSONL run-history artifact path",
    )
    parser.add_argument(
        "--check-freshness",
        action="store_true",
        help="Exit nonzero if the latest successful observation is stale",
    )
    parser.add_argument(
        "--freshness-threshold-hours",
        type=float,
        default=float(os.environ.get("PRECIO_REAL_FRESHNESS_THRESHOLD_HOURS", "6")),
        help="Maximum latest-observation age before freshness fails",
    )
    args = parser.parse_args()

    if args.max_queries is not None and args.max_queries < 0:
        parser.error("--max-queries must be greater than or equal to 0")
    if args.freshness_threshold_hours <= 0:
        parser.error("--freshness-threshold-hours must be greater than 0")

    queries = DISCOVERY_QUERIES
    if args.max_queries is not None:
        queries = DISCOVERY_QUERIES[:args.max_queries]

    stats = run_scraper(
        queries=queries,
        api_base=args.api_base,
        dry_run=args.dry_run,
        run_history_path=args.run_history_path,
    )
    output = {"event": "scraper_run", **stats, "run_history_path": args.run_history_path}

    if args.check_freshness:
        latest = load_latest_successful_observation(args.run_history_path)
        output["freshness"] = evaluate_freshness(
            latest,
            now_epoch=int(time.time()),
            max_age_seconds=int(args.freshness_threshold_hours * 3600),
        )

    print(json.dumps(output, sort_keys=True, separators=(",", ":")))

    if args.check_freshness and output.get("freshness", {}).get("ok") is not True:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
