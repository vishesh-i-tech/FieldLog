# Feature 00: Foundation & Health Check

---

## 1. What this feature does
This feature establishes the core foundation of DailyRecord. It connects the mobile phone app to the Node.js Fastify backend and verifies that the backend can talk to the cloud database (Neon Serverless PostgreSQL). When opened on a phone, it pings the server and shows a live indicator of whether the database and backend are operational.

---

## 2. Hinglish me samjho
Ye feature hamare pure project ki neev (foundation) hai. Isme humne mobile app, computer server (Fastify), aur cloud database (Neon Postgres) ka aapas me connection set kiya hai. Jab aap phone par app kholte hain, to ye server ko check karke batata hai ki server chal raha hai ya nahi aur database connected hai ya nahi. Agar database sleep mode me hai to ye 'waking up' dikhata hai taaki pata rahe ki sab theek se connect ho raha hai.

---

## 3. Who uses it
- **Developer / Owner / Tester:** Used by developer and system administrators during setup to verify end-to-end device connectivity before testing operational features.
- **User Steps:**
  1. Open the DailyRecord app on the phone.
  2. The home screen immediately tests the connection to the backend.
  3. Displays a green badge with connection latency when healthy.

---

## 4. How it works inside
1. Mobile app boots and reads `API_BASE_URL` from configuration.
2. The phone makes an HTTP `GET` request to `http://<laptop-ip>:4000/health`.
3. Fastify backend receives the request.
4. Fastify issues a lightweight query `SELECT 1` to Neon Postgres through PgBouncer.
5. If Neon returns a response, backend measures response latency and returns HTTP `200 OK` with status `healthy`.
6. If Neon is sleeping or unreachable, backend retries up to 3 times before returning HTTP `503` with a friendly "database waking up" message.
7. Mobile screen updates its UI state dynamically.

---

## 5. Files and code involved
- `backend/src/server.ts`: Starts the Fastify server, registers CORS, sensible error handling, and routes.
- `backend/src/routes/health.ts`: Implements `GET /health` and queries the database.
- `backend/src/db/index.ts`: Configures the connection pooler to Neon using `postgres.js` and Drizzle ORM.
- `backend/src/db/schema.ts`: Defines all 12 relational database tables with Drizzle.
- `mobile/app/index.tsx`: Main Expo mobile screen showing the live connectivity card and retry button.
- `mobile/src/constants/config.ts`: Configures the backend IP and port for local testing.

---

## 6. Database tables touched
- None modified directly during the health check.
- Executes `SELECT 1` to verify connectivity.
- Prepares the database schema for: `organizations`, `users`, `sites`, `site_assignments`, `daily_records`, `record_issues`, `media`, `transcripts`, `summaries`, `record_edits`, `record_acknowledgements`, `notification_log`.

---

## 7. API endpoints used
- `GET /health`: Public health check endpoint returning server uptime, timestamp, and database connectivity.

---

## 8. Edge cases and what happens
- **Neon Database Sleeping (Scale-to-zero):** Backend does not crash. It waits for Neon to wake up (with a 10s connection timeout and retry). The mobile app displays "Database waking up, please wait...".
- **Phone on different Wi-Fi network:** The phone cannot reach the laptop's local IP address. Mobile app shows "Cannot reach server. Check Wi-Fi connection" with a manual Retry button.
- **Laptop Firewall blocks port 4000:** Mobile app times out. Solution provided in `docs/SETUP.md` to allow inbound port 4000 in Windows Firewall.

---

## 9. How to test it by hand
1. Make sure your laptop and phone are on the same Wi-Fi network.
2. Start the backend on your laptop: `npm run dev:backend`.
3. In a browser on your laptop, visit `http://localhost:4000/health`. You should see `{"status":"healthy","database":"connected",...}`.
4. Start the mobile app: `npm run dev:mobile`.
5. Open **Expo Go** on your Android phone and scan the QR code.
6. Look at your phone's screen: it should display **"Backend: Connected"** and **"Neon Postgres: Healthy"** with a green badge.

---

## 10. Known limits and future improvements
- Currently requires phone and laptop to share local Wi-Fi or use Expo tunnel mode (`npx expo start --tunnel`).
- When backend is deployed to Render/Railway in later phases, the phone will connect via a public HTTPS URL without needing local Wi-Fi pairing.
