"""Structured logging configuration for Resourceful."""

import logging
import json
import sys
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    """Format log records as JSON for structured logging in production."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


def setup_logging(debug: bool = True):
    """Configure logging for the application."""
    root_logger = logging.getLogger()

    # Clear existing handlers
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)

    if debug:
        handler.setFormatter(logging.Formatter(
            "%(asctime)s %(levelname)-8s %(name)s: %(message)s",
            datefmt="%H:%M:%S",
        ))
        root_logger.setLevel(logging.DEBUG)
        # Quiet noisy loggers in debug mode
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
        logging.getLogger("httpcore").setLevel(logging.WARNING)
    else:
        handler.setFormatter(JSONFormatter())
        root_logger.setLevel(logging.INFO)

    root_logger.addHandler(handler)
