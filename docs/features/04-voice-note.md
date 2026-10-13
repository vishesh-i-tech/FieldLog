# Feature 04: Voice Note Recording (Audio)

---

## 1. What this feature does
This feature allows field supervisors to record a concise voice note (up to 60 seconds) describing the day's events, material arrivals, delays, or obstacles without typing a single word. The audio recording includes a live pulsing timer, progress bar, instant in-app playback preview, and re-record/delete capability. The recorded audio is streamed to object storage (presigned URL) and linked to the daily record in the `media` table (`kind: 'audio'`). It works on physical phones via `expo-audio` and inside laptop web browsers via `MediaRecorder` with an automated dev-mock audio generator.

---

## 2. Hinglish me samjho
Supervisor log aksar lambi typing nahi karna chahte ya unhe phone me lambe messages type karne me dikkat aati hai. Is feature ki madad se wo bas ek bada button dabakar bolna shuru karte hain: *"Aaj cement ke 50 katte aa gaye, 4 mistri aur 6 leber the, barish ki wajah se 3 baje kaam rokna pada."* 60 second tak ka live timer chalta hai, bolte samay laal rang ka recording indicator dikhta hai. Bolne ke baad wo 'सुनें (Play)' button daba kar apni awaaz sun sakte hain. Agar kuch galat bol diya to 'हटाएं (Delete)' karke dobara record kar sakte hain. Laptop browser me test karte waqt browser ka mic chalta hai aur mic na hone par dev mock awaaz se testing bina ruke chalti hai.

---

## 3. Who uses it
- **Supervisor:** Records a voice note in their native language (Hindi/regional) in under 60 seconds while at the work location.
- **Owner:** Listens to the voice note directly from their laptop or phone dashboard, or reads the AI-generated transcription and summary (Phase 7).

**User Steps (Supervisor):**
1. Open Today's Record form (`/record`).
2. Scroll to section 3: **"3. आवाज संदेश (Voice Note)"**.
3. Tap **"माइक दबाकर बोलें (Tap to record voice)"**.
4. Speak clearly while the pulsing red timer counts up (`00:15 / 01:00`).
5. Tap **"रिकॉर्डिंग रोकें (Stop & Save)"** when done (or it auto-stops at 60s).
6. Tap **"सुनें (Play Preview)"** to verify audio clarity.
7. Tap **"जमा करें (Submit Daily Record)"** to upload audio along with photos and status.

---

## 4. How it works inside
1. **Audio Capture Engine:**
   - **On Web (`Platform.OS === 'web'`):** Uses the HTML5 `MediaRecorder` API (`audio/webm` or `audio/mp4`). If no microphone permission or hardware exists in dev, falls back to a synthetic 520Hz PCM WAV audio generator marked with a `DEV MOCK` badge.
   - **On Native Android / iOS:** Uses Expo SDK 52's `expo-audio` native module (`AudioRecorder`) configured for 44.1kHz mono AAC (`audio/m4a`) compressed to ~150KB.
2. **Presigned Upload Request:**
   - Supervisor requests `POST /api/v1/uploads/presign` with `kind: 'audio'` and `mimeType` (`audio/webm` or `audio/m4a`).
   - Server validates supervisor's site assignment and returns a signed 5-minute PUT URL.
3. **Audio Upload & Storage:**
   - The audio file is uploaded to the storage provider (local stub in dev, Cloudflare R2 in production).
4. **Record Association:**
   - In `POST /api/v1/records`, the `audio` object is attached with `storageKey`, `mimeType`, `sizeBytes`, and `durationSeconds`.
   - The server creates a row in `media` (`kind: 'audio'`) and sets `missing_voice = false` on `daily_records`.

---

## 5. Files and code involved
- `mobile/app/record.tsx`: Recording UI, live timer, progress bar, play/pause controls, re-record trigger, and submit payload.
- `mobile/src/services/audio.service.ts`: Cross-platform audio abstraction (Web `MediaRecorder` + fallback synthetic WAV generator; Native `expo-audio`).
- `backend/src/routes/uploads.ts`: Validates audio MIME types (`m4a`, `mp4`, `webm`, `aac`) and issues presigned upload URLs.
- `backend/src/routes/records.ts`: Inserts audio into `media` table and updates `missing_voice` boolean.
- `backend/src/tests/records.test.ts`: Automated test verifying audio presigning, upload payload validation, and database linkage.

---

## 6. Database tables touched
- `daily_records`: Sets `missing_voice` flag (`false` if audio provided, `true` if omitted).
- `media`: Inserts audio row (`kind: 'audio'`, `storage_key`, `mime_type`, `size_bytes`, `duration_seconds`, `captured_at`).

---

## 7. API endpoints used
- `POST /api/v1/uploads/presign`: Generates presigned URL for audio file (`kind: 'audio'`).
- `POST /api/v1/records`: Submits daily record including audio metadata.
- `GET /api/v1/records/:id`: Retrieves full record details including audio player URL in `media`.

---

## 8. Edge cases and what happens
- **No audio recorded:** If supervisor submits without voice note, app confirms: *"आवाज संदेश नहीं है, क्या आप बिना आवाज रिकॉर्ड किए यह रिकॉर्ड जमा करना चाहते हैं?"*. If yes, sets `missing_voice = true`.
- **60-second limit reached:** The recording automatically stops at exactly 60 seconds (`01:00`) and transitions to the preview player so recordings cannot exceed size budgets.
- **Accidental mic permission denial:** On web dev, automatically falls back to synthetic mock audio with a yellow `DEV MOCK` badge; on native, prompts with a clear Hindi explanation to enable microphone permissions in Android Settings.
- **Microphone unplugged or interrupted during call:** Catch blocks handle recording errors gracefully, restoring the UI to the idle state.

---

## 9. How to test it by hand on your laptop or phone
1. **On Laptop Browser (`npm run dev:web`):**
   - Open `http://localhost:8081` in your browser.
   - Click **"आज का रिकॉर्ड भरें (Test Today's Record)"**.
   - Under section 3, click **"माइक दबाकर बोलें"**.
   - Speak into your laptop mic for 5 seconds. See the timer tick and the red bar grow.
   - Click **"रिकॉर्डिंग रोकें (Stop & Save)"**.
   - Click **"सुनें (Play Preview)"** and verify playback from your laptop speakers.
   - Click **"जमा करें (Submit Daily Record)"** and see the green confirmation!
2. **On Physical Phone (`npm run dev:mobile`):**
   - Open Expo Go, tap **"आज का रिकॉर्ड भरें"**, tap the red mic button, speak, review, and submit.

---

## 10. Known limits and future improvements
- Background offline audio sync queue via SQLite will be added in Phase 5.
- Speech-to-text AI transcription (Groq Whisper Hindi) and LLM bulleted summaries will be added in Phase 7.
