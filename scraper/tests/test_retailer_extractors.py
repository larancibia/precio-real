"""Fixture-backed retailer extraction tests."""

from pathlib import Path

import pytest

from scraper.retailer_extractors import (
    RETAILER_STATUS,
    extract_observations_from_fixture,
    smoke_fixture_extractors,
)


FIXTURES = Path(__file__).resolve().parent / "fixtures" / "retailers"


@pytest.mark.parametrize(
    ("retailer_id", "fixture_name", "url", "expected_price"),
    [
        ("naldo", "naldo_product.html", "https://www.naldo.com.ar/smart-tv-samsung-55-un55cu7000/p", 799999.99),
        ("cetrogar", "cetrogar_product.html", "https://www.cetrogar.com.ar/notebook-lenovo-ideapad-15alc7-82r400bwar.html", 650000),
        ("carrefour", "carrefour_vtex.json", None, 499999),
        ("jumbo", "jumbo_vtex.json", None, 89999),
        ("disco", "disco_vtex.json", None, 42999),
        ("farmacity", "farmacity_vtex.json", None, 35125.5),
        ("compragamer", "compragamer_products.json", None, 1299999),
    ],
)
def test_supported_retailers_extract_fixture_observations(retailer_id, fixture_name, url, expected_price):
    payload = (FIXTURES / fixture_name).read_text(encoding="utf-8")

    observations = extract_observations_from_fixture(retailer_id, payload, source_url=url)

    assert len(observations) == 1
    assert observations[0]["retailer_id"] == retailer_id
    assert observations[0]["price"] == expected_price
    assert observations[0]["currency"] == "ARS"
    assert observations[0]["title"]
    assert observations[0]["url"].startswith("https://")


def test_unsupported_retailer_has_clear_skip_reason():
    assert RETAILER_STATUS["amazon_ar"]["status"] == "unsupported"
    assert "no localized Amazon Argentina store" in RETAILER_STATUS["amazon_ar"]["reason"]

    observations = extract_observations_from_fixture(
        "amazon_ar",
        '<html><span class="a-price-whole">1,299</span></html>',
        source_url="https://www.amazon.com.ar/",
    )

    assert observations == []


def test_fixture_smoke_reports_per_retailer_successes_and_skips():
    report = smoke_fixture_extractors(FIXTURES)

    assert report["summary"]["retailers"] == 8
    assert report["summary"]["successes"] == 7
    assert report["summary"]["skipped"] == 1
    assert report["summary"]["success_rate"] == 1.0
    assert report["summary"]["target_success_rate"] == 1.0
    assert report["summary"]["meets_target"] is True
    assert report["retailers"]["naldo"]["successes"] == 1
    assert report["retailers"]["naldo"]["success_rate"] == 1.0
    assert report["retailers"]["amazon_ar"]["status"] == "unsupported"
    assert report["retailers"]["amazon_ar"]["failures"] == 0
