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
RETAILER_CONFIG_FILES = sorted(Path(__file__).resolve().parent.parent.glob("retailers*.json"))

REQUIRED_RETAILER_FIELDS = {"id", "name", "domain", "type"}
VALID_TYPES = {
    "angular_spa",
    "blocked",
    "html_scrape",
    "json_api",
    "unavailable",
    "vtex_api",
}
VALID_ANTIBOT = {
    None,
    "akamai",
    "akamai_waf",
    "bigip_waf",
    "cloudflare",
    "cloudflare_js_challenge",
    "cloudflare_block",
    "cloudfront_geo_block",
    "fortigate_waf",
    "ua_check",
}


@pytest.fixture(params=RETAILER_CONFIG_FILES, ids=lambda path: path.name)
def config_path(request):
    return request.param


@pytest.fixture
def config(config_path):
    """Load each retailer catalog once per test."""
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def retailers(config):
    """Extract the retailers list from the config."""
    return config["retailers"]


# ── File validity ──────────────────────────────────────────────────────────


class TestRetailersFileValidity:
    def test_file_exists(self):
        assert RETAILERS_JSON.exists(), f"retailers.json not found at {RETAILERS_JSON}"

    def test_catalog_files_exist(self):
        assert RETAILER_CONFIG_FILES, "Expected at least one retailers*.json catalog"

    def test_valid_json(self, config_path):
        with open(config_path, "r", encoding="utf-8") as f:
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
    def test_categories_are_dicts_when_present(self, retailers):
        for r in retailers:
            cats = r.get("categories", {})
            assert isinstance(cats, dict), (
                f"Retailer '{r['name']}' categories must be a dict"
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

    def test_vtex_api_retailers_have_api_base(self, retailers):
        for r in retailers:
            if r["type"] != "vtex_api":
                continue
            api_base = r.get("api_base")
            assert isinstance(api_base, str) and api_base.startswith("https://"), (
                f"VTEX API retailer '{r['name']}' must have an HTTPS api_base"
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

    def test_antibot_retailers_have_curl_status(self, retailers):
        """Anti-bot entries should record the observed HTTP status."""
        for r in retailers:
            if r.get("antibot"):
                assert isinstance(r.get("curl_status"), int), (
                    f"Anti-bot retailer '{r['name']}' should have "
                    f"integer curl_status, got {r.get('curl_status')}"
                )


# ── Selectors ──────────────────────────────────────────────────────────────


class TestSelectors:
    def test_selectors_are_dicts_when_present(self, retailers):
        for r in retailers:
            selectors = r.get("selectors")
            if selectors is None:
                continue
            assert isinstance(selectors, dict), (
                f"Retailer '{r['name']}' selectors must be a dict when present"
            )


# ── Count ──────────────────────────────────────────────────────────────────


class TestRetailerCount:
    def test_catalog_has_retailers(self, retailers):
        assert len(retailers) > 0, "Expected at least one retailer"

    def test_active_retailer_count(self, retailers):
        active = [r for r in retailers if r["type"] != "unavailable"]
        assert len(active) > 0, "Expected at least one active retailer"
