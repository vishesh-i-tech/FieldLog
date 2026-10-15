import { useState, useEffect } from 'react';

export type LanguageCode = 'en' | 'hi';

export const translations = {
  en: {
    appName: 'FieldLog',
    admin: 'Owner',
    fieldOfficer: 'Field Officer',
    mySites: 'My Work Places',
    siteName: 'Work Place',
    selectWork: 'Select Work Place',
    allWorks: "Today's Work",
    todayRecord: 'Daily Record',
    statusSectionTitle: 'Work Status',
    statusFull: 'Full Day',
    statusFullSub: '',
    statusHalf: 'Half Day',
    statusHalfSub: '',
    statusStopped: 'Work Stopped',
    statusStoppedSub: '',
    statusPending: 'Pending',
    photosSectionTitle: 'Photos',
    photosHint: 'GPS is tagged automatically.',
    takeLivePhoto: 'Take Photo',
    liveCamera: 'Camera',
    voiceSectionTitle: 'Voice Note',
    voiceHint: 'Record quick voice (max 60s)',
    tapToRecord: 'Tap to Record',
    tapToRecordSub: 'Max 60 sec',
    recording: 'Recording... Tap to stop',
    stopRecording: 'Stop',
    todayVoiceNote: 'Voice Note',
    playPreview: 'Play',
    pause: 'Pause',
    reRecord: 'Reset',
    issuesSectionTitle: 'Issues',
    issuesHint: 'Select or add today\'s issue:',
    customIssue: 'Add Custom Issue',
    enterCustomIssue: 'Type issue description...',
    submit: 'Submit',
    submitting: 'Submitting...',
    sent: 'Submitted',
    switchToOwner: 'Owner',
    ownerSubtitle: 'Submissions & management',
    switchToSupervisor: 'Field Officer',
    logout: 'Log Out',
    needUpdate: 'Update Available',
    loginTitle: 'Sign In',
    phoneLabel: 'Phone Number',
    pinLabel: '4-Digit PIN',
    // Owner Dashboard
    dailyOverview: 'Overview',
    refresh: 'Refresh',
    siteSubmissions: 'Site Records',
    reportsReceived: 'reports',
    loadingSites: 'Loading...',
    reportTime: 'Time',
    noReportYet: 'Pending',
    viewDetails: 'View',
    recordDetailTitle: 'Record Details',
    statusLabel: 'Status',
    issuesReported: 'Issues',
    gpsVerified: 'GPS OK',
    close: 'Close',
    markReviewed: 'Reviewed',
    acknowledge: 'Mark Reviewed',
    selectStatusAlert: 'Please select work status.',
    noPhotoAlert: 'Submit Without Photos?',
    noPhotoConfirm: 'Do you want to submit without taking any photos?',
    takePhoto: 'Take Photo',
    yesSubmit: 'Submit Anyway',
    noVoiceAlert: 'No Voice Note',
    noVoiceConfirm: 'Submit without a voice note?',
    recordVoice: 'Record',
    maxPhotosAlert: 'Max 6 photos.',
    addWorkPlace: 'Add',
    addFieldOfficer: 'Add Field Officer',
    assignFieldOfficer: 'Assign Officer',
    siteCategory: 'Site Category',
    addNewOfficer: '+ Add New Officer',
    workPlaceName: 'Site Name',
    location: 'Location',
    officerName: 'Officer Name',
    save: 'Save',
    cancel: 'Cancel',
  },
  hi: {
    appName: 'FieldLog',
    admin: 'Owner',
    fieldOfficer: 'फील्ड ऑफिसर',
    mySites: 'कार्यस्थल',
    siteName: 'कार्यस्थल',
    selectWork: 'कार्यस्थल चुनें',
    allWorks: 'आज का काम',
    todayRecord: 'दैनिक रिपोर्ट',
    statusSectionTitle: 'काम की स्थिति',
    statusFull: 'पूरा दिन',
    statusFullSub: '',
    statusHalf: 'आधा दिन',
    statusHalfSub: '',
    statusStopped: 'काम बंद',
    statusStoppedSub: '',
    statusPending: 'बाकी',
    photosSectionTitle: 'फोटो',
    photosHint: 'जीपीएस लोकेशन अपने आप दर्ज होगी।',
    takeLivePhoto: 'फोटो लें',
    liveCamera: 'कैमरा',
    voiceSectionTitle: 'आवाज संदेश',
    voiceHint: 'बोलकर बताएं (अधिकतम 60 से.)',
    tapToRecord: 'बोलने के लिए दबाएं',
    tapToRecordSub: 'अधिकतम 60 सेकंड',
    recording: 'रिकॉर्डिंग... रोकने के लिए दबाएं',
    stopRecording: 'रोकें',
    todayVoiceNote: 'आवाज संदेश',
    playPreview: 'सुनें',
    pause: 'रोकें',
    reRecord: 'हटाएं',
    issuesSectionTitle: 'समस्या',
    issuesHint: 'आज की समस्या चुनें या नई जोड़ें:',
    customIssue: 'नई समस्या जोड़ें',
    enterCustomIssue: 'समस्या का विवरण लिखें...',
    submit: 'जमा करें',
    submitting: 'जमा हो रही है...',
    sent: 'जमा हो गई',
    switchToOwner: 'Owner',
    ownerSubtitle: 'रिपोर्ट और प्रबंधन',
    switchToSupervisor: 'फील्ड ऑफिसर',
    logout: 'लॉग आउट',
    needUpdate: 'अपडेट उपलब्ध',
    loginTitle: 'लॉग इन करें',
    phoneLabel: 'फ़ोन नंबर',
    pinLabel: '4-अंकों का पिन',
    // Owner Dashboard
    dailyOverview: 'अवलोकन',
    refresh: 'रिफ्रेश',
    siteSubmissions: 'साइट रिपोर्ट',
    reportsReceived: 'रिपोर्ट',
    loadingSites: 'लोड हो रहा है...',
    reportTime: 'समय',
    noReportYet: 'बाकी है',
    viewDetails: 'देखें',
    recordDetailTitle: 'रिपोर्ट विवरण',
    statusLabel: 'स्थिति',
    issuesReported: 'समस्याएं',
    gpsVerified: 'जीपीएस सत्यापित',
    close: 'बंद करें',
    markReviewed: 'समीक्षित',
    acknowledge: 'स्वीकृत करें',
    selectStatusAlert: 'कृपया काम की स्थिति चुनें।',
    noPhotoAlert: 'बिना फोटो जमा करें?',
    noPhotoConfirm: 'क्या आप बिना फोटो लिए जमा करना चाहते हैं?',
    takePhoto: 'फोटो लें',
    yesSubmit: 'हाँ, जमा करें',
    noVoiceAlert: 'आवाज संदेश नहीं है',
    noVoiceConfirm: 'क्या आप बिना आवाज रिकॉर्ड किए जमा करना चाहते हैं?',
    recordVoice: 'आवाज रिकॉर्ड करें',
    maxPhotosAlert: 'अधिकतम 6 फोटो।',
    addWorkPlace: 'Add',
    addFieldOfficer: 'फील्ड ऑफिसर जोड़ें',
    assignFieldOfficer: 'अधिकारी नियुक्त करें',
    siteCategory: 'साइट की श्रेणी',
    addNewOfficer: '+ नया अधिकारी जोड़ें',
    workPlaceName: 'कार्यस्थल का नाम',
    location: 'स्थान',
    officerName: 'अधिकारी का नाम',
    save: 'सहेजें',
    cancel: 'रद्द करें',
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
