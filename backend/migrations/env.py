from alembic import context
from sqlalchemy import create_engine

from nexora.infrastructure.database.models import Base

config = context.config
target_metadata = Base.metadata


def _include(obj, name, type_, reflected, compare_to):
    # FTS5 virtual tables (and their shadow tables) are managed by hand-written migrations.
    return not (type_ == "table" and name and name.startswith("content_fts"))


def run_migrations_online() -> None:
    engine = config.attributes.get("engine")
    if engine is None:  # CLI usage: alembic -x db=path/to.db
        db = context.get_x_argument(as_dictionary=True).get("db", "nexora-dev.db")
        engine = create_engine(f"sqlite:///{db}")
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()
        connection.commit()


run_migrations_online()
