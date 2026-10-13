# FieldLog API Reference Documentation

All API communication uses JSON over HTTPS (or HTTP in local dev). Authenticated routes require standard Bearer token authorization: `Authorization: Bearer <access_token>`.

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

## System Diagnostics & Version Endpoints

### 1. `GET /health`
Checks backend and Neon Postgres connection health.
- **Access:** Public
- **Response `200 OK` (Healthy):**
```json
{
  "status": "healthy",
  "database": "connected",
  "databaseLatencyMs": 38,
  "timestamp": "2026-10-14T00:00:00.000Z",
  "uptimeSeconds": 142,
  "message": "All systems operational. Neon Postgres connected."
}
```

### 2. `GET /version`
App version compatibility and update enforcement.
- **Access:** Public
- **Response `200 OK`:**
```json
{
  "apiVersion": "0.1.0",
  "minAppVersion": "1.0.0",
  "latestAppVersion": "1.0.0",
  "environment": "development",
  "forceUpdate": false,
  "message": "FieldLog API is up to date.",
  "downloadUrl": null
}
```

---

## Authentication Endpoints (Phase 1)

### 3. `POST /api/v1/auth/owner/signup`
Registers a new contracting company/business and creates the Owner account. Automatically seeds 6 default issue chips.
- **Access:** Public
- **Request Body:**
```json
{
  "companyName": "Shree Ram Construction",
  "name": "Rajesh Kumar",
  "email": "rajesh@example.com",
  "phone": "9876543210",
  "password": "Password123!"
}
```
- **Response `201 Created`:**
```json
{
  "user": {
    "id": "uuid",
    "organizationId": "uuid",
    "role": "owner",
    "name": "Rajesh Kumar",
    "email": "rajesh@example.com",
    "phone": "9876543210",
    "language": "hi"
  },
  "organization": {
    "id": "uuid",
    "name": "Shree Ram Construction"
  },
  "tokens": {
    "accessToken": "jwt...",
    "refreshToken": "jwt...",
    "expiresInSeconds": 3600
  }
}
```

### 4. `POST /api/v1/auth/owner/login`
Owner login via email and password.
- **Access:** Public
- **Request Body:**
```json
{
  "email": "rajesh@example.com",
  "password": "Password123!"
}
```
- **Response `200 OK`:**
```json
{
  "user": { ... },
  "tokens": { "accessToken": "jwt...", "refreshToken": "jwt...", "expiresInSeconds": 3600 }
}
```

### 5. `POST /api/v1/auth/supervisor/login`
Supervisor field login via phone number and 4-digit PIN.
- **Access:** Public
- **Request Body:**
```json
{
  "phone": "9876543211",
  "pin": "1234"
}
```
- **Response `200 OK`:**
```json
{
  "user": {
    "id": "uuid",
    "organizationId": "uuid",
    "role": "supervisor",
    "name": "Ramesh Mistri",
    "phone": "9876543211",
    "language": "hi"
  },
  "tokens": { "accessToken": "jwt...", "refreshToken": "jwt...", "expiresInSeconds": 3600 }
}
```

### 6. `POST /api/v1/auth/refresh`
Rotates tokens without re-authenticating.
- **Access:** Public
- **Request Body:** `{ "refreshToken": "jwt..." }`
- **Response `200 OK`:** `{ "tokens": { "accessToken": "jwt...", "refreshToken": "jwt...", "expiresInSeconds": 3600 } }`

### 7. `GET /api/v1/auth/me`
Retrieves current profile and organization information.
- **Access:** Authenticated (Bearer Token)
- **Response `200 OK`:** `{ "user": { ... }, "organization": { ... } }`

---

## Supervisor Management Endpoints (Owner Only)

### 8. `GET /api/v1/supervisors`
Lists all supervisors within the caller's organization.
- **Access:** Owner only
- **Response `200 OK`:**
```json
{
  "supervisors": [
    {
      "id": "uuid",
      "name": "Ramesh Mistri",
      "phone": "9876543211",
      "language": "hi",
      "isActive": true,
      "lastLoginAt": "2026-10-14T00:00:00Z"
    }
  ]
}
```

### 9. `POST /api/v1/supervisors`
Creates a supervisor account with a 4-digit PIN.
- **Access:** Owner only
- **Request Body:**
```json
{
  "name": "Ramesh Mistri",
  "phone": "9876543211",
  "pin": "1234",
  "language": "hi"
}
```
- **Response `201 Created`:** `{ "supervisor": { ... } }`

### 10. `PATCH /api/v1/supervisors/:id/pin`
Resets a supervisor's 4-digit PIN.
- **Access:** Owner only
- **Request Body:** `{ "pin": "5678" }`
- **Response `200 OK`:** `{ "message": "Supervisor PIN reset successfully." }`

### 11. `PATCH /api/v1/supervisors/:id/status`
Activates or deactivates a supervisor account.
- **Access:** Owner only
- **Request Body:** `{ "isActive": false }`
- **Response `200 OK`:** `{ "message": "Supervisor deactivated successfully." }`

---

## Dynamic Issue Chips Endpoints

### 12. `GET /api/v1/issue-types`
Lists issue chips. For supervisors, returns active chips (max 8) sorted by sort order.
- **Access:** Authenticated (or `x-organization-id` header in dev)
- **Response `200 OK`:**
```json
{
  "issueTypes": [
    {
      "id": "uuid",
      "labelHi": "सामान / स्टॉक नहीं आया",
      "labelEn": "Material / Stock not arrived",
      "icon": "box",
      "sortOrder": 1,
      "isActive": true
    }
  ]
}
```

### 13. `POST /api/v1/issue-types`
Creates a new custom issue chip (enforces max 8 active visible chips).
- **Access:** Owner only
- **Request Body:**
```json
{
  "labelHi": "बिजली नहीं है",
  "labelEn": "Power outage / No electricity",
  "icon": "zap",
  "sortOrder": 7,
  "isActive": true
}
```

### 14. `PATCH /api/v1/issue-types/:id`
Renames, updates icon, reorders, or toggles visibility of an issue chip.
- **Access:** Owner only
