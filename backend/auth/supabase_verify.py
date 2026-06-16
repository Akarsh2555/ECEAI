import os
import httpx
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

bearer = HTTPBearer(auto_error=False)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

APP_ENV = os.environ.get("APP_ENV", "development").lower()
# The demo auth bypass (accepts 'demo-token' / works without Supabase) is a
# DEV convenience and must never be on in production. It is enabled only outside
# production, or when explicitly opted in via ALLOW_DEMO_AUTH=true.
ALLOW_DEMO_AUTH = os.environ.get(
    "ALLOW_DEMO_AUTH", "false" if APP_ENV == "production" else "true"
).lower() == "true"


async def verify_token(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer),
) -> dict:
    """Verify a Supabase JWT via the /auth/v1/user endpoint.

    Production (ALLOW_DEMO_AUTH=false): a valid Supabase token is required, and a
    missing Supabase config is a hard error — we never silently authenticate.
    Dev/demo (ALLOW_DEMO_AUTH=true): a 'demo-token' or an unconfigured Supabase
    returns a mock user so the app is usable locally without auth setup."""

    supabase_ready = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)

    if ALLOW_DEMO_AUTH and (not supabase_ready or (credentials and credentials.credentials == "demo-token")):
        return {"id": "demo-user-001", "email": "demo@ececopilot.dev"}

    if not supabase_ready:
        raise HTTPException(status_code=503, detail="Authentication is not configured on the server")

    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = credentials.credentials

    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_SERVICE_KEY,
            },
        )

    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return r.json()
