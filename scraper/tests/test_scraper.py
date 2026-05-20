"""
Tests for scraper.py — written before the implementation (TDD).

Run:
    cd scraper && pytest tests/ -v
"""
import json
from unittest.mock import MagicMock, patch, call
import pytest

import scraper.scraper as scraper_module

# Imported after scraper.py exists
from scraper.scraper import (
    extract_mla_id,
    normalize_ml_url,
    build_observe_payload,
    discover_products,
    fetch_item_price,
    post_observe,
    run_scraper,
)


# ── extract_mla_id ──────────────────────────────────────────────────────────

class TestExtractMlaId:
    def test_hyphenated_form(self):
        url = "https://articulo.mercadolibre.com.ar/MLA-1234567890-foo"
        assert extract_mla_id(url) == "MLA1234567890"

    def test_compact_permalink_form(self):
        url = "https://www.mercadolibre.com.ar/foo/p/MLA28066215"
        assert extract_mla_id(url) == "MLA28066215"

    def test_case_insensitive(self):
        url = "https://www.mercadolibre.com.ar/foo/p/mla28066215"
        assert extract_mla_id(url) == "MLA28066215"

    def test_no_id_returns_none(self):
        url = "https://www.mercadolibre.com.ar/no-id-here"
        assert extract_mla_id(url) is None

    def test_non_ml_url_returns_none(self):
        assert extract_mla_id("https://example.com/MLA-123456") == "MLA123456"

    def test_short_id(self):
        url = "https://articulo.mercadolibre.com.ar/MLA-123456789-foo-bar"
        assert extract_mla_id(url) == "MLA123456789"


# ── normalize_ml_url ────────────────────────────────────────────────────────

class TestNormalizeMlUrl:
    def test_removes_trailing_slash(self):
        url = "https://articulo.mercadolibre.com.ar/MLA-1234567890-foo/"
        result = normalize_ml_url(url)
        assert not result.endswith("/")
        assert "MLA" in result

    def test_removes_query_string(self):
        url = "https://articulo.mercadolibre.com.ar/MLA-1234567890-foo?ref=something"
        result = normalize_ml_url(url)
        assert "?" not in result

    def test_removes_fragment(self):
        url = "https://articulo.mercadolibre.com.ar/MLA-1234567890-foo#section"
        result = normalize_ml_url(url)
        assert "#" not in result

    def test_lowercases_hostname(self):
        url = "https://Articulo.MercadoLibre.com.ar/MLA-123"
        result = normalize_ml_url(url)
        assert result.startswith("https://articulo.mercadolibre.com.ar")

    def test_preserves_path(self):
        url = "https://articulo.mercadolibre.com.ar/MLA-1234567890-foo"
        result = normalize_ml_url(url)
        assert "/MLA-1234567890-foo" in result

    def test_root_path_unchanged(self):
        url = "https://www.mercadolibre.com.ar/"
        result = normalize_ml_url(url)
        assert result == "https://www.mercadolibre.com.ar/"


# ── build_observe_payload ───────────────────────────────────────────────────

