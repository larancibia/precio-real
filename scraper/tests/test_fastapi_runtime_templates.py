from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / "deploy" / "fastapi-runtime"


def read_runtime_file(relative_path: str) -> str:
    path = RUNTIME / relative_path
    assert path.exists(), f"missing runtime file: {path.relative_to(ROOT)}"
    return path.read_text(encoding="utf-8")


def test_runtime_directory_tracks_expected_files():
    expected = [
        "README.md",
        "Dockerfile",
        "app/main.py",
        "app/requirements.txt",
        "compose.yml",
        "schema.sql",
        "env.example",
        "systemd/precio-real-api.service",
        "systemd/precio-real-postgres.service",
    ]

    for relative_path in expected:
        assert (RUNTIME / relative_path).exists(), f"missing {relative_path}"


def test_compose_documents_live_ports_and_postgres_restart_policy():
    compose = read_runtime_file("compose.yml")

    assert "${API_HOST:-127.0.0.1}:${API_PORT:-8402}:8402" in compose
    assert "${POSTGRES_PUBLISHED_PORT:-54330}:5432" in compose
    assert "restart: unless-stopped" in compose
    assert "pg_isready" in compose
    assert "POSTGRES_PASSWORD" in compose


def test_env_example_is_sanitized_and_documents_required_names():
    env_example = read_runtime_file("env.example")

    for required_name in [
        "POSTGRES_DB=",
        "POSTGRES_USER=",
        "POSTGRES_PASSWORD=",
        "DATABASE_URL=",
        "API_HOST=",
        "API_PORT=",
    ]:
        assert required_name in env_example

    forbidden_fragments = ["aranserver", "cf_", "sk-", "AKIA", "BEGIN PRIVATE KEY"]
    for fragment in forbidden_fragments:
        assert fragment not in env_example


def test_schema_matches_observe_contract_and_is_idempotent():
    schema = read_runtime_file("schema.sql")

    assert "CREATE TABLE IF NOT EXISTS products" in schema
    assert "CREATE TABLE IF NOT EXISTS prices" in schema
    assert "url TEXT UNIQUE NOT NULL" in schema
    assert "product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE" in schema
    assert "CREATE INDEX IF NOT EXISTS idx_products_url" in schema
    assert "CREATE INDEX IF NOT EXISTS idx_prices_product_scraped" in schema


def test_fastapi_app_exposes_health_and_observe_routes():
    app = read_runtime_file("app/main.py")

    assert '@app.get("/api/health")' in app
    assert '@app.get("/api/ready")' in app
    assert '@app.post("/api/observe")' in app
    assert "X-Request-ID" in app
    assert "database_unavailable" in app
    assert "status_code=503" in app
    assert "INSERT INTO products" in app
    assert "ON CONFLICT (url) DO UPDATE" in app
    assert "INSERT INTO prices" in app


def test_fastapi_health_is_liveness_and_ready_checks_database():
    app = read_runtime_file("app/main.py")

    health_start = app.index('@app.get("/api/health")')
    ready_start = app.index('@app.get("/api/ready")')
    observe_start = app.index('@app.post("/api/observe")')
    health_block = app[health_start:ready_start]
    ready_block = app[ready_start:observe_start]

    assert "SELECT 1" not in health_block
    assert '{"ok": True}' in health_block
    assert "SELECT 1" in ready_block
    assert "db_unavailable_response" in ready_block


def test_readme_contains_smoke_cleanup_rollout_and_rollback():
    readme = read_runtime_file("README.md")

    assert "curl -fsS http://127.0.0.1:8402/api/health" in readme
    assert "curl -fsS http://127.0.0.1:8402/api/ready" in readme
    assert "database_unavailable" in readme
    assert "curl -fsS -X POST http://127.0.0.1:8402/api/observe" in readme
    assert "precio-real-smoke.invalid" in readme
    assert "DELETE FROM prices" in readme
    assert "DELETE FROM products" in readme
    assert "Rollout checklist" in readme
    assert "Rollback" in readme
    assert "Cloudflare Worker" in readme
