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
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import {
  getCurrentGpsLocation,
  compressPhoto,
  generateDevMockPhoto,
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
import { t } from '../src/i18n';
import {
  initAuthSession,
  getCurrentUser,
  getAuthTokens,
  clearAuthSession,
} from '../src/services/auth.state';

interface IssueChip {
  id: string;
  labelHi: string;
  labelEn: string;
  icon?: string;
}

export default function RecordSubmissionScreen() {
  const router = useRouter();
  const [supervisorName, setSupervisorName] = useState('Field Supervisor');

  // Selected work place details
  const [siteName, setSiteName] = useState('South Depot & Warehouse');
  const [siteId, setSiteId] = useState('00000000-0000-0000-0000-000000000001');

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
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<RecordedAudioResult | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Camera modal state
  const [cameraVisible, setCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitStatusText, setSubmitStatusText] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [submissionFeedback, setSubmissionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const todayDateStr = new Date().toLocaleDateString('hi-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Initialize supervisor auth, load assigned sites, and load dynamic issue chips
  useEffect(() => {
    initAuthSession().then(async (user) => {
      if (!user) {
        router.replace('/login');
        return;
      }
      setSupervisorName(user.name);

      const tokens = getAuthTokens();
      if (tokens) {
        try {
          // 1. Fetch assigned site
          const res = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/records/today`, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.sites && data.sites.length > 0) {
              setSiteName(data.sites[0].siteName);
              setSiteId(data.sites[0].siteId);
            }
          }

          // 2. Fetch real database issue chips with valid UUIDs
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

  // Open Live Camera Viewfinder (Native: expo-camera, Web: Dev Mock)
  const handleOpenLiveCamera = async () => {
    if (photos.length >= 6) {
      Alert.alert('अधिकतम फोटो', 'आप एक रिकॉर्ड में अधिकतम 6 फोटो जोड़ सकते हैं। (Max 6 photos)');
      return;
    }

    // Web Browser Fallback (DEV ONLY)
    if (Platform.OS === 'web') {
      if (__DEV__) {
        const mockPhoto = generateDevMockPhoto(photos.length, new Date().toISOString());
        setPhotos((prev) => [...prev, mockPhoto]);
      } else {
        Alert.alert('Live Camera Required', 'Live camera photos are only supported on physical mobile devices.');
      }
      return;
    }

    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('कैमरा अनुमति आवश्यक है', 'लाइव फोटो खींचने के लिए कैमरा अनुमति दें।');
        return;
      }
    }
    setCameraVisible(true);
  };

  // Capture Live Photo with GPS Tagging
  const handleCapturePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      const photoResult = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (!photoResult?.uri) return;

      // Close camera modal immediately
      setCameraVisible(false);

      // Acquire GPS coordinates in parallel
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
      Alert.alert('त्रुटि', 'फोटो खींचने में समस्या आई। कृपया पुनः प्रयास करें।');
      setCameraVisible(false);
    }
  };

  // Delete captured photo
  const handleDeletePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // --- AUDIO RECORDING HANDLERS ---
  const handleStartRecording = async () => {
    try {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission && !__DEV__) {
        Alert.alert('माइक अनुमति आवश्यक है', 'आवाज रिकॉर्ड करने के लिए माइक्रोफोन की अनुमति दें।');
        return;
      }

      await startAudioRecording();
      setIsRecording(true);
      setRecordingSeconds(0);

      // Start live timer up to 60 seconds
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 59) {
            // Auto-stop at 60 seconds
            handleStopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('रिकॉर्डिंग त्रुटि', msg);
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
      Alert.alert('रिकॉर्डिंग सहेजने में त्रुटि', msg);
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

  // Format seconds into MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (!status) {
      Alert.alert('स्थिति चुनें', 'कृपया काम की स्थिति (पूरा दिन / आधा दिन / काम बंद) चुनें।');
      return;
    }

    // Prompt if photo is missing
    if (photos.length === 0) {
      Alert.alert(
        'फोटो के बिना भेजना है?',
        'क्या आप बिना लाइव फोटो के यह रिकॉर्ड भेजना चाहते हैं?',
        [
          { text: 'फोटो लें', style: 'cancel' },
          { text: 'हाँ, भेजें', onPress: checkVoicePrompt },
        ]
      );
      return;
    }

    checkVoicePrompt();
  };

  const checkVoicePrompt = () => {
    if (!recordedAudio) {
      Alert.alert(
        'आवाज संदेश नहीं है',
        'क्या आप बिना आवाज रिकॉर्ड किए यह रिकॉर्ड जमा करना चाहते हैं?',
        [
          { text: 'आवाज रिकॉर्ड करें', style: 'cancel' },
          { text: 'हाँ, भेजें', onPress: executeSubmission },
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
      // Step 1: Photos metadata
      const uploadedPhotos = photos.map((p, idx) => ({
        storageKey: `photos/sample_${Date.now()}_${idx}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: p.sizeBytes,
        latitude: p.latitude,
        longitude: p.longitude,
        accuracyM: p.accuracyM,
        capturedAt: p.capturedAt,
        flags: p.isMockLocation ? { mock_location: true } : {},
      }));

      // Step 2: Audio metadata
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

      // Generate client-side UUID for idempotency
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
          throw new Error(errData.message || 'Submission failed on server');
        }
      }

      setSubmitStatusText('sent');
      const statusHindi = status === 'full' ? 'पूरा दिन' : status === 'half' ? 'आधा दिन' : 'काम बंद';
      setSubmissionFeedback({
        type: 'success',
        text: `रिकॉर्ड जमा हो गया! ✅ काम: ${siteName} (${statusHindi}) सर्वर पर सफलतापूर्वक सुरक्षित हो गया।`,
      });

      if (Platform.OS === 'web') {
        setTimeout(() => router.push('/owner'), 1500);
      } else {
        Alert.alert(
          'रिकॉर्ड जमा हो गया! ✅',
          `काम: ${siteName}\nस्थिति: ${statusHindi}\nफोटो: ${photos.length}\nआवाज: ${recordedAudio ? `${recordedAudio.durationSeconds}s` : 'कोई नहीं'}\nसर्वर पर सफलतापूर्वक सुरक्षित किया गया।`,
          [{ text: 'ठीक है', onPress: () => router.push('/owner') }]
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitStatusText('idle');
      setSubmissionFeedback({
        type: 'error',
        text: `भेजने में त्रुटि: ${msg}`,
      });
      if (Platform.OS !== 'web') {
        Alert.alert('भेजने में त्रुटि', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Switch to Owner Reviewer Mode Banner */}
        <TouchableOpacity
          style={styles.switchOwnerBanner}
          onPress={() => router.push('/owner')}
          activeOpacity={0.8}
        >
          <Text style={styles.switchOwnerIcon}>👑</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchOwnerTitle}>मालिक / एडमिन मोड देखें</Text>
            <Text style={styles.switchOwnerSub}>रिपोर्ट देखने वाला डैशबोर्ड (Owner Review View)</Text>
          </View>
          <Text style={styles.switchOwnerArrow}>→</Text>
        </TouchableOpacity>

        {/* Work Place Header */}
        <View style={styles.siteHeaderCard}>
          <Text style={styles.siteLabel}>{t('siteName')}</Text>
          <Text style={styles.siteName}>{siteName}</Text>
          <Text style={styles.todayDateText}>📅 {todayDateStr}</Text>
        </View>

        {/* 1. STATUS SELECTION (3 BIG BUTTONS) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>1. काम की स्थिति चुनें (Status) *</Text>
          <View style={styles.statusButtonsContainer}>
            {/* Full Day */}
            <TouchableOpacity
              style={[
                styles.statusButton,
                status === 'full' && styles.statusButtonActiveFull,
              ]}
              onPress={() => setStatus('full')}
              activeOpacity={0.8}
            >
              <Text style={styles.statusIcon}>🟢</Text>
              <Text style={[styles.statusText, status === 'full' && styles.statusTextActive]}>
                पूरा दिन
              </Text>
              <Text style={styles.statusSubtext}>Full Day</Text>
            </TouchableOpacity>

            {/* Half Day */}
            <TouchableOpacity
              style={[
                styles.statusButton,
                status === 'half' && styles.statusButtonActiveHalf,
              ]}
              onPress={() => setStatus('half')}
              activeOpacity={0.8}
            >
              <Text style={styles.statusIcon}>🟡</Text>
              <Text style={[styles.statusText, status === 'half' && styles.statusTextActive]}>
                आधा दिन
              </Text>
              <Text style={styles.statusSubtext}>Half Day</Text>
            </TouchableOpacity>

            {/* Work Stopped */}
            <TouchableOpacity
              style={[
                styles.statusButton,
                status === 'stopped' && styles.statusButtonActiveStopped,
              ]}
              onPress={() => setStatus('stopped')}
              activeOpacity={0.8}
            >
              <Text style={styles.statusIcon}>🔴</Text>
              <Text style={[styles.statusText, status === 'stopped' && styles.statusTextActive]}>
                काम बंद
              </Text>
              <Text style={styles.statusSubtext}>Stopped</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. LIVE PHOTOS (NO GALLERY PICKER) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>2. लाइव फोटो (Live Photos)</Text>
            <Text style={styles.photoCountText}>{photos.length}/6</Text>
          </View>
          <Text style={styles.sectionHint}>
            लाइव कैमरा से फोटो लें (गैलरी से अपलोड नहीं हो सकता)। जीपीएस लोकेशन अपने आप जुड़ जाएगी।
          </Text>

          {/* Photos Grid */}
          <View style={styles.photoGrid}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoThumbnailContainer}>
                <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} />
                {photo.isDevMock && (
                  <View style={styles.devMockBadge}>
                    <Text style={styles.devMockBadgeText}>DEV MOCK</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.deletePhotoButton}
                  onPress={() => handleDeletePhoto(index)}
                >
                  <Text style={styles.deletePhotoText}>✕</Text>
                </TouchableOpacity>
                <View style={styles.geoBadge}>
                  <Text style={styles.geoBadgeText}>
                    📍 {photo.latitude ? `${photo.latitude.toFixed(4)}, ${photo.longitude?.toFixed(4)}` : 'GPS Tagged'}
                  </Text>
                </View>
              </View>
            ))}

            {photos.length < 6 && (
              <TouchableOpacity
                style={styles.addPhotoButton}
                onPress={handleOpenLiveCamera}
                activeOpacity={0.8}
              >
                <Text style={styles.addPhotoIcon}>📷</Text>
                <Text style={styles.addPhotoText}>लाइव फोटो लें</Text>
                <Text style={styles.addPhotoSubtext}>Live Camera</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 3. VOICE NOTE RECORDING (PHASE 4) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>3. आवाज संदेश (Voice Note)</Text>
            {recordedAudio && (
              <Text style={styles.audioDurationBadge}>
                ⏱️ {formatTime(recordedAudio.durationSeconds)}
              </Text>
            )}
          </View>
          <Text style={styles.sectionHint}>
            आज के काम का ब्योरा बोलकर बताएं (अधिकतम 60 सेकंड)। मालिक यह आवाज सुन सकते हैं।
          </Text>

          {/* Case A: Active Recording State */}
          {isRecording ? (
            <View style={styles.recordingActiveCard}>
              <View style={styles.recordingPulseHeader}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingLiveText}>रिकॉर्डिंग चालू है... (Recording)</Text>
              </View>
              <Text style={styles.recordingTimerText}>
                {formatTime(recordingSeconds)} / 01:00
              </Text>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(100, (recordingSeconds / 60) * 100)}%` },
                  ]}
                />
              </View>

              <TouchableOpacity
                style={styles.stopRecordingButton}
                onPress={handleStopRecording}
                activeOpacity={0.8}
              >
                <Text style={styles.stopRecordingIcon}>⏹️</Text>
                <Text style={styles.stopRecordingText}>रिकॉर्डिंग रोकें (Stop & Save)</Text>
              </TouchableOpacity>
            </View>
          ) : recordedAudio ? (
            /* Case B: Audio Recorded Preview & Playback */
            <View style={styles.recordedAudioPreviewCard}>
              <View style={styles.audioPreviewInfoRow}>
                <View style={styles.audioIconBox}>
                  <Text style={styles.audioBoxIcon}>🎙️</Text>
                </View>
                <View style={styles.audioMetaColumn}>
                  <View style={styles.audioMetaTitleRow}>
                    <Text style={styles.audioFileTitle}>आज का आवाज संदेश</Text>
                    {recordedAudio.isDevMock && (
                      <View style={styles.devMockBadgeAudio}>
                        <Text style={styles.devMockBadgeText}>DEV MOCK</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.audioFileSub}>
                    लंबाई: {formatTime(recordedAudio.durationSeconds)} • {(recordedAudio.sizeBytes / 1024).toFixed(0)} KB
                  </Text>
                </View>
              </View>

              {/* Play / Pause and Delete Controls */}
              <View style={styles.audioActionButtonsRow}>
                <TouchableOpacity
                  style={[
                    styles.playAudioButton,
                    isPlayingAudio && styles.playAudioButtonActive,
                  ]}
                  onPress={handleTogglePlayback}
                  activeOpacity={0.8}
                >
                  <Text style={styles.playAudioIcon}>{isPlayingAudio ? '⏸️' : '▶️'}</Text>
                  <Text style={styles.playAudioText}>
                    {isPlayingAudio ? 'रोकें (Pause)' : 'सुनें (Play Preview)'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteAudioButton}
                  onPress={handleDeleteAudio}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteAudioIcon}>🗑️</Text>
                  <Text style={styles.deleteAudioText}>हटाएं (Re-record)</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Case C: Idle State - Start Recording */
            <TouchableOpacity
              style={styles.startRecordButton}
              onPress={handleStartRecording}
              activeOpacity={0.8}
            >
              <View style={styles.micIconCircle}>
                <Text style={styles.micIconText}>🎙️</Text>
              </View>
              <View style={styles.startRecordTextContainer}>
                <Text style={styles.startRecordTitle}>माइक दबाकर बोलें</Text>
                <Text style={styles.startRecordSubtitle}>
                  Tap to record voice (Max 60 sec)
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* 4. ISSUE CHIPS (MULTI-SELECT) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>4. कोई समस्या है? (Issue Chips)</Text>
          <Text style={styles.sectionHint}>यदि कोई समस्या है तो चुनें (वैकल्पिक / Optional):</Text>

          <View style={styles.chipsContainer}>
            {issueChips.map((chip) => {
              const isSelected = selectedIssueIds.includes(chip.id);
              return (
                <TouchableOpacity
                  key={chip.id}
                  style={[styles.chipButton, isSelected && styles.chipButtonSelected]}
                  onPress={() => toggleIssueChip(chip.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {chip.labelHi}
                  </Text>
                  <Text style={[styles.chipSubtext, isSelected && styles.chipSubtextSelected]}>
                    {chip.labelEn}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Submission Feedback Banner */}
        {submissionFeedback && (
          <View
            style={[
              styles.feedbackBanner,
              submissionFeedback.type === 'success'
                ? styles.feedbackBannerSuccess
                : styles.feedbackBannerError,
            ]}
          >
            <Text
              style={[
                styles.feedbackBannerText,
                submissionFeedback.type === 'success'
                  ? styles.feedbackTextSuccess
                  : styles.feedbackTextError,
              ]}
            >
              {submissionFeedback.text}
            </Text>
          </View>
        )}

        {/* SUBMIT BUTTON */}
        <TouchableOpacity
          style={[styles.submitButton, (!status || submitting) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>
              {submitStatusText === 'sent'
                ? '✅ भेज दिया गया (Sent)'
                : submitStatusText === 'sending'
                ? 'भेज रहे हैं... (Sending)'
                : 'जमा करें (Submit Daily Record)'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* FULLSCREEN LIVE CAMERA MODAL */}
      <Modal visible={cameraVisible} animationType="slide">
        <SafeAreaView style={styles.cameraModalContainer}>
          <CameraView ref={cameraRef} style={styles.cameraView} facing="back">
            <View style={styles.cameraControlsContainer}>
              <TouchableOpacity
                style={styles.closeCameraButton}
                onPress={() => setCameraVisible(false)}
              >
                <Text style={styles.closeCameraText}>✕ बंद करें</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shutterButton}
                onPress={handleCapturePhoto}
                activeOpacity={0.7}
              >
                <View style={styles.shutterButtonInner} />
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
    backgroundColor: '#0B0F19',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  switchOwnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  switchOwnerIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  switchOwnerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  switchOwnerSub: {
    color: '#E9D5FF',
    fontSize: 11,
    marginTop: 1,
    fontWeight: '500',
  },
  switchOwnerArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 8,
  },
  siteHeaderCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  siteLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  siteName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 4,
  },
  todayDateText: {
    fontSize: 14,
    color: '#38BDF8',
    marginTop: 6,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#131C2E',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F1F5F9',
    marginBottom: 6,
  },
  photoCountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
  },
  audioDurationBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#34D399',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  sectionHint: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 14,
    lineHeight: 18,
  },
  statusButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    minHeight: 80,
    justifyContent: 'center',
  },
  statusButtonActiveFull: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  statusButtonActiveHalf: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#F59E0B',
  },
  statusButtonActiveStopped: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
  },
  statusIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#CBD5E1',
  },
  statusTextActive: {
    color: '#FFFFFF',
  },
  statusSubtext: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoThumbnailContainer: {
    width: 100,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#334155',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  devMockBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#F59E0B',
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 4,
    zIndex: 10,
  },
  devMockBadgeAudio: {
    backgroundColor: '#F59E0B',
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 4,
    marginLeft: 8,
  },
  devMockBadgeText: {
    color: '#000000',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  deletePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletePhotoText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  geoBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  geoBadgeText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#38BDF8',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  addPhotoIcon: {
    fontSize: 26,
    marginBottom: 4,
  },
  addPhotoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
  },
  addPhotoSubtext: {
    fontSize: 9,
    color: '#94A3B8',
  },
  // Voice Recording Styles
  startRecordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  micIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  micIconText: {
    fontSize: 22,
  },
  startRecordTextContainer: {
    flex: 1,
  },
  startRecordTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  startRecordSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  recordingActiveCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    alignItems: 'center',
  },
  recordingPulseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  recordingLiveText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 14,
  },
  recordingTimerText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    fontFamily: 'monospace',
    marginVertical: 4,
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#EF4444',
  },
  stopRecordingButton: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 6,
    width: '100%',
    minHeight: 48,
  },
  stopRecordingIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  stopRecordingText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  recordedAudioPreviewCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  audioPreviewInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  audioIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  audioBoxIcon: {
    fontSize: 22,
  },
  audioMetaColumn: {
    flex: 1,
  },
  audioMetaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioFileTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  audioFileSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  audioActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  playAudioButton: {
    flex: 1.4,
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 48,
  },
  playAudioButtonActive: {
    backgroundColor: '#F59E0B',
  },
  playAudioIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  playAudioText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  deleteAudioButton: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 48,
  },
  deleteAudioIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  deleteAudioText: {
    color: '#F87171',
    fontWeight: '700',
    fontSize: 13,
  },
  // Chips Styles
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#334155',
    minHeight: 48,
    justifyContent: 'center',
  },
  chipButtonSelected: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  chipTextSelected: {
    color: '#FCA5A5',
  },
  chipSubtext: {
    fontSize: 10,
    color: '#64748B',
  },
  chipSubtextSelected: {
    color: '#F87171',
  },
  feedbackBanner: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  feedbackBannerSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  feedbackBannerError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  feedbackBannerText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  feedbackTextSuccess: {
    color: '#34D399',
  },
  feedbackTextError: {
    color: '#F87171',
  },
  submitButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 56,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    borderWidth: 1,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  cameraModalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  cameraControlsContainer: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 30,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeCameraButton: {
    padding: 12,
  },
  closeCameraText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterButtonInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFFFFF',
  },
});
