# Feature: Customizable Issue Types (Issue Chips)

---

## 1. What this feature does
This feature allows business Owners to customize the problem/issue buttons (issue chips) shown to supervisors on their Daily Record submission screen. Instead of hard-coded options, an owner can add, rename, reorder, or hide issue chips tailored to their industry (construction, retail shops, farms, transport, or service teams). Supervisors see up to 8 active chips, with clear Hindi labels displayed first.

---

## 2. Hinglish me samjho
Ye feature Owner ko ye azaadi deta hai ki wo apne hisaab se samasya (problem chips) set kar sake. Jaise agar dukan hai to 'stock nahi aaya', factory hai to 'machine kharab', kheti hai to 'barish ho gayi'. Har company ki default 6 samasyayein pehle se set milti hain. Owner naye chips jod sakta hai, purane chupaa (hide) sakta hai ya unka naam badal sakta hai (adhiktam 8 chips active reh sakte hain). Supervisor ko phone screen par Hindi me saaf-saaf buttons dikhenge.

---

## 3. Who uses it
- **Owner:** Customizes issue chips from their web/mobile management screen (adds custom chips, reorders, hides).
- **Supervisor:** Taps relevant issue chips when submitting their daily log on the mobile app.

**User Steps (Owner):**
1. Navigate to Settings / Manage Issue Chips.
2. View existing chips for the organization.
3. Tap "+ Add Issue Chip", enter Hindi label and English label, pick an icon.
4. Save. Max 8 active chips allowed at any time.

**User Steps (Supervisor):**
1. Open Today's Record screen for the assigned work.
2. Select status (Full Day / Half Day / Stopped).
3. Tap one or more issue chips if there is a problem (e.g., "सामान / स्टॉक नहीं आया").
4. Submit report.

---

## 4. How it works inside
1. When a new Organization signs up, backend automatically seeds 6 universal default issue types into `issue_types`.
2. When the Supervisor opens the Daily Record screen, the app requests `GET /api/v1/issue-types?activeOnly=true`.
3. Backend filters strictly by the authenticated supervisor's `organization_id`, ensuring full multi-tenant isolation.
4. Up to 8 active chips are returned sorted by `sort_order`.
5. When the Supervisor submits a report, selected `issue_type_id` UUIDs are saved in `record_issues` linked to the daily record.

---

## 5. Files and code involved
- `backend/src/db/schema.ts`: Defines `issue_types` table and updates `record_issues` foreign key relation.
- `backend/src/services/issueTypes.service.ts`: Implements `seedDefaultIssueTypes()` and `getIssueTypesForOrg()`.
- `backend/src/routes/issueTypes.ts`: REST endpoints (`GET`, `POST`, `PATCH`) with Zod validation.
- `backend/src/tests/issueTypes.test.ts`: Automated tests verifying tenant isolation and max 8 active chip limit.
- `mobile/src/i18n/hi.ts` & `en.ts`: Neutral terminology translations.

---

## 6. Database tables touched
- `issue_types` (stores custom chip metadata: `organization_id`, `label_hi`, `label_en`, `icon`, `sort_order`, `is_active`, `is_default`).
- `record_issues` (stores issues linked to daily records via `issue_type_id`).
- `organizations` (parent company link).

---

## 7. API endpoints used
- `GET /api/v1/issue-types`: Returns issue chips for caller's organization.
- `POST /api/v1/issue-types`: Creates new custom chip (Owner only).
- `PATCH /api/v1/issue-types/:id`: Updates label, visibility, or order (Owner only).

---

## 8. Edge cases and what happens
- **Attempting to activate more than 8 chips:** Backend rejects with HTTP 400 *"Maximum 8 active issue chips allowed. Deactivate an existing chip first."*
- **Tenant cross-access:** If Org A attempts to view or update Org B's chip, the query returns HTTP 404 (or 401) because queries enforce `WHERE organization_id = ?`.
- **Offline Supervisor:** Active issue chips are cached locally in SQLite; supervisor can still select chips while offline.
- **Deleted chip referenced in older records:** Chips are deactivated (`is_active = false`) rather than hard deleted so historical daily records maintain foreign key integrity.

---

## 9. How to test it by hand
1. Open API tester or app with Org A token.
2. Request `GET /api/v1/issue-types`. Verify the 6 seeded default chips appear in Hindi and English.
3. Send `POST /api/v1/issue-types` with a 7th and 8th chip. Verify success.
4. Try adding a 9th active chip. Verify server responds with error stating max 8 active chips.
5. Deactivate one chip via `PATCH /api/v1/issue-types/:id` with `isActive: false`. Add a new chip; verify it now succeeds.

---

## 10. Known limits and future improvements
- Pre-selected icons are currently limited to standard Feather/Lucide icon names (`box`, `users`, `cloud-rain`, `tool`, `cash`, `alert-circle`).
- In V2, owners will be able to drag-and-drop reorder chips directly in the UI.
