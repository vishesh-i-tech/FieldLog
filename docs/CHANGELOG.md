# Changelog

All notable changes to the DailyRecord project will be documented in this file.

---

## [Phase 3] - 2026-10-14: Daily Record Submission & Live Camera Geo-tagging
### Added
- Supervisor Today's Record form screen with 3 large status buttons (`पूरा दिन`, `आधा दिन`, `काम बंद`).
- Live in-app camera viewfinder (`expo-camera`) with auto-disabled gallery access.
- GPS geotagging (`expo-location`) stamping latitude, longitude, and accuracy on captured photos.
- Dynamic issue chips multi-selection with Hindi-first labeling.
- Pre-signed upload endpoint (`POST /api/v1/uploads/presign`) and local dev binary storage handler.
- Online Daily Record submission endpoint (`POST /api/v1/records`) with client-UUID idempotency.
- One record per site per calendar day rule with automatic change diff audit logging in `record_edits`.
- Automated tests verifying presigned upload, record submission, idempotency, same-day updates, and unassigned supervisor blocking.
- Feature specification `docs/features/03-daily-record.md`.

## [Phase 2] - 2026-10-14: Work Places & Supervisor Assignments
### Added
- CRUD endpoints for work places (`sites` table) with GPS coordinates and archiving support.
- Supervisor assignment and unassignment mapping (`site_assignments` table).
- Role-based scoping: Supervisors see only their assigned work places; Owners manage all organization sites.
- Automated tests verifying multi-tenant isolation and supervisor assignment visibility.
- Feature specification `docs/features/02-sites-and-assignments.md`.

## [Phase 1] - 2026-10-14: Authentication, Roles & Multi-Tenant Isolation
### Added
- Owner signup (`POST /api/v1/auth/owner/signup`) creating organization, hashing password via bcrypt, and auto-seeding 6 default issue chips.
- Owner login (`POST /api/v1/auth/owner/login`) with email and password.
- Owner management of supervisors (`/api/v1/supervisors`): create supervisor with 4-digit PIN, list supervisors, reset PIN, activate/deactivate.
- Supervisor login (`POST /api/v1/auth/supervisor/login`) with phone number and 4-digit PIN.
- Fastify JWT authentication middleware (`authenticate`) with role guards (`requireOwner`, `requireSupervisor`).
- Token refresh endpoint (`POST /api/v1/auth/refresh`) for persistent field sessions.
- Automated tests covering signup, login, PIN verification, role guards, and cross-tenant protection.
- Feature specification `docs/features/01-auth-and-roles.md`.

## [Updates] - 2026-10-14: FieldLog Multi-Industry Transition & Distribution Architecture
### Added
- Renamed application to **FieldLog** across monorepo packages, UI, and documentation.
- Adopted neutral multi-industry terminology ("Work" / "काम" instead of construction-only "site").
- Dynamic issue types system (`issue_types` table) with 6 universal defaults seeded per organization and max 8 active visible chips.
- Endpoints `GET /api/v1/issue-types`, `POST /api/v1/issue-types`, and `PATCH /api/v1/issue-types/:id`.
- Automated tests verifying multi-tenant isolation and 8-chip limit.
- EAS Build configuration (`mobile/eas.json`) with `preview` APK and `production` AAB profiles.
- Environment separation (Development local, Preview hosted HTTPS, Production Play Store) and `/version` compatibility endpoint.
- Feature specification `docs/features/01b-issue-types.md` and distribution guide `docs/DISTRIBUTION.md`.

## [Phase 0] - 2026-10-14: Foundation Setup
### Added
- Monorepo structure initialized with `backend`, `mobile`, and `docs` workspaces.
- Complete documentation framework initialized in `/docs` (Architecture, Database dictionary, API specs, Decisions log, Anti-fake policies, and Setup guides).
- Fastify server configuration in TypeScript with CORS, sensible error handling, and Zod environment validation.
- Neon Serverless PostgreSQL integration using Drizzle ORM with connection pooling support and schema definitions for all 12 core tables.
- Health check endpoint `GET /health` with live database connectivity and latency reporting.
- Mobile client initialized using React Native Expo & Expo Router with an interactive health status monitor for field testing.
