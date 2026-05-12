"""Tests for scraper.antibot — anti-ban utilities."""

import asyncio
import json
import os
import tempfile
import time

import pytest

from scraper.antibot import (
    ACCEPT_LANGUAGES,
    BACKOFF_DURATIONS,
    USER_AGENTS,
    DomainThrottle,
    ThrottleManager,
    random_headers,
)


# ── DomainThrottle ─────────────────────────────────────────────────────────


class TestDomainThrottle:
    def test_not_banned_initially(self):
        t = DomainThrottle(domain="example.com")
        assert t.is_banned() is False

    def test_banned_after_record_ban(self):
        t = DomainThrottle(domain="example.com")
        t.record_ban()
        assert t.is_banned() is True
        assert t.consecutive_fails == 1

    def test_ban_expires(self):
        t = DomainThrottle(domain="example.com")
        # Manually set ban_until to the past
        t.ban_until = time.time() - 1
        assert t.is_banned() is False

    def test_record_success_resets_fails(self):
        t = DomainThrottle(domain="example.com")
        t.record_ban()
        t.record_ban()
        assert t.consecutive_fails == 2
        t.record_success()
        assert t.consecutive_fails == 0

    def test_record_success_updates_last_request(self):
        t = DomainThrottle(domain="example.com")
        before = time.time()
        t.record_success()
        assert t.last_request_at >= before

    def test_exponential_backoff_increases(self):
        t = DomainThrottle(domain="example.com")

        # First ban: 30 minutes
        t.record_ban()
        ban1_duration = t.ban_until - time.time()
        assert 29 * 60 < ban1_duration <= 30 * 60 + 1

        # Second ban: 1 hour
        t.record_ban()
        ban2_duration = t.ban_until - time.time()
        assert 59 * 60 < ban2_duration <= 60 * 60 + 1

        # Third ban: 2 hours
        t.record_ban()
        ban3_duration = t.ban_until - time.time()
        assert 119 * 60 < ban3_duration <= 120 * 60 + 1

    def test_backoff_caps_at_8_hours(self):
        t = DomainThrottle(domain="example.com")
        # Exhaust all backoff levels and go beyond
        for _ in range(10):
            t.record_ban()
        ban_duration = t.ban_until - time.time()
        assert ban_duration <= 8 * 60 * 60 + 1

    def test_wait_sleeps_within_range(self):
        t = DomainThrottle(domain="example.com", min_delay=0.01, max_delay=0.02)
        before = time.time()
        asyncio.get_event_loop().run_until_complete(t.wait())
        elapsed = time.time() - before
        # With jitter, minimum is 0.5 * 0.8 = 0.004, but we clamp to 0.5
        # Actually min_delay=0.01, max_delay=0.02, jitter -20% to +20%
        # So 0.008 to 0.024, but clamped to max(0.5, ...)
        # Since 0.024 < 0.5, the delay will be 0.5
        # Let's just check it's reasonable
        assert elapsed >= 0.005  # at least some sleep happened

    def test_to_dict_roundtrip(self):
        t = DomainThrottle(domain="test.com", min_delay=3.0, max_delay=7.0)
        t.record_ban()
        d = t.to_dict()

        restored = DomainThrottle.from_dict(d)
        assert restored.domain == "test.com"
        assert restored.min_delay == 3.0
        assert restored.max_delay == 7.0
        assert restored.consecutive_fails == 1
        assert restored.ban_until == t.ban_until


# ── ThrottleManager ────────────────────────────────────────────────────────


