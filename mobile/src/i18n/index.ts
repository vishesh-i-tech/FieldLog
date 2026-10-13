export type LanguageCode = 'hi' | 'en';

export const translations = {
  hi: {
    appName: 'FieldLog',
    mySites: 'मेरे काम', // Neutral wording for "sites"
    siteName: 'काम का नाम',
    selectWork: 'काम चुनें',
    allWorks: 'आज के सारे काम',
    todayRecord: 'आज का रिकॉर्ड',
    statusFull: 'पूरा दिन',
    statusHalf: 'आधा दिन',
    statusStopped: 'काम बंद',
    voiceNote: 'आवाज़ रिकॉर्ड करें',
    livePhotos: 'लाइव फोटो लें',
    issueChips: 'समस्याएं (यदि कोई हो)',
    submit: 'जमा करें',
    savedOnPhone: 'फ़ोन पर सुरक्षित',
    sending: 'भेज रहे हैं...',
    sent: 'भेज दिया गया',
    ownerSeen: 'मालिक ने देख लिया',
    needUpdate: 'नया अपडेट उपलब्ध है',
    pleaseUpdate: 'कृपया जारी रखने के लिए ऐप अपडेट करें',
    loginTitle: 'लॉग इन करें',
    phoneLabel: 'फ़ोन नंबर',
    pinLabel: '4-अंकों का पिन',
    enterPin: 'पिन दर्ज करें',
    loginButton: 'लॉग इन',
    sendFeedback: 'फ़ीडबैक भेजें',
  },
  en: {
    appName: 'FieldLog',
    mySites: 'My Work', // Neutral wording for "sites"
    siteName: 'Work Place Name',
    selectWork: 'Select Work Place',
    allWorks: "Today's Work Summary",
    todayRecord: "Today's Log",
    statusFull: 'Full Day',
    statusHalf: 'Half Day',
    statusStopped: 'Work Stopped',
    voiceNote: 'Record Voice Note',
    livePhotos: 'Take Live Photos',
    issueChips: 'Issues / Blockers (if any)',
    submit: 'Submit Log',
    savedOnPhone: 'Saved on phone',
    sending: 'Sending...',
    sent: 'Sent',
    ownerSeen: 'Seen by Owner',
    needUpdate: 'Update Available',
    pleaseUpdate: 'Please update your app to continue',
    loginTitle: 'Log In',
    phoneLabel: 'Phone Number',
    pinLabel: '4-Digit PIN',
    enterPin: 'Enter PIN',
    loginButton: 'Log In',
    sendFeedback: 'Send Feedback',
  },
};

let currentLang: LanguageCode = 'hi';

export function setLanguage(lang: LanguageCode) {
  currentLang = lang;
}

export function getLanguage(): LanguageCode {
  return currentLang;
}

export function t(key: keyof typeof translations['hi']): string {
  return translations[currentLang][key] || translations['en'][key] || key;
}
