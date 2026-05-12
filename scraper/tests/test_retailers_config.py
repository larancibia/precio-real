"""
Tests for retailers.json configuration — validates structure and data integrity.

Run:
    cd scraper && pytest tests/test_retailers_config.py -v
"""
import json
import os
from pathlib import Path

import pytest

RETAILERS_JSON = Path(__file__).resolve().parent.parent / "retailers.json"

REQUIRED_RETAILER_FIELDS = {"id", "name", "domain", "type"}
VALID_TYPES = {"json_api", "html_scrape", "unavailable"}
VALID_ANTIBOT = {None, "cloudflare_js_challenge", "cloudflare_block"}


@pytest.fixture(scope="module")
def config():
    """Load retailers.json once for all tests."""
    with open(RETAILERS_JSON, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def retailers(config):
    """Extract the retailers list from the config."""
    return config["retailers"]


# ── File validity ──────────────────────────────────────────────────────────


class TestRetailersFileValidity:
    def test_file_exists(self):
        assert RETAILERS_JSON.exists(), f"retailers.json not found at {RETAILERS_JSON}"

    def test_valid_json(self):
        with open(RETAILERS_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
        assert isinstance(data, dict), "Root should be a JSON object"

    def test_has_retailers_key(self, config):
        assert "retailers" in config, "Config must have a 'retailers' key"

    def test_retailers_is_list(self, retailers):
        assert isinstance(retailers, list), "'retailers' must be a list"

    def test_retailers_not_empty(self, retailers):
        assert len(retailers) > 0, "retailers list must not be empty"


# ── Required fields ────────────────────────────────────────────────────────


class TestRetailerRequiredFields:
    def test_each_retailer_has_required_fields(self, retailers):
        for r in retailers:
            missing = REQUIRED_RETAILER_FIELDS - set(r.keys())
            assert not missing, (
                f"Retailer '{r.get('name', '?')}' missing fields: {missing}"
            )

    def test_each_retailer_has_id(self, retailers):
        for r in retailers:
            assert isinstance(r["id"], str) and len(r["id"]) > 0, (
                f"Retailer '{r.get('name', '?')}' must have a non-empty string id"
            )

    def test_each_retailer_has_name(self, retailers):
        for r in retailers:
            assert isinstance(r["name"], str) and len(r["name"]) > 0, (
                f"Retailer id='{r['id']}' must have a non-empty name"
            )

    def test_each_retailer_has_domain(self, retailers):
        for r in retailers:
            assert isinstance(r["domain"], str) and "." in r["domain"], (
                f"Retailer '{r['name']}' must have a valid domain"
            )

    def test_each_retailer_has_valid_type(self, retailers):
        for r in retailers:
            assert r["type"] in VALID_TYPES, (
                f"Retailer '{r['name']}' has invalid type '{r['type']}'. "
                f"Must be one of {VALID_TYPES}"
            )


# ── Categories ─────────────────────────────────────────────────────────────


class TestRetailerCategories:
    def test_active_retailers_have_categories(self, retailers):
        """Retailers with type != 'unavailable' must have at least one category."""
        for r in retailers:
            if r["type"] == "unavailable":
                continue
            cats = r.get("categories", {})
            assert isinstance(cats, dict) and len(cats) > 0, (
                f"Active retailer '{r['name']}' must have at least one category"
            )

    def test_category_values_are_strings(self, retailers):
        for r in retailers:
            cats = r.get("categories", {})
            if not isinstance(cats, dict):
                continue
            for key, val in cats.items():
                assert isinstance(val, str), (
                    f"Category '{key}' in '{r['name']}' must be a string, "
                    f"got {type(val).__name__}"
                )

    def test_category_paths_start_with_slash(self, retailers):
        for r in retailers:
            cats = r.get("categories", {})
            if not isinstance(cats, dict):
                continue
            for key, val in cats.items():
                assert val.startswith("/"), (
                    f"Category '{key}' in '{r['name']}' must start with '/', "
                    f"got '{val}'"
                )


# ── Uniqueness ─────────────────────────────────────────────────────────────


class TestRetailerUniqueness:
    def test_no_duplicate_ids(self, retailers):
        ids = [r["id"] for r in retailers]
        dupes = [x for x in ids if ids.count(x) > 1]
        assert not dupes, f"Duplicate retailer ids: {set(dupes)}"

    def test_no_duplicate_domains(self, retailers):
        domains = [r["domain"] for r in retailers]
        dupes = [x for x in domains if domains.count(x) > 1]
        assert not dupes, f"Duplicate domains: {set(dupes)}"

    def test_no_duplicate_names(self, retailers):
        names = [r["name"] for r in retailers]
        dupes = [x for x in names if names.count(x) > 1]
        assert not dupes, f"Duplicate names: {set(dupes)}"


# ── API retailers ──────────────────────────────────────────────────────────


class TestApiRetailers:
    def test_json_api_retailers_have_api_url(self, retailers):
        for r in retailers:
            if r["type"] != "json_api":
                continue
            assert "api_url" in r and isinstance(r["api_url"], str), (
                f"API retailer '{r['name']}' must have an 'api_url' string"
            )

    def test_api_url_is_https(self, retailers):
        for r in retailers:
            api_url = r.get("api_url")
            if api_url is None:
                continue
            assert api_url.startswith("https://"), (
                f"API URL for '{r['name']}' must use HTTPS: {api_url}"
            )


# ── Anti-bot ───────────────────────────────────────────────────────────────


class TestAntibotConfig:
    def test_antibot_values_are_valid(self, retailers):
        for r in retailers:
            antibot = r.get("antibot")
            assert antibot in VALID_ANTIBOT, (
                f"Retailer '{r['name']}' has invalid antibot value '{antibot}'. "
                f"Must be one of {VALID_ANTIBOT}"
            )

    def test_cloudflare_retailers_have_403_status(self, retailers):
        """Retailers behind Cloudflare should have curl_status 403."""
        for r in retailers:
            if r.get("antibot") and "cloudflare" in str(r["antibot"]):
                assert r.get("curl_status") == 403, (
                    f"Cloudflare-protected '{r['name']}' should have "
                    f"curl_status=403, got {r.get('curl_status')}"
                )


# ── Selectors ──────────────────────────────────────────────────────────────


class TestSelectors:
    def test_scrapable_retailers_have_selectors(self, retailers):
        """html_scrape retailers without antibot should have CSS selectors."""
        for r in retailers:
            if r["type"] != "html_scrape":
                continue
            if r.get("antibot") is not None:
                # Cloudflare-blocked sites may not have verified selectors yet
                continue
            selectors = r.get("selectors")
            assert selectors is not None and isinstance(selectors, dict), (
                f"Scrapable retailer '{r['name']}' must have selectors dict"
            )
            assert len(selectors) > 0, (
                f"Scrapable retailer '{r['name']}' must have at least one selector"
            )


# ── Count ──────────────────────────────────────────────────────────────────


class TestRetailerCount:
    def test_minimum_retailer_count(self, retailers):
        assert len(retailers) >= 12, (
            f"Expected at least 12 retailers, got {len(retailers)}"
        )

    def test_active_retailer_count(self, retailers):
        active = [r for r in retailers if r["type"] != "unavailable"]
        assert len(active) >= 6, (
            f"Expected at least 6 active retailers, got {len(active)}"
        )
