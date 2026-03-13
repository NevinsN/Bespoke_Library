"""
telemetry.py — Azure Application Insights integration.

Wires opencensus-ext-azure into Flask for:
  - Request tracking (every HTTP request with duration + status)
  - Exception tracking (unhandled errors with full stack)
  - Dependency tracking (Cosmos DB calls via pymongo)
  - Custom events (uses track_event for product analytics)

Reads APPLICATIONINSIGHTS_CONNECTION_STRING from environment.
Silently no-ops if the key is absent (local dev).
"""

import os
import logging

_client = None
_enabled = False


def init_telemetry(app):
    """
    Call once at Flask startup: init_telemetry(app).
    Attaches opencensus middleware and configures exporters.
    """
    global _client, _enabled

    conn_str = os.getenv("APPLICATIONINSIGHTS_CONNECTION_STRING", "")
    if not conn_str:
        app.logger.info("Application Insights not configured — telemetry disabled.")
        return

    try:
        from opencensus.ext.azure.trace_exporter import AzureExporter
        from opencensus.ext.azure.log_exporter import AzureLogHandler
        from opencensus.ext.flask.flask_middleware import FlaskMiddleware
        from opencensus.trace.samplers import ProbabilitySampler

        # ── Request + dependency tracing ─────────────────────────────────────
        FlaskMiddleware(
            app,
            exporter=AzureExporter(connection_string=conn_str),
            sampler=ProbabilitySampler(rate=1.0),  # 100% sampling — adjust for high traffic
        )

        # ── Exception + structured log export ────────────────────────────────
        handler = AzureLogHandler(connection_string=conn_str)
        handler.setLevel(logging.WARNING)
        logging.getLogger().addHandler(handler)
        app.logger.addHandler(handler)

        # ── Custom event client ───────────────────────────────────────────────
        from opencensus.ext.azure import metrics_exporter
        from applicationinsights import TelemetryClient
        _client = TelemetryClient(connection_string=conn_str)
        _client.channel.sender.send_interval_in_milliseconds = 5000

        _enabled = True
        app.logger.info("Application Insights telemetry enabled.")

    except ImportError as e:
        app.logger.warning(f"Application Insights packages not installed: {e}")
    except Exception as e:
        app.logger.warning(f"Application Insights init failed: {e}")


def track_event(name, properties=None, measurements=None):
    """
    Send a custom product event to Application Insights.
    Safe to call even if telemetry is disabled.

    Usage:
        track_event("chapter_opened", {"draft_id": "...", "user_id": "..."})
    """
    if not _enabled or not _client:
        return
    try:
        _client.track_event(name, properties=properties or {}, measurements=measurements or {})
    except Exception:
        pass


def track_exception(exc=None):
    """
    Explicitly track an exception (e.g. from a caught error you want visibility on).
    """
    if not _enabled or not _client:
        return
    try:
        _client.track_exception()
    except Exception:
        pass
