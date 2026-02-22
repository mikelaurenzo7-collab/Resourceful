from pydantic_settings import BaseSettings
from pydantic import model_validator
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Resourceful"
    app_version: str = "0.1.0"
    debug: bool = True

    # Database
    database_url: str = "sqlite+aiosqlite:///./resourceful.db"

    # Auth
    secret_key: str = "CHANGE-ME-in-production-use-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    platform_fee_percent: float = 8.0

    # Resource defaults
    solar_default_rate_kwh: float = 0.08
    bandwidth_default_rate_gb: float = 0.05
    gpu_default_rate_hour: float = 0.50

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @model_validator(mode="after")
    def ensure_async_sqlite_fallback(self):
        """If the DATABASE_URL points to PostgreSQL without asyncpg installed,
        fall back to SQLite for local development."""
        url = self.database_url
        if url.startswith("postgresql://") or url.startswith("postgres://"):
            try:
                import asyncpg  # noqa: F401

                # Convert to async postgres URL
                self.database_url = url.replace(
                    "postgresql://", "postgresql+asyncpg://"
                ).replace("postgres://", "postgresql+asyncpg://")
            except ImportError:
                # asyncpg not installed — use SQLite for dev
                self.database_url = "sqlite+aiosqlite:///./resourceful.db"
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
