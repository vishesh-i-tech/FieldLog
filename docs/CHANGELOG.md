# Changelog

All notable changes to the DailyRecord project will be documented in this file.

---

## [Phase 0] - 2026-10-14: Foundation Setup
### Added
- Monorepo structure initialized with `backend`, `mobile`, and `docs` workspaces.
- Complete documentation framework initialized in `/docs` (Architecture, Database dictionary, API specs, Decisions log, Anti-fake policies, and Setup guides).
- Fastify server configuration in TypeScript with CORS, sensible error handling, and Zod environment validation.
- Neon Serverless PostgreSQL integration using Drizzle ORM with connection pooling support and schema definitions for all 12 core tables.
- Health check endpoint `GET /health` with live database connectivity and latency reporting.
- Mobile client initialized using React Native Expo & Expo Router with an interactive health status monitor for field testing.
