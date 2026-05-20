from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
POLICY = ROOT / "docs" / "PUBLIC-DATA-QUALITY-POLICY.md"


def read(relative_path: str) -> str:
    path = ROOT / relative_path
    assert path.exists(), f"missing file: {relative_path}"
    return path.read_text(encoding="utf-8")


def test_public_data_quality_policy_exists_and_sets_thresholds():
    policy = read("docs/PUBLIC-DATA-QUALITY-POLICY.md")

    required_phrases = [
        "Fresh",
        "Stale",
        "Blocked",
        "last 24 hours",
        "7 days",
        "30 days",
        "at least 5 valid observations",
        "supported retailers",
        "stale retailers",
        "last successful run",
        "No guarantee",
    ]

    for phrase in required_phrases:
        assert phrase in policy


def test_public_copy_links_to_policy_and_avoids_absolute_coverage_claims():
    landing = read("landing/index.html")
    cws_listing = read("docs/CHROME-WEB-STORE-LISTING.md")
    pr_kit = read("docs/PR-KIT.md")
    combined = landing + "\n" + cws_listing + "\n" + pr_kit

    assert "PUBLIC-DATA-QUALITY-POLICY.md" in cws_listing
    assert "PUBLIC-DATA-QUALITY-POLICY.md" in pr_kit
    assert "coverage, freshness and confidence vary" in cws_listing
    assert "según cobertura, frescura y confianza" in landing

    forbidden_claims = [
        "historial real de precios de cada producto",
        "historial de cada producto",
        "cada oferta contra el historial real",
        "cada tienda soportada",
        "funciona en <strong>101 e-commerce argentinos</strong>",
    ]

    for claim in forbidden_claims:
        assert claim not in combined
