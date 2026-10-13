# FieldLog Documentation

Welcome to the **FieldLog** project documentation. FieldLog is an offline-first, mobile-first field reporting system for business owners overseeing work running at multiple locations they cannot visit daily (shops, farms, factories, delivery, repair teams, guards, construction).

---

## Project Status

| Phase | Description | Status | Manual Phone Check |
|---|---|---|---|
| **Phase 0** | **Foundation (Monorepo, Fastify, Neon, Drizzle, Health Check, Expo)** | ✅ Done & Phone Verified | Required (Completed) |
| **Updates** | **FieldLog Rename, Neutral Wording, Issue Types, Distribution Plan** | ✅ Done | Automated tests |
| **Phase 1** | **Auth and Roles (Multi-tenant, Owner signup, Supervisor PIN login)** | ✅ Done (Automated tests pass) | Automated tests |
| **Phase 2** | **Sites and Assignments (CRUD, Supervisor assigned work places)** | ✅ Done (Automated tests pass) | Automated tests |
| **Phase 3** | **Daily Record (Online only, Live camera photos with GPS, Presigned URLs)** | 🔄 In Progress | Required (End of Phase 3) |
| **Phase 4** | Voice Note Recording (Record, playback, upload audio) | ⏳ Not Started | Automated tests |
| **Phase 5** | Offline Sync (SQLite queue, Background sync worker, Retry, Conflict handling) | ⏳ Not Started | Required (End of Phase 5) |
| **Phase 6** | Owner Dashboard & Day Detail (7-day grid, Audio player, Photo gallery, "Seen" tick) | ⏳ Not Started | Automated tests |
| **Phase 7** | AI Voice Pipeline (Hindi transcription benchmark, LLM summary job) | ⏳ Not Started | Required (End of Phase 7) |
| **Phase 8** | Reminders & Notifications (5 PM local supervisor alert, Evening push summary) | ⏳ Not Started | Automated tests |
| **Phase 9** | Anti-Fake Flags & Hardening (Mock location, Time skew detection, Rate limiting) | ⏳ Not Started | Automated tests |
| **Phase 10** | Release Preparation (EAS Android build, Privacy policy, Deployment guides) | ⏳ Not Started | Final Release |

---

## Documentation Index

- [Architecture Guide](ARCHITECTURE.md) — System components, environments (dev, preview, production), and data flows.
- [Distribution & Release Guide](DISTRIBUTION.md) — Android APK generation for testers, EAS Update (OTA), and Play Store roadmap.
- [Database Guide](DATABASE.md) — Complete database schema, tables, columns, indexes, and relationships.
- [API Reference](API.md) — All REST API endpoints, security, payloads, and response formats.
- [Decisions & Log](DECISIONS.md) — Architectural decisions, trade-offs, and nomenclature conventions.
- [Anti-Fake Entry Measures](ANTI_FAKE.md) — What we protect against, what we flag, and realistic boundaries.
- [Setup & Run Guide](SETUP.md) — Step-by-step instructions for running on your computer and phone.
- [Changelog](CHANGELOG.md) — Dated record of releases and progress.

### Feature Specifications (`/docs/features/`)
- [00. Foundation](features/00-foundation.md)
- [01. Auth and Roles](features/01-auth-and-roles.md)
- [01b. Customizable Issue Types](features/01b-issue-types.md)
- [02. Sites and Assignments](features/02-sites-and-assignments.md)
