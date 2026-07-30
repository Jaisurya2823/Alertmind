# AlertMind — Architecture

## System Overview

```
Client (Alpine.js SPA)
       │
       ▼
Nginx (TLS, rate limiting)
       │
       ▼
Express API (Node.js 22)
       │
       ├──► PostgreSQL 17 (Prisma) — persistent data
       ├──► Redis (ioredis) — cache, sessions, rate limits
       ├──► BullMQ — async investigation queue
       ├──► MinIO — PDF/report object storage
       └──► Groq API — AI inference (Llama 3.3 70B / 3.1 8B)
```

## Request Flow — Alert Submission

1. Client submits alert via `POST /api/v1/alerts`
2. `alert.controller.js` validates and sanitizes input
3. `alert.service.js` creates `Alert` + `Investigation` records
4. Job enqueued to BullMQ `investigation` queue
5. Controller returns `202 Accepted` with `investigationId` immediately
6. Client polls `GET /api/v1/investigations/:id/status`

## AI Pipeline Execution (Background Worker)

```
jobs.js (BullMQ worker)
    │
    ▼
orchestration.service.js
    │
    ├─► parser.agent.js          (Llama 3.1 8B)
    ├─► entity-extractor.agent.js (Llama 3.1 8B)
    ├─► threat-classifier.agent.js (Llama 3.1 8B)
    ├─► mitre-mapper.agent.js     (Llama 3.3 70B)
    ├─► hypothesis-generator.agent.js (Llama 3.3 70B)
    ├─► investigation-planner.agent.js (Llama 3.3 70B)
    ├─► risk-assessor.agent.js    (Llama 3.3 70B)
    ├─► report-generator.agent.js (Llama 3.3 70B)
    └─► qa-validator.agent.js     (Llama 3.1 8B)
```

Each agent:
- Receives structured context from prior agents
- Calls `llm.service.js` with a Zod output schema
- Output is validated; invalid output triggers automatic retry
- Results persist to PostgreSQL incrementally (not all-or-nothing)

## Module Structure

Each business domain under `src/modules/<name>/` follows:
```
<name>.routes.js       — Express router, middleware wiring
<name>.controller.js   — HTTP request/response handling
<name>.service.js      — Business logic, DB queries
<name>.schema.js        — Zod validation schemas
```

## Data Layer

- **Prisma** is the single source of truth for schema (`prisma/schema.prisma`)
- **Repositories** (`src/database/repositories/`) wrap common query patterns
- **Models** (`src/database/models/`) add domain logic on top of raw Prisma records

## Caching Strategy

| Data | TTL | Invalidation |
|---|---|---|
| Completed investigations | 1 hour | On retry |
| User records | 5 min | On update |
| API key lookups | 5 min | On revoke |
| MITRE reference data | 24 hours | Manual |

## Security Boundaries

- All routes except `/api/health/*` require authentication (JWT or API key)
- RBAC enforced via `permission.middleware.js` on every protected route
- Connector credentials encrypted with AES-256-GCM before storage
- Rate limits backed by Redis — consistent across horizontally scaled pods

## Observability

- **Logs**: Pino → stdout (JSON) → collected by container runtime
- **Metrics**: `prom-client` on internal port 9090, scraped by Prometheus
- **Traces**: OpenTelemetry → OTLP exporter → collector
- **Errors**: Sentry (PII scrubbed in `beforeSend`)