class TestBuildObservePayload:
    def _make_item(self, **kwargs):
        base = {
            "permalink": "https://articulo.mercadolibre.com.ar/MLA-1234567890-foo",
            "title": "Notebook Lenovo",
            "price": 1500000.0,
            "currency_id": "ARS",
            "thumbnail": "https://http2.mlstatic.com/img.jpg",
            "seller": {"nickname": "vendedor123"},
        }
        base.update(kwargs)
        return base

    def test_valid_item_returns_payload(self):
        payload = build_observe_payload(self._make_item())
        assert payload is not None
        assert payload["price"] == 1500000.0
        assert payload["currency"] == "ARS"
        assert payload["title"] == "Notebook Lenovo"
        assert payload["seller"] == "vendedor123"
        assert "MLA-1234567890" in payload["url"]

    def test_price_is_rounded_to_2_decimals(self):
        item = self._make_item(price=1234567.899)
        payload = build_observe_payload(item)
        assert payload is not None
        assert payload["price"] == 1234567.9

    def test_missing_permalink_returns_none(self):
        item = self._make_item()
        del item["permalink"]
        assert build_observe_payload(item) is None

    def test_invalid_price_returns_none(self):
        assert build_observe_payload(self._make_item(price=0)) is None
        assert build_observe_payload(self._make_item(price=-100)) is None
        assert build_observe_payload(self._make_item(price="not a number")) is None

    def test_missing_seller_is_null(self):
        item = self._make_item()
        del item["seller"]
        payload = build_observe_payload(item)
        assert payload is not None
        assert payload["seller"] is None

    def test_missing_thumbnail_is_null(self):
        item = self._make_item()
        del item["thumbnail"]
        payload = build_observe_payload(item)
        assert payload is not None
        assert payload["image_url"] is None

    def test_default_currency_is_ars(self):
        item = self._make_item()
        del item["currency_id"]
        payload = build_observe_payload(item)
        assert payload is not None
        assert payload["currency"] == "ARS"

    def test_url_normalized(self):
        item = self._make_item(
            permalink="https://articulo.mercadolibre.com.ar/MLA-1234567890-foo?ref=home"
        )
        payload = build_observe_payload(item)
        assert payload is not None
        assert "?" not in payload["url"]


# ── discover_products ───────────────────────────────────────────────────────

class TestDiscoverProducts:
    def _make_client(self, results):
        resp = MagicMock()
        resp.json.return_value = {"results": results}
        resp.raise_for_status = MagicMock()
        client = MagicMock()
        client.get.return_value = resp
        return client

    def test_returns_results_list(self):
        items = [{"id": "MLA1", "title": "TV", "price": 100000, "permalink": "https://a.mercadolibre.com.ar/MLA-1"}]
        client = self._make_client(items)
        result = discover_products("televisor", limit=20, client=client)
        assert result == items

    def test_empty_results(self):
        client = self._make_client([])
        result = discover_products("xyzabc", limit=5, client=client)
        assert result == []

    def test_url_contains_query(self):
        client = self._make_client([])
        discover_products("smart tv", limit=20, client=client)
        call_url = client.get.call_args[0][0]
        assert "smart+tv" in call_url or "smart%20tv" in call_url or "smart tv" in call_url

    def test_url_contains_limit(self):
        client = self._make_client([])
        discover_products("celular", limit=15, client=client)
        call_url = client.get.call_args[0][0]
        assert "limit=15" in call_url

    def test_http_error_returns_empty(self):
        import httpx
        client = MagicMock()
        client.get.side_effect = httpx.HTTPError("Connection refused")
        result = discover_products("celular", limit=20, client=client)
        assert result == []

    def test_missing_results_key_returns_empty(self):
        resp = MagicMock()
        resp.json.return_value = {}  # no "results" key
        resp.raise_for_status = MagicMock()
        client = MagicMock()
        client.get.return_value = resp
        result = discover_products("celular", limit=20, client=client)
        assert result == []


# ── fetch_item_price ────────────────────────────────────────────────────────

