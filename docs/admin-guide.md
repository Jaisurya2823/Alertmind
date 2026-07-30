# AlertMind — Administrator Guide

## Roles

| Role | Permissions |
|---|---|
| OWNER | Full access, including billing |
| ADMIN | Manage users, settings, API keys, connectors — no billing |
| ANALYST | Submit alerts, view investigations, export reports |
| VIEWER | Read-only access to investigations and reports |

## Managing Users

Invite users via `POST /api/v1/organizations/:id/members` (requires ADMIN or OWNER).

To deactivate a user, use the user management endpoint — this immediately revokes their sessions on next token expiry (max 15 minutes).

## API Keys

Create organization-level API keys for CI/CD, SIEM integrations, or scripted alert submission:

```bash
curl -X POST https://your-domain.com/api/v1/api-keys \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "<uuid>",
    "name": "Splunk Forwarder",
    "permissions": ["alert:write", "investigation:read"]
  }'
```

**The raw key is shown exactly once.** Store it securely — AlertMind only stores its SHA-256 hash.

## Organization Settings

Configurable via `PATCH /api/v1/organizations/:id/settings`:

- `retentionDays` — how long to keep alert/investigation data (default 90)
- `webhookUrl` — endpoint to notify on new investigations
- `notifyOnHigh` / `notifyOnCritical` — enable notifications for high-severity alerts
- `aiModel` — override the default AI model per organization

## Audit Logs

All security-significant actions (login, alert submission, API key creation, settings changes) are logged to an append-only audit trail. Access via `GET /api/v1/audit` (requires `audit:read` permission).

## Live Connectors (Splunk / Elastic)

AlertMind can poll your SIEM directly instead of requiring analysts to paste alerts manually.

### Setting up a Splunk connector

1. In Splunk: **Settings → Tokens → New Token**. Assign a role with **only** the `search` capability — never use an admin token.
2. In AlertMind: `POST /api/v1/connectors`
   ```json
   {
     "type": "SPLUNK",
     "workspaceId": "<uuid>",
     "name": "Production Splunk",
     "config": {
       "baseUrl": "https://splunk.corp.local:8089",
       "token": "<your read-only token>",
       "indexes": ["security", "notable"]
     },
     "syncIntervalMinutes": 15
   }
   ```
3. AlertMind tests the connection before saving — if it fails, nothing is persisted.

### Setting up an Elastic connector

1. In Elastic: **Stack Management → API Keys → Create**, restricted to `read` on your alert index pattern only.
2. In AlertMind: `POST /api/v1/connectors`
   ```json
   {
     "type": "ELASTIC",
     "workspaceId": "<uuid>",
     "name": "Production Elastic",
     "config": {
       "baseUrl": "https://elastic.corp.local:9200",
       "apiKey": "<your read-only API key>",
       "indexPattern": "logs-security.*"
     },
     "syncIntervalMinutes": 15
   }
   ```

### How syncing works

- Scheduled via BullMQ repeatable jobs — fires once per interval **cluster-wide**, not once per replica
- Each sync pulls events since the last successful sync (first sync looks back 60 minutes)
- Every event is deduplicated (Redis, 7-day window) before entering the AI pipeline — polling overlap never creates duplicate investigations
- Capped at 50 events per sync cycle to bound AI cost from a misconfigured query
- Manual trigger: `POST /api/v1/connectors/:id/sync`
- Credentials are AES-256-GCM encrypted at rest and never appear in logs, audit trails, or API responses

### Security notes

- AlertMind never issues write/delete calls to Splunk or Elastic — only `GET /services/server/info` + read-only searches (Splunk), and `GET /_cluster/health` + `_search` (Elastic)
- If a connector's credentials are revoked or expire, `syncStatus` flips to `ERROR` and syncing pauses automatically — check `GET /api/v1/connectors/:id`

## Monitoring Your Deployment


- **Grafana Dashboard**: `monitoring/grafana-dashboard.json` — investigation throughput, AI latency, error rates
- **Prometheus Alerts**: `monitoring/alerts.yml` — pre-configured alerts for SLA breaches, error spikes, queue backlog
- **Health Endpoint**: `GET /api/health` — checks database, Redis, and AI provider connectivity

## Data Retention & Privacy

- Raw alert content is stored in PostgreSQL for the configured retention period
- No alert data is sent to Groq for model training — inference only
- Connector credentials are encrypted at rest with AES-256-GCM
- PII is scrubbed from Sentry error reports automatically
