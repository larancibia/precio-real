"""Catalog URL classifier and audit tests."""

import json

from scraper.catalog_urls import audit_catalog_urls, classify_product_url, main


BAD_CATALOG_URLS = [
    "https://www.fravega.com/l/celulares/",
    "https://www.naldo.com.ar/ayuda",
    "https://www.jumbo.com.ar/institucional/privacidad",
    "https://www.disco.com.ar/sitemap.xml",
    "https://www.sodimac.com.ar/sodimac-ar/category/cat10012/herramientas",
    "https://www.easy.com.ar/blog/ideas-para-tu-casa",
    "https://www.compumundo.com.ar/contacto",
    "https://www.farmacity.com/terminos-y-condiciones",
    "https://www.coppel.com.ar/c/celulares",
]


GOOD_PRODUCT_URLS = [
    "https://www.naldo.com.ar/smart-tv-samsung-55-un55cu7000/p",
    "https://www.cetrogar.com.ar/notebook-lenovo-ideapad-15alc7-82r400bwar.html",
    "https://www.carrefour.com.ar/smart-tv-50-pulgadas-uhd-4k/p",
    "https://www.amazon.com/-/es/SAMSUNG-Galaxy-S24-128GB-Desbloqueado/dp/B0CMDRCZBX",
    "https://compragamer.com/producto/Notebook_Gamer_ASUS_TUF_A15_16549",
]


def test_known_bad_catalog_urls_are_non_product():
    for url in BAD_CATALOG_URLS:
        result = classify_product_url(url)
        assert result.is_product is False, url
        assert result.quarantine is True, url
        assert result.reason in {
            "category_path",
            "support_path",
            "legal_path",
            "sitemap_path",
            "blog_path",
        }


def test_known_good_urls_remain_product_candidates():
    for url in GOOD_PRODUCT_URLS:
        result = classify_product_url(url)
        assert result.is_product is True, url
        assert result.quarantine is False, url
        assert result.reason == "product_allowlist"


def test_audit_report_is_dry_run_and_sanitized():
    rows = GOOD_PRODUCT_URLS[:2] + BAD_CATALOG_URLS[:3]

    report = audit_catalog_urls(rows)

    assert report["summary"] == {
        "total": 5,
        "valid": 2,
        "invalid": 0,
        "quarantined": 3,
        "unknown": 0,
    }
    assert [entry["url"] for entry in report["quarantine"]] == BAD_CATALOG_URLS[:3]
    assert set(report["quarantine"][0]) == {"url", "host", "reason"}


def test_audit_report_json_is_machine_readable():
    report = audit_catalog_urls(["not a url", GOOD_PRODUCT_URLS[0], BAD_CATALOG_URLS[0]])

    encoded = json.dumps(report)
    decoded = json.loads(encoded)

    assert decoded["summary"]["invalid"] == 1
    assert decoded["summary"]["valid"] == 1
    assert decoded["summary"]["quarantined"] == 1


def test_audit_command_writes_sanitized_report_without_mutating_input(tmp_path):
    input_path = tmp_path / "catalog.txt"
    report_path = tmp_path / "quarantine.json"
    rows = [GOOD_PRODUCT_URLS[0], BAD_CATALOG_URLS[0], "not a url"]
    input_path.write_text("\n".join(rows), encoding="utf-8")

    exit_code = main(["--input", str(input_path), "--quarantine-file", str(report_path)])

    assert exit_code == 0
    assert input_path.read_text(encoding="utf-8") == "\n".join(rows)
    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert report["summary"] == {
        "total": 3,
        "valid": 1,
        "invalid": 1,
        "quarantined": 1,
        "unknown": 0,
    }
    assert report["quarantine"] == [
        {
            "url": BAD_CATALOG_URLS[0],
            "host": "fravega.com",
            "reason": "category_path",
        }
    ]
