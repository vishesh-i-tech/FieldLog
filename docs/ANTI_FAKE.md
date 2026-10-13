# Anti-Fake Entry Measures & Realistic Boundaries

A primary goal of DailyRecord is accountability. However, client-side software alone **cannot 100% eliminate fraud** if a user is determined to circumvent it. Our approach is to **increase friction**, **capture undeniable audit signals**, and **neutrally flag discrepancies** for the Owner rather than making false accusations or blocking field workers.

---

## 1. What We Protect Against & How

| Vector | Protection Mechanism | Action Taken |
|---|---|---|
| **Uploading old photos from gallery** | Live camera viewfinder only (`expo-camera`). No gallery picker exists in the app bundle. | Hard enforcement. Gallery import is structurally impossible in the app UI. |
| **Android Mock / Fake Location Apps** | Detect Android `isFromMockProvider` or mock location flags via native location APIs. | Captured in `flags: {"mock_location": true}`. Displayed to owner as *"Location unverified"*. |
| **Tampered Device Clock (Submitting late)** | Compare device `captured_at` timestamp with server `received_at` upon arrival. | If delta exceeds 15 minutes, flagged as `time_skew`. Displayed to owner as *"Synced late (device clock difference)"*. |
| **Submitting from Home instead of Jobsite** | Calculate distance between photo GPS coordinates and site's registered coordinates. | If distance > 500m, flagged as `distance_warning`. Displayed to owner as *"Location far from site"*. Never blocks submission. |

---

## 2. What This Does NOT Protect Against (Honest Limitations)

1. **Taking a photo of another photo / computer screen:**
   - A supervisor can take a live photo of a photograph on another phone or computer screen. AI cannot reliably detect this without false positives.
2. **Rooted / Modified Android Devices:**
   - On rooted phones with specialized Xposed modules or custom OS ROMs, low-level GPS hooks can forge location data before it reaches the OS API.
3. **Bad GPS reception (indoors, basement, heavy rain):**
   - High GPS inaccuracy (e.g. accuracy > 100m) can occur naturally in basements or high-rise concrete shafts. The app records the accuracy radius (`accuracy_m`) so the owner sees whether poor signal caused a drift.

---

## 3. Communication Philosophy: Neutral Language

We **never** accuse the supervisor of cheating or dishonesty in the UI.
- ❌ Do NOT display: *"Fake location detected!"* or *"Supervisor cheating"*.
- ✅ DO display: *"Location unverified"* or *"GPS signal weak at capture"*.
