"""Product URL classification and dry-run catalog audits.

This module is intentionally pure and conservative: only known product URL
shapes are marked as product candidates, while obvious category/support/legal
paths are quarantined for scheduler skips and human inspection.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse


SUPPORT_PATH_RE = re.compile(r"^/(ayuda|help|contacto|atencion-al-cliente|centro-de-ayuda)(/|$)", re.I)
LEGAL_PATH_RE = re.compile(r"/(privacidad|privacy|terminos|terminos-y-condiciones|legales)(/|$)", re.I)
SITEMAP_PATH_RE = re.compile(r"^/(sitemap(\.xml)?|robots\.txt)(/|$)", re.I)
BLOG_PATH_RE = re.compile(r"^/(blog|ideas)(/|$)", re.I)
CATEGORY_PATH_RE = re.compile(
    r"^/(c|categoria|categorias|category|cat|l|departamento|collections?|sodimac-ar/category)(/|$)",
    re.I,
)


PRODUCT_RULES: tuple[tuple[re.Pattern[str], re.Pattern[str]], ...] = (
    (re.compile(r"(^|\.)mercadolibre\.com\.ar$", re.I), re.compile(r"(/MLA-?\d+|/p/MLA\d+)", re.I)),
    (re.compile(r"(^|\.)naldo\.com\.ar$", re.I), re.compile(r"/p/?$", re.I)),
    (re.compile(r"(^|\.)cetrogar\.com\.ar$", re.I), re.compile(r"\.html$", re.I)),
    (re.compile(r"(^|\.)carrefour\.com\.ar$", re.I), re.compile(r"/p/?$", re.I)),
    (re.compile(r"(^|\.)amazon\.", re.I), re.compile(r"/(dp|gp/product)/[A-Z0-9]{10}(/|$)", re.I)),
    (re.compile(r"(^|\.)compragamer\.com$", re.I), re.compile(r"/producto/", re.I)),
    (re.compile(r"(^|\.)fravega\.com$", re.I), re.compile(r"/p/", re.I)),
    (re.compile(r"(^|\.)sodimac\.com\.ar$", re.I), re.compile(r"/sodimac-ar/product/", re.I)),
    (re.compile(r"(^|\.)easy\.com\.ar$", re.I), re.compile(r"/p(/|$)", re.I)),
    (re.compile(r"(^|\.)farmacity\.com$", re.I), re.compile(r"/p(/|$)", re.I)),
    (re.compile(r"(^|\.)coppel\.com\.ar$", re.I), re.compile(r"/p(/|$)", re.I)),
)


@dataclass(frozen=True)
class UrlClassification:
    is_product: bool
    quarantine: bool
    reason: str
    host: str | None


def _clean_host(netloc: str) -> str:
    host = netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def classify_product_url(url: str) -> UrlClassification:
    """Classify a catalog URL as product, quarantined, invalid, or unknown."""
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return UrlClassification(False, False, "invalid_url", None)

    host = _clean_host(parsed.netloc)
    path = parsed.path.rstrip("/") or "/"

    for reason, pattern in (
        ("sitemap_path", SITEMAP_PATH_RE),
        ("support_path", SUPPORT_PATH_RE),
        ("legal_path", LEGAL_PATH_RE),
        ("blog_path", BLOG_PATH_RE),
        ("category_path", CATEGORY_PATH_RE),
    ):
        if pattern.search(path):
            return UrlClassification(False, True, reason, host)

    for host_pattern, path_pattern in PRODUCT_RULES:
        if host_pattern.search(host) and path_pattern.search(path):
            return UrlClassification(True, False, "product_allowlist", host)

    return UrlClassification(False, False, "unknown_pattern", host)


def audit_catalog_urls(urls: Iterable[str]) -> dict:
    """Return a sanitized report. Does not mutate catalog data."""
    summary = {"total": 0, "valid": 0, "invalid": 0, "quarantined": 0, "unknown": 0}
    quarantine: list[dict[str, str | None]] = []
    invalid: list[dict[str, str | None]] = []
    unknown: list[dict[str, str | None]] = []

    for raw_url in urls:
        url = raw_url.strip()
        if not url:
            continue
        summary["total"] += 1
        result = classify_product_url(url)
        entry = {"url": url, "host": result.host, "reason": result.reason}
        if result.is_product:
            summary["valid"] += 1
        elif result.quarantine:
            summary["quarantined"] += 1
            quarantine.append(entry)
        elif result.reason == "invalid_url":
            summary["invalid"] += 1
            invalid.append(entry)
        else:
            summary["unknown"] += 1
            unknown.append(entry)

    return {
        "summary": summary,
        "quarantine": quarantine,
        "invalid": invalid,
        "unknown": unknown,
    }


def _read_urls(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    stripped = text.strip()
    if not stripped:
        return []
    if stripped.startswith("["):
        data = json.loads(stripped)
        if not isinstance(data, list):
            raise ValueError("JSON input must be a list of URLs or objects with url")
        urls = []
        for item in data:
            if isinstance(item, str):
                urls.append(item)
            elif isinstance(item, dict) and isinstance(item.get("url"), str):
                urls.append(item["url"])
        return urls
    return [line.strip() for line in text.splitlines() if line.strip()]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Dry-run audit of product catalog URLs")
    parser.add_argument("--input", required=True, help="Newline-delimited URL file or JSON list")
    parser.add_argument(
        "--quarantine-file",
        help="Optional output path for the sanitized quarantine report. Omitted by default.",
    )
    args = parser.parse_args(argv)

    report = audit_catalog_urls(_read_urls(Path(args.input)))
    output = json.dumps(report, indent=2, sort_keys=True)
    if args.quarantine_file:
        Path(args.quarantine_file).write_text(f"{output}\n", encoding="utf-8")
    else:
        print(output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
