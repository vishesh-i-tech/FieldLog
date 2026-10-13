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

---

### DEC-006: Product Rename to FieldLog & Neutral Wording
* **Date:** 2026-10-14
* **Decision:** App renamed to **FieldLog**. The system is generalized for any business owner running work across multiple remote locations (shops, farms, factories, delivery, guards, construction).
* **Code Identifier Convention:** All user-facing text uses "Work" (Hindi: "काम") via i18n dictionaries. Database tables, API routes, and code identifiers strictly retain `sites` and `site_id` to avoid breaking schema contracts. In all internal code and docs, "sites" signifies "work place".

---

### DEC-007: Dynamic Issue Types System
* **Date:** 2026-10-14
* **Decision:** Replace hard-coded issue enums with a dynamic `issue_types` table.
* **Rules:**
  - 6 universal default chips seeded upon organization creation.
  - Owners can create, rename, reorder, and hide chips.
  - Maximum 8 active visible chips enforced at API layer to prevent cluttered mobile UI for field supervisors.
  - Strict multi-tenant isolation enforced on all read/write endpoints.

---

### DEC-008: Android Distribution via EAS Preview APK
* **Date:** 2026-10-14
* **Decision:** For internal testing (several months), distribute standalone Android `.apk` files using EAS Build `preview` profile rather than publishing directly to Google Play Store.
* **Updates:** Use EAS Update (OTA) for fast JavaScript-only bug fixes; enforce backend minimum app version via `GET /version` to prevent outdated client desync.

---

### DEC-009: Environment Separation (Dev, Preview, Production)
* **Date:** 2026-10-14
* **Decision:** Separate three execution tiers:
  - **Development:** Local Fastify backend on Wi-Fi IP, Neon `dev` branch via `db:push` or local tests, Expo development build / Expo Go.
  - **Preview (Testers):** Hosted Fastify backend with valid SSL/HTTPS, dedicated Neon `preview` branch with structured migrations (`db:migrate`), standalone Android APK.
  - **Production (Future):** Scaled backend, Neon `main` branch, Android AAB for Google Play Store.

---

### DEC-010: Web Preview & Dev-Safe Fallbacks Architecture
* **Date:** 2026-10-14
* **Decision:** Support live laptop web browser frontend development (`npm run dev:web`) via `react-native-web` without sacrificing native Android constraints.
* **Architecture:**
  - Phone-sized container: Centered 430px column with `#030712` desktop frame backdrop in `app/_layout.tsx`.
  - Native-only feature isolation: Features that require native hardware (camera, satellite GPS, secure hardware keystore, SQLite, native push) are wrapped behind platform gates.
  - Strict Dev Isolation: DEV mock photos, synthetic mock audio, and mock GPS coordinates are strictly guarded behind `Platform.OS === 'web' && __DEV__`. They are stripped out of release builds.
  - Gallery Prohibition Intact: The real Android application continues to prohibit gallery pickers, preserving anti-fraud guarantees.

---

### DEC-011: Cross-Platform Voice Note Architecture (Phase 4)
* **Date:** 2026-10-14
* **Decision:** Implement voice recording abstraction using HTML5 `MediaRecorder` on Web (`audio/webm`) and Expo SDK 52 `expo-audio` on Native (`audio/m4a`).
* **Constraints:**
  - 60-second hardware recording cap to protect mobile data usage and transcription latency.
  - Live pulsing recording timer and visual progress bar.
  - Instant in-app playback preview with pause and re-record capability.
  - Presigned upload URL flow with MIME validation (`audio/m4a`, `audio/webm`, `audio/mp4`, `audio/aac`).
  - Recorded audio attached to master record via `media` table (`kind: 'audio'`) and reflected on `daily_records.missing_voice`.

