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
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { getCurrentGpsLocation, compressPhoto, CapturedPhoto } from '../src/services/photo.service';
import { DEFAULT_API_BASE_URL } from '../src/constants/config';
import { t } from '../src/i18n';

interface IssueChip {
  id: string;
  labelHi: string;
  labelEn: string;
  icon?: string;
}

export default function RecordSubmissionScreen() {
  const router = useRouter();

  // Selected work place details
  const [siteName, setSiteName] = useState('Sector 62 Main Project');
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

  // Camera modal state
  const [cameraVisible, setCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitStatusText, setSubmitStatusText] = useState<'idle' | 'sending' | 'sent'>('idle');

  const todayDateStr = new Date().toLocaleDateString('hi-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Toggle issue chip selection
  const toggleIssueChip = (id: string) => {
    setSelectedIssueIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Open Live Camera Viewfinder
  const handleOpenLiveCamera = async () => {
    if (photos.length >= 6) {
      Alert.alert('अधिकतम फोटो', 'आप एक रिकॉर्ड में अधिकतम 6 फोटो जोड़ सकते हैं। (Max 6 photos)');
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
      // Step 1: Simulated Upload of Photos via Presigned URLs
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

      // Generate client-side UUID for idempotency
      const clientGeneratedId = 'c-' + Math.random().toString(36).substring(2, 15);
      const recordDate = new Date().toISOString().split('T')[0];

      // Simulated network post to backend
      const payload = {
        clientId: 'a0000000-0000-0000-0000-' + Math.floor(100000000000 + Math.random() * 900000000000),
        siteId,
        recordDate,
        status,
        capturedAt: new Date().toISOString(),
        missingPhoto: photos.length === 0,
        missingVoice: true,
        issueTypeIds: selectedIssueIds,
        photos: uploadedPhotos,
      };

      setSubmitStatusText('sent');

      Alert.alert(
        'रिकॉर्ड जमा हो गया! ✅',
        `स्थिति: ${status === 'full' ? 'पूरा दिन' : status === 'half' ? 'आधा दिन' : 'काम बंद'}\nफोटो: ${photos.length}\nसफलतापूर्वक भेजा गया।`,
        [{ text: 'ठीक है', onPress: () => router.back() }]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('भेजने में त्रुटि', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
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

        {/* 3. ISSUE CHIPS (MULTI-SELECT) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>3. कोई समस्या है? (Issue Chips)</Text>
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
            <>
              <Text style={styles.submitButtonText}>
                {submitStatusText === 'sent'
                  ? '✅ भेज दिया गया (Sent)'
                  : submitStatusText === 'sending'
                  ? 'भेज रहे हैं... (Sending)'
                  : 'जमा करें (Submit Daily Record)'}
              </Text>
            </>
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
    minHeight: 80, // Minimum 48px standard
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
    minHeight: 48, // Accessibility touch target
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
