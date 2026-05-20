import logging
import os
import re
import time
import uuid
from typing import Any
from urllib.parse import urlparse, urlunparse

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from psycopg import Error as PsycopgError
from pydantic import BaseModel, Field, field_validator
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool, PoolTimeout


DATABASE_URL = os.environ["DATABASE_URL"]
MAX_URL_LENGTH = 2048
MAX_TITLE_LENGTH = 300
MAX_SELLER_LENGTH = 120
MAX_IMAGE_URL_LENGTH = 2048
MAX_PRICE_ARS = 1_000_000_000
OBSERVE_DEDUPE_WINDOW_SEC = 600
REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,100}$")

app = FastAPI(title="Precio Real ingestion runtime", version="0.2.0")
pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=10, open=False)
DB_UNAVAILABLE_EXCEPTIONS = (PsycopgError, PoolTimeout, OSError, TimeoutError)
log = logging.getLogger("precio_real.fastapi_runtime")


class Observation(BaseModel):
    url: str = Field(min_length=1, max_length=MAX_URL_LENGTH)
    title: str | None = Field(default=None, max_length=MAX_TITLE_LENGTH)
    seller: str | None = Field(default=None, max_length=MAX_SELLER_LENGTH)
    image_url: str | None = Field(default=None, max_length=MAX_IMAGE_URL_LENGTH)
    price: float
    currency: str = "ARS"

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        normalized = normalize_observed_url(value)
        if normalized is None:
            raise ValueError("invalid url")
        return normalized

    @field_validator("title", "seller", "image_url", mode="before")
    @classmethod
    def clean_optional_string(cls, value: Any) -> str | None:
        if not isinstance(value, str):
            return None
        trimmed = value.strip()
        return trimmed or None

    @field_validator("image_url")
    @classmethod
    def validate_image_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return None
        return urlunparse(parsed._replace(fragment=""))

    @field_validator("price")
    @classmethod
    def validate_price(cls, value: float) -> float:
        if value <= 0 or value > MAX_PRICE_ARS:
            raise ValueError("invalid price")
        return round(value, 2)

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, value: Any) -> str:
        if not isinstance(value, str):
            return "ARS"
        currency = value.strip().upper()
        if len(currency) == 3 and currency.isalpha():
            return currency
        return "ARS"


def normalize_observed_url(raw: str) -> str | None:
    value = raw.strip()
    if not value or len(value) > MAX_URL_LENGTH:
        return None

    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None

    host = parsed.hostname.lower() if parsed.hostname else ""
    if not host.endswith("mercadolibre.com.ar"):
        return None

    path = parsed.path
    if len(path) > 1 and path.endswith("/"):
        path = path[:-1]

    port = f":{parsed.port}" if parsed.port else ""
    return urlunparse((parsed.scheme, f"{host}{port}", path or "/", "", "", ""))


def request_id_from(request: Request) -> str:
    value = request.headers.get("x-request-id", "").strip()
    if REQUEST_ID_RE.fullmatch(value):
        return value
    return uuid.uuid4().hex


def db_unavailable_response(request: Request, *, route: str) -> JSONResponse:
    request_id = getattr(request.state, "request_id", uuid.uuid4().hex)
    log.warning(
        "database_unavailable route=%s request_id=%s",
        route,
        request_id,
        extra={"route": route, "request_id": request_id, "error_code": "database_unavailable"},
    )
    return JSONResponse(
        status_code=503,
        content={
            "ok": False,
            "error": {
                "code": "database_unavailable",
                "message": "database temporarily unavailable",
            },
            "request_id": request_id,
        },
    )


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request.state.request_id = request_id_from(request)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


@app.on_event("startup")
def startup() -> None:
    pool.open()


@app.on_event("shutdown")
def shutdown() -> None:
    pool.close()


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/api/ready")
def ready(request: Request) -> dict[str, bool] | JSONResponse:
    try:
        with pool.connection() as conn:
            conn.execute("SELECT 1")
    except DB_UNAVAILABLE_EXCEPTIONS:
        return db_unavailable_response(request, route="/api/ready")
    return {"ok": True}


@app.post("/api/observe")
def observe(observation: Observation, request: Request) -> dict[str, Any] | JSONResponse:
    now = int(time.time())

    try:
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    """
                    INSERT INTO products (url, title, seller, image_url)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (url) DO UPDATE
                    SET
                      title = COALESCE(products.title, EXCLUDED.title),
                      seller = COALESCE(products.seller, EXCLUDED.seller),
                      image_url = COALESCE(products.image_url, EXCLUDED.image_url)
                    RETURNING id
                    """,
                    (observation.url, observation.title, observation.seller, observation.image_url),
                )
                product = cur.fetchone()
                if not product:
                    raise HTTPException(status_code=500, detail="Product insert failed")

                product_id = product["id"]
                cur.execute(
                    """
                    SELECT price, scraped_at
                    FROM prices
                    WHERE product_id = %s
                    ORDER BY scraped_at DESC
                    LIMIT 1
                    """,
                    (product_id,),
                )
                latest = cur.fetchone()

                if (
                    latest
                    and now - int(latest["scraped_at"]) <= OBSERVE_DEDUPE_WINDOW_SEC
                    and abs(float(latest["price"]) - observation.price) < 0.01
                ):
                    return {
                        "ok": True,
                        "inserted": False,
                        "deduped": True,
                        "product_id": product_id,
                        "observed_at": int(latest["scraped_at"]),
                    }

                cur.execute(
                    """
                    INSERT INTO prices (product_id, price, currency, scraped_at)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (product_id, observation.price, observation.currency, now),
                )
    except DB_UNAVAILABLE_EXCEPTIONS:
        return db_unavailable_response(request, route="/api/observe")

    return {
        "ok": True,
        "inserted": True,
        "deduped": False,
        "product_id": product_id,
        "observed_at": now,
    }
