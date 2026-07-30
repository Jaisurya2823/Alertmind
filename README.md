# AlertMind — AI Security Alert Investigation Platform

Transform any security alert into a complete AI-powered investigation in under 60 seconds.

[![CI](https://github.com/your-org/alertmind/workflows/CI/badge.svg)](https://github.com/your-org/alertmind/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What AlertMind Does

AlertMind is an AI-powered alert investigation platform that eliminates the most time-consuming part of SOC operations: understanding and documenting security alerts.

**Before AlertMind:** Analysts spend 30–60 minutes per alert manually researching MITRE ATT&CK, extracting IOCs, correlating evidence, and writing reports.

**After AlertMind:** Paste any alert. Receive a complete investigation in under 60 seconds.

### AI Investigation Pipeline

```
Alert Input → Parser → Entity Extraction → Threat Classification → MITRE ATT&CK Mapping
           → Hypothesis Generation → Investigation Planning → Risk Assessment → Report
```

### Supported Alert Formats (paste/upload)

- Microsoft Defender XDR
- CrowdStrike Falcon
- Splunk
- Elastic / Kibana
- Wazuh
- Sysmon (XML)
- Windows Event Logs
- SentinelOne
- AWS GuardDuty
- Syslog / CEF
- Sigma Rules
- Plain text logs

### Live Connectors (automatic ingestion)

AlertMind can poll your SIEM directly instead of requiring manual paste:

- **Splunk** — read-only REST API integration (token auth, oneshot search)
- **Elastic** — read-only REST API integration (API key auth, `_search`)

Both run on BullMQ repeatable jobs (fires once per interval cluster-wide, not per replica), dedupe events via Redis, and cap ingestion per cycle to bound AI cost. Credentials are AES-256-GCM encrypted at rest. See `docs/admin-guide.md` for setup.

---

## Quick Start

Docker is **optional** — the default setup needs no Docker, no local Postgres/Redis install, nothing beyond Node.js and two free cloud signups.

### Prerequisites

- Node.js 22 LTS
- A Groq API key (free at [console.groq.com](https://console.groq.com))
- A free [Neon](https://neon.tech) Postgres database and a free [Upstash](https://upstash.com) Redis database — full walkthrough in [`docs/no-docker-setup.md`](docs/no-docker-setup.md) (~3 minutes)

### 1. Clone and install

```bash
git clone https://github.com/your-org/alertmind.git
cd alertmind
npm install
npx prisma generate
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your Groq key:

```env
GROQ_API_KEY=gsk_your_key_here
```

Then generate every secret in one step — `AUTH_SECRET`, `CSRF_SECRET`, `ENCRYPTION_KEY`, and the JWT RSA key pair (works on Windows, Mac, Linux — no `openssl` required):

```bash
node scripts/generate-secrets.js
```

Paste the 5 printed lines into `.env`.

Then set `DATABASE_URL` (from Neon) and `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` (from Upstash) — see [`docs/no-docker-setup.md`](docs/no-docker-setup.md) for exactly where to find these in each dashboard. File storage and PDF export need no configuration — they use local disk and your installed Chrome/Edge browser automatically.

### 3. Run migrations and start

```bash
npx prisma migrate deploy
node server.js
```

Open [http://localhost:3000](http://localhost:3000)

---

### Alternative: Docker Compose path

If you'd rather run Postgres/Redis/MinIO locally in containers instead of using Neon/Upstash/local disk, that path still works unchanged:

```bash
make install
node scripts/generate-secrets.js   # paste output into .env
make docker-up                     # Postgres, Redis, MinIO, Prometheus, Grafana
make db-migrate
make dev
```

Set `STORAGE_PROVIDER=minio` in `.env` if you want file storage in the MinIO container rather than on local disk.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    AlertMind Platform                    │
│                                                         │
│  Frontend: HTML5 + Alpine.js + Tailwind CSS + Flowbite  │
│                                                         │
│  Backend: Node.js 22 + Express.js (ES Modules)          │
│                                                         │
│  AI Pipeline:                                           │
│    Groq (Llama 3.3 70B + Llama 3.1 8B)                 │
│    10-stage agent pipeline                              │
│                                                         │
│  Database: PostgreSQL 17 + pgvector                     │
│  Cache: Redis (BullMQ + session + rate limiting)        │
│  Storage: Local disk (default) or MinIO (S3-compatible)  │
│  Monitoring: Prometheus + Grafana + Sentry              │
└─────────────────────────────────────────────────────────┘
```

### AI Agents

| Agent | Model | Purpose |
|---|---|---|
| Parser | Llama 3.1 8B | Format detection, field normalization |
| Entity Extractor | Llama 3.1 8B | IOC extraction, Base64 decoding |
| Threat Classifier | Llama 3.1 8B | Category, kill chain, plain-English explanation |
| MITRE Mapper | Llama 3.3 70B | ATT&CK technique mapping with evidence |
| Hypothesis Generator | Llama 3.3 70B | 3 ranked hypotheses with confidence scores |
| Investigation Planner | Llama 3.3 70B | Checklist, platform queries, commands |
| Risk Assessor | Llama 3.3 70B | Severity, likelihood, business impact |
| Report Generator | Llama 3.3 70B | Executive + technical incident report |
| QA Validator | Llama 3.1 8B | Fabrication detection, consistency check |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 LTS |
| Framework | Express.js (ES Modules) |
| AI Provider | Groq (Llama 3.3 70B / Llama 3.1 8B) |
| Database | PostgreSQL 17 + pgvector |
| ORM | Prisma |
| Cache | Redis (ioredis) |
| Queue | BullMQ |
| Auth | RS256 JWT (jose) + Argon2id |
| Storage | Local disk (default) or MinIO (optional) |
| PDF | Puppeteer + Chromium |
| Monitoring | Prometheus + Grafana + Sentry |
| Frontend | HTML5 + Alpine.js + Tailwind CSS |
| Testing | Vitest + Playwright |
| Deployment | Docker + Kubernetes + GitHub Actions |

---

## API Reference

Base URL: `https://your-domain.com/api/v1`

### Authentication

Include in headers:
```
Authorization: Bearer <access_token>
# or
X-Api-Key: am_your_api_key
```

### Submit Alert

```http
POST /alerts
Content-Type: application/json

{
  "rawInput": "<paste any security alert here>",
  "workspaceId": "uuid"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "alertId": "uuid",
    "investigationId": "uuid",
    "message": "Alert submitted. Investigation is processing.",
    "estimatedSeconds": 60
  }
}
```

### Poll Investigation Status

```http
GET /investigations/:id/status
```

### Get Full Investigation Results

```http
GET /investigations/:id?workspaceId=uuid
```

### Export Report as PDF

```http
POST /reports/:investigationId/pdf
```

Full API documentation: [http://localhost:3000/api/docs](http://localhost:3000/api/docs) (development only)

---

## Available Commands

```bash
make help          # Show all commands
make install       # Install dependencies
make keys          # Generate RSA key pair
make dev           # Start development server
make docker-up     # Start all services
make db-migrate    # Run database migrations
make db-seed       # Seed reference data
make test          # Run all tests
make test-unit     # Unit tests only
make test-api      # API tests only
make lint          # ESLint
make format        # Prettier
make audit         # npm security audit
make clean         # Remove node_modules, logs, temp
```

---

## Deployment

### Docker Compose (single server)

```bash
# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Kubernetes (Hetzner Cloud or any K8s)

```bash
# Create namespace
kubectl create namespace alertmind

# Apply secrets (use sealed-secrets in production)
kubectl apply -f kubernetes/secret.example.yaml -n alertmind

# Apply configuration
kubectl apply -f kubernetes/configmap.yaml -n alertmind
kubectl apply -f kubernetes/deployment.yaml -n alertmind
kubectl apply -f kubernetes/service.yaml -n alertmind
kubectl apply -f kubernetes/ingress.yaml -n alertmind
kubectl apply -f kubernetes/hpa.yaml -n alertmind
```

---

## Security

- All passwords hashed with Argon2id (OWASP 2024 parameters)
- JWT signed with RS256 (4096-bit RSA keys)
- Connector credentials encrypted at rest with AES-256-GCM
- API keys stored as SHA-256 hashes
- Rate limiting backed by Redis (works across pods)
- CSRF protection with double-submit cookie pattern
- Security headers via Helmet
- Input sanitization on all alert ingestion
- Prometheus metrics on internal port only (never exposed publicly)
- Non-root Docker container
- TLS enforced in production Nginx config

---

## Environment Variables

See `.env.example` for all configuration options with descriptions.

**Required:** `GROQ_API_KEY`, `AUTH_SECRET`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `CSRF_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`, `REDIS_HOST`

**Required only if `STORAGE_PROVIDER=minio`:** `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` — not needed with the default `STORAGE_PROVIDER=local`.

---

## License

MIT License — see [LICENSE](LICENSE) for details.
#   A l e r t m i n d  
 