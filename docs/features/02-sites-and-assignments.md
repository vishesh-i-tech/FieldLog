# Feature 02: Work Places & Supervisor Assignments

---

## 1. What this feature does
This feature allows business Owners to set up and manage all their remote work places (shops, construction sites, farm locations, warehouse depots, or repair zones) and assign specific supervisors to each one. Supervisors only see and submit daily reports for the work places they are assigned to, keeping their mobile interface uncluttered and focused.

---

## 2. Hinglish me samjho
Maalik (Owner) ke paas alag-alag jagaho par kaam chal raha hota hai (jaise Shop A, Warehouse B, ya Jobsite C). Is feature ke zariye Maalik naye kaam (Work Places) jod sakta hai, unka pata daal sakta hai aur tay kar sakta hai ki kaunsa supervisor kis kaam ki zimmedari sambhalega. Jab koi mistri ya supervisor apna phone kholega, to use sirf wahi kaam dikhenge jo usko assign kiye gaye hain. Doosre kisi kaam ka data ya naam use nahi dikhega.

---

## 3. Who uses it
- **Owner:** Creates work places, edits location details, archives finished work, and assigns/unassigns supervisors.
- **Supervisor:** Views their list of assigned work places on the mobile app ("मेरे काम") and selects where to submit today's log.

**User Steps (Owner):**
1. Tap "Manage Work Places" → "+ New Work Place".
2. Enter name (e.g. "Sector 62 Depot") and address/location description.
3. Select supervisors to assign to this location. Tap "Save".

**User Steps (Supervisor):**
1. Open FieldLog and log in.
2. The "My Work" screen displays only their assigned work places.
3. Tap on the desired work place to start today's submission.

---

## 4. How it works inside
1. Owner submits `POST /api/v1/sites` with `{ name, locationText, latitude?, longitude? }`. Server inserts record into `sites` linked to `request.user.organizationId`.
2. Owner calls `POST /api/v1/sites/:id/assign` with `{ supervisorIds: ["uuid..."] }`. Server verifies all supervisors belong to the owner's organization and creates unique mappings in `site_assignments`.
3. When Supervisor calls `GET /api/v1/sites`, the query joins `sites` with `site_assignments` on `userId = request.user.userId` and filters `isArchived = false`.
4. If a Supervisor attempts to fetch an unassigned work place via `GET /api/v1/sites/:id`, server returns HTTP 403 Forbidden.

---

## 5. Files and code involved
- `backend/src/routes/sites.ts`: Endpoints for CRUD on work places and supervisor assignment mapping.
- `backend/src/db/schema.ts`: Defines `sites` and `site_assignments` with cascading foreign keys and unique constraints.
- `backend/src/middleware/auth.ts`: Enforces `authenticate` and `requireOwner` guards.
- `backend/src/tests/sites.test.ts`: Automated integration tests covering work place creation, supervisor-only visibility, and cross-tenant protection.
- `mobile/src/i18n/hi.ts` & `en.ts`: Language mappings for "My Work" ("मेरे काम").

---

## 6. Database tables touched
- `sites`: Stores work places (`organization_id`, `name`, `location_text`, `latitude`, `longitude`, `is_archived`).
- `site_assignments`: Maps `site_id` to `user_id` with a `UNIQUE(site_id, user_id)` constraint.
- `users`: Referenced when validating assigned supervisors.

---

## 7. API endpoints used
- `GET /api/v1/sites`: Lists work places (Owner sees all company sites; Supervisor sees only assigned sites).
- `GET /api/v1/sites/:id`: Gets detail of a single work place (with supervisor assignment check).
- `POST /api/v1/sites`: Creates a new work place (Owner only).
- `PATCH /api/v1/sites/:id`: Updates name, location, coordinates, or archives work place (Owner only).
- `POST /api/v1/sites/:id/assign`: Assigns supervisors to a work place (Owner only).
- `DELETE /api/v1/sites/:id/assign/:userId`: Removes a supervisor assignment (Owner only).

---

## 8. Edge cases and what happens
- **Supervisor assigned multiple times to same site:** The database unique constraint `UNIQUE(site_id, user_id)` and backend deduplication safely ignore duplicate assignment attempts.
- **Owner assigns a supervisor from another company:** Backend validates that all `supervisorIds` match `request.user.organizationId`; rejects with HTTP 400 if any ID belongs to another tenant.
- **Supervisor visits unassigned site URL directly:** Server blocks request with HTTP 403: *"You are not assigned to this work place"*.
- **Archived work places:** When `isArchived` is set to `true`, the site disappears from supervisor lists but remains visible in Owner historical records.

---

## 9. How to test it by hand
1. With Owner A token, call `POST /api/v1/sites` to create "Work Site 1" and "Work Site 2".
2. Assign Supervisor A to "Work Site 1" via `POST /api/v1/sites/<id1>/assign`.
3. Log in with Supervisor A token and request `GET /api/v1/sites`. Verify only "Work Site 1" is returned.
4. Attempt `GET /api/v1/sites/<id2>` with Supervisor A token. Verify response is HTTP 403 Forbidden.
5. With Owner B token, attempt `GET /api/v1/sites/<id1>`. Verify response is HTTP 404 Not Found.

---

## 10. Known limits and future improvements
- In V1, GPS coordinates for a work place are optional; supervisors can submit even if site GPS is not pre-configured.
- In V2, owners will be able to set a geo-fence boundary (e.g. 500m circle) for distance deviation alerts.
