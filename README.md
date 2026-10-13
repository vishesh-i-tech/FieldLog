# 📍 FieldLog

> **Offline-first, mobile-first daily reporting app for business owners managing work across multiple remote locations.**  
> *Built for real-world operations: shops, farms, factories, delivery hubs, repair teams, guards, and construction.*

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Expo](https://img.shields.io/badge/Expo-SDK%2052-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![React Native Web](https://img.shields.io/badge/React%20Native%20Web-Supported-61DAFB?logo=react&logoColor=white)](https://necolas.github.io/react-native-web/)
[![Fastify](https://img.shields.io/badge/Fastify-v5-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![Neon Postgres](https://img.shields.io/badge/Neon-PostgreSQL%20Serverless-00E599?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

---

## 💡 What is FieldLog?

Business owners running work across multiple remote sites cannot visit every location every day. Daily phone calls waste hours and result in miscommunication. Generic messaging apps (like WhatsApp) get cluttered and lack accountability.

**FieldLog solves this with high-trust, zero-typing reporting:**

* 🟢 **3-Tap Daily Status:** Big, accessible buttons for **"पूरा दिन (Full Day)"**, **"आधा दिन (Half Day)"**, and **"काम बंद (Stopped)"**.
* 📸 **Live-Camera Geo-Tagging:** Real-time in-app camera capture stamped with GPS coordinates, satellite accuracy, and capture timestamps. **No photo gallery uploads allowed** (anti-fraud protection).
* 🎙️ **60-Second Voice Notes:** Supervisors speak their daily update in Hindi/regional language. Live audio recording, instant in-app playback preview, and re-record capability.
* 🏷️ **Dynamic Issue Chips:** Tap-to-report obstacles (*"सामान नहीं आया"*, *"स्टाफ कम"*, *"बारिश"*, *"मशीन खराब"*, etc.) customized per business.
* 🌐 **Instant Laptop Web Preview:** Develop and test live in your laptop browser (`npm run dev:web`) inside a centered 430px smartphone frame with dev-safe fallbacks.
* 🛡️ **Strict Multi-Tenancy:** Complete tenant isolation at both the API layer and the database layer.

---

## 🏗️ Architecture & Technology Stack

```
                          ┌────────────────────────┐
                          │   Business Owner       │
                          │   (Web Dashboard)      │
                          └───────────┬────────────┘
                                      │
                                      ▼
┌────────────────────────┐     ┌──────────────────┐     ┌────────────────────────┐
│   Field Supervisor     │────▶│ Fastify Backend  │────▶│ Neon Serverless DB     │
│   (Mobile App / Web)   │     │ (REST API / JWT) │     │ (Postgres + Drizzle)   │
└────────────────────────┘     └─────────┬────────┘     └────────────────────────┘
            │                            │
            ▼                            ▼
┌────────────────────────┐     ┌──────────────────┐
│  Device GPS + Camera   │     │  Object Storage  │
│  + Audio Recorder      │     │  (Dev / R2 / S3) │
└────────────────────────┘     └──────────────────┘
```

* **Mobile & Frontend (`mobile/`):** React Native (Expo SDK 52), Expo Router v4, React Native Web, `expo-audio`, `expo-camera`, `expo-location`.
* **Backend (`backend/`):** Fastify v5, TypeScript, JWT role-based access, bcrypt password & PIN hashing.
* **Database:** Neon Serverless PostgreSQL with PgBouncer connection pooling and Drizzle ORM.
* **Storage:** Presigned upload architecture (Local filesystem stub in dev, Cloudflare R2 / S3 in production).

---

## 🚦 Roadmap & Implementation Status

| Phase | Feature | Status | Test Verification |
|---|---|---|---|
| **Phase 0** | **Foundation** (Monorepo, Fastify, Neon, Health Check, Expo) | ✅ Complete | Verified on Phone |
| **Updates** | **FieldLog Generalized Architecture** (Universal neutral wording, Dynamic chips) | ✅ Complete | Automated Tests Pass |
| **Phase 1** | **Auth & Roles** (Multi-tenant isolation, Owner signup, Supervisor PIN login) | ✅ Complete | Automated Tests Pass |
| **Phase 2** | **Work Places & Assignments** (CRUD, Scoped permissions, Site mapping) | ✅ Complete | Automated Tests Pass |
| **Phase 3** | **Daily Record Submission** (Status buttons, GPS photos, Idempotency, Edit diffs) | ✅ Complete | Automated Tests Pass |
| **Phase 4** | **Voice Note Recording** (Web MediaRecorder, expo-audio, Live timer, Playback) | ✅ Complete | Automated Tests Pass |
| **Phase 5** | Offline Sync Queue (SQLite, background retry worker, conflict resolution) | ⏳ In Progress | Manual Phone Check |
| **Phase 6** | Owner Dashboard & Day Detail (7-day grid, Audio player, Photo carousel, "Seen" tick) | 📋 Planned | Automated Tests |
| **Phase 7** | AI Voice Pipeline (Hindi Whisper transcription, LLM daily summaries) | 📋 Planned | Manual Phone Check |
| **Phase 8** | Reminders & Push Notifications (5 PM supervisor alert, Evening digest) | 📋 Planned | Automated Tests |
| **Phase 9** | Anti-Fake Hardening (Mock location flags, Time skew checks, Rate limits) | 📋 Planned | Automated Tests |
| **Phase 10** | Production Release (EAS Build standalone APK/AAB, Play Store readiness) | 📋 Planned | Final Release |

---

## 🚀 Quick Start & Development

### 1. Prerequisites
* **Node.js** v18+ and **npm** v9+
* Neon Postgres account (or local Postgres)

### 2. Installation
```powershell
# Clone the repository
git clone https://github.com/vishesh-i-tech/FieldLog.git
cd FieldLog

# Install dependencies across all workspaces
npm install
```

### 3. Configure Environment
Create `backend/.env`:
```env
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://user:password@ep-cold-pooler.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:password@ep-cold.neon.tech/neondb?sslmode=require"
JWT_SECRET="dev-super-secret-key-change-in-production-12345"
```

Push database schema to Neon:
```powershell
npm run db:push
```

### 4. Seed Realistic Test Data
```powershell
npm run seed:dev
```
*Seeds a test owner (`owner@fieldlog.dev`), 2 supervisors with 4-digit PINs (`9811111111` / `1234`), 3 work places, and 7 days of realistic history.*

### 5. Run the Application

```powershell
# Start the Fastify backend API (Port 4000)
npm run dev:backend

# Launch the interactive Web Preview in your Laptop Browser (Port 8081)
npm run dev:web

# Launch on your physical mobile phone via Expo Go
npm run dev:mobile
```

---

## 📚 Documentation Index

Complete project specifications are maintained in the [`/docs`](docs/) directory:

* 🗺️ **[System Architecture](docs/ARCHITECTURE.md)** — Architectural design, environments (dev/preview/prod), and data flows.
* 🗄️ **[Database Dictionary](docs/DATABASE.md)** — Complete schema definitions, tables, constraints, and indexes.
* 🔌 **[REST API Reference](docs/API.md)** — Endpoints, payloads, query parameters, and auth contracts.
* 📦 **[Distribution Guide](docs/DISTRIBUTION.md)** — EAS Build profiles, APK generation for testers, and OTA updates.
* 📱 **[UI Living Screen Directory](docs/UI_NOTES.md)** — Screen-by-screen route directory, components, and design guidelines.
* 🛡️ **[Anti-Fake Policy](docs/ANTI_FAKE.md)** — Location spoofing defense, time manipulation detection, and trust policies.
* ⚖️ **[Decisions Log](docs/DECISIONS.md)** — Complete architectural trade-off log (DEC-001 to DEC-011).
* 📝 **[Changelog](docs/CHANGELOG.md)** — Chronological release history.

### Feature Deep-Dives
* [00. Foundation](docs/features/00-foundation.md)
* [01. Auth & Roles](docs/features/01-auth-and-roles.md)
* [01b. Customizable Issue Types](docs/features/01b-issue-types.md)
* [02. Sites & Assignments](docs/features/02-sites-and-assignments.md)
* [03. Daily Record Online](docs/features/03-daily-record.md)
* [04. Voice Note Recording](docs/features/04-voice-note.md)

---

## 📄 License
This project is proprietary and confidential. All rights reserved.
