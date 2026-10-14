# 📘 FieldLog Technology & Architecture Explainer (`explainer.md`)

This living document explains every core technology, library, and architectural pattern used in FieldLog. It is continuously updated as new features, dependencies, and systems are introduced.

---

## 1. Fastify (v5)

* **What it does (Role & Purpose):**  
  Fastify is the Node.js backend web framework that serves our REST API endpoints. It handles incoming HTTP requests from the mobile app and web dashboard, routes them to specific controllers, verifies security tokens, and returns JSON responses.

* **How it works (Under the hood):**  
  Unlike Express, Fastify uses a compiled JSON schema serialization engine (`fast-json-stringify`) and radix-tree route matching (`find-my-way`). This minimizes V8 engine overhead, resulting in up to 2x–4x higher throughput and minimal CPU latency under load.

* **Simple Summary:**  
  The fast, lightweight engine powering the server that receives reports and sends data back to the app.

---

## 2. Neon Serverless Postgres

* **What it does (Role & Purpose):**  
  Neon is our cloud PostgreSQL relational database. It permanently stores all multi-tenant business data: organizations, users, work places (`sites`), daily logs, issues, media references, and edit history.

* **How it works (Under the hood):**  
  Neon separates storage from compute. It runs a custom Rust-based Page Server architecture where database storage is backed by cloud object storage, and compute nodes can scale to zero when idle and wake up on demand. It supports instant git-like branching (`main`, `dev`, `preview`), allowing isolated development without risking production data.

* **Simple Summary:**  
  The cloud database where all reports, accounts, and workplace records are safely stored.

---

## 3. Drizzle ORM

* **What it does (Role & Purpose):**  
  Drizzle is a TypeScript-first Object-Relational Mapper (ORM). It allows us to define our database schema in code (`backend/src/db/schema.ts`) and query the database using type-safe TypeScript methods instead of raw SQL strings.

* **How it works (Under the hood):**  
  Drizzle has zero runtime dependencies and generates lightweight SQL queries with negligible overhead. During compilation, TypeScript inspects database queries against schema definitions so type mismatches or missing columns trigger build-time errors before code ever deploys.

* **Simple Summary:**  
  A code tool that translates TypeScript commands into safe SQL database queries.

---

## 4. postgres.js (`postgres`)

* **What it does (Role & Purpose):**  
  The underlying PostgreSQL client driver that maintains TCP network connections between the Fastify server and Neon Postgres.

* **How it works (Under the hood):**  
  Built with native tagged template literals, efficient binary communication with PostgreSQL wire protocol v3, and connection pooling support that works seamlessly through Neon's PgBouncer pooler (port 6543/5432).

* **Simple Summary:**  
  The pipeline establishing the actual network connection between the server and the database.

---

## 5. React Native & Expo (SDK 52)

* **What it does (Role & Purpose):**  
  The cross-platform framework used to build our mobile application for Android phones and laptop web browsers from a single TypeScript codebase.

* **How it works (Under the hood):**  
  React Native maps JSX declarative components (`<View>`, `<Text>`) to native Android platform widgets (like `android.widget.TextView` and `android.view.ViewGroup`). Expo provides a managed suite of native modules (camera, location, audio, permissions) that execute native Java/Kotlin code under the hood.

* **Simple Summary:**  
  The tool that lets us write one app that runs as a native Android app and as a web page on a laptop.

---

## 6. React Native Web & Metro Bundler

* **What it does (Role & Purpose):**  
  Enables running the Expo mobile application directly in desktop web browsers (`npm run dev:web`) for rapid visual design and testing.

* **How it works (Under the hood):**  
  React Native Web maps React Native primitive components to standard HTML5 DOM elements (e.g., `<View>` becomes `<div>`, `<Text>` becomes `<span>`). Metro compiles and bundles JavaScript files while respecting monorepo workspaces via `metro.config.js`.

* **Simple Summary:**  
  The bridge that translates phone app components into regular website code so you can test on your laptop.

