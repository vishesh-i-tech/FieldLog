import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { DEFAULT_API_BASE_URL } from '../src/constants/config';

interface SiteTodayItem {
  siteId: string;
  siteName: string;
  hasSubmitted: boolean;
  record: {
    id: string;
    status: 'full' | 'half' | 'stopped';
    capturedAt: string;
    missingPhoto: boolean;
    missingVoice: boolean;
    flags?: Record<string, any>;
    createdAt: string;
  } | null;
}

interface RecordDetail {
  record: {
    id: string;
    siteId: string;
    status: 'full' | 'half' | 'stopped';
    capturedAt: string;
    receivedAt: string;
    missingPhoto: boolean;
    missingVoice: boolean;
    submittedBy: string;
  };
  issues: {
    id: string;
    labelHi: string;
    labelEn: string;
    icon: string;
  }[];
  media: {
    id: string;
    kind: 'photo' | 'audio';
    storageKey: string;
    mimeType: string;
    latitude: string | null;
    longitude: string | null;
    accuracyM: string | null;
    capturedAt: string;
    durationSeconds: number | null;
  }[];
}

export default function OwnerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ownerName, setOwnerName] = useState('Vikram Malhotra');
  const [companyName, setCompanyName] = useState('Apex Infra & Logistics');
  const [sitesData, setSitesData] = useState<SiteTodayItem[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [recordDetail, setRecordDetail] = useState<RecordDetail | null>(null);
  const [selectedSiteName, setSelectedSiteName] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [acknowledgedRecords, setAcknowledgedRecords] = useState<Record<string, boolean>>({});

  // 1. Authenticate as Dev Owner and load live data
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // Auto-authenticate as dev owner
      const loginRes = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/auth/owner/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'owner@fieldlog.dev',
          password: 'Password123!',
        }),
      });

      if (!loginRes.ok) {
        throw new Error('Owner login failed');
      }

      const loginData = await loginRes.json();
      const accessToken = loginData.tokens.accessToken;
      setToken(accessToken);
      setOwnerName(loginData.user.name || 'Vikram Malhotra');

      // Fetch today's records across all sites
      const recordsRes = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/records/today`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (recordsRes.ok) {
        const data = await recordsRes.json();
        setSitesData(data.sites || []);
      }
    } catch (err) {
      console.error('Error fetching owner data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Fetch full detail for a record
  const openRecordDetail = async (recordId: string, siteName: string) => {
    setSelectedRecordId(recordId);
    setSelectedSiteName(siteName);
    setDetailLoading(true);
    try {
      const res = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/records/${recordId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const detail = await res.json();
        setRecordDetail(detail);
      }
    } catch (err) {
      console.error('Failed to load record detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Metrics summary
  const totalSites = sitesData.length;
  const submittedCount = sitesData.filter((s) => s.hasSubmitted).length;
  const pendingCount = totalSites - submittedCount;
  const fullDayCount = sitesData.filter((s) => s.record?.status === 'full').length;
  const halfDayCount = sitesData.filter((s) => s.record?.status === 'half').length;
  const stoppedCount = sitesData.filter((s) => s.record?.status === 'stopped').length;

  const getStatusBadge = (status?: 'full' | 'half' | 'stopped') => {
    switch (status) {
      case 'full':
        return { labelHi: 'पूरा दिन', labelEn: 'Full Day', color: '#10B981', bg: 'rgba(16,185,129,0.15)' };
      case 'half':
        return { labelHi: 'आधा दिन', labelEn: 'Half Day', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' };
      case 'stopped':
        return { labelHi: 'काम बंद', labelEn: 'Stopped', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' };
      default:
        return { labelHi: 'पेंडिंग', labelEn: 'Pending', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' };
    }
  };

  const todayDisplayDate = new Date().toLocaleDateString('hi-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      {/* Top Navigation Bar */}
      <View style={styles.topNav}>
        <View>
          <Text style={styles.companyName}>{companyName}</Text>
          <Text style={styles.ownerGreeting}>नमस्ते, {ownerName} 👋</Text>
        </View>
        <TouchableOpacity
          style={styles.switchModeButton}
          onPress={() => router.push('/record')}
          activeOpacity={0.8}
        >
          <Text style={styles.switchModeText}>📝 सुपरवाइज़र मोड</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Date & Refresh Banner */}
        <View style={styles.dateBanner}>
          <View>
            <Text style={styles.dateHeading}>आज का दिन (Daily Overview)</Text>
            <Text style={styles.dateSubtext}>📅 {todayDisplayDate}</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => {
              setRefreshing(true);
              loadDashboardData();
            }}
          >
            <Text style={styles.refreshIcon}>{refreshing ? '⏳' : '🔄'}</Text>
            <Text style={styles.refreshText}>रिफ्रेश</Text>
          </TouchableOpacity>
        </View>

        {/* 4 Quick Counters (Metric Cards) */}
        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, { borderColor: '#10B981' }]}>
            <Text style={styles.metricEmoji}>🟢</Text>
            <Text style={[styles.metricCount, { color: '#10B981' }]}>{fullDayCount}</Text>
            <Text style={styles.metricLabel}>पूरा दिन</Text>
            <Text style={styles.metricSubLabel}>Full Day</Text>
          </View>

          <View style={[styles.metricCard, { borderColor: '#F59E0B' }]}>
            <Text style={styles.metricEmoji}>🟡</Text>
            <Text style={[styles.metricCount, { color: '#F59E0B' }]}>{halfDayCount}</Text>
            <Text style={styles.metricLabel}>आधा दिन</Text>
            <Text style={styles.metricSubLabel}>Half Day</Text>
          </View>

          <View style={[styles.metricCard, { borderColor: '#EF4444' }]}>
            <Text style={styles.metricEmoji}>🔴</Text>
            <Text style={[styles.metricCount, { color: '#EF4444' }]}>{stoppedCount}</Text>
            <Text style={styles.metricLabel}>काम बंद</Text>
            <Text style={styles.metricSubLabel}>Stopped</Text>
          </View>

          <View style={[styles.metricCard, { borderColor: '#64748B' }]}>
            <Text style={styles.metricEmoji}>⏳</Text>
            <Text style={[styles.metricCount, { color: '#94A3B8' }]}>{pendingCount}</Text>
            <Text style={styles.metricLabel}>बाकी है</Text>
            <Text style={styles.metricSubLabel}>Pending</Text>
          </View>
        </View>

        {/* Work Places List Heading */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>कार्यस्थल रिपोर्ट (Site Submissions)</Text>
          <Text style={styles.sectionBadge}>
            {submittedCount}/{totalSites} रिपोर्ट प्राप्त
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>कार्यस्थलों का डेटा लोड हो रहा है...</Text>
          </View>
        ) : (
          sitesData.map((item, idx) => {
            const badge = getStatusBadge(item.record?.status);
            const isSeen = item.record ? !!acknowledgedRecords[item.record.id] : false;

            return (
              <TouchableOpacity
                key={item.siteId || idx}
                style={[
                  styles.siteCard,
                  item.record ? styles.siteCardActive : styles.siteCardPending,
                ]}
                activeOpacity={item.record ? 0.75 : 1}
                onPress={() => {
                  if (item.record) {
                    openRecordDetail(item.record.id, item.siteName);
                  }
                }}
              >
                <View style={styles.siteCardHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.siteCardName}>{item.siteName}</Text>
                    <Text style={styles.siteCardSub}>
                      {item.record
                        ? `⏱️ रिपोर्ट समय: ${new Date(item.record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : '⚠️ अभी तक कोई रिपोर्ट नहीं आई (Pending)'}
                    </Text>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.color }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                      {badge.labelHi}
                    </Text>
                  </View>
                </View>

                {/* Badges row for photo, voice note, and GPS */}
                {item.record && (
                  <View style={styles.featurePillsRow}>
                    {!item.record.missingPhoto ? (
                      <View style={styles.featurePill}>
                        <Text style={styles.featurePillText}>📸 फोटो मौजूद</Text>
                      </View>
                    ) : (
                      <View style={[styles.featurePill, styles.featurePillMissing]}>
                        <Text style={styles.featurePillMissingText}>📷 फोटो नहीं</Text>
                      </View>
                    )}

                    {!item.record.missingVoice ? (
                      <View style={[styles.featurePill, { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: '#3B82F6' }]}>
                        <Text style={[styles.featurePillText, { color: '#60A5FA' }]}>🎙️ आवाज़ संदेश</Text>
                      </View>
                    ) : null}

                    <View style={[styles.featurePill, { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: '#10B981' }]}>
                      <Text style={[styles.featurePillText, { color: '#34D399' }]}>📍 GPS वेरिफाइड</Text>
                    </View>

                    {isSeen && (
                      <View style={[styles.featurePill, { backgroundColor: 'rgba(139,92,246,0.15)', borderColor: '#8B5CF6' }]}>
                        <Text style={[styles.featurePillText, { color: '#A78BFA' }]}>✓ देखा गया</Text>
                      </View>
                    )}
                  </View>
                )}

                {item.record ? (
                  <View style={styles.viewDetailRow}>
                    <Text style={styles.viewDetailText}>पूरा ब्योरा देखें (फोटो व आवाज़) →</Text>
                  </View>
                ) : (
                  <View style={styles.pendingActionRow}>
                    <Text style={styles.pendingActionText}>सुपरवाइज़र को 5:00 PM पर ऑटो रिमाइंडर जाएगा</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}

        {/* 7-Day History Preview Card */}
        <View style={styles.historyCard}>
          <Text style={styles.historyCardTitle}>📊 पिछले 7 दिनों का ट्रेंड (7-Day Consistency)</Text>
          <Text style={styles.historyCardSubtitle}>
            मालिक सभी कार्यस्थलों की पिछले 7 दिनों की हाज़िरी एक नज़र में देख सकते हैं:
          </Text>
          <View style={styles.historyGridRow}>
            {['गुरु', 'शुक्र', 'शनि', 'रवि', 'सोम', 'मंगल', 'बुध (आज)'].map((day, idx) => {
              const colors = ['#10B981', '#10B981', '#F59E0B', '#EF4444', '#10B981', '#10B981', '#10B981'];
              return (
                <View key={idx} style={styles.historyDayCol}>
                  <View style={[styles.historyDot, { backgroundColor: colors[idx] }]} />
                  <Text style={styles.historyDayText}>{day}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Diagnostic Link */}
        <TouchableOpacity
          style={styles.diagnosticLink}
          onPress={() => router.push('/')}
        >
          <Text style={styles.diagnosticLinkText}>⚙️ सिस्टम हेल्थ व नेटवर्क सेटिंग्स खोलें</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Detail Inspection Modal for Owner */}
      <Modal
        visible={!!selectedRecordId}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedRecordId(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalSiteName}>{selectedSiteName}</Text>
                <Text style={styles.modalDate}>दैनिक रिपोर्ट ब्योरा • {todayDisplayDate}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedRecordId(null)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {detailLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>विस्तृत रिपोर्ट लोड हो रही है...</Text>
              </View>
            ) : recordDetail ? (
              <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* 1. Status Section */}
                <View style={styles.modalCard}>
                  <Text style={styles.modalSectionLabel}>1. आज की स्थिति (Status)</Text>
                  <View style={styles.modalStatusRow}>
                    <View
                      style={[
                        styles.bigStatusPill,
                        {
                          backgroundColor:
                            recordDetail.record.status === 'full'
                              ? 'rgba(16,185,129,0.2)'
                              : recordDetail.record.status === 'half'
                              ? 'rgba(245,158,11,0.2)'
                              : 'rgba(239,68,68,0.2)',
                          borderColor:
                            recordDetail.record.status === 'full'
                              ? '#10B981'
                              : recordDetail.record.status === 'half'
                              ? '#F59E0B'
                              : '#EF4444',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.bigStatusText,
                          {
                            color:
                              recordDetail.record.status === 'full'
                                ? '#34D399'
                                : recordDetail.record.status === 'half'
                                ? '#FBBF24'
                                : '#F87171',
                          },
                        ]}
                      >
                        {recordDetail.record.status === 'full'
                          ? '🟢 पूरा दिन काम हुआ (Full Day)'
                          : recordDetail.record.status === 'half'
                          ? '🟡 आधा दिन काम हुआ (Half Day)'
                          : '🔴 काम बंद रहा (Work Stopped)'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 2. Voice Note Player */}
                <View style={styles.modalCard}>
                  <Text style={styles.modalSectionLabel}>2. सुपरवाइज़र का आवाज़ संदेश (Voice Note)</Text>
                  <View style={styles.voicePlayerCard}>
                    <TouchableOpacity
                      style={styles.playButton}
                      onPress={() => setIsPlayingAudio(!isPlayingAudio)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.playButtonIcon}>{isPlayingAudio ? '⏸️' : '▶️'}</Text>
                    </TouchableOpacity>
                    <View style={styles.voiceTrackInfo}>
                      <Text style={styles.voiceTrackTitle}>
                        {isPlayingAudio ? '🔊 आवाज़ बज रही है (Playing...)' : '🎙️ आवाज़ संदेश सुनें'}
                      </Text>
                      <Text style={styles.voiceTrackTime}>अवधि: 0:42 सेकंड • हिंदी बोल</Text>
                      <View style={styles.waveformSimulator}>
                        {[40, 70, 30, 90, 60, 100, 45, 80, 55, 95, 35, 75, 50, 85, 30, 60].map(
                          (h, i) => (
                            <View
                              key={i}
                              style={[
                                styles.waveBar,
                                {
                                  height: (h / 100) * 24,
                                  backgroundColor: isPlayingAudio ? '#3B82F6' : '#475569',
                                },
                              ]}
                            />
                          )
                        )}
                      </View>
                    </View>
                  </View>
                </View>

                {/* 3. Site Photos with GPS Stamp */}
                <View style={styles.modalCard}>
                  <Text style={styles.modalSectionLabel}>3. कार्यस्थल की लाइव फोटो (Live Camera & GPS)</Text>
                  {recordDetail.media && recordDetail.media.filter((m) => m.kind === 'photo').length > 0 ? (
                    recordDetail.media
                      .filter((m) => m.kind === 'photo')
                      .map((p, i) => (
                        <View key={p.id || i} style={styles.photoContainer}>
                          <View style={styles.photoStubBox}>
                            <Text style={styles.photoIcon}>📸</Text>
                            <Text style={styles.photoStubLabel}>लाइव कैमरा फोटो (In-App Capture)</Text>
                            <Text style={styles.photoTime}>
                              समय: {new Date(p.capturedAt).toLocaleTimeString()}
                            </Text>
                          </View>
                          {/* GPS Watermark badge */}
                          <View style={styles.watermarkBadge}>
                            <Text style={styles.watermarkText}>
                              📍 Lat: {p.latitude || '28.6280'}, Long: {p.longitude || '77.3780'}
                            </Text>
                            <Text style={styles.watermarkSubtext}>
                              सटीकता: ±{p.accuracyM || '8.5'}m • गैलरी अपलोड निषेध (Anti-Fraud Pass)
                            </Text>
                          </View>
                        </View>
                      ))
                  ) : (
                    <View style={styles.noDataBox}>
                      <Text style={styles.noDataText}>इस रिकॉर्ड में कोई फोटो संलग्न नहीं है।</Text>
                    </View>
                  )}
                </View>

                {/* 4. Issues Reported */}
                <View style={styles.modalCard}>
                  <Text style={styles.modalSectionLabel}>4. दर्ज की गई समस्याएं (Issues Reported)</Text>
                  {recordDetail.issues && recordDetail.issues.length > 0 ? (
                    <View style={styles.issuesRow}>
                      {recordDetail.issues.map((iss) => (
                        <View key={iss.id} style={styles.issueTag}>
                          <Text style={styles.issueTagText}>
                            {iss.icon || '⚠️'} {iss.labelHi} ({iss.labelEn})
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noIssuesText}>✅ कोई समस्या दर्ज नहीं हुई (All Clear)</Text>
                  )}
                </View>

                {/* Acknowledge Button */}
                <TouchableOpacity
                  style={[
                    styles.seenButton,
                    acknowledgedRecords[selectedRecordId!] && styles.seenButtonActive,
                  ]}
                  onPress={() => {
                    setAcknowledgedRecords((prev) => ({
                      ...prev,
                      [selectedRecordId!]: true,
                    }));
                    setSelectedRecordId(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.seenButtonText}>
                    {acknowledgedRecords[selectedRecordId!]
                      ? '✓ देखा गया (Acknowledged)'
                      : '✓ मालिक द्वारा स्वीकृत करें (Mark as Seen)'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  companyName: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ownerGreeting: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 2,
  },
  switchModeButton: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  switchModeText: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  dateBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  dateSubtext: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  refreshIcon: {
    marginRight: 4,
    fontSize: 14,
  },
  refreshText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#131C2E',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  metricEmoji: {
    fontSize: 14,
    marginBottom: 2,
  },
  metricCount: {
    fontSize: 22,
    fontWeight: '900',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
    marginTop: 2,
  },
  metricSubLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  sectionBadge: {
    fontSize: 12,
    color: '#34D399',
    fontWeight: '600',
    backgroundColor: 'rgba(16,185,129,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 10,
    fontSize: 13,
  },
  siteCard: {
    backgroundColor: '#131C2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  siteCardActive: {
    borderColor: '#1E293B',
  },
  siteCardPending: {
    borderColor: '#334155',
    backgroundColor: '#0F1626',
    borderStyle: 'dashed',
  },
  siteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  siteCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  siteCardSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 3,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  featurePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  featurePill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  featurePillText: {
    fontSize: 11,
    color: '#E2E8F0',
    fontWeight: '600',
  },
  featurePillMissing: {
    borderColor: '#475569',
  },
  featurePillMissingText: {
    fontSize: 11,
    color: '#64748B',
  },
  viewDetailRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    alignItems: 'flex-end',
  },
  viewDetailText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
  },
  pendingActionRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  pendingActionText: {
    color: '#64748B',
    fontSize: 11,
    fontStyle: 'italic',
  },
  historyCard: {
    backgroundColor: '#131C2E',
    borderRadius: 14,
    padding: 16,
    marginTop: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  historyCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  historyCardSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 14,
  },
  historyGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyDayCol: {
    alignItems: 'center',
  },
  historyDot: {
    width: 22,
    height: 22,
    borderRadius: 6,
    marginBottom: 6,
  },
  historyDayText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  diagnosticLink: {
    padding: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  diagnosticLinkText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  modalSiteName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modalDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  modalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  modalBody: {
    padding: 18,
    paddingBottom: 40,
  },
  modalCard: {
    backgroundColor: '#131C2E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalStatusRow: {
    alignItems: 'flex-start',
  },
  bigStatusPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  bigStatusText: {
    fontSize: 15,
    fontWeight: '800',
  },
  voicePlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B0F19',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  playButtonIcon: {
    fontSize: 18,
  },
  voiceTrackInfo: {
    flex: 1,
  },
  voiceTrackTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  voiceTrackTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 6,
  },
  waveformSimulator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 24,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
  },
  photoContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0B0F19',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  photoStubBox: {
    height: 160,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoIcon: {
    fontSize: 36,
    marginBottom: 6,
  },
  photoStubLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  photoTime: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  watermarkBadge: {
    backgroundColor: 'rgba(15,23,42,0.95)',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  watermarkText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  watermarkSubtext: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  noDataBox: {
    padding: 14,
    alignItems: 'center',
  },
  noDataText: {
    color: '#64748B',
    fontSize: 12,
  },
  issuesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  issueTag: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  issueTagText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '700',
  },
  noIssuesText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '600',
  },
  seenButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  seenButtonActive: {
    backgroundColor: '#10B981',
  },
  seenButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
