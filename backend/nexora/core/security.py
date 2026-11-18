"""Local API protection.

Threat model: NEXORA binds to loopback only, but any web page the student opens
in a browser can try to reach http://127.0.0.1:<port>. We defend against that with:

1. A per-launch random access token required on every /api request (except health).
   The token is injected into the HTML served by the backend itself (same origin) or
   attached by the Vite dev proxy. Cross-origin pages cannot read it.
2. Host header validation (blocks DNS-rebinding attacks).
3. No permissive CORS: cross-origin requests are not granted access.
"""

from __future__ import annotations

import hmac

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from nexora.core.config import API_PREFIX, Settings

TOKEN_HEADER = "x-nexora-token"
PUBLIC_PATHS = {f"{API_PREFIX}/health"}


def _hostname(host_header: str) -> str:
    if host_header.startswith("["):
        return host_header.split("]")[0] + "]"
    return host_header.split(":")[0]


class LocalAccessMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, settings: Settings):
        super().__init__(app)
        self.settings = settings

    async def dispatch(self, request: Request, call_next):
        host = _hostname(request.headers.get("host") or "")
        if host not in self.settings.allowed_hosts:
            return JSONResponse({"detail": "Host not allowed"}, status_code=403)

        path = request.url.path
        if path.startswith("/api") and path not in PUBLIC_PATHS:
            supplied = request.headers.get(TOKEN_HEADER, "")
            if not hmac.compare_digest(supplied.encode(), self.settings.access_token.encode()):
                return JSONResponse({"detail": "Missing or invalid local access token"}, status_code=401)
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response
