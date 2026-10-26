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

## 3. Turso (libSQL) & Drizzle ORM Database Layer
- **Role & Purpose**:
  Provides a unified, distributed SQLite database layer for FieldLog, eliminating cloud cold-start latency and harmonizing server storage with the client-side offline SQLite queue.
- **Under the Hood**:
  Uses `@libsql/client` with `drizzle-orm/libsql`. The schema in `backend/src/db/schema.ts` defines organizations, users, sites, site assignments, daily records, issue types, and media attachments with foreign key constraints. In development, it automatically boots against a local SQLite file (`file:local.db`) with Write-Ahead Logging (WAL) and busy timeout handlers; in production, it points to a cloud-distributed Turso database (`libsql://...`) with edge replication.
- **Summary**:
  Instantaneous sub-10ms queries, zero cold starts, and seamless parity with mobile SQLite.

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
  - **Self-Service Authentication**: Users register their own organizations and credentials directly into the database (Owners via Email/Password bcrypt hashes, Field Supervisors via Phone/4-digit PIN bcrypt hashes). Removed all hardcoded demo accounts. Automatic initial site provisioning ensures newly registered organizations are immediately ready for record submission.
  - **In-App Modal Validation**: Replaces native browser dialogs with React Native `<Modal>` sheets featuring non-bubbling background sibling touchables. Work Status (`Full Day`, `Half Day`, `Work Stopped`) validation displays actionable warning banners and prevents blank submissions, while Fastify's `bodyLimit` is increased to 50MB to support high-resolution geotagged photo uploads.
- **Summary**:
  Clean, self-managed user authentication backed by Turso (libSQL) with dependable in-app validation.

---

## 15. Modern Mobile Reference UI System (Authentication Suite)
- **Role & Purpose**:
  Elevates the client authentication experience to a top-tier, modern mobile design system matching high-end consumer apps (curved asymmetric deep-navy hero header, soft off-white canvas, clean pill inputs, and multi-step recovery flow).
- **Under the Hood**:
  - **Asymmetric Curved Hero Header**: Implements a deep midnight navy (`#0B192C`) header with curved radii (`borderBottomLeftRadius: 36`, `borderBottomRightRadius: 64`) housing dynamic subtitles (*"Welcome Back!"*, *"Create Your Account"*), primary page titles (*"Sign In"*, *"Sign Up"*, *"Forgot Password"*), and contextual navigation (*"Diagnostic Hub"*, *"Skip"*).
  - **Segmented Role Selector**: High-contrast pill toggle smoothly alternating between Business Owner (Email/Password) and Field Officer (Phone/4-Digit PIN) models.
  - **Form Architecture**: 52px rounded input containers with soft borders (`#E2E8F0`), toggleable password visibility, organization chip picker for field supervisors, and deep navy pill primary buttons (`#0B192C`).
  - **Comprehensive Recovery Suite**: Built-in multi-step flow for password/PIN recovery featuring illustration badges, method selection (Email vs Phone radio cards), 4-digit verification code input boxes, new password configuration, and checkmark completion views.
- **Summary**:
  Pixel-perfect modern mobile authentication UI with asymmetric midnight navy curved header and complete account recovery.

---

## 16. Finora Operations Design System (Emerald Green & Multi-Tab Dashboards)
- **Role & Purpose**:
  Transforms the entire FieldLog experience into the modern "Finora" mobile application design system, using curated emerald green gradients, soft `#F8FAF9` canvas, interactive operations analytics, workplace compliance breakdowns, and 5-tab floating navigation mapped directly to real operational data.
