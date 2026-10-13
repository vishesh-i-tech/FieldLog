# Database Schema & Data Dictionary

DailyRecord uses PostgreSQL hosted on **Neon**. Every table uses UUID primary keys, standardized `created_at` / `updated_at` timestamps, and explicit foreign key constraints.

---

## Entity Relationship Overview

```text
[organizations] 
   ├── 1:N ──> [users]
   │             ├── 1:N ──> [site_assignments] <── N:1 ── [sites] (belongs to org)
   │             └── 1:N ──> [daily_records]    <── N:1 ── [sites]
   │                           ├── 1:N ──> [record_issues]
   │                           ├── 1:N ──> [media]
   │                           ├── 1:1 ──> [transcripts]
   │                           ├── 1:1 ──> [summaries]
   │                           ├── 1:N ──> [record_edits]
   │                           └── 1:N ──> [record_acknowledgements]
   └── 1:N ──> [notification_log]
```

---

## Tables and Columns

### 1. `organizations`
Represents the contracting company / business entity.
- `id` (UUID, Primary Key): Unique organization identifier.
- `name` (VARCHAR): Company or contractor trade name.
- `created_at` (TIMESTAMPTZ): Time company was registered.
- `updated_at` (TIMESTAMPTZ): Last updated time.

### 2. `users`
Accounts for Owners and Supervisors.
- `id` (UUID, Primary Key): Unique user ID.
- `organization_id` (UUID, FK -> `organizations.id`): Tenant isolation key.
- `role` (VARCHAR enum: `'owner' | 'supervisor'`): Defines access level and UI permissions.
- `name` (VARCHAR): Display name of the contractor or supervisor.
- `phone` (VARCHAR, Unique): Phone number used for login.
- `email` (VARCHAR, Nullable): Email address (used by owners for signup/login).
- `password_hash` (VARCHAR, Nullable): Hashed password (argon2/bcrypt) for owners.
- `pin_hash` (VARCHAR, Nullable): Hashed 4-digit PIN for supervisors.
- `language` (VARCHAR, default `'hi'`): Preferred language code (`'hi'` or `'en'`).
- `push_token` (VARCHAR, Nullable): Expo push notification token.
- `is_active` (BOOLEAN, default `true`): Deactivation flag.
- `last_login_at` (TIMESTAMPTZ, Nullable): Timestamp of most recent session.
- `created_at` (TIMESTAMPTZ): Created timestamp.
- `updated_at` (TIMESTAMPTZ): Updated timestamp.

### 3. `sites`
Construction jobsites managed by an organization.
- `id` (UUID, Primary Key): Unique site ID.
- `organization_id` (UUID, FK -> `organizations.id`): Tenant isolation key.
- `name` (VARCHAR): Site name (e.g., "Sector 62 Tower B").
- `location_text` (TEXT): Human-readable location / address description.
- `latitude` (DECIMAL, Nullable): Expected GPS latitude of the site.
- `longitude` (DECIMAL, Nullable): Expected GPS longitude of the site.
- `is_archived` (BOOLEAN, default `false`): Soft delete / archive flag.
- `created_at` (TIMESTAMPTZ): Creation timestamp.
- `updated_at` (TIMESTAMPTZ): Update timestamp.

### 4. `site_assignments`
Maps supervisors to specific sites they are authorized to report for.
- `id` (UUID, Primary Key): Unique assignment ID.
- `site_id` (UUID, FK -> `sites.id`, CASCADE): Target site.
- `user_id` (UUID, FK -> `users.id`, CASCADE): Assigned supervisor.
- `created_at` (TIMESTAMPTZ): Assignment timestamp.
- **Constraints:** `UNIQUE(site_id, user_id)` — a supervisor cannot be assigned twice to the same site.

### 5. `daily_records`
The core daily report submitted for a site on a particular calendar day.
- `id` (UUID, Primary Key): Internal record ID.
- `client_id` (UUID, Unique): Client-generated UUID ensuring idempotent sync.
- `organization_id` (UUID, FK -> `organizations.id`): Tenant isolation key.
- `site_id` (UUID, FK -> `sites.id`): Target construction site.
- `submitted_by` (UUID, FK -> `users.id`): Supervisor who created the record.
- `record_date` (DATE): Calendar date of the log (YYYY-MM-DD).
- `status` (VARCHAR enum: `'full' | 'half' | 'stopped'`): Site work progress status.
- `captured_at` (TIMESTAMPTZ): Local device time when supervisor submitted the log.
- `received_at` (TIMESTAMPTZ): Server time when API processed the upload.
- `flags` (JSONB): Anti-fake warnings (e.g. `mock_location`, `time_skew`, `missing_media`).
- `missing_photo` (BOOLEAN, default `false`): Flagged if submitted without a photo.
- `missing_voice` (BOOLEAN, default `false`): Flagged if submitted without a voice note.
- `created_at` (TIMESTAMPTZ): Creation timestamp.
- `updated_at` (TIMESTAMPTZ): Update timestamp.
- **Constraints:** `UNIQUE(site_id, record_date)` — strictly enforces one master record per site per calendar day. Resubmission performs an update and creates an audit entry in `record_edits`.

