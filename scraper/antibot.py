"""Anti-ban utilities for precio-real scrapers.

Provides per-domain throttling with exponential backoff, randomized headers,
and persistent ban state so scrapers can resume gracefully after 429/403 bans.

Usage:
    from scraper.antibot import ThrottleManager, random_headers

    manager = ThrottleManager()
    manager.load_state("scraper/throttle_state.json")

    throttle = manager.get("compragamer.com")
    if throttle.is_banned():
        log.info("Skipping %s — banned until %s", throttle.domain, throttle.ban_until)
    else:
        await throttle.wait()
        headers = random_headers()
        # ... do request ...
        throttle.record_success()

    manager.save_state("scraper/throttle_state.json")
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import time
from dataclasses import dataclass, field
from typing import Optional

log = logging.getLogger(__name__)

# ── User-Agent pool ─────────────────────────────────────────────────────────
# Current Chrome/Firefox/Edge UAs as of 2026. Rotate to reduce fingerprinting.

USER_AGENTS = [
    # Chrome 124-128 on Windows/Mac/Linux
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    # Firefox 126-130
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:130.0) Gecko/20100101 Firefox/130.0",
    "Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
    # Edge
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
]

ACCEPT_LANGUAGES = [
    "es-AR,es;q=0.9,en;q=0.8",
    "es;q=0.9,en-US;q=0.8,en;q=0.7",
    "es-AR,es;q=0.9",
    "es-419,es;q=0.9,en;q=0.8",
    "es-AR,es;q=0.8,en-US;q=0.5,en;q=0.3",
]

# Backoff schedule in seconds: 30m, 1h, 2h, 4h, 8h
BACKOFF_DURATIONS = [
    30 * 60,      # 30 minutes
    60 * 60,      # 1 hour
    2 * 60 * 60,  # 2 hours
    4 * 60 * 60,  # 4 hours
    8 * 60 * 60,  # 8 hours
]


def random_headers() -> dict:
    """Generate randomized but realistic browser headers.

    Each call picks a random UA and Accept-Language, producing headers
    that look like a normal browser visit.
    """
    ua = random.choice(USER_AGENTS)
    is_firefox = "Firefox" in ua

    headers = {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": random.choice(ACCEPT_LANGUAGES),
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }

    if is_firefox:
        headers["Sec-Fetch-Dest"] = "document"
        headers["Sec-Fetch-Mode"] = "navigate"
        headers["Sec-Fetch-Site"] = "none"
        headers["Sec-Fetch-User"] = "?1"
    else:
        headers["Sec-Ch-Ua"] = '"Chromium";v="128", "Not A(Brand";v="24"'
        headers["Sec-Ch-Ua-Mobile"] = "?0"
        headers["Sec-Ch-Ua-Platform"] = random.choice(['"Windows"', '"macOS"', '"Linux"'])
        headers["Sec-Fetch-Dest"] = "document"
        headers["Sec-Fetch-Mode"] = "navigate"
        headers["Sec-Fetch-Site"] = "none"
        headers["Sec-Fetch-User"] = "?1"

    return headers


@dataclass
class DomainThrottle:
    """Per-domain rate limiter with exponential backoff on bans.

    Tracks consecutive failures and applies increasing ban windows:
    30m -> 1h -> 2h -> 4h -> 8h (caps at 8h).
    """

    domain: str
    min_delay: float = 2.0
    max_delay: float = 5.0
    ban_until: float = 0.0
    consecutive_fails: int = 0
    last_request_at: float = 0.0

    def is_banned(self) -> bool:
        """Return True if this domain is currently in a ban backoff window."""
        return time.time() < self.ban_until

    def record_success(self) -> None:
        """Record a successful request — resets the failure counter."""
        self.consecutive_fails = 0
        self.last_request_at = time.time()

    def record_ban(self) -> None:
        """Record a 429/403 ban. Applies exponential backoff.

        Backoff schedule: 30m, 1h, 2h, 4h, 8h (caps at 8h).
        """
        idx = min(self.consecutive_fails, len(BACKOFF_DURATIONS) - 1)
        duration = BACKOFF_DURATIONS[idx]
        self.ban_until = time.time() + duration
        self.consecutive_fails += 1
        log.warning(
            "[antibot] domain=%s banned for %dm (fail #%d), ban_until=%.0f",
            self.domain,
            duration // 60,
            self.consecutive_fails,
            self.ban_until,
        )

    async def wait(self) -> None:
        """Sleep a randomized delay between min_delay and max_delay with jitter.

        The jitter is +/- 20% of the base delay to avoid request patterns.
        """
        base = random.uniform(self.min_delay, self.max_delay)
        jitter = base * random.uniform(-0.2, 0.2)
        delay = max(0.5, base + jitter)
        await asyncio.sleep(delay)
        self.last_request_at = time.time()

    def to_dict(self) -> dict:
        """Serialize to a JSON-safe dict for persistence."""
        return {
            "domain": self.domain,
            "min_delay": self.min_delay,
            "max_delay": self.max_delay,
            "ban_until": self.ban_until,
            "consecutive_fails": self.consecutive_fails,
            "last_request_at": self.last_request_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> DomainThrottle:
        """Restore from a persisted dict."""
        return cls(
            domain=data["domain"],
            min_delay=data.get("min_delay", 2.0),
            max_delay=data.get("max_delay", 5.0),
            ban_until=data.get("ban_until", 0.0),
            consecutive_fails=data.get("consecutive_fails", 0),
            last_request_at=data.get("last_request_at", 0.0),
        )


class ThrottleManager:
    """Manages per-domain throttles with persistence.

    Example:
        manager = ThrottleManager()
        manager.load_state("throttle_state.json")
        throttle = manager.get("compragamer.com")
        # ... use throttle ...
        manager.save_state("throttle_state.json")
    """

    def __init__(self) -> None:
        self._throttles: dict[str, DomainThrottle] = {}

    def get(self, domain: str, min_delay: float = 2.0, max_delay: float = 5.0) -> DomainThrottle:
        """Get or create a throttle for the given domain.

        If the domain already has a throttle (from persistence or a previous
        call), return it. Otherwise create a new one with the given delays.
        """
        if domain not in self._throttles:
            self._throttles[domain] = DomainThrottle(
                domain=domain, min_delay=min_delay, max_delay=max_delay,
            )
        return self._throttles[domain]

    @property
    def domains(self) -> list[str]:
        """List all tracked domains."""
        return list(self._throttles.keys())

    def save_state(self, path: str) -> None:
        """Persist all throttle states to a JSON file.

        Only saves domains that have an active ban or recent failures,
        to keep the file small.
        """
        now = time.time()
        data = []
        for throttle in self._throttles.values():
            if throttle.ban_until > now or throttle.consecutive_fails > 0:
                data.append(throttle.to_dict())

        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w") as f:
            json.dump({"saved_at": now, "throttles": data}, f, indent=2)
        log.info("[antibot] saved throttle state to %s (%d entries)", path, len(data))

    def load_state(self, path: str) -> None:
        """Load throttle states from a JSON file.

        Silently skips if the file doesn't exist (first run).
        Expired bans are loaded but will return is_banned()=False immediately.
        """
        if not os.path.exists(path):
            log.debug("[antibot] no state file at %s — starting fresh", path)
            return

        try:
            with open(path) as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError) as exc:
            log.warning("[antibot] failed to load state from %s: %s", path, exc)
            return

        throttles_data = data.get("throttles", [])
        for entry in throttles_data:
            domain = entry.get("domain")
            if domain:
                self._throttles[domain] = DomainThrottle.from_dict(entry)

        log.info(
            "[antibot] loaded throttle state from %s (%d entries)",
            path,
            len(throttles_data),
        )