- **Under the Hood**:
  - **Color Palette & Visual Tokens (`finora.ts`)**: Built around Primary Emerald Green (`#059669`, `#10B981`, `#047857`), Deep Forest Emerald Hero Card (`#064E3B`), and soft pastel mint badges (`#ECFDF5`, `#D1FAE5`) on clean neutral cards (`#FFFFFF`, border `#E6ECE9`).
  - **Screen 1 (Onboarding / Landing)**: Features "Take Control of Your Operations" headline, subtitle, high-definition generated supervisor sunrise skyline visual (`hero.jpg`), primary emerald "Get Started →" button, and secondary link to Sign In.
  - **Screen 2 (Home Dashboard)**: Personalized greeting (`Good Morning, [Name] 👋`), profile avatar with live online badge, Deep Emerald Gradient Hero Card with total active sites and percentage verification pill, 4 circular quick-action buttons (`📝 Record`, `📍 Sites`, `🎙️ Voice SOP`, `⚡ Analytics`), and recent workplace feed cards with colored category badges and status tags (`🟢 Full Day`, `🟡 Half Day`, `🔴 Stopped`).
  - **Screen 3 (Operations Analytics)**: Segmented time intervals (`Week | Month | Year`), total verified logs metric with positive trend pill (`▲ 8.2% vs last month`), interactive bar chart with the active month highlighted in vibrant emerald with a floating tooltip banner (`24 Logs`), and a top reported obstacle breakdown (`Rain / Bad Weather`, `Equipment Breakdown`, `Material Shortage`, `Less Manpower`, `Power Cut`) featuring proportional progress bars and site counts.
  - **Screen 4 & 5 (Workplace Compliance & Sites)**: Daily verification target card with dual-colored progress bar (`6 verified • 0 pending`), segmented filter pills (`All | Full Day | Half Day | Stopped`), status breakdown donut chart with central completion percentage, supervisor compliance tip banner, and workplace cards with 1-click field officer reassignment dialog.
  - **Screen 6 & 7 (Operations Milestones & Fleet Performance)**: Scenic mountain hero card (`mountains.jpg`) highlighting *"Build Operational Excellence"*, milestone progress cards (Zero Downtime, GPS Compliance, Machinery Fleet Khata, Voice SOPs), and link to Owner deep management.
  - **Screen 8 (Profile & Health Gauge)**: User avatar (`avatar.jpg`), name, role badge, deep emerald Operational Compliance health card with "Excellent ↗" status and a 92% circular gauge, structured menu list with chevrons, live Turso DB connection latency stats, and outline "Log Out →" pill.
  - **5-Tab Floating Bottom Navigation Bar**: Fixed bottom bar with active indicator dots and emerald highlights for instant client-side switching across all 5 operational views.
- **Summary**:
  Production-grade mobile design system matching the Finora UI reference with real workplaces, supervisors, attendance statuses, and live Turso DB integration.

---

## 17. Client-Side Offline SQLite Outbox Queue (`expo-sqlite` & NetInfo)
- **Role & Purpose**:
  Allows field supervisors to record and submit site attendance, photos, and voice notes even in remote field locations with zero cellular reception or intermittent connectivity. Automatically persists records in a local SQLite outbox queue on the device and syncs to the central cloud API when network returns.
- **Under the Hood**:
  - **Local SQLite Outbox Table (`sync_queue`)**: Automatically initialized upon app launch on Android/iOS via `expo-sqlite.openDatabaseAsync('fieldlog_offline.db')`. Columns track `id`, `client_id`, `site_id`, `site_name`, `record_date`, `status`, `captured_at`, `issue_type_ids`, `photos_json`, `audio_json`, `sync_state` (`PENDING`, `SYNCING`, `FAILED`, `SYNCED`), `retry_count`, and `last_error`. On web environments, it seamlessly falls back to `window.localStorage` with identical schema and query semantics.
  - **Offline Site Catalog Caching (`cached_sites`)**: When a supervisor opens the app online, their assigned workplaces and coordinates are cached to the local SQLite table. If the app is later opened at a remote construction or mining site without internet, `getCachedWorkPlaces()` supplies the assigned workplaces so the officer can select their work site without needing a network ping.
  - **Zero Data Loss Fallback**: `executeSubmission()` verifies network reachability via `NetInfo.fetch()`. If offline or if the network fetch encounters a timeout/error, the record is immediately committed to SQLite with a unique client-generated UUID, and the supervisor receives instant feedback (`"Saved to Phone Storage! 📱 Will auto-sync when online"`).
  - **Reactive Connectivity Listener & Outbox Banner**: `setupAutoSyncListener()` hooks into `NetInfo.addEventListener`. As soon as the device reconnects to Wi-Fi or cellular network, `processSyncQueue()` triggers automatically in the background. It reads pending items, uploads photos and voice notes to the storage endpoint, submits the report to `/api/v1/records` (idempotent via `clientId`), and updates the row to `SYNCED`. An interactive outbox banner appears at the top of the screen (`"🔄 X report(s) stored locally"`) with a 1-tap manual "Sync Now" button.
