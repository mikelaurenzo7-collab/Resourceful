from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


_engine = None
_async_session = None


def _get_engine():
    global _engine
    if _engine is None:
        from app.config import get_settings

        settings = get_settings()
        db_url = settings.database_url
        connect_args = {"check_same_thread": False} if "sqlite" in db_url else {}
        _engine = create_async_engine(db_url, echo=settings.debug, connect_args=connect_args)
    return _engine


def _get_session_factory():
    global _async_session
    if _async_session is None:
        _async_session = async_sessionmaker(
            _get_engine(), class_=AsyncSession, expire_on_commit=False
        )
    return _async_session


async def get_db() -> AsyncSession:
    session_factory = _get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    engine = _get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
