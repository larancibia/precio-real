"""Retailer fixture extraction helpers.

These helpers are deliberately conservative: they parse public product data
from stable HTML metadata or documented/public JSON surfaces, and mark known
unsupported retailers as skipped instead of failed.
"""

from __future__ import annotations

import argparse
import json
import re
from html import unescape
from pathlib import Path
from typing import Any


RETAILER_STATUS: dict[str, dict[str, str]] = {
    "naldo": {"status": "supported", "kind": "html_metadata"},
    "cetrogar": {"status": "supported", "kind": "html_metadata"},
    "carrefour": {"status": "supported", "kind": "vtex_api"},
    "jumbo": {"status": "supported", "kind": "vtex_api"},
    "disco": {"status": "supported", "kind": "vtex_api"},
    "farmacity": {"status": "supported", "kind": "vtex_api"},
    "compragamer": {"status": "supported", "kind": "compragamer_api"},
    "amazon_ar": {
        "status": "unsupported",
        "kind": "unsupported",
        "reason": "amazon.com.ar has no localized Amazon Argentina store and redirects to amazon.com; skip for AR pricing.",
    },
}


FIXTURE_FILES: dict[str, str] = {
    "naldo": "naldo_product.html",
    "cetrogar": "cetrogar_product.html",
    "carrefour": "carrefour_vtex.json",
    "jumbo": "jumbo_vtex.json",
    "disco": "disco_vtex.json",
    "farmacity": "farmacity_vtex.json",
    "compragamer": "compragamer_products.json",
}

SUPPORTED_FIXTURE_SUCCESS_RATE_TARGET = 1.0


def parse_argentine_price(value: Any) -> float | None:
    """Parse ARS price strings without accepting tiny/non-price fragments."""
    if isinstance(value, (int, float)):
        price = float(value)
        return round(price, 2) if price > 0 else None
    if not isinstance(value, str):
        return None

    cleaned = re.sub(r"[^\d,\.]", "", value)
    if not cleaned:
        return None

    if "." in cleaned and "," in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            normalized = cleaned.replace(".", "").replace(",", ".")
        else:
            normalized = cleaned.replace(",", "")
    elif "." in cleaned:
        head, tail = cleaned.rsplit(".", 1)
        normalized = cleaned.replace(".", "") if len(tail) == 3 and head else cleaned
    elif "," in cleaned:
        head, tail = cleaned.rsplit(",", 1)
        normalized = cleaned.replace(",", "") if len(tail) == 3 and head else cleaned.replace(",", ".")
    else:
        normalized = cleaned

    try:
        price = float(normalized)
    except ValueError:
        return None
    return round(price, 2) if price > 0 else None


def _normalize_observation(
    *,
    retailer_id: str,
    title: Any,
    price: Any,
    url: Any,
    currency: Any = "ARS",
    seller: Any = None,
    image_url: Any = None,
    availability: Any = None,
) -> dict | None:
    parsed_price = parse_argentine_price(price)
    if parsed_price is None or not isinstance(title, str) or not title.strip():
        return None
    if not isinstance(url, str) or not url.startswith("https://"):
        return None

    return {
        "retailer_id": retailer_id,
        "url": url,
        "title": title.strip(),
        "seller": seller if isinstance(seller, str) and seller else None,
        "image_url": image_url if isinstance(image_url, str) and image_url else None,
        "price": parsed_price,
        "currency": currency if isinstance(currency, str) and currency else "ARS",
        "availability": availability if isinstance(availability, str) and availability else None,
    }


def _json_ld_blocks(html: str) -> list[Any]:
    blocks: list[Any] = []
    for match in re.finditer(
        r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
        html,
        re.I | re.S,
    ):
        raw = unescape(match.group(1)).strip()
        if not raw:
            continue
        try:
            blocks.append(json.loads(raw))
        except json.JSONDecodeError:
            continue
    return blocks


def _iter_json_objects(value: Any) -> list[dict]:
    if isinstance(value, dict):
        graph = value.get("@graph")
        if isinstance(graph, list):
            return [item for item in graph if isinstance(item, dict)] + [value]
        return [value]
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def _meta_content(html: str, key: str) -> str | None:
    pattern = (
        r"<meta[^>]+(?:property|name|itemprop)=[\"']"
        + re.escape(key)
        + r"[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>"
    )
    match = re.search(pattern, html, re.I)
    if match:
        return unescape(match.group(1)).strip()
    reverse_pattern = (
        r"<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name|itemprop)=[\"']"
        + re.escape(key)
        + r"[\"'][^>]*>"
    )
    match = re.search(reverse_pattern, html, re.I)
    return unescape(match.group(1)).strip() if match else None


def extract_html_metadata(retailer_id: str, html: str, source_url: str | None) -> list[dict]:
    observations: list[dict] = []

    for block in _json_ld_blocks(html):
        for obj in _iter_json_objects(block):
            if obj.get("@type") != "Product":
                continue
            offers = obj.get("offers")
            offer = offers[0] if isinstance(offers, list) and offers else offers
            if not isinstance(offer, dict):
                continue
            observation = _normalize_observation(
                retailer_id=retailer_id,
                title=obj.get("name"),
                price=offer.get("price") or offer.get("lowPrice"),
                currency=offer.get("priceCurrency", "ARS"),
                url=offer.get("url") or obj.get("url") or source_url,
                image_url=(obj.get("image")[0] if isinstance(obj.get("image"), list) else obj.get("image")),
                availability=offer.get("availability"),
            )
            if observation:
                observations.append(observation)

    if observations:
        return observations

    observation = _normalize_observation(
        retailer_id=retailer_id,
        title=_meta_content(html, "og:title") or _meta_content(html, "name"),
        price=_meta_content(html, "product:price:amount") or _meta_content(html, "price"),
        currency=_meta_content(html, "product:price:currency") or "ARS",
        url=_meta_content(html, "og:url") or source_url,
        image_url=_meta_content(html, "og:image"),
    )
    return [observation] if observation else []