---

## 7. Expo Router (v4)

* **What it does (Role & Purpose):**  
  Provides file-based routing and navigation for the mobile application.

* **How it works (Under the hood):**  
  Similar to Next.js, every file inside the `mobile/app/` directory automatically becomes a navigation route (e.g. `app/record.tsx` routes to `/record`). It manages native Android back-stack transitions, deep links, and browser URL history.

* **Simple Summary:**  
  The traffic system that decides which screen opens when a user taps a button or link.

---

## 8. Expo Audio (`expo-audio`) & HTML5 MediaRecorder

* **What it does (Role & Purpose):**  
  Powers the 60-second voice note recording and playback system.

* **How it works (Under the hood):**  
  - **On Android:** Uses Expo SDK 52's native `expo-audio` module to record mono AAC audio (`.m4a`) at 44.1 kHz, compressed to ~150 KB.
  - **On Web:** Uses the browser's native `navigator.mediaDevices.getUserMedia` and `MediaRecorder` API (`audio/webm`), with a synthetic 520Hz PCM WAV fallback generator for development environments without a microphone.

* **Simple Summary:**  
  The voice recorder that lets supervisors speak their updates instead of typing long messages.

---

## 9. Expo Camera (`expo-camera`)

* **What it does (Role & Purpose):**  
  Enables supervisors to capture live photos directly inside the app while at the work location.

* **How it works (Under the hood):**  
  Interfaces with Android's `Camera2` hardware API to render a live hardware viewfinder (`CameraView`). Gallery pickers and photo library imports are deliberately excluded to enforce anti-fraud protection (preventing users from uploading old or downloaded images). On web dev preview, a dev mock photo stamped with GPS coordinates is generated.

* **Simple Summary:**  
  A secure camera inside the app that takes real-time photos and prevents uploading old photos from the gallery.

---

## 10. Expo Location (`expo-location`) & Geotagging

* **What it does (Role & Purpose):**  
  Acquires GPS satellite coordinates, accuracy radius, and mock-location flags when taking photos.

* **How it works (Under the hood):**  
  Requests Android fine location permissions and communicates with device GPS / GNSS hardware providers. It inspects Android location metadata flags (`mocked: true/false`) to detect location spoofing apps.

* **Simple Summary:**  
  The GPS detector that stamps real latitude and longitude coordinates onto photos to prove supervisors were at the work place.

---

## 11. Expo Secure Store (`expo-secure-store`)

* **What it does (Role & Purpose):**  
  Stores sensitive authentication tokens (JWT access tokens and refresh tokens) safely on the device.

* **How it works (Under the hood):**  
  On Android, it uses the Android Keystore system with AES encryption. Data is stored in `SharedPreferences`, encrypted with a key stored in the hardware keystore. On web dev, it falls back to `localStorage` / in-memory storage.

* **Simple Summary:**  
  An encrypted vault on the phone that remembers who is logged in so they do not have to enter their PIN every time.

---

## 12. Zod

* **What it does (Role & Purpose):**  
  Performs runtime schema validation on all incoming API requests (payloads, query params, headers).

* **How it works (Under the hood):**  
  Parses raw HTTP JSON bodies against structured TypeScript schemas. If a field is missing, has an incorrect type, or violates UUID/date formats, it immediately rejects the request with a clean HTTP 400 Bad Request before database queries can run.

* **Simple Summary:**  
  A security inspector that checks all data entering the server to make sure it matches the expected format.

---

## 13. EAS Build & EAS Update (Expo Application Services)

* **What it does (Role & Purpose):**  
  The cloud build and distribution pipeline for generating standalone Android `.apk` (for internal testing) and `.aab` (for Google Play Store).

* **How it works (Under the hood):**  
  Configured via `mobile/eas.json`. Cloud worker machines assemble native Gradle binaries, package assets, and produce downloadable installation files for team devices without requiring local Android Studio installations.

* **Simple Summary:**  
  The cloud factory that compiles the code into an installable Android APK file.
