# FieldLog Setup & Execution Guide: Web Browser, Laptop & Phone

> [!IMPORTANT]
> ### 🌐 Web Browser Preview vs 📱 Physical Phone Testing
> * **What works in the Laptop Web Browser (`npm run dev:web`):**
>   - Fast visual polish and layout inspection in a centered **430px smartphone frame**.
>   - Full interactive Today's Record form (big status buttons, dynamic issue chips).
>   - Web-safe live camera simulation (stamped with timestamp and GPS coordinates).
>   - Voice recording via browser microphone (`MediaRecorder`).
>   - Full local backend API communication and testing with dev seed data.
> * **What strictly requires a Physical Android Phone:**
>   - Hard enforcement of live camera hardware (verifying gallery imports cannot be triggered).
>   - Physical satellite GPS accuracy and Android mock location flag detection.
>   - Native SQLite offline queue and network airplane-mode recovery (Phase 5).
>   - Push notifications and native background sync workers.

---

## Quick Commands Reference

```powershell
# 1. Start Backend API (Port 4000)
npm run dev:backend

# 2. Seed Realistic Dev Data (Owner, 2 Supervisors, 3 Work Places, 7-Day History)
npm run seed:dev

# 3. View App in Laptop Web Browser (Fast UI Polish)
npm run dev:web

# 4. View App on Physical Phone (Expo Go QR Code)
npm run dev:mobile
```

---

## 1. Setting Up Neon Serverless Postgres (Step-by-Step for Beginners)

Neon provides free cloud PostgreSQL with serverless branches. Follow these exact steps:

### Step 1.1: Sign Up on Neon
1. Open your browser and go to [https://neon.tech](https://neon.tech).
2. Click **Sign Up** (you can sign up with your GitHub or Google account with 1 click).

### Step 1.2: Create Your Project
1. Once inside the Neon Console, click the **New Project** button.
2. In the modal:
   - **Project name:** Enter `dailyrecord`.
   - **Postgres version:** Leave as default (Postgres 16 or 17).
   - **Region:** Choose the region closest to you (e.g. `ap-southeast-1 Singapore` or `aws-eu-central-1 Frankfurt` or `aws-us-east-1`).
3. Click **Create Project**.

### Step 1.3: Create the `dev` Branch
1. In the left sidebar of your Neon dashboard, click **Branches**.
2. You will see a default branch named `main`.
3. Click the **New Branch** button in the top right.
4. Name the branch: `dev`.
5. Leave the parent branch as `main` and click **Create Branch**.

### Step 1.4: Copy Your Connection Strings
1. From the top navigation or branch selector, make sure **Branch: dev** is selected.
2. Click on the **Dashboard** or **Connection Details** widget on the project home page.
3. You will see a dropdown menu for **Connection string**:
   - Check the box or toggle that says **Pooled connection**. Copy this string. This is your `DATABASE_URL` (pooled).
   - Uncheck or select **Direct connection** (without connection pooling). Copy this string. This is your `DIRECT_URL`.
4. Your connection strings will look similar to this:
   - **Pooled:** `postgresql://neondb_owner:npg_xyz@ep-cold-star-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
   - **Direct:** `postgresql://neondb_owner:npg_xyz@ep-cold-star.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`

---

## 2. Setting Up Backend on Your Laptop

### Step 2.1: Configure Environment Variables
Inside the project root, open `backend/.env.example` and create `backend/.env`:
```bash
# In backend/.env:
PORT=4000
NODE_ENV=development

# Paste the strings you copied from Neon:
DATABASE_URL="postgresql://neondb_owner:npg_xyz@ep-xyz-pooler.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://neondb_owner:npg_xyz@ep-xyz.aws.neon.tech/neondb?sslmode=require"

# JWT Secret for sessions
JWT_SECRET="dailyrecord-super-secret-key-change-in-production-12345"
```

### Step 2.2: Install Dependencies & Run Database Migrations
Open PowerShell in the project directory (`D:\TECH\DailyREC`):
```powershell
npm install
npm run db:push
```
*`db:push` automatically pushes all tables from `backend/src/db/schema.ts` directly into your Neon `dev` database branch!*

### Step 2.3: Start the Backend Server
```powershell
npm run dev:backend
```
You will see:
`🚀 DailyRecord API listening on http://0.0.0.0:4000`
`✅ Database connection verified (Neon Postgres)`

---

## 3. Running on Your Mobile Phone (Expo Go)

### Step 3.1: Install Expo Go
1. On your Android phone, open Google Play Store.
2. Search for and install **Expo Go**.

### Step 3.2: Connect to Same Wi-Fi
Make sure your phone and your laptop are connected to the **same Wi-Fi network**.

### Step 3.3: Configure Local IP in Mobile App
1. On your laptop, open PowerShell and run:
   ```powershell
   ipconfig
   ```
2. Look for **IPv4 Address** (e.g. `192.168.1.15`).
3. Check `mobile/.env` or `mobile/src/constants/config.ts` and set:
   ```ts
   API_BASE_URL="http://192.168.1.15:4000"
   ```

### Step 3.4: Launch the Mobile App
In PowerShell:
```powershell
npm run dev:mobile
```
1. A QR code will appear in the terminal.
2. Open the **Expo Go** app on your phone.
3. Tap **Scan QR code** and scan the QR code on your laptop screen.
4. The DailyRecord app will bundle and open on your phone!
5. You will see the live status screen confirming:
   **"Backend: Connected"**
   **"Neon Postgres: Healthy"**