class TestFetchItemPrice:
    def _make_client(self, body, status=200):
        resp = MagicMock()
        resp.json.return_value = body
        resp.status_code = status
        resp.raise_for_status = MagicMock()
        client = MagicMock()
        client.get.return_value = resp
        return client

    def test_valid_item_returns_dict(self):
        body = {
            "id": "MLA1234567890",
            "title": "Notebook Lenovo",
            "price": 1500000.0,
            "currency_id": "ARS",
            "permalink": "https://articulo.mercadolibre.com.ar/MLA-1234567890-foo",
            "thumbnail": "https://img.jpg",
        }
        client = self._make_client(body)
        result = fetch_item_price("MLA1234567890", client=client)
        assert result is not None
        assert result["price"] == 1500000.0
        assert result["permalink"] == body["permalink"]

    def test_invalid_id_pattern_returns_none(self):
        client = MagicMock()
        result = fetch_item_price("not-an-id", client=client)
        assert result is None
        client.get.assert_not_called()

    def test_http_error_returns_none(self):
        import httpx
        client = MagicMock()
        client.get.side_effect = httpx.HTTPError("timeout")
        result = fetch_item_price("MLA1234567890", client=client)
        assert result is None

    def test_url_uses_uppercase_id(self):
        body = {"id": "MLA123", "title": "T", "price": 100, "currency_id": "ARS",
                "permalink": "https://a.mercadolibre.com.ar/MLA-123"}
        client = self._make_client(body)
        fetch_item_price("mla123", client=client)
        call_url = client.get.call_args[0][0]
        assert "MLA123" in call_url

    def test_missing_price_returns_none(self):
        body = {"id": "MLA123", "title": "T", "currency_id": "ARS",
                "permalink": "https://a.mercadolibre.com.ar/MLA-123"}
        client = self._make_client(body)
        result = fetch_item_price("MLA123", client=client)
        assert result is None


# ── post_observe ────────────────────────────────────────────────────────────

class TestPostObserve:
    def _make_client(self, response_body, status=200):
        resp = MagicMock()
        resp.json.return_value = response_body
        resp.status_code = status
        resp.raise_for_status = MagicMock()
        client = MagicMock()
        client.post.return_value = resp
        return client

    def _payload(self):
        return {
            "url": "https://articulo.mercadolibre.com.ar/MLA-1234567890-foo",
            "title": "Notebook",
            "seller": "vendedor",
            "image_url": None,
            "price": 1500000.0,
            "currency": "ARS",
        }

    def test_inserted_true(self):
        client = self._make_client({"ok": True, "inserted": True, "deduped": False})
        ok, inserted, deduped = post_observe("https://api.example.com", self._payload(), client=client)
        assert ok is True
        assert inserted is True
        assert deduped is False

    def test_deduped(self):
        client = self._make_client({"ok": True, "inserted": False, "deduped": True})
        ok, inserted, deduped = post_observe("https://api.example.com", self._payload(), client=client)
        assert ok is True
        assert inserted is False
        assert deduped is True

    def test_http_error_returns_failure(self):
        import httpx
        client = MagicMock()
        client.post.side_effect = httpx.HTTPError("server error")
        ok, inserted, deduped = post_observe("https://api.example.com", self._payload(), client=client)
        assert ok is False

    def test_posts_to_observe_endpoint(self):
        client = self._make_client({"ok": True, "inserted": True, "deduped": False})
        post_observe("https://api.example.com", self._payload(), client=client)
        call_url = client.post.call_args[0][0]
        assert call_url == "https://api.example.com/api/observe"

    def test_sends_json_payload(self):
        client = self._make_client({"ok": True, "inserted": True, "deduped": False})
        payload = self._payload()
        post_observe("https://api.example.com", payload, client=client)
        sent_json = client.post.call_args[1].get("json") or client.post.call_args[0][1] if len(client.post.call_args[0]) > 1 else None
        # Check json kwarg was used
        kwargs = client.post.call_args[1]
        assert "json" in kwargs
        assert kwargs["json"]["price"] == 1500000.0


# ── run_scraper ─────────────────────────────────────────────────────────────

