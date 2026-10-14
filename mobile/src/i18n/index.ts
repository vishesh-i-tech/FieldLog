import { useState, useEffect } from 'react';

export type LanguageCode = 'en' | 'hi';

export const translations = {
  en: {
    appName: 'FieldLog',
    mySites: 'My Work Places',
    siteName: 'Work Place Name',
    selectWork: 'Select Work Place',
    allWorks: "Today's Work Summary",
    todayRecord: "Today's Daily Record",
    statusSectionTitle: '1. Select Work Status *',
    statusFull: 'Full Day',
    statusFullSub: 'Standard Shift',
    statusHalf: 'Half Day',
    statusHalfSub: 'Partial Shift',
    statusStopped: 'Work Stopped',
    statusStoppedSub: 'Halted',
    statusPending: 'Pending',
    photosSectionTitle: '2. Live Site Photos',
    photosHint: 'Capture live in-app photos with automatic GPS and timestamp. Gallery uploads are disabled.',
    takeLivePhoto: 'Take Live Photo',
    liveCamera: 'Live Camera',
    voiceSectionTitle: '3. Voice Note Update',
    voiceHint: "Record a verbal summary of the day's progress (max 60 sec). The business owner can listen directly.",
    tapToRecord: 'Tap to Record Voice',
    tapToRecordSub: 'Max 60 seconds',
    recording: 'Recording in progress... Tap to Stop',
    stopRecording: 'Stop Recording (Save)',
    todayVoiceNote: "Today's Voice Note",
    playPreview: 'Play Preview',
    pause: 'Pause',
    reRecord: 'Delete & Re-record',
    issuesSectionTitle: '4. Any Obstacles or Issues? (Optional)',
    issuesHint: 'Select any issues that affected site work today (Optional):',
    submit: 'Submit Daily Record',
    submitting: 'Submitting Record...',
    sent: 'Submitted Successfully',
    switchToOwner: '👑 Switch to Owner Review Dashboard',
    ownerSubtitle: 'Owner Overview & Site Inspection Mode',
    switchToSupervisor: '📝 Supervisor',
    logout: 'Log Out',
    needUpdate: 'Update Available',
    loginTitle: 'Sign In',
    phoneLabel: 'Phone Number',
    pinLabel: '4-Digit PIN',
    // Owner Dashboard
    dailyOverview: 'Daily Overview',
    refresh: 'Refresh',
    siteSubmissions: 'Site Submissions',
    reportsReceived: 'reports received',
    loadingSites: 'Loading site submission data...',
    reportTime: 'Reported at',
    noReportYet: '⚠️ No report submitted yet (Pending)',
    viewDetails: 'Tap to Inspect',
    recordDetailTitle: 'Site Record Detail',
    statusLabel: 'Status',
    issuesReported: 'Issues Reported',
    gpsVerified: 'GPS Location Verified',
    close: 'Close',
    markReviewed: 'Reviewed',
    acknowledge: 'Acknowledge Report',
    selectStatusAlert: 'Please select work status (Full Day / Half Day / Work Stopped).',
    noPhotoAlert: 'Submit Without Photos?',
    noPhotoConfirm: 'Do you want to submit this record without capturing live photos?',
    takePhoto: 'Take Photo',
    yesSubmit: 'Yes, Submit',
    noVoiceAlert: 'No Voice Note',
    noVoiceConfirm: 'Do you want to submit this record without a voice note?',
    recordVoice: 'Record Voice',
    maxPhotosAlert: 'You can attach up to 6 photos per record.',
  },
  hi: {
    appName: 'FieldLog',
    mySites: 'मेरे कार्यस्थल',
    siteName: 'काम का नाम',
    selectWork: 'काम चुनें',
    allWorks: 'आज के सारे काम',
    todayRecord: 'आज का रिकॉर्ड',
    statusSectionTitle: '1. काम की स्थिति चुनें *',
    statusFull: 'पूरा दिन',
    statusFullSub: 'Full Day',
    statusHalf: 'आधा दिन',
    statusHalfSub: 'Half Day',
    statusStopped: 'काम बंद',
    statusStoppedSub: 'Stopped',
    statusPending: 'बाकी है',
    photosSectionTitle: '2. लाइव फोटो (Live Photos)',
    photosHint: 'लाइव कैमरा से फोटो लें (गैलरी से अपलोड नहीं हो सकता)। जीपीएस लोकेशन अपने आप जुड़ जाएगी।',
    takeLivePhoto: 'लाइव फोटो लें',
    liveCamera: 'Live Camera',
    voiceSectionTitle: '3. आवाज संदेश (Voice Note)',
    voiceHint: 'आज के काम का ब्योरा बोलकर बताएं (अधिकतम 60 सेकंड)। मालिक यह आवाज सुन सकते हैं।',
    tapToRecord: 'माइक दबाकर बोलें',
    tapToRecordSub: 'Tap to record voice (Max 60 sec)',
    recording: 'रिकॉर्डिंग चालू है... (Recording)',
    stopRecording: 'रिकॉर्डिंग रोकें (Stop & Save)',
    todayVoiceNote: 'आज का आवाज संदेश',
    playPreview: 'सुनें (Play Preview)',
    pause: 'रोकें (Pause)',
    reRecord: 'हटाएं (Re-record)',
    issuesSectionTitle: '4. कोई समस्या है? (वैकल्पिक)',
    issuesHint: 'यदि कोई समस्या है तो चुनें (वैकल्पिक / Optional):',
    submit: 'जमा करें (Submit Daily Record)',
    submitting: 'भेज रहे हैं... (Sending)',
    sent: 'भेज दिया गया (Sent)',
    switchToOwner: '👑 मालिक / एडमिन मोड देखें',
    ownerSubtitle: 'रिपोर्ट देखने वाला डैशबोर्ड (Owner Review View)',
    switchToSupervisor: '📝 सुपरवाइज़र',
    logout: 'लॉग आउट',
    needUpdate: 'नया अपडेट उपलब्ध है',
    loginTitle: 'लॉग इन करें',
    phoneLabel: 'फ़ोन नंबर',
    pinLabel: '4-अंकों का पिन',
    // Owner Dashboard
    dailyOverview: 'आज का दिन (Daily Overview)',
    refresh: 'रिफ्रेश',
    siteSubmissions: 'कार्यस्थल रिपोर्ट (Site Submissions)',
    reportsReceived: 'रिपोर्ट प्राप्त',
    loadingSites: 'कार्यस्थलों का डेटा लोड हो रहा है...',
    reportTime: 'रिपोर्ट समय',
    noReportYet: '⚠️ अभी तक कोई रिपोर्ट नहीं आई (Pending)',
    viewDetails: 'विवरण देखें',
    recordDetailTitle: 'दैनिक रिकॉर्ड विवरण',
    statusLabel: 'काम की स्थिति',
    issuesReported: 'समस्याएं (Issues)',
    gpsVerified: 'जीपीएस लोकेशन सत्यापित',
    close: 'बंद करें',
    markReviewed: 'समीक्षित चिह्नित (Reviewed)',
    acknowledge: 'स्वीकार करें (Acknowledge)',
    selectStatusAlert: 'कृपया काम की स्थिति (पूरा दिन / आधा दिन / काम बंद) चुनें।',
    noPhotoAlert: 'फोटो के बिना भेजना है?',
    noPhotoConfirm: 'क्या आप बिना लाइव फोटो के यह रिकॉर्ड भेजना चाहते हैं?',
    takePhoto: 'फोटो लें',
    yesSubmit: 'हाँ, भेजें',
    noVoiceAlert: 'आवाज संदेश नहीं है',
    noVoiceConfirm: 'क्या आप बिना आवाज रिकॉर्ड किए यह रिकॉर्ड जमा करना चाहते हैं?',
    recordVoice: 'आवाज रिकॉर्ड करें',
    maxPhotosAlert: 'आप एक रिकॉर्ड में अधिकतम 6 फोटो जोड़ सकते हैं। (Max 6 photos)',
  },
};

let currentLang: LanguageCode = 'en'; // Default to English mode
const listeners = new Set<(lang: LanguageCode) => void>();

export function setLanguage(lang: LanguageCode) {
  currentLang = lang;
  listeners.forEach((fn) => fn(lang));
}

export function getLanguage(): LanguageCode {
  return currentLang;
}

export function subscribeLanguage(callback: (lang: LanguageCode) => void): () => void {
  listeners.add(callback);
  callback(currentLang);
  return () => {
    listeners.delete(callback);
  };
}

export function t(key: keyof typeof translations['en']): string {
  return translations[currentLang][key] || translations['en'][key] || (key as string);
}

export function useLanguage() {
  const [lang, setLangState] = useState<LanguageCode>(currentLang);

  useEffect(() => {
    return subscribeLanguage((newLang) => setLangState(newLang));
  }, []);

  const changeLanguage = (newLang: LanguageCode) => {
    setLanguage(newLang);
  };

  return { lang, changeLanguage, t };
}
