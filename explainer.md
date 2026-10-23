# FieldLog — Technology & Architecture Explainer

This document outlines the technologies, libraries, architectural decisions, and workflows implemented across the **FieldLog** project. It is continuously maintained as new features and capabilities are introduced.

---

## 1. Expo & React Native (SDK 52)
- **Role & Purpose**:
  Provides the universal client application runtime supporting Web, Android, and iOS from a single TypeScript codebase.
- **Under the Hood**:
  Uses Expo Router for file-based navigation (analogous to Next.js App Router). Web execution runs via `@expo/metro-runtime` compiling React Native Web primitives into semantic DOM elements. Native execution targets Android and iOS with native view hierarchies.
- **Summary**:
  Single code base powering web browsers, mobile web, and native mobile APK/AAB builds.

---

## 2. Fastify v5 (Backend API)
- **Role & Purpose**:
  High-performance, low-overhead HTTP/JSON REST backend server.
- **Under the Hood**:
  Fastify utilizes schema-based serialization with JSON Schema compilation and rapid lifecycle hooks (`onRequest`, `preHandler`, etc.). It powers multi-tenant authentication, record submissions, attendance statuses, image storage, and supervisor assignments.
- **Summary**:
  Blazing fast backend handling requests with sub-millisecond route resolution.

---

## 3. Drizzle ORM & Database Layer
- **Role & Purpose**:
  Type-safe Object-Relational Mapping for relational database management (PostgreSQL / SQLite).
- **Under the Hood**:
  Drizzle provides zero-overhead SQL generation with compile-time type safety. Schemas in `backend/src/db/schema.ts` define organizations, users, sites (work places), site assignments, daily records, issue types, and media attachments with foreign key constraints.
- **Summary**:
  Type-safe database interactions with automatic migrations and zero runtime bloat.

---

## 4. Multi-Tenant Role & Work Place Architecture
- **Role & Purpose**:
  Enforces multi-tenancy and data isolation between Owners (Admins) and Field Officers (Supervisors).
- **Under the Hood**:
  - **Owner**: Full access to create/manage work places, invite field officers, assign officers to sites, review daily submissions, inspect geotagged photos, and listen to voice notes.
  - **Field Officer**: Assigned strictly to specific work places. Login via phone number + 4-digit PIN. Can only submit reports and view workplaces explicitly assigned by the Owner.
  - **Site Assignments**: Managed via `site_assignments` table linking `site_id` and `user_id`. Each site displays its assigned officer on the Owner dashboard with 1-click reassignment.
- **Summary**:
  Owner manages the entire organization; Field Officers only access their assigned work places.

---

## 5. Client-Side Geotagging & Watermarking (`photo.service.ts`)
- **Role & Purpose**:
  Ensures every photographic record has verifiable real-world coordinates without requiring external cloud EXIF services.
- **Under the Hood**:
  - **EXIF Extraction (`extractExifGps`)**: Directly parses raw JPEG APP1 binary markers (`0xFFE1`), searches for TIFF headers and GPS IFD blocks, and computes fractional Latitude and Longitude from rational number tags.
  - **High-Accuracy Geolocation**: Uses `navigator.geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 })` for live camera shots.
  - **Canvas Watermarking**: Renders the image to an offscreen HTML5 `<canvas>` element and stamps timestamp (`YYYY-MM-DD HH:mm:ss`), coordinates (`Lat: XX.XXXXX, Long: YY.YYYYY`), and verified badges in real time.
- **Summary**:
  Extracts GPS directly from device images or live camera and burns tamper-evident stamps onto the image before upload.

---

## 6. Audio Note Engine (`MediaRecorder` & Expo Audio)
- **Role & Purpose**:
  Allows field supervisors to record detailed audio voice notes (extended up to 5 minutes / 300 seconds) explaining site conditions, worker attendance, or blockers.
- **Under the Hood**:
  On Web, uses browser `navigator.mediaDevices.getUserMedia({ audio: true })` and `MediaRecorder` encoding into Opus/WebM audio blobs. On Native, integrates `expo-audio` / `expo-av`. Automatic cutoff triggers at 300 seconds (5 min) with live second-by-second countdown and dynamic `MM:SS` duration calculation. Audio payloads are stored with accurate metadata and previewed via the audio player across both the Field Officer and Owner portals.
- **Summary**:
  Extended hands-free voice reporting supporting up to 5 minutes of site updates.

---

## 7. Modal Sibling Backdrop Architecture (React Native Web Fix)
- **Role & Purpose**:
  Prevents modals from unexpectedly closing when users click or type inside `<TextInput>` fields on Web.
- **Under the Hood**:
  In React Native Web, wrapping a sheet inside `<TouchableOpacity style={styles.modalBackdrop} onPress={closeModal}>` causes DOM click/focus events inside `<TextInput>` to bubble up and trigger the parent `onPress`. The solution places `<TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeModal} />` as a **sibling behind** `<View style={styles.manageSheet}>`, completely eliminating event bubbling while retaining click-outside-to-dismiss behavior.
- **Summary**:
  Rock-solid modal interactions with zero focus/input dismissal bugs.

---

## 8. Offline-First & Dev Storage Engine (`devStorage.ts`)
- **Role & Purpose**:
  Provides local asset persistence during development and offline staging before pushing to S3/Cloud Storage.
