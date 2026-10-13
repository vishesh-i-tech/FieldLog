# DailyRecord Documentation

Welcome to the **DailyRecord** project documentation. DailyRecord is an offline-first, mobile-first field reporting system for construction contractors and supervisors.

---

## Project Status

| Phase | Description | Status | Manual Phone Check |
|---|---|---|---|
| **Phase 0** | **Foundation (Monorepo, Fastify, Neon, Drizzle, Health Check, Expo)** | 🔄 In Progress | Required (End of Phase 0) |
| **Phase 1** | Auth and Roles (Multi-tenant, Owner signup, Supervisor PIN login) | ⏳ Not Started | Automated tests |
| **Phase 2** | Sites and Assignments (CRUD, Supervisor assigned sites) | ⏳ Not Started | Automated tests |
| **Phase 3** | Daily Record (Online only, Live camera photos with GPS, Presigned URLs) | ⏳ Not Started | Required (End of Phase 3) |
| **Phase 4** | Voice Note Recording (Record, playback, upload audio) | ⏳ Not Started | Automated tests |
| **Phase 5** | Offline Sync (SQLite queue, Background sync worker, Retry, Conflict handling) | ⏳ Not Started | Required (End of Phase 5) |
| **Phase 6** | Owner Dashboard & Day Detail (7-day grid, Audio player, Photo gallery, "Seen" tick) | ⏳ Not Started | Automated tests |
| **Phase 7** | AI Voice Pipeline (Hindi transcription benchmark, LLM summary job) | ⏳ Not Started | Required (End of Phase 7) |
| **Phase 8** | Reminders & Notifications (5 PM local supervisor alert, Evening push summary) | ⏳ Not Started | Automated tests |
| **Phase 9** | Anti-Fake Flags & Hardening (Mock location, Time skew detection, Rate limiting) | ⏳ Not Started | Automated tests |
| **Phase 10** | Release Preparation (EAS Android build, Privacy policy, Deployment guides) | ⏳ Not Started | Final Release |

---

## Documentation Index

- [Architecture Guide](ARCHITECTURE.md) — System components, data flows, and infrastructure diagram.
- [Database Guide](DATABASE.md) — Complete database schema, tables, columns, indexes, and relationships.
- [API Reference](API.md) — All REST API endpoints, security, payloads, and response formats.
- [Decisions & Log](DECISIONS.md) — Architectural and implementation decisions with trade-offs.
- [Anti-Fake Entry Measures](ANTI_FAKE.md) — What we protect against, what we flag, and realistic boundaries.
- [Setup & Run Guide](SETUP.md) — Step-by-step instructions for running on your computer and phone.
- [Changelog](CHANGELOG.md) — Dated record of releases and progress.

### Feature Specifications (`/docs/features/`)
- [00. Foundation](features/00-foundation.md)