def extract_vtex_products(retailer_id: str, payload: str) -> list[dict]:
    try:
        products = json.loads(payload)
    except json.JSONDecodeError:
        return []
    if not isinstance(products, list):
        return []

    observations: list[dict] = []
    for product in products:
        if not isinstance(product, dict):
            continue
        items = product.get("items")
        item = items[0] if isinstance(items, list) and items else {}
        if not isinstance(item, dict):
            item = {}
        sellers = item.get("sellers")
        seller = sellers[0] if isinstance(sellers, list) and sellers else {}
        if not isinstance(seller, dict):
            seller = {}
        offer = seller.get("commertialOffer") if isinstance(seller.get("commertialOffer"), dict) else {}
        images = item.get("images")
        image = images[0] if isinstance(images, list) and images else {}
        observation = _normalize_observation(
            retailer_id=retailer_id,
            title=product.get("productName"),
            price=offer.get("Price"),
            url=product.get("link"),
            seller=seller.get("sellerName"),
            image_url=image.get("imageUrl") if isinstance(image, dict) else None,
            availability="in_stock" if offer.get("AvailableQuantity", 0) else "out_of_stock",
        )
        if observation:
            observations.append(observation)
    return observations


def extract_compragamer_products(payload: str) -> list[dict]:
    try:
        products = json.loads(payload)
    except json.JSONDecodeError:
        return []
    if not isinstance(products, list):
        return []

    observations: list[dict] = []
    for product in products:
        if not isinstance(product, dict):
            continue
        product_id = product.get("id")
        url = f"https://compragamer.com/producto/{product_id}" if product_id else None
        images = product.get("imagenes")
        image = images[0] if isinstance(images, list) and images else None
        observation = _normalize_observation(
            retailer_id="compragamer",
            title=product.get("nombre") or product.get("name"),
            price=product.get("precio") or product.get("price"),
            url=url,
            seller="CompraGamer",
            image_url=f"https://compragamer.com/imagenes/{image}" if isinstance(image, str) else None,
        )
        if observation:
            observations.append(observation)
    return observations


def extract_observations_from_fixture(
    retailer_id: str,
    payload: str,
    *,
    source_url: str | None = None,
) -> list[dict]:
    """Extract observations from a saved retailer fixture."""
    status = RETAILER_STATUS.get(retailer_id)
    if status is None or status["status"] != "supported":
        return []

    kind = status["kind"]
    if kind == "html_metadata":
        return extract_html_metadata(retailer_id, payload, source_url)
    if kind == "vtex_api":
        return extract_vtex_products(retailer_id, payload)
    if kind == "compragamer_api":
        return extract_compragamer_products(payload)
    return []


def smoke_fixture_extractors(fixture_dir: Path) -> dict:
    """Run local fixtures and report per-retailer successes/failures/skips."""
    retailers: dict[str, dict[str, Any]] = {}
    summary: dict[str, Any] = {"retailers": 0, "successes": 0, "failures": 0, "skipped": 0}

    for retailer_id, status in RETAILER_STATUS.items():
        summary["retailers"] += 1
        if status["status"] != "supported":
            summary["skipped"] += 1
            retailers[retailer_id] = {
                "status": status["status"],
                "reason": status.get("reason"),
                "successes": 0,
                "failures": 0,
                "skipped": 1,
            }
            continue

        fixture_name = FIXTURE_FILES.get(retailer_id)
        fixture_path = fixture_dir / fixture_name if fixture_name else None
        if fixture_path is None or not fixture_path.exists():
            summary["failures"] += 1
            retailers[retailer_id] = {"status": "supported", "successes": 0, "failures": 1, "skipped": 0}
            continue

        observations = extract_observations_from_fixture(
            retailer_id,
            fixture_path.read_text(encoding="utf-8"),
            source_url=_fixture_source_url(retailer_id),
        )
        if observations:
            summary["successes"] += 1
            retailers[retailer_id] = {
                "status": "supported",
                "successes": len(observations),
                "failures": 0,
                "skipped": 0,
                "success_rate": 1.0,
            }
        else:
            summary["failures"] += 1
            retailers[retailer_id] = {
                "status": "supported",
                "successes": 0,
                "failures": 1,
                "skipped": 0,
                "success_rate": 0.0,
            }

    supported_count = summary["retailers"] - summary["skipped"]
    summary["success_rate"] = round(summary["successes"] / supported_count, 4) if supported_count else 0.0
    summary["target_success_rate"] = SUPPORTED_FIXTURE_SUCCESS_RATE_TARGET
    summary["meets_target"] = summary["success_rate"] >= SUPPORTED_FIXTURE_SUCCESS_RATE_TARGET
    return {"summary": summary, "retailers": retailers}


def _fixture_source_url(retailer_id: str) -> str | None:
    return {
        "naldo": "https://www.naldo.com.ar/smart-tv-samsung-55-un55cu7000/p",
        "cetrogar": "https://www.cetrogar.com.ar/notebook-lenovo-ideapad-15alc7-82r400bwar.html",
    }.get(retailer_id)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run retailer fixture extraction smoke checks")
    parser.add_argument(
        "--fixture-dir",
        default=str(Path(__file__).resolve().parent / "tests" / "fixtures" / "retailers"),
        help="Directory containing retailer fixture files",
    )
    args = parser.parse_args(argv)

    report = smoke_fixture_extractors(Path(args.fixture_dir))
    print(json.dumps(report, indent=2, sort_keys=True))
    return 1 if report["summary"]["failures"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