- **Under the Hood**:
  Accepts raw multipart binary or JSON `{ dataUrl }` base64 payloads at `PUT /api/v1/dev-storage/upload`, writes files into `./uploads/`, and serves them with accurate MIME types at `GET /api/v1/dev-storage/files/:key`.
- **Summary**:
  Self-contained media storage requiring zero external cloud dependencies during local testing.

---

## 9. Role-Based Navigation Security & Password Gating
- **Role & Purpose**:
  Prevents unauthorized field personnel from accessing executive management dashboards, financial aggregates, and workplace assignments.
- **Under the Hood**:
  The top role switcher displays the active role (`Owner` vs logged-in officer display name). Attempting to transition from the Field Officer interface (`/record`) to the Owner portal triggers a secure authentication modal requiring the owner's master account credentials. Authentication is validated against the backend `/api/v1/auth/owner/login` endpoint before granting route transition.
- **Summary**:
  Owner dashboard is locked behind verified admin password authentication when accessed from field devices.

---

## 10. Date-Wise Historical Records Engine (`/api/v1/sites/:siteId/records`)
- **Role & Purpose**:
  Allows the business owner to browse all past daily submissions date-by-date for any work place, rather than only viewing today's latest submission.
- **Under the Hood**:
  The backend endpoint `GET /api/v1/sites/:siteId/records` queries all rows in `daily_records` matching the specified `site_id`, ordered by `record_date DESC`. It joins with `users` for officer identification, fetches linked `record_issues` and `issue_types`, and resolves all attached photos and voice notes from `media`. On the frontend, a horizontal scrollable strip of date chips allows instant switching between dates, updating the status badge, voice notes, photos, and issue tags.
- **Summary**:
  Complete chronological audit trail for every site with full day-by-day record navigation.

---

## 11. Multi-Date All-Photos Gallery with GPS Watermarks
- **Role & Purpose**:
  Provides owners with a centralized visual gallery of all photos ever uploaded for a work place across all dates.
- **Under the Hood**:
  Aggregates all media items where `kind === 'photo'` from the site's historical record set. Each card in the responsive 2-column grid displays an overlay with the capture date (e.g. `📅 Oct 16, 2026`) and on-device GPS coordinates (e.g. `📍 28.535, 77.391`). Tapping any photo triggers the full photo inspection modal with high-resolution rendering, coordinates, and timestamp verification.
- **Summary**:
  A complete, permanent photo archive for each site accessible in one tap.

---

## 12. Inline Officer Creation & Dynamic Workplace Assignment
- **Role & Purpose**:
  Streamlines operational workflow by removing separate disconnected officer forms and enabling 1-step inline officer creation directly during workplace setup or reassignment.
- **Under the Hood**:
  The primary action is streamlined to a concise `+ Add` button. Work place creation features dynamic category selection with pre-configured chips (*Construction, Warehouse, Retail, Manufacturing, Office, Other*) plus an automatic custom category input when *Other* is selected, allowing custom enterprise classifications (e.g., Solar Farm, Mining, Refinery). The `Assign Officer` section features an integrated `[+]` toggle button on the left of the label, which expands an inline registration sub-form (Officer Name, Mobile Phone Number, 4-digit PIN) that saves and links the new supervisor directly to the workplace in one atomic step.
- **Summary**:
  Zero-friction onboarding: custom workplace categorization and left-aligned inline officer creation in a single view.

---

## 13. Web Live Camera Viewfinder (`getUserMedia` & Canvas Stream Shutter)
- **Role & Purpose**:
  Eliminates desktop/laptop browser file picker popups when users select "Take Camera Photo", launching a real-time on-screen camera viewfinder instead of navigating to system folders.
- **Under the Hood**:
  On Web, invokes `navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })`, streaming hardware camera video directly into an HTML5 `<video>` element within a modal viewfinder overlay. Features dynamic camera toggling (environment vs user facing), visual rule-of-thirds reticle markings, and real-time GPS readiness indicators. Tapping the circular shutter extracts the active video frame onto an HTML5 `<canvas>`, invokes `stampGeoDataOnImage()` to burn verifiable GPS and timestamp coordinates into the image binary, and automatically terminates active stream tracks upon capture.
- **Summary**:
  True on-screen live camera stream with one-tap shutter capture, bypassing OS folder dialogs completely.

---

## 14. Real Database Authentication & In-App Validation Modals
- **Role & Purpose**:
  Provides strict, production-ready database authentication without reference mock credentials, paired with interactive in-app submission validation that eliminates web `Alert.alert` flakiness.
- **Under the Hood**:
  - **Self-Service Authentication**: Users register their own organizations and credentials directly into PostgreSQL (Owners via Email/Password bcrypt hashes, Field Supervisors via Phone/4-digit PIN bcrypt hashes). Removed all hardcoded demo accounts. Automatic initial site provisioning ensures newly registered organizations are immediately ready for record submission.
  - **In-App Modal Validation**: Replaces native browser dialogs with React Native `<Modal>` sheets featuring non-bubbling background sibling touchables. Work Status (`Full Day`, `Half Day`, `Work Stopped`) validation displays actionable warning banners and prevents blank submissions, while Fastify's `bodyLimit` is increased to 50MB to support high-resolution geotagged photo uploads.
- **Summary**:
  Clean, self-managed user authentication backed by PostgreSQL with dependable in-app validation.