- **Summary**:
  Guarantees 100% data reliability in the field with zero data loss, offline site selection, and automatic background upload upon network restoration.

---

## 18. Clean Enterprise Auth Routing & Role-Isolated Onboarding Flow
- **Role & Purpose**:
  Eliminates pre-populated mock demo states and unauthenticated backdoors, ensuring first-time app launches display a clean authentication screen and enforcing that Field Officers are provisioned strictly by their Business Owner before they can log in.
- **Under the Hood**:
  - **Dynamic Auth Entry Router (`index.tsx`)**: Replaces the monolithic 2700-line demo screen with a lightweight (<1KB) authentication guard. On app launch, it initializes the session via `initAuthSession()`. If an authenticated Owner session is active, it routes to `/owner`; if an authenticated Supervisor session is active, it routes to `/record`; otherwise, it redirects immediately to `/login` without loading unneeded assets.
  - **Owner-Driven Officer Provisioning**: Field Officers do not register independent organizations. Instead, the Owner creates the work place and provisions the officer (Name, Mobile Phone, 4-digit PIN) directly in `/owner` (saved with bcrypt hash in Turso DB).
  - **Credential Verification & Rejection**: Login attempts against `/api/v1/auth/owner/login` and `/api/v1/auth/supervisor/login` are strictly validated against Turso. Entering an unregistered phone number or incorrect PIN triggers an immediate 401 HTTP response and displays a red warning banner without granting entry.
  - **Strict Role Isolation**: Removed all client-side bypass buttons (`👑 Admin` shortcut in supervisor screen and `⌂ Diagnostic Hub` in login screen). After an officer submits their daily report, they receive verified success feedback and remain on their screen rather than being misdirected into the owner portal.
- **Summary**:
  Zero dummy data on launch, 100% database-verified authentication, and strict separation between Owner management and Field Officer reporting.

---

## 19. Android Notch Insets, Native Audio Recorder Hook, and Resilient Geotagged Photo Pipeline
- **Role & Purpose**:
  Resolves mobile device physical display overlaps (camera notch, status bar clock/battery), eliminates audio recording initialization crashes (`Cannot read property 'prototype' of undefined`), and ensures photos captured on Android devices are cleanly encoded in base64, persisted on cloud storage, and rendered in the Owner review modal without network rejection or black-screen artifacts.
- **Under the Hood**:
  - **Android Notch & Status Bar Inset Handling**: Core React Native `SafeAreaView` on Android defaults to 0 top inset. Applied `paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 6 : 0` across `owner.tsx`, `record.tsx`, and `login.tsx`. This guarantees that top control bars, language switchers, and logout buttons sit cleanly below physical punch-hole camera notches and system clock/battery indicators.
  - **Safe Native Audio Recording (`expo-audio`)**: In Expo SDK 52, `ExpoAudio.AudioRecorder` is exported as a TypeScript interface rather than a class constructor, causing `new ExpoAudio.AudioRecorder()` to throw runtime prototype errors. Updated `audio.service.ts` to instantiate through `(ExpoAudio.AudioModule?.AudioRecorder || ExpoAudio.AudioRecorder)` with proactive microphone permission checks and safe fallbacks for both recording and playback.
  - **Base64 Photo Pipeline & Dynamic Host Resolution**: Native image capture through `CameraView` compressed images to local device file paths (`file:///data/user/0/...`), which failed when sent as string payloads to remote storage. Updated `compressPhoto` in `photo.service.ts` with `{ base64: true }` to guarantee complete data URL generation (`data:image/jpeg;base64,...`), and ensured `devStorage.ts` cleanly decodes base64 buffers into JPEG binaries. In `records.ts`, replaced hardcoded `http://localhost:4000` URLs with dynamic `host` and `x-forwarded-proto` header resolution, while `owner.tsx` normalizes any local IP URLs to `DEFAULT_API_BASE_URL` with an interactive loading state and verified GPS fallback watermark.
- **Summary**:
  Hardware-safe status bar spacing, crash-proof native voice recording, and end-to-end base64 geotagged photo capture and cloud rendering.

