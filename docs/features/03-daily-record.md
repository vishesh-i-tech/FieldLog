# Feature 03: Daily Record Submission (Online)

---

## 1. What this feature does
This feature is the core daily reporting engine of FieldLog. A field supervisor submits a report for an assigned work place consisting of: work status (Full Day / Half Day / Stopped) via large buttons, live geo-tagged camera photos (strictly live camera, no gallery), and optional issue chips. The server strictly enforces one master record per work place per calendar day and automatically tracks audit history if the supervisor resubmits on the same day.

---

## 2. Hinglish me samjho
Ye hamare FieldLog app ka sabse mukhya (core) feature hai. Supervisor jab apne kaam par pahunchta hai, to wo din ke aakhir me ye form bharta hai. Isme 3 bade button hote hain: 'पूरा दिन', 'आधा दिन', aur 'काम बंद'. Uske baad wo live camera se wahi khade hokar photo kheenchta hai—phone ki gallery se purani photo choose karne ka koi option nahi hai taaki koi jhooth na bol sake. Har photo ke saath GPS location aur time jud jata hai. Agar koi dikkat hai to wo problem chip chunta hai aur submit kar deta hai. Ek din me ek kaam ka ek hi record banta hai; agar dobara submit kiya to purana update hota hai aur badlav ka record save rehta hai.

---

## 3. Who uses it
- **Supervisor:** Submits the daily report from their mobile phone in under 60 seconds.
- **Owner:** Reviews the submitted report on their dashboard with live GPS and status.

**User Steps (Supervisor):**
1. Select assigned work place from "My Work" ("मेरे काम").
2. Tap one of three big status buttons (`पूरा दिन` / `आधा दिन` / `काम बंद`).
3. Tap "लाइव फोटो लें" (Take Live Photo). Viewfinder opens; take photo. Up to 6 photos allowed.
4. (Optional) Select one or more issue chips (e.g., "सामान / स्टॉक नहीं आया").
5. Tap big "जमा करें (Submit Daily Record)" button.
6. View confirmation: "✅ भेज दिया गया (Sent)".

---

## 4. How it works inside
1. **Pre-signed Upload:** When taking photos, app requests `POST /api/v1/uploads/presign` for each photo. Server returns a pre-signed URL and storage key.
2. **Binary Upload:** App compresses photo to ~350 KB and streams binary data to the storage provider (local stub in dev, Cloudflare R2 in production).
3. **GPS Geotagging:** App fetches latitude, longitude, accuracy radius, and mock-location flag via `expo-location` and stamps it into the photo payload.
4. **Idempotent Record Creation:** App generates a client UUID (`clientId`) and calls `POST /api/v1/records`.
5. **Database Transaction:**
   - If `clientId` was already received, server returns existing record immediately (idempotency).
   - If a record already exists for `(site_id, record_date)`: server computes change diff, updates `daily_records`, and writes change audit entry to `record_edits`.
   - If new: creates record in `daily_records`, links issues in `record_issues`, and saves photo metadata in `media`.

---

## 5. Files and code involved
- `mobile/app/record.tsx`: Main submission UI screen with 3 big buttons, camera viewfinder modal, and issue chips.
- `mobile/src/services/photo.service.ts`: Captures GPS coordinates and compresses images to ~350 KB.
- `backend/src/routes/uploads.ts`: Issues short-lived pre-signed upload URLs for photos.
- `backend/src/routes/records.ts`: Handles online daily record submission, idempotency, same-day edit diffs, and today's summary.
- `backend/src/routes/devStorage.ts`: Local disk binary storage handler for development testing.
- `backend/src/tests/records.test.ts`: Automated tests covering record creation, idempotency, and same-day resubmission diffing.

---

## 6. Database tables touched
- `daily_records`: Master row (`client_id`, `site_id`, `record_date`, `status`, `captured_at`, `received_at`, `flags`, `missing_photo`).
- `record_issues`: Linked problem chips (`record_id`, `issue_type_id`).
- `media`: Photo metadata (`record_id`, `storage_key`, `latitude`, `longitude`, `accuracy_m`, `captured_at`, `flags`).
- `record_edits`: Audit log for same-day updates (`record_id`, `edited_by`, `change_json`, `edited_at`).

---

## 7. API endpoints used
- `POST /api/v1/uploads/presign`: Issues pre-signed upload URL for photo.
- `PUT /api/v1/dev-storage/upload`: Dev binary upload handler.
- `POST /api/v1/records`: Submits or updates daily record.
- `GET /api/v1/records/today`: Returns today's submission state for supervisor's assigned sites.
- `GET /api/v1/records/:id`: Retrieves full record detail with photos and issues.

---

## 8. Edge cases and what happens
- **No photos taken:** If supervisor submits without photos, app prompts: *"फोटो के बिना भेजना है? (Submit without photos?)"*. If confirmed, submits with `missingPhoto: true`.
- **Double-click / Network retry:** Sending the same `clientId` twice returns the existing record without creating duplicate entries.
- **Resubmission on same calendar day:** Server detects `UNIQUE(site_id, record_date)` match, updates the existing record to the new status, and logs previous vs new status in `record_edits`.
- **Gallery upload attempt:** Structurally impossible because no gallery picker exists in the app bundle.
- **Unassigned supervisor:** Server rejects submission with HTTP 403 Forbidden.

---

## 9. How to test it by hand on your phone
1. Ensure your laptop and phone are on the same Wi-Fi.
2. Start backend: `npm run dev:backend`.
3. Start mobile: `npm run dev:mobile`. Scan QR code in Expo Go on your phone.
4. On the main screen, tap the big blue card: **"आज का रिकॉर्ड भरें (Test Today's Record)"**.
5. Select a status (e.g. `पूरा दिन`).
6. Tap **"लाइव फोटो लें"**. Allow camera permission. Snap a photo. Notice the GPS coordinates and capture time stamped on the thumbnail!
7. Select an issue chip (e.g. `सामान / स्टॉक नहीं आया`).
8. Tap **"जमा करें (Submit Daily Record)"**.
9. See the green success alert: *"रिकॉर्ड जमा हो गया! ✅"*.

---

## 10. Known limits and future improvements
- Offline queuing and local SQLite synchronization will be added in Phase 5.
- Voice note audio recording will be added in Phase 4.
