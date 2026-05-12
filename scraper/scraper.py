"""
precio-real scraper — MercadoLibre Argentina product discovery + price posting.

Fetches top products from ML Argentina categories and posts prices to
the /api/observe endpoint. Designed to run every 2 hours via crontab.

Usage:
    python -m scraper.scraper
    python -m scraper.scraper --api-base https://api.precio-real.crisolabs.com
    python -m scraper.scraper --dry-run

Env vars (optional overrides):
    PRECIO_REAL_API_BASE   → API base URL (default: https://api.precio-real.crisolabs.com)
    PRECIO_REAL_DRY_RUN    → set to "1" to skip POSTing to /api/observe
"""

from __future__ import annotations

import logging
import os
import re
import time
import urllib.parse
from typing import Optional

import httpx

log = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────

API_BASE_URL = "https://api.precio-real.crisolabs.com"
ML_API_BASE = "https://api.mercadolibre.com"
USER_AGENT = "precio-real-scraper/1.0 (+https://precioreal.ar)"
TIMEOUT_SEC = 15.0
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

def _get_with_retry(client: httpx.Client, url: str) -> httpx.Response:
    """GET with retry on 429/5xx. Raises on final failure."""
    for attempt in range(ML_RETRY_ATTEMPTS):
        resp = client.get(url, timeout=TIMEOUT_SEC)
        if resp.status_code == 429 or resp.status_code >= 500:
            if attempt < ML_RETRY_ATTEMPTS - 1:
                delay = ML_RETRY_BASE_SEC * (2 ** attempt)
                log.debug("[retry] status=%d url=%s sleeping=%.1fs", resp.status_code, url, delay)
                time.sleep(delay)
                continue
        resp.raise_for_status()
        return resp
    resp.raise_for_status()  # last attempt
    return resp  # unreachable, satisfies type checker


def discover_products(
    query: str,
    limit: int = LIMIT_PER_QUERY,
    *,
    client: httpx.Client,
) -> list[dict]:
    """Query ML Argentina search API and return the results list."""
    url = (
        f"{ML_API_BASE}/sites/MLA/search"
        f"?q={urllib.parse.quote(query)}&limit={limit}"
    )
    try:
        resp = client.get(url, timeout=TIMEOUT_SEC)
        resp.raise_for_status()
        data = resp.json()
        return data.get("results") or []
    except Exception as exc:
        log.warning("[discover] query=%r error=%s", query, exc)
        return []


def fetch_item_price(mla_id: str, *, client: httpx.Client) -> Optional[dict]:
    """Fetch a single ML item by ID via /items/<ID>.

    Returns the raw response dict (with at least price + permalink) or None.
    """
    if not re.match(r"^[Mm][Ll][Aa]\d+$", mla_id):
        return None

    upper_id = mla_id.upper()
    url = f"{ML_API_BASE}/items/{upper_id}?attributes={ML_ITEM_ATTRIBUTES}"
    try:
        resp = client.get(url, timeout=TIMEOUT_SEC)
        resp.raise_for_status()
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
    url = f"{api_base}/api/observe"
    try:
        resp = client.post(url, json=payload, timeout=TIMEOUT_SEC)
        resp.raise_for_status()
        data = resp.json()
        inserted = bool(data.get("inserted"))
        deduped = bool(data.get("deduped"))
        return True, inserted, deduped
    except Exception as exc:
        log.warning("[observe] url=%s error=%s", payload.get("url"), exc)
        return False, False, False


# ── Orchestration ─────────────────────────────────────────────────────────────

def run_scraper(
    queries: list[str] = DISCOVERY_QUERIES,
    *,
    api_base: str = API_BASE_URL,
    client: Optional[httpx.Client] = None,
    dry_run: bool = False,
) -> dict:
    """Run discovery across all queries, deduplicate, and POST new prices.

    Returns a stats dict: queries, candidates, posted, inserted, deduped, failed.
    """
    own_client = client is None
    if own_client:
        client = httpx.Client(
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
                "Accept-Language": "es-AR,es;q=0.9",
            },
            follow_redirects=True,
        )

    stats = {
        "queries": len(queries),
        "candidates": 0,
        "posted": 0,
        "inserted": 0,
        "deduped": 0,
        "failed": 0,
    }

    seen_urls: set[str] = set()
    payloads: list[dict] = []

    for query in queries:
        items = discover_products(query, limit=LIMIT_PER_QUERY, client=client)
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

    if not dry_run:
        for payload in payloads:
            ok, inserted, deduped = post_observe(api_base, payload, client=client)
            if ok:
                stats["posted"] += 1
                if inserted:
                    stats["inserted"] += 1
                elif deduped:
                    stats["deduped"] += 1
            else:
                stats["failed"] += 1

    log.info(
        "[scraper] queries=%d candidates=%d posted=%d inserted=%d deduped=%d failed=%d",
        stats["queries"],
        stats["candidates"],
        stats["posted"],
        stats["inserted"],
        stats["deduped"],
        stats["failed"],
    )

    if own_client:
        client.close()  # type: ignore[union-attr]

    return stats


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    import argparse

    logging.basicConfig(
        level=logging.INFO,
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
    args = parser.parse_args()

    stats = run_scraper(api_base=args.api_base, dry_run=args.dry_run)
    print(
        f"Done — queries={stats['queries']} candidates={stats['candidates']} "
        f"posted={stats['posted']} inserted={stats['inserted']} "
        f"deduped={stats['deduped']} failed={stats['failed']}"
    )


if __name__ == "__main__":
    main()
