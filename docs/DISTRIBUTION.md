# FieldLog Distribution & Release Guide (Android APK & Play Store)

This guide explains how to generate standalone Android APKs for internal testers, distribute over-the-air (OTA) updates, and transition to the Google Play Store in the future.

---

## Hinglish me samjho
Abhi shuruati mahino me hum Google Play Store par direct app nahi daal rahe hain. Hum ek **Android APK file** banayenge jo hum sidhe apne 10-15 field testers ya mistriyon/supervisors ke phone par install karwayenge (WhatsApp ya link ke zariye). 
Jab testers install karenge, to Android puchega 'Install unknown apps' aur Google Play Protect warning dikha sakta hai—usko 'Install anyway' karna hoga. 
Agar app me humne koi chhota JavaScript/UI change kiya, to hum **OTA (Over-the-Air) Update** bhejenge jisse bina naya APK download kiye app khud update ho jayega. 
Lekin agar koi naya hardware permission (Camera, GPS) ya native package joda, tab naya APK dena padega. 
Baad me jab hum Play Store par jayenge, to yahi setup Google Play Bundle (.aab) me convert ho jayega.

---

## 1. Build Profiles in `eas.json`

| Profile | Target Output | Purpose | API Base URL |
|---|---|---|---|
| `development` | Dev Client APK | Local coding with native debuggers | `http://<laptop-ip>:4000` |
| `preview` | Standalone `.apk` | Internal field testers (months of testing) | `https://api-preview.fieldlog.app` (Hosted HTTPS) |
| `production` | Android `.aab` | Google Play Store release (V2) | `https://api.fieldlog.app` (Hosted HTTPS) |

---

## 2. Generating the Tester APK

### Prerequisites (Run Once)
```bash
npm install -g eas-cli
eas login
```

### Build Command for Android APK
Run from the `mobile/` directory:
```bash
eas build --profile preview --platform android
```
- EAS Build creates an installable `.apk` file in the Expo Cloud.
- When finished, EAS provides a **direct download link and QR code**.
- Download this `.apk` to send to testers.

> [!IMPORTANT]
> **Keystore Backup:** EAS securely generates and manages your Android Keystore credentials in the cloud. Run `eas credentials` to view or download a local backup of your keystore. Never lose this, as Google Play Store requires the exact same key for lifetime app updates.

---

## 3. How Testers Install the APK

1. **Send Link / File:** Send the APK file or Expo download link to the tester on WhatsApp.
2. **Allow Unknown Apps:** 
   - When the tester taps the `.apk`, Android will prompt: *"For your security, your phone is not allowed to install unknown apps from this source."*
   - Tap **Settings** → Enable **"Allow from this source"** → Go back and tap **Install**.
3. **Google Play Protect Warning:**
   - Because the app is not yet signed by Google's public store, Google Play Protect may display: *"Unrecognized app details"*.
   - Tap **"More details"** → Tap **"Install anyway"**.
4. **App Permissions:** On first launch, the tester will be greeted with the Consent Screen explaining Camera, Location, and Voice usage.

---

## 4. Updates During Testing: OTA vs New APK

### JavaScript-Only Updates (OTA via EAS Update)
If you fix a UI bug, change Hindi text, or update business logic **without adding new native packages or permissions**:
```bash
eas update --branch preview --message "Fix supervisor submit button"
```
- The phone downloads the update silently in the background on next app launch.
- No need to reinstall the APK!

### When a New APK is Strictly Required:
You **must** build and distribute a new `.apk` if you:
- Add a new native npm package (e.g., adding a new hardware sensor).
- Change native permissions in `app.json` (e.g., Bluetooth, Background Location).
- Update the Expo SDK version or `runtimeVersion`.

---

## 5. Minimum Supported App Version Check

The backend exposes `GET /version` returning:
```json
{
  "apiVersion": "0.1.0",
  "minAppVersion": "1.0.0",
  "latestAppVersion": "1.0.1",
  "forceUpdate": false
}
```
If an older installed APK's version is lower than `minAppVersion`, the app displays a friendly full-screen lock:
- **Hindi:** *"कृपया जारी रखने के लिए नया अपडेट इनस्टॉल करें"* (Please install the new update to continue).
- Provides a direct link to download the latest APK.

---

## 6. Moving to Google Play Store Later (Phase 10)

When ready for public Play Store launch:
1. **Google Play Console Account:** $25 one-time developer registration fee.
2. **Package Name:** Locked to `com.fieldlog.app` (or custom brand domain). Cannot be changed after registration.
3. **Build Android App Bundle (.aab):**
   ```bash
   eas build --profile production --platform android
   ```
4. **Play App Signing:** Google manages production app signing keys automatically from the AAB.
5. **Data Safety Form:** Disclose collection of location (for geo-tagging), microphone (for voice notes), and camera (for live progress photos).
6. **Privacy Policy URL:** Hosted public webpage linked in Google Play Console.

---

## 7. Tester Onboarding Checklist

- [ ] Phone runs Android 8.0 or higher.
- [ ] Internet connectivity verified (Wi-Fi or 4G).
- [ ] Unknown app installations allowed in Android settings.
- [ ] First-launch permissions granted (Camera, Location, Audio).
- [ ] Supervisor 4-digit PIN tested and verified.
- [ ] "Send Feedback" button confirmed working (opens pre-filled message with app version).
