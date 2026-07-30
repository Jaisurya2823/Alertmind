# AlertMind — API Guide

Base URL: `https://your-domain.com/api/v1`

Full OpenAPI spec: `src/docs/openapi.yaml` (served at `/api/docs` in development)

## Authentication

Two methods:

**1. JWT Bearer Token** (for the web UI and user sessions)
```
Authorization: Bearer <access_token>
```
Obtained via `POST /api/v1/auth/login`. Expires in 15 minutes; use the refresh token to get a new one.

**2. API Key** (for programmatic/integration access)
```
X-Api-Key: am_<64 hex chars>
```
Created via `POST /api/v1/api-keys` (requires OWNER or ADMIN role).

## Typical Flow

```bash
# 1. Register
curl -X POST https://your-domain.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Analyst","email":"jane@corp.com","password":"SecurePass123!","organizationName":"Acme Corp"}'

# 2. Login
curl -X POST https://your-domain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@corp.com","password":"SecurePass123!"}'
# → returns accessToken, refreshToken

# 3. Submit an alert
curl -X POST https://your-domain.com/api/v1/alerts \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"rawInput":"<paste alert JSON/text here>","workspaceId":"<uuid>"}'
# → returns investigationId

# 4. Poll for completion
curl https://your-domain.com/api/v1/investigations/<id>/status \
  -H "Authorization: Bearer <accessToken>"
# → status: IN_PROGRESS | COMPLETED | FAILED

# 5. Fetch full results
curl "https://your-domain.com/api/v1/investigations/<id>?workspaceId=<uuid>" \
  -H "Authorization: Bearer <accessToken>"

# 6. Export as PDF
curl -X POST https://your-domain.com/api/v1/reports/<id>/pdf \
  -H "Authorization: Bearer <accessToken>"
```

## Rate Limits

| Endpoint group | Limit |
|---|---|
| `/auth/login`, `/auth/register` | 10 / 15 min per IP |
| `/alerts` (submission) | 10 / 60s per user |
| `/reports/*/pdf` | 5 / 60s per user |
| All other `/api/*` | 100 / 15 min per user/IP |

## Error Format

All errors follow:
```json
{
  "success": false,
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "requestId": "uuid",
  "fieldErrors": { "email": ["Invalid email format"] }
}
```

## Pagination

List endpoints accept `page` and `limit` query params and return:
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1, "limit": 25, "total": 142,
    "totalPages": 6, "hasNextPage": true, "hasPreviousPage": false
  }
}
```