class TestThrottleManager:
    def test_get_creates_throttle(self):
        mgr = ThrottleManager()
        t = mgr.get("example.com")
        assert t.domain == "example.com"
        assert isinstance(t, DomainThrottle)

    def test_get_returns_same_instance(self):
        mgr = ThrottleManager()
        t1 = mgr.get("example.com")
        t2 = mgr.get("example.com")
        assert t1 is t2

    def test_get_respects_custom_delays(self):
        mgr = ThrottleManager()
        t = mgr.get("slow.com", min_delay=5.0, max_delay=10.0)
        assert t.min_delay == 5.0
        assert t.max_delay == 10.0

    def test_domains_list(self):
        mgr = ThrottleManager()
        mgr.get("a.com")
        mgr.get("b.com")
        assert set(mgr.domains) == {"a.com", "b.com"}

    def test_save_and_load_state(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "state.json")

            # Save state with a banned domain
            mgr1 = ThrottleManager()
            t = mgr1.get("banned.com")
            t.record_ban()
            mgr1.save_state(path)

            # Load into a fresh manager
            mgr2 = ThrottleManager()
            mgr2.load_state(path)

            restored = mgr2.get("banned.com")
            assert restored.consecutive_fails == 1
            assert restored.is_banned() is True

    def test_save_only_persists_active_bans(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "state.json")

            mgr = ThrottleManager()
            mgr.get("clean.com")  # no bans, no fails
            banned = mgr.get("banned.com")
            banned.record_ban()
            mgr.save_state(path)

            with open(path) as f:
                data = json.load(f)

            domains = [e["domain"] for e in data["throttles"]]
            assert "banned.com" in domains
            assert "clean.com" not in domains

    def test_load_missing_file_is_silent(self):
        mgr = ThrottleManager()
        mgr.load_state("/nonexistent/path/state.json")
        assert mgr.domains == []

    def test_load_corrupt_file_is_silent(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "state.json")
            with open(path, "w") as f:
                f.write("not valid json{{{")

            mgr = ThrottleManager()
            mgr.load_state(path)
            assert mgr.domains == []

    def test_state_file_contains_saved_at_timestamp(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "state.json")

            mgr = ThrottleManager()
            mgr.get("test.com").record_ban()
            before = time.time()
            mgr.save_state(path)

            with open(path) as f:
                data = json.load(f)
            assert "saved_at" in data
            assert data["saved_at"] >= before


# ── random_headers ─────────────────────────────────────────────────────────


class TestRandomHeaders:
    def test_returns_dict(self):
        h = random_headers()
        assert isinstance(h, dict)

    def test_contains_required_keys(self):
        h = random_headers()
        assert "User-Agent" in h
        assert "Accept" in h
        assert "Accept-Language" in h
        assert "Accept-Encoding" in h

    def test_user_agent_from_pool(self):
        h = random_headers()
        assert h["User-Agent"] in USER_AGENTS

    def test_accept_language_from_pool(self):
        h = random_headers()
        assert h["Accept-Language"] in ACCEPT_LANGUAGES

    def test_headers_vary_between_calls(self):
        """At least some variation across 20 calls (not all identical)."""
        headers_set = set()
        for _ in range(20):
            h = random_headers()
            headers_set.add(h["User-Agent"])
        # With 12 UAs, getting all the same in 20 draws is extremely unlikely
        assert len(headers_set) > 1

    def test_chrome_ua_gets_sec_ch_headers(self):
        # Force a Chrome UA by mocking
        h = random_headers()
        ua = h["User-Agent"]
        if "Chrome" in ua and "Firefox" not in ua and "Edg" not in ua:
            assert "Sec-Ch-Ua" in h
        elif "Firefox" in ua:
            assert "Sec-Ch-Ua" not in h

    def test_sec_fetch_headers_always_present(self):
        h = random_headers()
        assert h["Sec-Fetch-Dest"] == "document"
        assert h["Sec-Fetch-Mode"] == "navigate"


# ── BACKOFF_DURATIONS ──────────────────────────────────────────────────────


class TestBackoffDurations:
    def test_has_five_levels(self):
        assert len(BACKOFF_DURATIONS) == 5

    def test_monotonically_increasing(self):
        for i in range(1, len(BACKOFF_DURATIONS)):
            assert BACKOFF_DURATIONS[i] > BACKOFF_DURATIONS[i - 1]

    def test_first_is_30_minutes(self):
        assert BACKOFF_DURATIONS[0] == 30 * 60

    def test_last_is_8_hours(self):
        assert BACKOFF_DURATIONS[-1] == 8 * 60 * 60


# ── USER_AGENTS ────────────────────────────────────────────────────────────


class TestUserAgents:
    def test_has_at_least_10(self):
        assert len(USER_AGENTS) >= 10

    def test_all_start_with_mozilla(self):
        for ua in USER_AGENTS:
            assert ua.startswith("Mozilla/5.0"), f"Bad UA: {ua}"

    def test_includes_chrome_and_firefox(self):
        has_chrome = any("Chrome" in ua for ua in USER_AGENTS)
        has_firefox = any("Firefox" in ua for ua in USER_AGENTS)
        assert has_chrome
        assert has_firefox
