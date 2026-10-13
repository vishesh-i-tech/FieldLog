# API Reference Documentation

All API communication uses JSON over HTTPS. Authenticated routes require standard Bearer token authorization: `Authorization: Bearer <access_token>`.

---

## Standard Error Response Format

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation error or specific reason",
  "code": "ERROR_CODE"
}
```

---

## Foundation Endpoints (Phase 0)

### 1. `GET /health`
Checks backend and Neon Postgres connection health.
- **Access:** Public (No authentication required)
- **Response `200 OK` (Healthy):**
```json
{
  "status": "healthy",
  "database": "connected",
  "databaseLatencyMs": 42,
  "timestamp": "2026-10-14T00:00:00.000Z",
  "uptimeSeconds": 128
}
```
- **Response `503 Service Unavailable` (Database waking up or disconnected):**
```json
{
  "status": "degraded",
  "database": "disconnected",
  "error": "Connection to Neon timed out (waking from sleep)",
  "timestamp": "2026-10-14T00:00:00.000Z",
  "uptimeSeconds": 24
}
```

---

## Planned API Surface by Phase

### Phase 1: Authentication & Users
- `POST /api/v1/auth/owner/signup` — Registers new owner & organization.
- `POST /api/v1/auth/owner/login` — Owner login via email + password. Returns access + refresh token.
- `POST /api/v1/auth/supervisor/login` — Supervisor login via phone + 4-digit PIN.
- `POST /api/v1/auth/refresh` — Rotates tokens.
- `POST /api/v1/supervisors` — Owner creates a supervisor account.

### Phase 2: Sites & Assignments
- `GET /api/v1/sites` — List sites (Owners see all org sites; Supervisors see only assigned).
- `POST /api/v1/sites` — Owner creates site.
- `PATCH /api/v1/sites/:id` — Owner updates/archives site.
- `POST /api/v1/sites/:id/assign` — Assign supervisor to site.

### Phase 3 & 4: Daily Records & Media
- `POST /api/v1/uploads/presign` — Requests short-lived presigned upload URL for photo or audio.
- `POST /api/v1/records` — Submit daily record (Idempotent via `client_id`).
- `GET /api/v1/records/today` — Fetch today's records for supervisor's assigned sites.

### Phase 6: Owner Oversight
- `GET /api/v1/owner/dashboard` — Aggregated daily status count + 7-day history per site.
- `GET /api/v1/owner/records/:id` — Full day detail (audio, photos with GPS metadata, AI summary).
- `POST /api/v1/owner/records/:id/seen` — Mark record as seen.
