# 📍 FieldLog

> **Offline-first, mobile-first enterprise daily attendance, reporting, and site management system.**  
> *Built for real-world field operations: construction, warehouses, retail chains, factories, logistics hubs, repair teams, and facility security.*

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Expo](https://img.shields.io/badge/Expo-SDK%2052-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-v8-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Fastify](https://img.shields.io/badge/Fastify-v5-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![Turso](https://img.shields.io/badge/Turso-libSQL%20Distributed-00E599?logo=sqlite&logoColor=white)](https://turso.tech/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

---

## ⚡ Quick Download & Live Access

| Channel | Platform | Status | Access Link |
|---|---|---|---|
| **Android Native APK** | Android 8.0+ | **Build #6 Ready** | [⬇️ Download FieldLog APK](https://expo.dev/artifacts/eas/IQmXMMHIwCfyvulTlHoTU_2NwXlmyhqgAdF3Qlf7Aso.apk) |
| **Expo Cloud Dashboard** | All Devices | Active | [📊 View Build #6 on EAS](https://expo.dev/accounts/vishesh-itech/projects/fieldlog/builds/5c2e1bbe-9225-46d2-acf1-fae9c8145e87) |
| **PWA Web App** | Mobile / Desktop | Live | [🌐 Open Web App (Install via Chrome)](http://localhost:8081/login) |
| **Production Backend** | Cloud API | Running on Render | `https://fieldlog-backend-4on5.onrender.com` |

---

## 💡 What is FieldLog?

Business owners managing multiple distributed sites (stores, construction projects, agricultural lands, security posts) cannot physically visit every location every day. Traditional WhatsApp groups are unstructured, lack location accountability, and bury critical issues under noise.

**FieldLog provides high-trust, zero-friction daily operations:**

* 🟢 **3-Tap Daily Attendance & Status**: Big, color-coded status selectors: **Full Day**, **Half Day**, and **Work Stopped** with dual-language support (**English & Hindi**).
* 📸 **Live Geotagged Photos**: Photos stamped on-device with GPS coordinates, satellite accuracy, and real timestamps. Gallery uploads are protected against fraud.
* 🎙️ **Voice Notes**: Officers record up to 60-second audio updates with real-time waveform timers, instant in-app playback, and cloud sync.
* 🏷️ **Dynamic Issue Tagging**: Tap-to-report site obstacles (*"Material Delayed"*, *"Less Manpower"*, *"Severe Weather"*, *"Vehicle Breakdown"*, *"Need Cash/Funds"*, etc.).
* 📅 **Historical Audit Trail & All-Photos Gallery**: Owners can browse past records date-by-date or inspect a chronological visual photo gallery for every workplace.
* 🛡️ **Strict Multi-Tenancy & Provisioning**: Business owners create work places and provision supervisors (Phone + 4-digit PIN) directly from the Owner portal.

---

## 🏗️ Architecture & Technology Stack

```
                          ┌────────────────────────┐
                          │     Business Owner     │
                          │   (Web / Mobile App)   │
                          └───────────┬────────────┘
                                      │
                                      ▼
┌────────────────────────┐     ┌──────────────────┐     ┌────────────────────────┐
│    Field Officer       │────▶│ Fastify Backend  │────▶│ Turso Distributed DB   │
│ (Android / PWA / Web)  │     │ (REST API / JWT) │     │ (libSQL + Drizzle ORM) │
└────────────────────────┘     └─────────┬────────┘     └────────────────────────┘
            │                            │
            ▼                            ▼
┌────────────────────────┐     ┌──────────────────┐
│  Hardware GPS, Camera  │     │  Cloud Storage   │
│   & Audio Recording    │     │  (Dev / R2 / S3) │
└────────────────────────┘     └──────────────────┘
```

* **Mobile Core (`mobile/`)**: React Native (Expo SDK 52, React Native 0.76), Expo Router v4, React Native Web.
* **Hybrid Deployment**:
  * **Native APK**: Built via Expo Application Services (EAS Build).
  * **Progressive Web App (PWA)**: Standalone web app manifest, custom icons, and background service worker for offline asset caching.
  * **Capacitor Wrapper**: `@capacitor/core` & `@capacitor/android` wrapping the production web bundle into an Android WebView APK.
* **Backend (`backend/`)**: Fastify v5, TypeScript, JWT role-based security, bcrypt password & PIN hashing.
* **Database**: Turso (libSQL distributed SQLite engine) configured with WAL journaling and high-concurrency busy timeouts via Drizzle ORM.
* **Media Pipeline**: Base64 data URL encoding, local binary storage stub, and dynamic host/protocol resolution.

---

## 📲 4 Ways to Run & Install FieldLog

### Option 1: Direct Android APK (Recommended for Testing)
1. Download the latest compiled APK on your Android device:
   👉 **[Download FieldLog Build #6 APK](https://expo.dev/artifacts/eas/IQmXMMHIwCfyvulTlHoTU_2NwXlmyhqgAdF3Qlf7Aso.apk)**
2. Tap the downloaded file in your notifications or Downloads folder to install.
3. Open **FieldLog** from your home screen.

---

### Option 2: Progressive Web App (PWA — 1-Click Browser Install)
Zero APK download required. Works on Android, iOS, Windows, Mac, and Linux:

1. Open **Google Chrome** on your phone (or laptop) and go to the web URL:
   * **Local / Wi-Fi**: `http://localhost:8081/login`
   * **Production**: `https://fieldlog-backend-4on5.onrender.com`
2. Tap the Chrome menu (**⋮**) in the top right.
3. Tap **"Install app"** (or **"Add to Home screen"**).
4. Tap **Install**.
5. **FieldLog** will appear on your home screen with its own icon and launch in **standalone full-screen mode** with no browser bars.

---

### Option 3: Capacitor Android Project (WebView APK)
If you want to package the web bundle into an Android Studio APK locally:

```powershell
# 1. Navigate to the mobile workspace
cd mobile

# 2. Build the static web bundle and sync with the Android project
npm run cap:sync

# 3. Open the project in Android Studio
npm run cap:open

# 4. Or compile debug APK via Gradle command line:
cd android
./gradlew assembleDebug
```
The compiled APK will be output at:  
`mobile/android/app/build/outputs/apk/debug/app-debug.apk`

---

### Option 4: Local Developer Monorepo Setup

#### 1. Prerequisites
* **Node.js** v18.x or v20+ / v22+
* **npm** v9+
* Git

#### 2. Clone Repository & Install Dependencies
```powershell
# Clone the repository
git clone https://github.com/vishesh-i-tech/FieldLog.git
cd FieldLog

# Install root dependencies
npm install

# Install mobile dependencies
cd mobile && npm install && cd ..

# Install backend dependencies
cd backend && npm install && cd ..
```

#### 3. Environment Variables
Create `backend/.env`:
```env
PORT=4000
NODE_ENV=development
TURSO_DATABASE_URL="libsql://feildlog-vishesh-i-tech.aws-ap-south-1.turso.io"
TURSO_AUTH_TOKEN="<your-turso-jwt-token>"
JWT_SECRET="dev-super-secret-key-change-in-production-12345"
API_BASE_URL="http://localhost:4000"
```

Push schema to Turso database:
```powershell
cd backend
npm run db:push
```

#### 4. Launch Development Servers
Open two terminal windows:

* **Terminal 1: Start Backend API (Port 4000)**
  ```powershell
  cd backend
  npm run dev
  ```

* **Terminal 2: Start Mobile / Web App (Port 8081)**
  ```powershell
  cd mobile
  npm run web
  ```
Open `http://localhost:8081/login` in your browser.

---

## 📁 Repository Structure

```
FieldLog/
├── backend/                       # Fastify API Server
│   ├── src/
│   │   ├── db/                    # Drizzle ORM schema & Turso client
│   │   ├── routes/                # REST endpoints (auth, sites, records, devStorage)
│   │   ├── services/              # Business logic & auth services
│   │   └── server.ts              # Fastify instance & CORS configuration
│   ├── uploads/                   # Local media persistence folder
│   └── package.json
│
├── mobile/                        # React Native / Expo / PWA / Capacitor App
│   ├── android/                   # Capacitor Android Studio native project
│   ├── app/                       # Expo Router screens (index, login, owner, record)
│   ├── assets/                    # Image assets & illustrations
│   ├── public/                    # PWA static assets (manifest.json, service-worker, icons)
│   ├── src/
│   │   ├── constants/             # API configuration & base URLs
│   │   ├── services/              # Audio, Photo, Location, Auth, and Offline Sync
│   │   └── i18n/                  # English and Hindi localization dictionaries
│   ├── capacitor.config.ts        # Capacitor configuration
│   ├── eas.json                   # EAS Build profiles (preview, production)
│   └── package.json
│
├── docs/                          # Architecture & design specifications
├── explainer.md                   # Chronological technical architecture explainer
└── README.md                      # Project documentation & setup guide
```

---

## 🚦 Roadmap & Implementation Status

| Feature | Description | Status | Verification |
|---|---|---|---|
| **Clean Enterprise Auth** | Dynamic role router, owner email/pass, officer phone/4-digit PIN | ✅ Complete | Verified on Device |
| **Site & Officer Mapping** | Dynamic categories, 1-click inline officer provisioning & assignment | ✅ Complete | Verified on Device |
| **Daily Record Online** | 3-tap status, on-device GPS stamping, same-day edit diffs | ✅ Complete | Verified on Device |
| **Voice Note Recording** | Dual-mode Web MediaRecorder & native `expo-audio` | ✅ Complete | Verified on Device |
| **Android Notch Insets** | `StatusBar.currentHeight` safe-area padding across screens | ✅ Complete | Verified on Device |
| **Cloud Photo Pipeline** | Base64 image compression, dynamic host URLs, verified GPS fallback | ✅ Complete | Verified on Device |
| **Date-Wise History** | Chronological audit trail with horizontal date switcher | ✅ Complete | Verified on Device |
| **All-Photos Gallery** | Multi-date responsive photo grid with GPS badges | ✅ Complete | Verified on Device |
| **PWA Web App** | Web manifest, offline service worker, 1-click browser install | ✅ Complete | Verified on Browser |
| **Capacitor Android** | Web bundle sync, native Android Studio project, hardware permissions | ✅ Complete | Verified via CLI |
| **Automated Tests** | Backend test suite across auth, sites, and daily records | ✅ Complete | 6/6 Suites Passing |

---

## 🧪 Testing & Verification

Run the automated backend test suite:
```powershell
cd backend
npm test -- --test-concurrency=1
```
Result: **6 passed suites, 0 failed** (Auth, Sites, Daily Records, Media Storage).

---

## 📄 License
This project is proprietary and confidential. All rights reserved.