class TestRunScraper:
    """Integration-level tests: mock client performs full discovery+observe cycle."""

    def _make_search_response(self, items):
        resp = MagicMock()
        resp.json.return_value = {"results": items}
        resp.raise_for_status = MagicMock()
        return resp

    def _make_observe_response(self, inserted=True, deduped=False):
        resp = MagicMock()
        resp.json.return_value = {"ok": True, "inserted": inserted, "deduped": deduped}
        resp.status_code = 200
        resp.raise_for_status = MagicMock()
        return resp

    def test_scrapes_and_posts_products(self):
        items = [
            {
                "id": "MLA1",
                "title": "Notebook",
                "price": 1500000.0,
                "currency_id": "ARS",
                "permalink": "https://articulo.mercadolibre.com.ar/MLA-1234567890-notebook",
                "thumbnail": "https://img.jpg",
                "seller": {"nickname": "vendedor"},
            }
        ]
        client = MagicMock()
        client.get.return_value = self._make_search_response(items)
        client.post.return_value = self._make_observe_response(inserted=True)

        result = run_scraper(["celular"], api_base="https://api.example.com", client=client)

        assert result["candidates"] >= 1
        assert result["posted"] >= 1
        assert result["inserted"] >= 1
        assert client.post.called

    def test_deduped_not_counted_as_inserted(self):
        items = [
            {
                "id": "MLA1",
                "title": "TV",
                "price": 500000.0,
                "currency_id": "ARS",
                "permalink": "https://articulo.mercadolibre.com.ar/MLA-111-tv",
                "thumbnail": None,
                "seller": {"nickname": "vendedor"},
            }
        ]
        client = MagicMock()
        client.get.return_value = self._make_search_response(items)
        client.post.return_value = self._make_observe_response(inserted=False, deduped=True)

        result = run_scraper(["televisor"], api_base="https://api.example.com", client=client)

        assert result["deduped"] >= 1
        assert result["inserted"] == 0

    def test_invalid_items_skipped(self):
        items = [
            {"id": "MLA1", "title": "Broken"},  # no price, no permalink
        ]
        client = MagicMock()
        client.get.return_value = self._make_search_response(items)

        result = run_scraper(["celular"], api_base="https://api.example.com", client=client)

        assert result["candidates"] == 0
        client.post.assert_not_called()

    def test_deduplicates_across_queries(self):
        # Same permalink returned by two queries
        item = {
            "id": "MLA1",
            "title": "TV",
            "price": 500000.0,
            "currency_id": "ARS",
            "permalink": "https://articulo.mercadolibre.com.ar/MLA-111-tv",
            "thumbnail": None,
            "seller": {"nickname": "vendedor"},
        }
        client = MagicMock()
        client.get.return_value = self._make_search_response([item])
        client.post.return_value = self._make_observe_response(inserted=True)

        result = run_scraper(["televisor", "smart tv"], api_base="https://api.example.com", client=client)

        # Two queries → two GET calls, but only 1 unique URL → 1 POST
        assert client.post.call_count == 1
        assert result["candidates"] == 1

    def test_returns_stats_dict(self):
        client = MagicMock()
        client.get.return_value = self._make_search_response([])

        result = run_scraper(["celular"], api_base="https://api.example.com", client=client)

        assert "queries" in result
        assert "candidates" in result
        assert "posted" in result
        assert "inserted" in result
        assert "deduped" in result
        assert "failed" in result


# ── command entrypoint ──────────────────────────────────────────────────────

class TestCommandEntrypoint:
    def test_dry_run_can_smoke_without_network(self, monkeypatch, capsys):
        calls = []

        def fake_run_scraper(*, api_base, dry_run, queries):
            calls.append({
                "api_base": api_base,
                "dry_run": dry_run,
                "queries": queries,
            })
            return {
                "queries": len(queries),
                "candidates": 0,
                "posted": 0,
                "inserted": 0,
                "deduped": 0,
                "failed": 0,
                "skipped_banned": 0,
            }

        monkeypatch.setattr(scraper_module, "run_scraper", fake_run_scraper)
        monkeypatch.setattr(
            "sys.argv",
            ["scraper", "--dry-run", "--max-queries", "0"],
        )

        scraper_module.main()

        assert calls == [{
            "api_base": scraper_module.API_BASE_URL,
            "dry_run": True,
            "queries": [],
        }]
        assert "Done" in capsys.readouterr().out
