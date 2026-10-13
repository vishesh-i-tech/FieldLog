# Architecture Overview

DailyRecord is designed around **offline-first field collection** and **centralized owner oversight** with strict multi-tenant data isolation.

---

## High-Level System Architecture

```text
       +-------------------------------------------------------------+
       |                        SUPERVISOR PHONE                     |
       |  (Offline-First React Native / Expo App with Local SQLite)  |
       +------------------------------+------------------------------+
                                      |
                     REST HTTPS API   |   Direct Upload via Presigned URL
                  (JWT Auth + Sync)   |   (Photos & Audio files)
                                      v                               v
       +-------------------------------------+      +------------------------+
       |         FASTIFY BACKEND API         |      |  S3-COMPATIBLE STORAGE  |
       |     (Node.js + TypeScript + Zod)    |      | (Cloudflare R2 / S3)   |
       |     - Multi-tenant tenant checks    |      | - Raw photos (.jpg)    |
       |     - Presigned URL minting         |      | - Voice notes (.m4a)   |
       |     - Asynchronous job dispatcher   |      +------------------------+
       +-------------------+-----------------+
                           |
            Connection     | Pooled SQL
            (PgBouncer)    | over TLS
                           v
       +-------------------------------------+
       |         NEON SERVERLESS POSTGRES    |
       |  - Strict organization_id isolation |
       |  - Drizzle ORM Schema & Migrations  |
       |  - Serverless branches (main, dev)  |
       +-------------------------------------+
                           ^
                           | Async Worker Tasks
       +-------------------+-----------------+
       |         AI PIPELINE ADAPTER         |
       |  1. Transcription: Whisper API      |
       |     (Hindi colloquial speech-to-text)|
       |  2. Summary: Flash LLM Engine       |
       |     (Extract issues, materials, 3-4 |
       |      line concise summary)          |
       +-------------------------------------+
```

---

## Core Components

### 1. Mobile Client (Supervisor & Owner)
- **Framework:** React Native with Expo (TypeScript) & Expo Router.
- **Offline Storage:** Local SQLite database tracks queued submissions and local states.
- **Hardware Integration:** Live in-app camera (gallery imports disabled), GPS coordinates (`expo-location`), and voice microphone recorder.
- **Security:** Tokens stored in `expo-secure-store`. The mobile client **never** communicates with Neon directly and possesses no database credentials.

### 2. Backend API
- **Framework:** Fastify (lightweight, high throughput, built-in schema validation via Zod).
- **Multi-Tenancy:** Every request validates the user's `organization_id` from their signed JWT token. SQL queries strictly constrain where-clauses to the tenant ID.
- **Storage Subsystem:** Issues short-lived pre-signed upload URLs so the mobile client uploads large binary media directly to object storage without choking backend bandwidth.
- **Connection Handling:** Configured with retry logic and connection pooling to seamlessly tolerate Neon free-tier scale-to-zero wake-up latency.

### 3. Database Layer (Neon Postgres)
- **Engine:** Serverless PostgreSQL on Neon.
- **Connection Model:** 
  - **Pooled string** (PgBouncer) for the live backend API server.
  - **Direct string** for running Drizzle schema migrations.
- **Branching Strategy:** Dedicated `dev` branch for local development and testing, isolated from the production `main` branch.

### 4. File Storage
- **Provider:** S3-compatible object storage (Cloudflare R2 in production; local disk stub during development).
- **Privacy:** Private bucket. Files are never public; access is mediated through short-lived presigned download URLs.

### 5. AI Processing Pipeline
- **Adapter Pattern:** `IAiTranscriptionProvider` and `IAiSummaryProvider` interfaces.
- **Processing Flow:** 
  1. Supervisor uploads voice note.
  2. Background job extracts transcript using speech-to-text with Hindi acoustic models.
  3. LLM synthesizes structured summary (material requests, site delays, manpower status).
  4. Original audio and raw text are always retained alongside the summary as the immutable source of truth.
