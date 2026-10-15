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

## 6. Audio Note Engine (`MediaRecorder` & Expo AV)
- **Role & Purpose**:
  Allows field supervisors to record quick audio voice notes (up to 60 seconds) explaining site conditions or blockers.
- **Under the Hood**:
  On Web, uses browser `navigator.mediaDevices.getUserMedia({ audio: true })` and `MediaRecorder` encoding into Opus/WebM audio blobs. On Native, integrates `expo-av` audio recording. Uploads to backend storage with duration metadata and allows playback in Owner dashboard.
- **Summary**:
  One-tap voice recording giving field staff a hands-free reporting channel.

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

## 10. Inline Officer Creation & Dynamic Workplace Assignment
- **Role & Purpose**:
  Streamlines operational workflow by removing separate disconnected officer forms and enabling 1-step inline officer creation directly during workplace setup or reassignment.
- **Under the Hood**:
  The "+ Add Field Officer" primary button is consolidated into "+ Add Work Place" and existing site "Assign Officer" modals. Owners can expand an inline `+ Add New Officer` sub-form to register a supervisor with name, mobile phone number, and 4-digit PIN. Upon creation, the officer is immediately selected and linked to the active workplace in a single atomic flow. Work place creation follows a standardized 3-step hierarchy: 1. Site Name, 2. Category Chips (Construction, Warehouse, Retail, etc.), and 3. Location.
- **Summary**:
  Zero friction onboarding: register and assign officers directly inside workplace workflows.

---

## 11. Web Live Camera Viewfinder (`getUserMedia` & Canvas Stream Shutter)
- **Role & Purpose**:
  Eliminates desktop/laptop browser file picker popups when users select "Take Camera Photo", launching a real-time on-screen camera viewfinder instead of navigating to system folders.
- **Under the Hood**:
  On Web, invokes `navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })`, streaming hardware camera video directly into an HTML5 `<video>` element within a modal viewfinder overlay. Features dynamic camera toggling (environment vs user facing), visual rule-of-thirds reticle markings, and real-time GPS readiness indicators. Tapping the circular shutter extracts the active video frame onto an HTML5 `<canvas>`, invokes `stampGeoDataOnImage()` to burn verifiable GPS and timestamp coordinates into the image binary, and automatically terminates active stream tracks upon capture.
- **Summary**:
  True on-screen live camera stream with one-tap shutter capture, bypassing OS folder dialogs completely.