### 6. `record_issues`
Issue chips selected by the supervisor during submission.
- `id` (UUID, Primary Key): Unique issue ID.
- `record_id` (UUID, FK -> `daily_records.id`, CASCADE): Parent record.
- `issue_type` (VARCHAR enum: `'material_not_arrived' | 'less_manpower' | 'rain' | 'machine_broken' | 'need_money' | 'other'`): Categorized site blocker.
- `created_at` (TIMESTAMPTZ): Creation timestamp.

### 7. `media`
Photos and audio voice notes associated with a record.
- `id` (UUID, Primary Key): Unique media ID.
- `record_id` (UUID, FK -> `daily_records.id`, CASCADE): Parent daily record.
- `kind` (VARCHAR enum: `'photo' | 'audio'`): File type.
- `storage_key` (VARCHAR): Cloud object storage key / S3 path.
- `mime_type` (VARCHAR): MIME type (e.g., `image/jpeg`, `audio/m4a`).
- `size_bytes` (INTEGER): File size in bytes.
- `duration_seconds` (INTEGER, Nullable): Audio duration if applicable.
- `latitude` (DECIMAL, Nullable): GPS latitude tagged at capture.
- `longitude` (DECIMAL, Nullable): GPS longitude tagged at capture.
- `accuracy_m` (DECIMAL, Nullable): GPS accuracy radius in meters.
- `captured_at` (TIMESTAMPTZ): Device timestamp when media was captured.
- `flags` (JSONB): Metadata flags (e.g. `{"mock_location": true}`).
- `created_at` (TIMESTAMPTZ): Creation timestamp.

### 8. `transcripts`
Speech-to-text output generated from the supervisor's voice note.
- `id` (UUID, Primary Key): Unique transcript ID.
- `record_id` (UUID, FK -> `daily_records.id`, CASCADE): Parent record.
- `audio_media_id` (UUID, FK -> `media.id`): Reference to original audio file.
- `language` (VARCHAR, default `'hi'`): Detected or hinted language.
- `raw_text` (TEXT): Verbatim transcription text.
- `status` (VARCHAR enum: `'pending' | 'done' | 'failed'`): Processing state.
- `provider` (VARCHAR): Provider name (e.g., `groq_whisper`, `openai_whisper`).
- `error` (TEXT, Nullable): Error message if processing failed.
- `created_at` (TIMESTAMPTZ): Creation timestamp.
- `updated_at` (TIMESTAMPTZ): Update timestamp.

### 9. `summaries`
AI-synthesized brief for the contractor.
- `id` (UUID, Primary Key): Unique summary ID.
- `record_id` (UUID, FK -> `daily_records.id`, CASCADE): Parent record.
- `summary_text` (TEXT): 3 to 4 line executive summary of the day.
- `material_mentions` (JSONB): Extracted list of materials needed or received.
- `model_info` (VARCHAR): Model identifier used.
- `status` (VARCHAR enum: `'pending' | 'done' | 'failed'`): Processing state.
- `created_at` (TIMESTAMPTZ): Creation timestamp.

### 10. `record_edits`
Audit trail of record updates submitted on the same day.
- `id` (UUID, Primary Key): Unique edit ID.
- `record_id` (UUID, FK -> `daily_records.id`, CASCADE): Modified record.
- `edited_by` (UUID, FK -> `users.id`): User who made the modification.
- `change_json` (JSONB): Diff showing fields before and after edit.
- `edited_at` (TIMESTAMPTZ): Timestamp of update.

### 11. `record_acknowledgements`
Owner review confirmation ("Seen" tick) and optional voice replies.
- `id` (UUID, Primary Key): Unique acknowledgement ID.
- `record_id` (UUID, FK -> `daily_records.id`, CASCADE): Acknowledged record.
- `owner_id` (UUID, FK -> `users.id`): Reviewing contractor.
- `seen_at` (TIMESTAMPTZ): Time marked as seen.
- `reply_media_id` (UUID, FK -> `media.id`, Nullable): Optional voice reply.

### 12. `notification_log`
Audit history of automated notifications (reminders, evening digests).
- `id` (UUID, Primary Key): Unique notification log ID.
- `user_id` (UUID, FK -> `users.id`): Recipient.
- `type` (VARCHAR): Notification category (`supervisor_reminder_5pm`, `owner_evening_digest`).
- `sent_at` (TIMESTAMPTZ): Timestamp when notification was dispatched.
- `status` (VARCHAR enum: `'sent' | 'failed'`): Delivery status.
