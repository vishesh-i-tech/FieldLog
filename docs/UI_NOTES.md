# FieldLog UI Living Screen Directory & Customization Catalog

This document is a living directory of every frontend screen, route, and UI component in FieldLog. Use this catalog to request screen-by-screen visual, copy, or structural modifications.

---

## Screen Overview & Route Matrix

| # | Screen Name | Expo Route | Role | Current Status | Key UI Elements |
|---|---|---|---|---|---|
| **01** | **Diagnostic & Status Hub** | `/` | All / Tester | 🟢 Live & Responsive | Health badge, Neon latency, laptop IP editor, link to Today's Record |
| **02** | **Today's Record** | `/record` | Supervisor | 🟢 Live (Web & Mobile) | 3 big status buttons, live camera, GPS badge, dynamic issue chips, submit button |
| **03** | **My Work Places ("मेरे काम")** | `/sites` | Supervisor | 🟡 In Development | Work place list, today's submission status indicator (Submitted vs Pending) |
| **04** | **Supervisor Login** | `/login` | Supervisor | 🟡 Phase 1 APIs Built | Phone number input, 4-digit PIN keypad, large high-contrast submit button |
| **05** | **Owner Dashboard** | `/owner/dashboard` | Owner | 📋 Next (Phase 6) | Aggregated counters (Full, Half, Stopped), 7-day colored squares, voice player |
| **06** | **Day Detail View** | `/owner/records/[id]` | Owner | 📋 Next (Phase 6) | AI summary, audio player, full transcript, GPS photo carousel, "Seen" tick |
| **07** | **First-Launch Consent** | `/consent` | All | 🟢 Live Component | Bilingual (Hindi + English) camera, location, audio permissions disclosure |
| **08** | **Manage Issue Chips** | `/owner/issue-types` | Owner | 🟢 APIs Built | List chips, add custom chip, toggle active/hide (max 8 visible limit) |
| **09** | **Manage Work Places** | `/owner/sites` | Owner | 🟢 APIs Built | Create work place, assign supervisors, edit location, archive |
| **10** | **Manage Supervisors** | `/owner/supervisors`| Owner | 🟢 APIs Built | Add supervisor with 4-digit PIN, reset PIN, deactivate account |

---

## Detailed Screen Specifications

### 01. Diagnostic & Status Hub
- **Route:** `app/index.tsx`
- **Purpose:** Diagnostic tool to verify Fastify API connection, Neon latency, and switch API IP address dynamically.
- **Components:**
  - Status Badge (`🟢 All Systems Operational` / `🟡 Degraded` / `🔴 Offline`)
  - Server Diagnostic Card (Fastify port, Neon status, roundtrip latency in ms, uptime)
  - Backend IP Configurator (interactive inline editor to change laptop IP)
  - Big Navigation CTA: **"आज का रिकॉर्ड भरें (Test Today's Record)"**
- **Feedback & Tweaks:** *(Add your requested changes here)*

---

### 02. Today's Record Submission (The Most Important Field Screen)
- **Route:** `app/record.tsx`
- **Purpose:** Primary screen used daily by supervisors (designed for zero typing, high contrast, big tap targets).
- **Components:**
  - **Work Place Header:** Displays work place name and today's date in Hindi (`📅 बुधवार, 14 अक्टूबर 2026`).
  - **Status Selection:** 3 large buttons (minimum 80px height):
    - `पूरा दिन` (Full Day — Emerald Green `#10B981`)
    - `आधा दिन` (Half Day — Amber `#F59E0B`)
    - `काम बंद` (Stopped — Red `#EF4444`)
  - **Live Photo Capture:**
    - Live in-app viewfinder (`expo-camera`). No gallery picker exists.
    - Web Fallback: Automatically simulates live camera with stamped timestamp & GPS.
    - Geo-tagged thumbnails displaying `📍 Lat, Long` and capture time. Up to 6 photos.
  - **Issue Chips:**
    - Dynamic multi-select chips fetched from database (`सामान / स्टॉक नहीं आया`, `कम लोग`, `बारिश`, etc.).
  - **Action Button:** Big submit button with clear states (`Saved on phone` → `Sending...` → `Sent`).
- **Feedback & Tweaks:** *(Add your requested changes here)*

---

### 03. Web Desktop Phone Frame
- **File:** `app/_layout.tsx`
- **Purpose:** Constrains the app to a clean, centered phone-sized column (`maxWidth: 430px`) with a dark `#030712` desktop backdrop on widescreen monitors.
- **Feedback & Tweaks:** *(Add your requested changes here)*
