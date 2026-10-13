# Architectural & Technical Decisions Log

This document records key technical decisions, rationale, trade-offs, and assumptions made during development.

---

### DEC-001: Neon PostgreSQL Driver & Connection Strategy
* **Date:** 2026-10-14
* **Decision:** Use `postgres` (postgres.js) with Drizzle ORM (`drizzle-orm/postgres-js`).
  - Running backend API connects to **Neon Pooled Connection String** (PgBouncer port `6543` / `5432` with `ssl: 'require'`).
  - Schema migrations run via Drizzle Kit using **Neon Direct Connection String** (`max: 1`).
* **Why:** Neon's serverless HTTP/WebSocket driver (`@neondatabase/serverless`) is tailored for edge runtimes (Cloudflare Workers, Vercel Edge). For a long-running Node.js Fastify process, a standard TCP client with PgBouncer connection pooling provides maximum throughput, predictable connection reuse, and rock-solid transaction support.
* **Cold Start Handling:** Fastify initializes database health checks with exponential retry (up to 3 retries, 10s timeout) to absorb Neon's free-tier wake-up delay without crashing the process.

---

### DEC-002: Storage Layer Strategy (Phases 0–2 Stub, Phase 3 Cloudflare R2)
* **Date:** 2026-10-14
* **Decision:** Build an `IStorageProvider` abstraction. In Phases 0–2, use a `LocalStorageProvider` (storing files locally in `backend/uploads/` with simulated signed URLs). Switch to `CloudflareR2StorageProvider` in Phase 3.
* **Cloudflare R2 Economics & Free Tier Limits:**
  - Cloudflare R2 offers 10 GB storage free each month with **$0 egress fees** (AWS S3 charges heavy bandwidth fees).
  - Expected monthly usage for 20 sites: 20 sites × 6 photos/day × ~500 KB = ~60 MB/day = **~1.8 GB/month**.
  - **Free Tier Lifespan:** The 10 GB free tier will fill up in approximately **5 months**.
  - **Cost after Free Tier:** Beyond 10 GB, R2 costs **$0.015 / GB / month**. Holding 20 GB costs just $0.15/month extra. This remains exponentially cheaper than AWS S3.

---

### DEC-003: Backend Hosting & Cold Start Management
* **Date:** 2026-10-14
* **Decision:** Recommend Render or Railway for deployment.
* **Important Constraint:** Render's free tier suspends idle web services after 15 minutes. Combining a sleeping web service with Neon's free-tier database sleep can lead to a 30-50 second delay on cold start.
* **Production Recommendation:** Production deployments must use an always-on instance (e.g. Render Starter $7/mo or Railway ~$5/mo). In development, both the mobile app and backend implement resilient retry loops and display a friendly "Starting up, please wait a moment..." state.

---

### DEC-004: Authentication Schemes
* **Date:** 2026-10-14
* **Decision:** 
  - **Owner:** Email + Password. Hashed using `argon2` or `bcrypt`. Owners need desktop/tablet access and standard credential recovery.
  - **Supervisor:** Phone Number + 4-digit PIN. Field supervisors need instantaneous entry without dealing with complex alpha-numeric passwords or email confirmations.
* **Multi-Tenant Rule:** Every authenticated token contains `userId` and `organizationId`. Every database query is strictly scoped to `organization_id`.

---

### DEC-005: AI Voice & Summarization Pipeline (Phase 7 Roadmap)
* **Date:** 2026-10-14
* **Decision:** Retain an adapter interface `IAiTranscriptionProvider` and `IAiSummaryProvider`.
* **Testing Protocol:** Groq Whisper (`whisper-large-v3`) is selected as primary candidate due to low cost (~$0.00185/min) and high speed, but will be benchmarked live in Phase 7 against 5 realistic Hindi/Hinglish audio samples (including background construction noise).
* **Summarizer:** Will query the current recommended Flash-class model with live pricing verified at Phase 7 implementation.
