"""Run-history and freshness helpers for the Python scraper."""

from __future__ import annotations

import json
import os
from collections import Counter
from pathlib import Path
from typing import Any, Iterable, Optional


DEFAULT_RUN_HISTORY_PATH = Path(__file__).with_name("run_history.jsonl")


def source_from_url(url: str) -> str:
    from urllib.parse import urlparse

    host = urlparse(url).netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    if host.endswith("mercadolibre.com.ar"):
        return "mercadolibre.com.ar"
    return host or "unknown"


def classify_http_failure(status_code: int, error_code: str | None = None) -> str:
    if error_code:
        return error_code
    if status_code == 429:
        return "api_rate_limited"
    if status_code == 403:
        return "api_blocked"
    if status_code == 503:
        return "api_unavailable"
    if 500 <= status_code:
        return "api_http_5xx"
    if 400 <= status_code:
        return "api_http_4xx"
    return "api_http_error"


def build_run_summary(
    *,
    started_at: str,
    finished_at: str,
    dry_run: bool,
    queries: int,
    candidates: int,
    observations: Iterable[dict[str, Any]],
    skipped_banned: int = 0,
) -> dict[str, Any]:
    observations = list(observations)
    attempted = len(observations)
    succeeded = sum(1 for obs in observations if obs.get("ok") is True)
    failed = attempted - succeeded
    failure_classes = Counter(
        str(obs.get("failure_class") or "unknown")
        for obs in observations
        if obs.get("ok") is not True
    )

    retailers: dict[str, dict[str, Any]] = {}
    latest_success: Optional[dict[str, Any]] = None

    for obs in observations:
        source = str(obs.get("source") or "unknown")
        bucket = retailers.setdefault(
            source,
            {
                "attempted": 0,
                "succeeded": 0,
                "failed": 0,
                "success_rate": 0.0,
                "failure_classes": {},
                "last_successful_at": None,
                "last_successful_price": None,
                "last_successful_url": None,
            },
        )
        bucket["attempted"] += 1
        if obs.get("ok") is True:
            bucket["succeeded"] += 1
            observed_at = obs.get("observed_at")
            bucket["last_successful_at"] = observed_at
            bucket["last_successful_price"] = obs.get("price")
            bucket["last_successful_url"] = obs.get("url")
            candidate = {
                "source": source,
                "observed_at": observed_at,
                "price": obs.get("price"),
                "currency": obs.get("currency"),
                "url": obs.get("url"),
            }
            if latest_success is None or int(observed_at or 0) > int(latest_success.get("observed_at") or 0):
                latest_success = candidate
        else:
            bucket["failed"] += 1
            failure_class = str(obs.get("failure_class") or "unknown")
            bucket["failure_classes"][failure_class] = bucket["failure_classes"].get(failure_class, 0) + 1

    for bucket in retailers.values():
        if bucket["attempted"]:
            bucket["success_rate"] = round(bucket["succeeded"] / bucket["attempted"], 4)

    return {
        "started_at": started_at,
        "finished_at": finished_at,
        "dry_run": dry_run,
        "queries": queries,
        "candidates": candidates,
        "skipped_banned": skipped_banned,
        "attempted": attempted,
        "succeeded": succeeded,
        "failed": failed,
        "success_rate": round(succeeded / attempted, 4) if attempted else 0.0,
        "failure_classes": dict(sorted(failure_classes.items())),
        "top_failure_reasons": [
            {"failure_class": name, "count": count}
            for name, count in failure_classes.most_common(5)
        ],
        "retailers": retailers,
        "latest_successful_observation": latest_success,
    }


def write_run_summary(path: os.PathLike[str] | str, summary: dict[str, Any]) -> None:
    history_path = Path(path)
    history_path.parent.mkdir(parents=True, exist_ok=True)
    with history_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(summary, sort_keys=True, separators=(",", ":")))
        handle.write("\n")


def load_latest_successful_observation(path: os.PathLike[str] | str) -> Optional[dict[str, Any]]:
    history_path = Path(path)
    if not history_path.exists():
        return None

    latest: Optional[dict[str, Any]] = None
    with history_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            try:
                summary = json.loads(line)
            except json.JSONDecodeError:
                continue
            observation = summary.get("latest_successful_observation")
            if not isinstance(observation, dict):
                continue
            if latest is None or int(observation.get("observed_at") or 0) > int(latest.get("observed_at") or 0):
                latest = observation
    return latest


def evaluate_freshness(
    latest_observation: Optional[dict[str, Any]],
    *,
    now_epoch: int,
    max_age_seconds: int,
) -> dict[str, Any]:
    if latest_observation is None:
        return {
            "ok": False,
            "status": "missing",
            "age_seconds": None,
            "max_age_seconds": max_age_seconds,
        }

    age_seconds = max(0, now_epoch - int(latest_observation.get("observed_at") or 0))
    return {
        "ok": age_seconds <= max_age_seconds,
        "status": "fresh" if age_seconds <= max_age_seconds else "stale",
        "age_seconds": age_seconds,
        "max_age_seconds": max_age_seconds,
    }
