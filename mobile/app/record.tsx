import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  TextInput,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import {
  getCurrentGpsLocation,
  compressPhoto,
  generateDevMockPhoto,
  pickRealDevicePhoto,
  CapturedPhoto,
} from '../src/services/photo.service';
import {
  startAudioRecording,
  stopAudioRecording,
  playAudio,
  stopAudioPlayback,
  requestMicrophonePermission,
  RecordedAudioResult,
} from '../src/services/audio.service';
import { generateUuidV4 } from '../src/utils/uuid';
import { DEFAULT_API_BASE_URL } from '../src/constants/config';
import { useLanguage } from '../src/i18n';
import {
  initAuthSession,
  getAuthTokens,
  loginSupervisor,
  loginOwner,
} from '../src/services/auth.state';

interface IssueChip {
  id: string;
  labelHi: string;
  labelEn: string;
  icon?: string;
}

interface SiteItem {
  id: string;
  name: string;
  locationText?: string;
}

export default function RecordSubmissionScreen() {
  const router = useRouter();
  const { lang, changeLanguage, t } = useLanguage();
  const [supervisorName, setSupervisorName] = useState('Field Officer');

  // Work Places list and selected work place
  const [assignedSites, setAssignedSites] = useState<SiteItem[]>([]);
  const [siteName, setSiteName] = useState('South Depot & Warehouse');
  const [siteId, setSiteId] = useState('00000000-0000-0000-0000-000000000001');
  const [workplaceTrayVisible, setWorkplaceTrayVisible] = useState(false);

  // Form State
  const [status, setStatus] = useState<'full' | 'half' | 'stopped' | null>(null);
  const [issueChips, setIssueChips] = useState<IssueChip[]>([
    { id: '1', labelHi: 'सामान / स्टॉक नहीं आया', labelEn: 'Material / Stock not arrived' },
    { id: '2', labelHi: 'कम लोग / स्टाफ कम', labelEn: 'Less manpower / staff' },
    { id: '3', labelHi: 'बारिश / मौसम खराब', labelEn: 'Rain / Bad weather' },
    { id: '4', labelHi: 'मशीन / गाड़ी खराब', labelEn: 'Machine / Vehicle breakdown' },
    { id: '5', labelHi: 'पैसे चाहिए', labelEn: 'Need funds / cash' },
    { id: '6', labelHi: 'अन्य समस्या', labelEn: 'Other issue' },
  ]);
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [issuesTrayVisible, setIssuesTrayVisible] = useState(false);
  const [customIssueInput, setCustomIssueInput] = useState('');

  // Photos State & Viewing Modal
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [photoPickerModalVisible, setPhotoPickerModalVisible] = useState(false);
  const [inspectingPhoto, setInspectingPhoto] = useState<CapturedPhoto | null>(null);
  const [locationToast, setLocationToast] = useState<string | null>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<RecordedAudioResult | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Native Camera modal state
  const [cameraVisible, setCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitStatusText, setSubmitStatusText] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [submissionFeedback, setSubmissionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Admin Password Protection Modal
  const [adminAuthModalVisible, setAdminAuthModalVisible] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [verifyingAdmin, setVerifyingAdmin] = useState(false);

  const handleVerifyAdminSwitch = async () => {
    if (!adminPasswordInput.trim()) {
      setAdminAuthError(lang === 'hi' ? 'पासवर्ड दर्ज करें' : 'Please enter admin password');
      return;
    }
    setVerifyingAdmin(true);
    setAdminAuthError('');
    try {
      await loginOwner('owner@fieldlog.dev', adminPasswordInput.trim());
      setAdminAuthModalVisible(false);
      setAdminPasswordInput('');
      router.push('/owner');
    } catch {
      setAdminAuthError(
        lang === 'hi'
          ? 'गलत एडमिन पासवर्ड। केवल अधिकृत एडमिन ही स्विच कर सकते हैं।'
          : 'Incorrect admin password. Access denied.'
      );
    } finally {
      setVerifyingAdmin(false);
    }
  };

  const todayDateStr = new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  // Load supervisor session, assigned sites, and issue chips
  useEffect(() => {
    initAuthSession().then(async (user) => {
      let activeUser = user;
      let tokens = getAuthTokens();

      if (!activeUser || !tokens || activeUser.role !== 'supervisor') {
        try {
          activeUser = await loginSupervisor('9811111111', '1234');
          tokens = getAuthTokens();
        } catch {
          router.replace('/login');
          return;
        }
      }

      setSupervisorName(activeUser.name);

      if (tokens) {
        try {
          // 1. Fetch assigned sites for this supervisor
          const sitesRes = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/sites`, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          });
          if (sitesRes.ok) {
            const data = await sitesRes.json();
            if (data.sites && data.sites.length > 0) {
              setAssignedSites(data.sites);
              setSiteName(data.sites[0].name);
              setSiteId(data.sites[0].id);
            }
          }

          // 2. Fetch issue chips
          const issuesRes = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/issue-types`, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          });
          if (issuesRes.ok) {
            const issuesData = await issuesRes.json();
            if (issuesData.issueTypes && issuesData.issueTypes.length > 0) {
              setIssueChips(issuesData.issueTypes.map((it: any) => ({
                id: it.id,
                labelHi: it.labelHi,
                labelEn: it.labelEn,
                icon: it.icon,
              })));
            }
          }
        } catch (err) {
          console.error('Failed to load supervisor data:', err);
        }
      }
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopAudioPlayback();
    };
  }, []);

  // Toggle issue chip selection
  const toggleIssueChip = (id: string) => {
    setSelectedIssueIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Add custom issue from tray
  const handleAddCustomIssue = () => {
    const text = customIssueInput.trim();
    if (!text) return;

    const existing = issueChips.find(
      (c) => c.labelEn.toLowerCase() === text.toLowerCase() || c.labelHi === text
    );

    if (existing) {
      if (!selectedIssueIds.includes(existing.id)) {
        setSelectedIssueIds((prev) => [...prev, existing.id]);
      }
    } else {
      const newChip: IssueChip = {
        id: text,
        labelEn: text,
        labelHi: text,
        icon: '⚠️',
      };
      setIssueChips((prev) => [...prev, newChip]);
      setSelectedIssueIds((prev) => [...prev, text]);
    }

    setCustomIssueInput('');
    setIssuesTrayVisible(false);
  };

  // Open photo options (Camera or Gallery)
  const handleOpenPhotoOptions = async () => {
    if (photos.length >= 6) {
      Alert.alert(lang === 'hi' ? 'अधिकतम फोटो' : 'Maximum Photos', t('maxPhotosAlert'));
      return;
    }

    if (Platform.OS === 'web') {
      setPhotoPickerModalVisible(true);
      return;
    }

    // Native Platform (Android / iOS)
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          lang === 'hi' ? 'कैमरा अनुमति आवश्यक है' : 'Camera Permission Required',
          lang === 'hi' ? 'फोटो खींचने के लिए कैमरा अनुमति दें।' : 'Please grant camera access to capture site photos.'
        );
        return;
      }
    }
    setCameraVisible(true);
  };

  // Handler: Take photo with live camera on web
  const handlePickFromCamera = async () => {
    setPhotoPickerModalVisible(false);
    try {
      const photo = await pickRealDevicePhoto('camera');
      if (photo) {
        setPhotos((prev) => [...prev, photo]);
        if (photo.locationWarning) {
          setLocationToast(lang === 'hi' ? '⚠️ डिवाइस का जीपीएस बंद है।' : '⚠️ Device GPS is turned off.');
          setTimeout(() => setLocationToast(null), 4000);
        }
      }
    } catch (err) {
      console.error('Failed to capture camera photo:', err);
    }
  };

  // Handler: Choose existing device image
  const handlePickFromGallery = async () => {
    setPhotoPickerModalVisible(false);
    try {
      const photo = await pickRealDevicePhoto('gallery');
      if (photo) {
        setPhotos((prev) => [...prev, photo]);
        if (photo.locationSource === 'exif') {
          setLocationToast(lang === 'hi' ? `📍 फोटो में मौजूद लोकेशन दर्ज: ${photo.latitude?.toFixed(4)}, ${photo.longitude?.toFixed(4)}` : `📍 Location extracted from photo EXIF: ${photo.latitude?.toFixed(4)}, ${photo.longitude?.toFixed(4)}`);
          setTimeout(() => setLocationToast(null), 4000);
        } else if (photo.locationWarning) {
          setLocationToast(lang === 'hi' ? '⚠️ फोटो में लोकेशन नहीं थी और डिवाइस का जीपीएस बंद है।' : '⚠️ No location in photo & device GPS off.');
          setTimeout(() => setLocationToast(null), 4000);
        }
      }
    } catch (err) {
      console.error('Failed to pick device photo:', err);
    }
  };

  // Handler: Instant quick demo snap
  const handleQuickDevSnap = async () => {
    setPhotoPickerModalVisible(false);
    try {
      const photo = await generateDevMockPhoto(photos.length, new Date().toISOString());
      setPhotos((prev) => [...prev, photo]);
    } catch (err) {
      console.error('Failed to generate demo photo:', err);
    }
  };

  // Capture Live Photo from Native Camera
  const handleCapturePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      const photoResult = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (!photoResult?.uri) return;
      setCameraVisible(false);

      const gps = await getCurrentGpsLocation();
      const compressed = await compressPhoto(photoResult.uri);

      const newPhoto: CapturedPhoto = {
        uri: compressed.uri,
        width: compressed.width,
        height: compressed.height,
        sizeBytes: compressed.sizeBytes,
        latitude: gps.latitude,
        longitude: gps.longitude,
        accuracyM: gps.accuracyM,
        capturedAt: new Date().toISOString(),
        isMockLocation: gps.isMockLocation,
      };

      setPhotos((prev) => [...prev, newPhoto]);
    } catch (err) {
      console.error('Camera capture error:', err);
      Alert.alert(
        lang === 'hi' ? 'त्रुटि' : 'Error',
        lang === 'hi' ? 'फोटो खींचने में समस्या आई।' : 'Failed to capture photo.'
      );
      setCameraVisible(false);
    }
  };

  // Delete captured photo
  const handleDeletePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    if (inspectingPhoto) {
      setInspectingPhoto(null);
    }
  };

  // --- AUDIO RECORDING HANDLERS ---
  const handleStartRecording = async () => {
    try {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission && !__DEV__) {
        Alert.alert(
          lang === 'hi' ? 'माइक अनुमति आवश्यक है' : 'Microphone Permission Required',
          lang === 'hi' ? 'आवाज रिकॉर्ड करने के लिए अनुमति दें।' : 'Please grant microphone access.'
        );
        return;
      }

      await startAudioRecording();
      setIsRecording(true);
      setRecordingSeconds(0);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 59) {
            handleStopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(lang === 'hi' ? 'रिकॉर्डिंग त्रुटि' : 'Recording Error', msg);
    }
  };

  const handleStopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const result = await stopAudioRecording();
      setRecordedAudio(result);
      setIsRecording(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(lang === 'hi' ? 'त्रुटि' : 'Audio Error', msg);
      setIsRecording(false);
    }
  };

  const handleTogglePlayback = async () => {
    if (!recordedAudio) return;

    if (isPlayingAudio) {
      stopAudioPlayback();
      setIsPlayingAudio(false);
    } else {
      setIsPlayingAudio(true);
      await playAudio(recordedAudio.uri, () => {
        setIsPlayingAudio(false);
      });
    }
  };

  const handleDeleteAudio = () => {
    stopAudioPlayback();
    setIsPlayingAudio(false);
    setRecordedAudio(null);
    setRecordingSeconds(0);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (!status) {
      Alert.alert(lang === 'hi' ? 'स्थिति चुनें' : 'Select Status', t('selectStatusAlert'));
      return;
    }

    if (photos.length === 0) {
      Alert.alert(
        t('noPhotoAlert'),
        t('noPhotoConfirm'),
        [
          { text: t('takePhoto'), style: 'cancel' },
          { text: t('yesSubmit'), onPress: checkVoicePrompt },
        ]
      );
      return;
    }

    checkVoicePrompt();
  };

  const checkVoicePrompt = () => {
    if (!recordedAudio) {
      Alert.alert(
        t('noVoiceAlert'),
        t('noVoiceConfirm'),
        [
          { text: t('recordVoice'), style: 'cancel' },
          { text: t('yesSubmit'), onPress: executeSubmission },
        ]
      );
      return;
    }
    executeSubmission();
  };

  const executeSubmission = async () => {
    setSubmitting(true);
    setSubmitStatusText('sending');

    try {
      // 1. Upload real photos to local dev-storage stub so server holds the file
      const uploadedPhotos = await Promise.all(
        photos.map(async (p, idx) => {
          const fileName = `site_${siteId}_${Date.now()}_${idx}.jpg`;
          const storageKey = `photos/${fileName}`;

          try {
            await fetch(`${DEFAULT_API_BASE_URL}/api/v1/dev-storage/upload?key=${encodeURIComponent(storageKey)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dataUrl: p.uri }),
            });
          } catch (uploadErr) {
            console.warn('Storage upload note:', uploadErr);
          }

          return {
            storageKey,
            mimeType: 'image/jpeg',
            sizeBytes: p.sizeBytes,
            latitude: p.latitude,
            longitude: p.longitude,
            accuracyM: p.accuracyM,
            capturedAt: p.capturedAt,
            flags: p.isMockLocation ? { mock_location: true } : {},
          };
        })
      );

      let audioPayload: any = undefined;
      if (recordedAudio) {
        audioPayload = {
          storageKey: `audio/sample_${Date.now()}.${recordedAudio.mimeType.includes('webm') ? 'webm' : 'm4a'}`,
          mimeType: recordedAudio.mimeType,
          sizeBytes: recordedAudio.sizeBytes,
          durationSeconds: recordedAudio.durationSeconds,
          capturedAt: new Date().toISOString(),
        };
      }

      const clientGeneratedId = generateUuidV4();
      const recordDate = new Date().toISOString().split('T')[0];

      const payload = {
        clientId: clientGeneratedId,
        siteId,
        recordDate,
        status,
        capturedAt: new Date().toISOString(),
        missingPhoto: photos.length === 0,
        missingVoice: !recordedAudio,
        issueTypeIds: selectedIssueIds,
        photos: uploadedPhotos,
        audio: audioPayload,
      };

      const tokens = getAuthTokens();
      if (tokens) {
        const response = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/records`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.message || 'Submission failed');
        }
      }

      setSubmitStatusText('sent');
      setSubmissionFeedback({
        type: 'success',
        text: lang === 'hi' ? 'जमा हो गया! ✅' : 'Submitted successfully! ✅',
      });

      if (Platform.OS === 'web') {
        setTimeout(() => router.push('/owner'), 1200);
      } else {
        router.push('/owner');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitStatusText('idle');
      setSubmissionFeedback({
        type: 'error',
        text: `${lang === 'hi' ? 'त्रुटि' : 'Error'}: ${msg}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainWrapper}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* TOP BAR: Role Toggle (Admin / Field Officer) & Compact Language Toggle (EN / HN) */}
          <View style={styles.topBar}>
            {/* Role Switcher */}
            <View style={styles.roleToggle}>
              <TouchableOpacity
                style={styles.roleBtn}
                onPress={() => {
                  setAdminPasswordInput('');
                  setAdminAuthError('');
                  setAdminAuthModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.roleBtnText}>🔒 {t('admin')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleBtn, styles.roleBtnActive]}
                activeOpacity={1}
              >
                <Text style={[styles.roleBtnText, styles.roleBtnTextActive]} numberOfLines={1}>
                  👷 {supervisorName || t('fieldOfficer')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Language Switcher: EN / HN */}
            <View style={styles.langToggle}>
              <TouchableOpacity
                style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
                onPress={() => changeLanguage('en')}
              >
                <Text style={[styles.langBtnText, lang === 'en' && styles.langBtnTextActive]}>
                  EN
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langBtn, lang === 'hi' && styles.langBtnActive]}
                onPress={() => changeLanguage('hi')}
              >
                <Text style={[styles.langBtnText, lang === 'hi' && styles.langBtnTextActive]}>
                  HN
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* WORK PLACE TRAY SELECTOR */}
          <TouchableOpacity
            style={styles.siteCard}
            onPress={() => setWorkplaceTrayVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.siteInfoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.siteHeaderLabel}>{t('siteName')}</Text>
                <View style={styles.siteNameDropdownRow}>
                  <Text style={styles.siteNameText} numberOfLines={1}>
                    📍 {siteName}
                  </Text>
                  <Text style={styles.dropdownIcon}>▾</Text>
                </View>
              </View>
              <Text style={styles.todayDateBadge}>{todayDateStr}</Text>
            </View>
          </TouchableOpacity>

          {/* LOCATION STATUS TOAST */}
          {locationToast && (
            <View style={styles.locationToastBox}>
              <Text style={styles.locationToastText}>{locationToast}</Text>
            </View>
          )}

          {/* WORK STATUS (Unnumbered, 3 Compact Buttons) */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('statusSectionTitle')}</Text>
            <View style={styles.statusRow}>
              <TouchableOpacity
                style={[styles.statusBtn, status === 'full' && styles.statusBtnActiveFull]}
                onPress={() => setStatus('full')}
                activeOpacity={0.8}
              >
                <Text style={styles.statusIcon}>🟢</Text>
                <Text style={[styles.statusLabel, status === 'full' && styles.statusLabelActive]}>
                  {t('statusFull')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusBtn, status === 'half' && styles.statusBtnActiveHalf]}
                onPress={() => setStatus('half')}
                activeOpacity={0.8}
              >
                <Text style={styles.statusIcon}>🟡</Text>
                <Text style={[styles.statusLabel, status === 'half' && styles.statusLabelActive]}>
                  {t('statusHalf')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusBtn, status === 'stopped' && styles.statusBtnActiveStopped]}
                onPress={() => setStatus('stopped')}
                activeOpacity={0.8}
              >
                <Text style={styles.statusIcon}>🔴</Text>
                <Text style={[styles.statusLabel, status === 'stopped' && styles.statusLabelActive]}>
                  {t('statusStopped')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* PHOTOS (Real Geo-Tagged Photo Clickable Preview) */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{t('photosSectionTitle')}</Text>
              <Text style={styles.cardCounter}>{photos.length}/6</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
              <View style={styles.photosRow}>
                {photos.map((photo, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.photoBox}
                    onPress={() => setInspectingPhoto(photo)}
                    activeOpacity={0.75}
                  >
                    <Image source={{ uri: photo.uri }} style={styles.photoImg} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.deletePhotoBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleDeletePhoto(index);
                      }}
                    >
                      <Text style={styles.deletePhotoIcon}>✕</Text>
                    </TouchableOpacity>
                    <View style={styles.geoStamp}>
                      <Text style={styles.geoStampText}>
                        📍 {photo.latitude ? `${photo.latitude.toFixed(3)}, ${photo.longitude?.toFixed(3)}` : 'GPS OK'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}

                {photos.length < 6 && (
                  <TouchableOpacity
                    style={styles.takePhotoBtn}
                    onPress={handleOpenPhotoOptions}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.takePhotoIcon}>📷</Text>
                    <Text style={styles.takePhotoText}>{t('takeLivePhoto')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>

          {/* VOICE NOTE (Unnumbered, Compact Horizontal Strip) */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{t('voiceSectionTitle')}</Text>
              {recordedAudio && (
                <Text style={styles.audioDurationText}>⏱️ {formatTime(recordedAudio.durationSeconds)}</Text>
              )}
            </View>

            {isRecording ? (
              <View style={styles.voiceStripRecording}>
                <View style={styles.recordingPulse}>
                  <View style={styles.redDot} />
                  <Text style={styles.recordingText}>
                    {t('recording')} ({formatTime(recordingSeconds)})
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.voiceActionBtnStop}
                  onPress={handleStopRecording}
                >
                  <Text style={styles.voiceActionTextStop}>⏹️ {t('stopRecording')}</Text>
                </TouchableOpacity>
              </View>
            ) : recordedAudio ? (
              <View style={styles.voiceStripReady}>
                <View style={styles.voiceReadyInfo}>
                  <Text style={styles.voiceMicIcon}>🎙️</Text>
                  <Text style={styles.voiceReadyLabel}>
                    {t('todayVoiceNote')} ({formatTime(recordedAudio.durationSeconds)})
                  </Text>
                </View>
                <View style={styles.voiceActionsRow}>
                  <TouchableOpacity
                    style={styles.voicePlayBtn}
                    onPress={handleTogglePlayback}
                  >
                    <Text style={styles.voicePlayText}>
                      {isPlayingAudio ? '⏸️' : '▶️'} {isPlayingAudio ? t('pause') : t('playPreview')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.voiceResetBtn}
                    onPress={handleDeleteAudio}
                  >
                    <Text style={styles.voiceResetText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.voiceStripIdle}
                onPress={handleStartRecording}
                activeOpacity={0.8}
              >
                <Text style={styles.voiceMicIcon}>🎙️</Text>
                <Text style={styles.voiceIdleText}>{t('tapToRecord')} ({t('tapToRecordSub')})</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ISSUES (Unnumbered, No Optional, Quick Chips + Tray Add) */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{t('issuesSectionTitle')}</Text>
              <TouchableOpacity
                style={styles.addCustomBtn}
                onPress={() => setIssuesTrayVisible(true)}
              >
                <Text style={styles.addCustomBtnText}>+ {t('customIssue')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.chipsWrap}>
              {issueChips.map((chip) => {
                const isSelected = selectedIssueIds.includes(chip.id);
                const label = lang === 'hi' ? chip.labelHi : (chip.labelEn || chip.labelHi);

                return (
                  <TouchableOpacity
                    key={chip.id}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => toggleIssueChip(chip.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {chip.icon ? `${chip.icon} ` : ''}{label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* FEEDBACK BANNER */}
          {submissionFeedback && (
            <View
              style={[
                styles.feedback,
                submissionFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
              ]}
            >
              <Text style={styles.feedbackText}>{submissionFeedback.text}</Text>
            </View>
          )}

          {/* SUBMIT BUTTON (Strictly "Submit" / "जमा करें") */}
          <TouchableOpacity
            style={[styles.submitBtn, (!status || submitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>
                {submitStatusText === 'sent' ? `✅ ${t('sent')}` : t('submit')}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* FULL PHOTO INSPECTION MODAL (User can inspect their uploaded/clicked image) */}
      <Modal
        visible={!!inspectingPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setInspectingPhoto(null)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setInspectingPhoto(null)}
          />
          <View style={styles.inspectPhotoCard}>
            <View style={styles.inspectHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inspectTitle}>{lang === 'hi' ? 'साइट फोटो' : 'Site Photo'}</Text>
                <Text style={styles.inspectSub}>
                  {inspectingPhoto?.locationSource === 'exif'
                    ? (lang === 'hi' ? '📱 फोटो फाइल से लोकेशन प्राप्त' : '📱 Location extracted from photo EXIF')
                    : (lang === 'hi' ? '📡 डिवाइस जीपीएस' : '📡 Real Device GPS')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setInspectingPhoto(null)} style={{ padding: 4 }}>
                <Text style={styles.trayCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {inspectingPhoto && (
              <View style={styles.inspectImageWrapper}>
                <Image
                  source={{ uri: inspectingPhoto.uri }}
                  style={styles.inspectImage}
                  resizeMode="contain"
                />
              </View>
            )}

            <View style={styles.inspectDetailsBox}>
              <Text style={styles.inspectGpsText}>
                📍 Lat: {inspectingPhoto?.latitude?.toFixed(5)}° N, Long: {inspectingPhoto?.longitude?.toFixed(5)}° E
              </Text>
              <Text style={styles.inspectTimeText}>
                📅 {inspectingPhoto?.capturedAt ? new Date(inspectingPhoto.capturedAt).toLocaleString() : ''}
              </Text>
              {inspectingPhoto?.locationWarning ? (
                <Text style={styles.inspectWarningText}>⚠️ {inspectingPhoto.locationWarning}</Text>
              ) : null}
            </View>

            <View style={styles.inspectActionsRow}>
              <TouchableOpacity
                style={styles.inspectCloseBtn}
                onPress={() => setInspectingPhoto(null)}
              >
                <Text style={styles.inspectCloseBtnText}>{t('close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PHOTO SOURCE SELECTION TRAY MODAL */}
      <Modal
        visible={photoPickerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoPickerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setPhotoPickerModalVisible(false)}
          />
          <View style={styles.traySheet}>
            <View style={styles.trayHeader}>
              <Text style={styles.trayTitle}>{t('takeLivePhoto')}</Text>
              <TouchableOpacity onPress={() => setPhotoPickerModalVisible(false)}>
                <Text style={styles.trayCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.pickerOptionBtn} onPress={handlePickFromCamera}>
              <Text style={styles.pickerOptionIcon}>📷</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerOptionTitle}>{lang === 'hi' ? 'कैमरा से लाइव फोटो लें' : 'Take Camera Photo'}</Text>
                <Text style={styles.pickerOptionSub}>{lang === 'hi' ? 'डिवाइस का कैमरा खोलें' : 'Open real device camera'}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.pickerOptionBtn} onPress={handlePickFromGallery}>
              <Text style={styles.pickerOptionIcon}>📁</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerOptionTitle}>{lang === 'hi' ? 'डिवाइस से फोटो चुनें' : 'Choose Existing Device Image'}</Text>
                <Text style={styles.pickerOptionSub}>{lang === 'hi' ? 'गैलरी / फाइल से चुनें (लोकेशन सहित)' : 'Pick from device storage with EXIF location'}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.pickerOptionBtn, { borderColor: '#334155' }]} onPress={handleQuickDevSnap}>
              <Text style={styles.pickerOptionIcon}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerOptionTitle}>{lang === 'hi' ? 'त्वरित डेमो फोटो' : 'Quick Demo Photo'}</Text>
                <Text style={styles.pickerOptionSub}>{lang === 'hi' ? 'परीक्षण के लिए' : 'Instant snapshot'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* WORK PLACE TRAY MODAL */}
      <Modal
        visible={workplaceTrayVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWorkplaceTrayVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setWorkplaceTrayVisible(false)}
          />
          <View style={styles.traySheet}>
            <View style={styles.trayHeader}>
              <Text style={styles.trayTitle}>{t('selectWork')}</Text>
              <TouchableOpacity onPress={() => setWorkplaceTrayVisible(false)}>
                <Text style={styles.trayCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 280 }}>
              {assignedSites.length === 0 ? (
                <View style={styles.emptySitesBox}>
                  <Text style={styles.emptySitesText}>
                    {lang === 'hi'
                      ? 'मालिक द्वारा अभी तक कोई कार्यस्थल नहीं सौंपा गया।'
                      : 'No work place assigned by owner yet.'}
                  </Text>
                </View>
              ) : (
                assignedSites.map((site) => {
                  const isCurrent = site.id === siteId;
                  return (
                    <TouchableOpacity
                      key={site.id}
                      style={[styles.traySiteItem, isCurrent && styles.traySiteItemActive]}
                      onPress={() => {
                        setSiteId(site.id);
                        setSiteName(site.name);
                        setWorkplaceTrayVisible(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.traySiteName, isCurrent && styles.traySiteNameActive]}>
                          {site.name}
                        </Text>
                        {site.locationText ? (
                          <Text style={styles.traySiteLocation}>{site.locationText}</Text>
                        ) : null}
                      </View>
                      {isCurrent && <Text style={styles.trayCheckmark}>✓</Text>}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ISSUES TRAY MODAL */}
      <Modal
        visible={issuesTrayVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIssuesTrayVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setIssuesTrayVisible(false)}
          />
          <View style={styles.traySheet}>
            <View style={styles.trayHeader}>
              <Text style={styles.trayTitle}>{t('customIssue')}</Text>
              <TouchableOpacity onPress={() => setIssuesTrayVisible(false)}>
                <Text style={styles.trayCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.traySubtitle}>{t('enterCustomIssue')}</Text>
            <TextInput
              style={styles.trayInput}
              placeholder={lang === 'hi' ? 'समस्या का विवरण लिखें...' : 'Type issue description...'}
              placeholderTextColor="#71717A"
              value={customIssueInput}
              onChangeText={setCustomIssueInput}
              autoFocus
            />

            <TouchableOpacity
              style={styles.trayAddBtn}
              onPress={handleAddCustomIssue}
            >
              <Text style={styles.trayAddBtnText}>+ {t('save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ADMIN PASSWORD PROTECTION MODAL */}
      <Modal
        visible={adminAuthModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAdminAuthModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setAdminAuthModalVisible(false)}
          />
          <View style={styles.traySheet}>
            <View style={styles.trayHeader}>
              <Text style={styles.trayTitle}>🔒 {lang === 'hi' ? 'एडमिन सुरक्षा' : 'Admin Access'}</Text>
              <TouchableOpacity onPress={() => setAdminAuthModalVisible(false)}>
                <Text style={styles.trayCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.traySubtitle}>
              {lang === 'hi'
                ? 'एडमिन पोर्टल पर जाने के लिए एडमिन पासवर्ड दर्ज करें:'
                : 'Enter the Admin account password to switch to the Owner portal:'}
            </Text>

            <TextInput
              style={styles.trayInput}
              placeholder={lang === 'hi' ? 'एडमिन पासवर्ड' : 'Admin Password'}
              placeholderTextColor="#71717A"
              secureTextEntry
              value={adminPasswordInput}
              onChangeText={(txt) => {
                setAdminPasswordInput(txt);
                setAdminAuthError('');
              }}
              autoFocus
            />

            {adminAuthError ? (
              <Text style={styles.adminAuthErrorText}>⚠️ {adminAuthError}</Text>
            ) : null}

            <TouchableOpacity
              style={styles.trayAddBtn}
              onPress={handleVerifyAdminSwitch}
              disabled={verifyingAdmin}
            >
              {verifyingAdmin ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.trayAddBtnText}>
                  {lang === 'hi' ? 'सत्यापित करें और जाएं' : 'Verify & Switch to Admin'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* NATIVE CAMERA MODAL (PHYSICAL DEVICE ONLY) */}
      <Modal visible={cameraVisible} animationType="slide">
        <SafeAreaView style={styles.cameraModal}>
          <CameraView ref={cameraRef} style={styles.cameraView} facing="back">
            <View style={styles.cameraControls}>
              <TouchableOpacity
                style={styles.closeCameraBtn}
                onPress={() => setCameraVisible(false)}
              >
                <Text style={styles.closeCameraText}>✕ {t('close')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shutterBtn}
                onPress={handleCapturePhoto}
                activeOpacity={0.7}
              >
                <View style={styles.shutterBtnInner} />
              </TouchableOpacity>
            </View>
          </CameraView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  mainWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: '#121212',
  },
  container: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 20,
  },
  // Top Control Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  roleBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  roleBtnActive: {
    backgroundColor: '#2563EB',
  },
  roleBtnText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
  },
  roleBtnTextActive: {
    color: '#FFFFFF',
  },
  langToggle: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  langBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  langBtnActive: {
    backgroundColor: '#2563EB',
  },
  langBtnText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
  },
  langBtnTextActive: {
    color: '#FFFFFF',
  },
  // Work Place Card
  siteCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  siteInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  siteHeaderLabel: {
    fontSize: 10,
    color: '#A1A1AA',
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  siteNameDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  siteNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    maxWidth: 220,
  },
  dropdownIcon: {
    color: '#38BDF8',
    fontSize: 13,
    marginLeft: 4,
    fontWeight: '800',
  },
  todayDateBadge: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    backgroundColor: '#262626',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  locationToastBox: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  locationToastText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Reusable Card Container
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  cardCounter: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
  },
  // Status Selection
  statusRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBtn: {
    flex: 1,
    backgroundColor: '#121212',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#2C2C2E',
  },
  statusBtnActiveFull: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  statusBtnActiveHalf: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
  },
  statusBtnActiveStopped: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  statusIcon: {
    fontSize: 15,
    marginBottom: 2,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A1A1AA',
  },
  statusLabelActive: {
    color: '#FFFFFF',
  },
  // Photos Row
  photosScroll: {
    marginTop: 2,
  },
  photosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photoBox: {
    width: 68,
    height: 68,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#334155',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  deletePhotoIcon: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 10,
  },
  geoStamp: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingVertical: 1,
  },
  geoStampText: {
    color: '#34D399',
    fontSize: 7,
    fontWeight: '700',
    textAlign: 'center',
  },
  takePhotoBtn: {
    width: 68,
    height: 68,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  takePhotoIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  takePhotoText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
    textAlign: 'center',
  },
  // Voice Note (Compact Horizontal Strip)
  audioDurationText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
  },
  voiceStripIdle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  voiceMicIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  voiceIdleText: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '600',
  },
  voiceStripRecording: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  recordingPulse: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  recordingText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
  },
  voiceActionBtnStop: {
    backgroundColor: '#EF4444',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  voiceActionTextStop: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  voiceStripReady: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  voiceReadyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceReadyLabel: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '700',
  },
  voiceActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  voicePlayBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  voicePlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  voiceResetBtn: {
    backgroundColor: '#27272A',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  voiceResetText: {
    fontSize: 12,
  },
  // Issues Section
  addCustomBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 6,
  },
  addCustomBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  chipSelected: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
  },
  chipText: {
    fontSize: 11,
    color: '#A1A1AA',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // Feedback
  feedback: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  feedbackError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  feedbackText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  // Submit Button
  submitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // Photo Picker Modal
  pickerOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  pickerOptionIcon: {
    fontSize: 22,
  },
  pickerOptionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pickerOptionSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  // Photo Inspection Modal
  inspectPhotoCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    padding: 14,
    width: '90%',
    maxWidth: 400,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  inspectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inspectTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  inspectSub: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  inspectImageWrapper: {
    width: '100%',
    height: 260,
    backgroundColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inspectImage: {
    width: '100%',
    height: '100%',
  },
  inspectDetailsBox: {
    backgroundColor: '#121212',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  inspectGpsText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  inspectTimeText: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  inspectWarningText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  inspectActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  inspectCloseBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  inspectCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  // Tray Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  traySheet: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#334155',
  },
  trayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trayTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  trayCloseText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '700',
    padding: 4,
  },
  traySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 8,
  },
  trayInput: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 10,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 12,
  },
  adminAuthErrorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  trayAddBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  trayAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  traySiteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  traySiteItemActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderRadius: 8,
  },
  traySiteName: {
    fontSize: 14,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  traySiteNameActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  traySiteLocation: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  trayCheckmark: {
    color: '#38BDF8',
    fontSize: 16,
    fontWeight: '900',
  },
  emptySitesBox: {
    padding: 16,
    alignItems: 'center',
  },
  emptySitesText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
  },
  // Modal Backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Camera Modal
  cameraModal: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  closeCameraBtn: {
    padding: 12,
  },
  closeCameraText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  shutterBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBtnInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },
});
