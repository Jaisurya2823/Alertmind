# AlertMind — Setup Without Docker

Docker is optional, not required. This guide gets AlertMind running using:
- **Neon** (neon.tech) — free serverless PostgreSQL, no install
- **Upstash** (upstash.com) — free serverless Redis, no install
- **Local disk** — file storage, zero setup, built in by default

Total signup time: about 3 minutes. No Docker Desktop, no WSL2, no virtualization settings in BIOS.

---

## 1. Database — Neon (free Postgres)

1. Go to [neon.tech](https://neon.tech) → sign up (GitHub/Google/email)
2. Create a project — any name, any region close to you
3. On the project dashboard, copy the **connection string**. It looks like:
   ```
   postgresql://alex:AbC123xyz@ep-cool-forest-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Paste it directly into `.env`:
   ```
   DATABASE_URL=postgresql://alex:AbC123xyz@ep-cool-forest-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   Nothing else to change — Neon's URL already includes `sslmode=require`, which Prisma understands natively.

## 2. Cache/Queue — Upstash (free Redis)

1. Go to [upstash.com](https://upstash.com) → sign up
2. Create a Redis database — any name, any region
3. On the database dashboard, find the **connection details** panel. You need three values from it:
   - `Endpoint` (a hostname like `usable-titmouse-12345.upstash.io`)
   - `Port` (usually `6379`)
   - `Password`
4. Put them in `.env`:
   ```
   REDIS_HOST=usable-titmouse-12345.upstash.io
   REDIS_PORT=6379
   REDIS_PASSWORD=<the password Upstash gave you>
   REDIS_TLS=true
   ```
   `REDIS_TLS=true` is required for Upstash — their databases only accept encrypted connections.

## 3. File Storage — nothing to do

Leave this as the default:
```
STORAGE_PROVIDER=local
STORAGE_LOCAL_PATH=./storage/objects
```
PDF exports get written to a folder inside your project directory. No account, no service, no config.

## 4. PDF Export — uses your existing browser

AlertMind auto-detects an installed Chrome or Edge on your machine to generate PDF reports — leave `PUPPETEER_EXECUTABLE_PATH` blank in `.env`. If you don't have Chrome or Edge installed, install one (they're free), or set the path manually:
```
# Windows example
PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

## 5. Everything else

Fill in `AUTH_SECRET`, `CSRF_SECRET`, `ENCRYPTION_KEY`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` using:
```bash
node scripts/generate-secrets.js
```
And `GROQ_API_KEY` from [console.groq.com](https://console.groq.com).

## 6. Run it

```bash
npm install
npx prisma generate
npx prisma migrate deploy
node server.js
```

Open [http://localhost:3000](http://localhost:3000).

---

## Why this is a reasonable default, not just a workaround

- **Neon and Upstash both have generous free tiers** that comfortably cover development and small production use — this isn't a "toy" setup you'll need to abandon later.
- **Local storage is actually more secure by default** than the MinIO path: PDF downloads go through an authenticated API route (your login token required) instead of a presigned URL that works for anyone who has the link.
- **No Docker Desktop licensing concerns** — Docker Desktop requires a paid license for larger companies; Neon/Upstash's free tiers have no such restriction for this use case.
- **Fewer moving parts to debug** — three fewer local services (Postgres, Redis, MinIO containers) means three fewer things that can silently fail to start, conflict on a port, or need a Docker Desktop restart.

## When you'd actually want Docker/MinIO instead

- You're running multiple AlertMind instances behind a load balancer and need object storage shared across all of them → set `STORAGE_PROVIDER=minio`
- You want full data residency on infrastructure you physically control, with no cloud provider in the loop at all → run Postgres/Redis via `docker compose up -d` as before (that path still works, unchanged)
- You're deploying to Kubernetes in production → see `kubernetes/` manifests, which still assume managed/self-hosted Postgres, Redis, and MinIO
