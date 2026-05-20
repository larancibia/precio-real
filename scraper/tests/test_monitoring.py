import json

from scraper.monitoring import (
    build_run_summary,
    evaluate_freshness,
    load_latest_successful_observation,
    write_run_summary,
)


def test_build_run_summary_aggregates_sources_and_failures():
    summary = build_run_summary(
        started_at="2026-05-20T10:00:00Z",
        finished_at="2026-05-20T10:01:00Z",
        dry_run=False,
        queries=2,
        candidates=3,
        observations=[
            {
                "source": "mercadolibre.com.ar",
                "ok": True,
                "price": 1000.0,
                "currency": "ARS",
                "url": "https://articulo.mercadolibre.com.ar/MLA-1",
                "observed_at": 1_790_000_000,
            },
            {
                "source": "mercadolibre.com.ar",
                "ok": False,
                "failure_class": "database_unavailable",
            },
            {
                "source": "example-retailer",
                "ok": False,
                "failure_class": "selector_drift",
            },
        ],
    )

    assert summary["attempted"] == 3
    assert summary["succeeded"] == 1
    assert summary["failed"] == 2
    assert summary["failure_classes"] == {
        "database_unavailable": 1,
        "selector_drift": 1,
    }
    assert summary["retailers"]["mercadolibre.com.ar"]["success_rate"] == 0.5
    assert summary["retailers"]["mercadolibre.com.ar"]["failure_classes"] == {
        "database_unavailable": 1,
    }
    assert summary["retailers"]["example-retailer"]["success_rate"] == 0.0
    assert summary["retailers"]["example-retailer"]["failure_classes"] == {
        "selector_drift": 1,
    }
    assert summary["latest_successful_observation"]["price"] == 1000.0
    assert summary["top_failure_reasons"][0] == {
        "failure_class": "database_unavailable",
        "count": 1,
    }


def test_write_run_summary_appends_jsonl_and_loads_latest_success(tmp_path):
    history_path = tmp_path / "run_history.jsonl"
    older = build_run_summary(
        started_at="2026-05-20T08:00:00Z",
        finished_at="2026-05-20T08:01:00Z",
        dry_run=False,
        queries=1,
        candidates=1,
        observations=[
            {
                "source": "mercadolibre.com.ar",
                "ok": True,
                "price": 900.0,
                "currency": "ARS",
                "url": "https://example.com/older",
                "observed_at": 1_789_990_000,
            }
        ],
    )
    newer = build_run_summary(
        started_at="2026-05-20T10:00:00Z",
        finished_at="2026-05-20T10:01:00Z",
        dry_run=False,
        queries=1,
        candidates=1,
        observations=[
            {
                "source": "mercadolibre.com.ar",
                "ok": True,
                "price": 1000.0,
                "currency": "ARS",
                "url": "https://example.com/newer",
                "observed_at": 1_790_000_000,
            }
        ],
    )

    write_run_summary(history_path, older)
    write_run_summary(history_path, newer)

    lines = history_path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 2
    assert json.loads(lines[1])["latest_successful_observation"]["url"] == "https://example.com/newer"
    assert load_latest_successful_observation(history_path)["price"] == 1000.0


def test_evaluate_freshness_marks_stale_and_missing_history(tmp_path):
    assert evaluate_freshness(None, now_epoch=1_790_010_000, max_age_seconds=3600) == {
        "ok": False,
        "status": "missing",
        "age_seconds": None,
        "max_age_seconds": 3600,
    }

    stale = {
        "source": "mercadolibre.com.ar",
        "price": 1000.0,
        "currency": "ARS",
        "url": "https://example.com/stale",
        "observed_at": 1_790_000_000,
    }
    assert evaluate_freshness(stale, now_epoch=1_790_010_000, max_age_seconds=3600) == {
        "ok": False,
        "status": "stale",
        "age_seconds": 10_000,
        "max_age_seconds": 3600,
    }

    fresh = dict(stale, observed_at=1_790_009_000)
    assert evaluate_freshness(fresh, now_epoch=1_790_010_000, max_age_seconds=3600)["status"] == "fresh"
