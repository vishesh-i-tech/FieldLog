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
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { DEFAULT_API_BASE_URL } from '../src/constants/config';
import { useLanguage } from '../src/i18n';

import {
  getCurrentUser,
  getAuthTokens,
  clearAuthSession,
  initAuthSession,
  loginOwner,
  loginSupervisor,
} from '../src/services/auth.state';

interface SiteTodayItem {
  siteId: string;
  siteName: string;
  locationText?: string;
  assignedSupervisors?: {
    id: string;
    name: string;
    phone: string;
  }[];
  hasSubmitted: boolean;
  record: {
    id: string;
    status: 'full' | 'half' | 'stopped';
    capturedAt: string;
    createdAt: string;
    updatedAt?: string;
    missingPhoto: boolean;
    missingVoice: boolean;
    flags?: Record<string, any>;
    submittedBy?: string;
    submitterName?: string;
    issues?: {
      id: string;
      labelHi: string;
      labelEn: string;
      icon?: string;
    }[];
  } | null;
}

interface SupervisorItem {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
}

interface RecordDetail {
  record: {
    id: string;
    siteId: string;
    status: 'full' | 'half' | 'stopped';
    capturedAt: string;
    receivedAt: string;
    createdAt?: string;
    updatedAt?: string;
    missingPhoto: boolean;
    missingVoice: boolean;
    submittedBy: string;
    submitterName?: string;
  };
  issues: {
    id: string;
    labelHi: string;
    labelEn: string;
    icon?: string;
  }[];
  media: {
    id: string;
    kind: 'photo' | 'audio';
    storageKey: string;
    url?: string;
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
  const { lang, changeLanguage, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ownerName, setOwnerName] = useState('Owner');
  const [sitesData, setSitesData] = useState<SiteTodayItem[]>([]);
  const [supervisorsList, setSupervisorsList] = useState<SupervisorItem[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedSiteRecords, setSelectedSiteRecords] = useState<any[]>([]);
  const [selectedRecordIndex, setSelectedRecordIndex] = useState<number>(0);
  const [siteHistoryTab, setSiteHistoryTab] = useState<'dates' | 'allPhotos'>('dates');
  const [detailLoading, setDetailLoading] = useState(false);
  const [recordDetail, setRecordDetail] = useState<RecordDetail | null>(null);
  const [selectedSiteName, setSelectedSiteName] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activeAudioObj, setActiveAudioObj] = useState<any>(null);
  const [acknowledgedRecords, setAcknowledgedRecords] = useState<Record<string, boolean>>({});
  const [inspectingOwnerPhoto, setInspectingOwnerPhoto] = useState<any>(null);

  // Management modals
  const [addSiteModalVisible, setAddSiteModalVisible] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteLocation, setNewSiteLocation] = useState('');
  const [selectedSupervisorIdsForSite, setSelectedSupervisorIdsForSite] = useState<string[]>([]);
  const [savingSite, setSavingSite] = useState(false);

  const [addOfficerModalVisible, setAddOfficerModalVisible] = useState(false);
  const [newOfficerName, setNewOfficerName] = useState('');
  const [newOfficerPhone, setNewOfficerPhone] = useState('');
  const [newOfficerPin, setNewOfficerPin] = useState('1234');
  const [selectedSiteIdsForOfficer, setSelectedSiteIdsForOfficer] = useState<string[]>([]);
  const [savingOfficer, setSavingOfficer] = useState(false);

  // Quick Assign Field Officer to Site modal
  const [assignSiteModalVisible, setAssignSiteModalVisible] = useState(false);
  const [targetSiteForAssignment, setTargetSiteForAssignment] = useState<{ id: string; name: string } | null>(null);
  const [initialSupervisorIdsForTargetSite, setInitialSupervisorIdsForTargetSite] = useState<string[]>([]);
  const [selectedSupervisorIdsForTargetSite, setSelectedSupervisorIdsForTargetSite] = useState<string[]>([]);
  const [savingSiteAssignment, setSavingSiteAssignment] = useState(false);
  const [activeSupervisorName, setActiveSupervisorName] = useState('');

  // Site Category & Inline New Officer creation
  const [newSiteCategory, setNewSiteCategory] = useState('Construction');
  const [customCategory, setCustomCategory] = useState('');
  const [inlineNewOfficerVisible, setInlineNewOfficerVisible] = useState(false);
  const [inlineOfficerName, setInlineOfficerName] = useState('');
  const [inlineOfficerPhone, setInlineOfficerPhone] = useState('');
  const [inlineOfficerPin, setInlineOfficerPin] = useState('1234');
  const [savingInlineOfficer, setSavingInlineOfficer] = useState(false);

  const handleCreateInlineOfficer = async (targetFor: 'newSite' | 'existingSite') => {
    if (!inlineOfficerName.trim() || !inlineOfficerPhone.trim()) {
      Alert.alert(
        lang === 'hi' ? 'नाम और फ़ोन आवश्यक' : 'Required',
        lang === 'hi'
          ? 'कृपया अधिकारी का नाम और फ़ोन नंबर दर्ज करें'
          : 'Please enter officer name and mobile phone number'
      );
      return;
    }
    setSavingInlineOfficer(true);
    try {
      const res = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/supervisors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: inlineOfficerName.trim(),
          phone: inlineOfficerPhone.trim(),
          pin: inlineOfficerPin || '1234',
          language: 'hi',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create officer');
      }

      const created = await res.json();
      const newSup = created.supervisor;
      setSupervisorsList((prev) => [...prev, newSup]);

      if (targetFor === 'newSite') {
        setSelectedSupervisorIdsForSite((prev) => [...prev, newSup.id]);
      } else {
        setSelectedSupervisorIdsForTargetSite((prev) => [...prev, newSup.id]);
      }

      setInlineOfficerName('');
      setInlineOfficerPhone('');
      setInlineOfficerPin('1234');
      setInlineNewOfficerVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingInlineOfficer(false);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // 1. Authenticate and load live data
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      let user = getCurrentUser();
      let tokens = getAuthTokens();

      if (!tokens || !user) {
        user = await initAuthSession();
        tokens = getAuthTokens();
      }

      if (!tokens || !user || user.role !== 'owner') {
        router.replace('/login');
        return;
      }

      const accessToken = tokens.accessToken;
      setToken(accessToken);
      setOwnerName(user.name);

      // Fetch sites list with assigned supervisors
      const sitesRes = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/sites`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      let sitesMap: Record<string, any> = {};
      if (sitesRes.ok) {
        const sitesList = await sitesRes.json();
        for (const s of (sitesList.sites || [])) {
          sitesMap[s.id] = s;
        }
      }

      // Fetch today's records across all sites
      const recordsRes = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/records/today`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (recordsRes.ok) {
        const data = await recordsRes.json();
        const merged = (data.sites || []).map((s: any) => ({
          ...s,
          locationText: sitesMap[s.siteId]?.locationText || '',
          assignedSupervisors: sitesMap[s.siteId]?.assignedSupervisors || [],
        }));
        setSitesData(merged);
      }

      // Fetch supervisors list
      const supervisorsRes = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/supervisors`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (supervisorsRes.ok) {
        const supData = await supervisorsRes.json();
        const list = supData.supervisors || [];
        setSupervisorsList(list);
        if (list.length > 0) {
          setActiveSupervisorName((prev) => prev || list[0].name);
        }
      }
    } catch (err) {
      console.error('Error fetching owner data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSaveSiteAssignment = async () => {
    if (!targetSiteForAssignment) return;
    setSavingSiteAssignment(true);
    try {
      const siteId = targetSiteForAssignment.id;
      const addedIds = selectedSupervisorIdsForTargetSite.filter(
        (id) => !initialSupervisorIdsForTargetSite.includes(id)
      );
      const removedIds = initialSupervisorIdsForTargetSite.filter(
        (id) => !selectedSupervisorIdsForTargetSite.includes(id)
      );

      if (addedIds.length > 0) {
        await fetch(`${DEFAULT_API_BASE_URL}/api/v1/sites/${siteId}/assign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ supervisorIds: addedIds }),
        });
      }

      for (const remId of removedIds) {
        await fetch(`${DEFAULT_API_BASE_URL}/api/v1/sites/${siteId}/assign/${remId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      setAssignSiteModalVisible(false);
      setTargetSiteForAssignment(null);
      loadDashboardData();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingSiteAssignment(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Fetch all historical daily records for a site (Date-Wise)
  const openSiteDetail = async (siteId: string, siteName: string, initialRecordId?: string) => {
    setSelectedSiteId(siteId);
    setSelectedSiteName(siteName);
    setDetailLoading(true);
    setSiteHistoryTab('dates');
    setIsPlayingAudio(false);
    if (activeAudioObj) {
      try {
        activeAudioObj.pause();
      } catch {}
      setActiveAudioObj(null);
    }

    try {
      const res = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/sites/${siteId}/records`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        const records = data.records || [];
        setSelectedSiteRecords(records);
        if (initialRecordId) {
          const idx = records.findIndex((r: any) => r.id === initialRecordId);
          setSelectedRecordIndex(idx >= 0 ? idx : 0);
        } else {
          setSelectedRecordIndex(0);
        }
      } else {
        // Fallback to single record detail if full history endpoint is not available
        if (initialRecordId) {
          const singleRes = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/records/${initialRecordId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (singleRes.ok) {
            const single = await singleRes.json();
            setSelectedSiteRecords([{ ...single.record, issues: single.issues, media: single.media }]);
            setSelectedRecordIndex(0);
          }
        } else {
          setSelectedSiteRecords([]);
        }
      }
    } catch (err) {
      console.error('Failed to load site historical records:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Backwards compatibility alias
  const openRecordDetail = async (recordId: string, siteName: string) => {
    // Look up siteId from sitesData
    const found = sitesData.find((s) => s.record?.id === recordId);
    if (found) {
      await openSiteDetail(found.siteId, siteName, recordId);
    } else {
      setSelectedRecordId(recordId);
      setSelectedSiteName(siteName);
      setDetailLoading(true);
      try {
        const res = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/records/${recordId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const detail = await res.json();
          setSelectedSiteRecords([{ ...detail.record, issues: detail.issues, media: detail.media }]);
          setSelectedRecordIndex(0);
        }
      } catch (err) {
        console.error('Failed to load record:', err);
      } finally {
        setDetailLoading(false);
      }
    }
  };

  const handleToggleVoicePlayback = (audioMedia?: any) => {
    if (!audioMedia) return;

    if (isPlayingAudio) {
      if (activeAudioObj) {
        try {
          activeAudioObj.pause();
        } catch {}
        setActiveAudioObj(null);
      }
      setIsPlayingAudio(false);
    } else {
      setIsPlayingAudio(true);
      if (Platform.OS === 'web' && typeof Audio !== 'undefined') {
        let audioUrl = audioMedia.url;
        if (!audioUrl) {
          if (audioMedia.storageKey?.startsWith('http://') || audioMedia.storageKey?.startsWith('https://') || audioMedia.storageKey?.startsWith('data:')) {
            audioUrl = audioMedia.storageKey;
          } else {
            audioUrl = `${DEFAULT_API_BASE_URL}/api/v1/dev-storage/files/${encodeURIComponent(audioMedia.storageKey)}`;
          }
        }
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          setIsPlayingAudio(false);
          setActiveAudioObj(null);
        };
        audio.onerror = () => {
          setTimeout(() => {
            setIsPlayingAudio(false);
            setActiveAudioObj(null);
          }, (audioMedia.durationSeconds || 4) * 1000);
        };
        audio.play().catch(() => {
          setTimeout(() => {
            setIsPlayingAudio(false);
            setActiveAudioObj(null);
          }, (audioMedia.durationSeconds || 4) * 1000);
        });
        setActiveAudioObj(audio);
      } else {
        setTimeout(() => setIsPlayingAudio(false), (audioMedia.durationSeconds || 4) * 1000);
      }
    }
  };

  // Create new workplace
  const handleSaveSite = async () => {
    if (!newSiteName.trim()) {
      Alert.alert(lang === 'hi' ? 'नाम आवश्यक है' : 'Name Required', 'Please enter workplace name');
      return;
    }
    setSavingSite(true);
    try {
      const resolvedCategory = (newSiteCategory === 'Other' && customCategory.trim())
        ? customCategory.trim()
        : (newSiteCategory || 'General');

      const res = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/sites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newSiteName.trim(),
          locationText: `[${resolvedCategory}] ${newSiteLocation.trim() || 'Site Area'}`,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create workplace');
      }

      const createdSiteData = await res.json();
      const newSiteId = createdSiteData.site.id;

      // Assign supervisors if any selected
      if (selectedSupervisorIdsForSite.length > 0) {
        await fetch(`${DEFAULT_API_BASE_URL}/api/v1/sites/${newSiteId}/assign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ supervisorIds: selectedSupervisorIdsForSite }),
        });
      }

      setAddSiteModalVisible(false);
      setNewSiteName('');
      setNewSiteCategory('Construction');
      setCustomCategory('');
      setNewSiteLocation('');
      setSelectedSupervisorIdsForSite([]);
      setInlineNewOfficerVisible(false);
      loadDashboardData();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingSite(false);
    }
  };

  // Create new field officer
  const handleSaveOfficer = async () => {
    if (!newOfficerName.trim() || !newOfficerPhone.trim()) {
      Alert.alert('Required', 'Please enter field officer name and mobile number');
      return;
    }
    setSavingOfficer(true);
    try {
      const res = await fetch(`${DEFAULT_API_BASE_URL}/api/v1/supervisors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newOfficerName.trim(),
          phone: newOfficerPhone.trim(),
          pin: newOfficerPin || '1234',
          language: 'hi',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create officer');
      }

      const created = await res.json();
      const officerId = created.supervisor.id;

      // Assign to selected work places
      for (const sId of selectedSiteIdsForOfficer) {
        try {
          await fetch(`${DEFAULT_API_BASE_URL}/api/v1/sites/${sId}/assign`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ supervisorIds: [officerId] }),
          });
        } catch {}
      }

      setAddOfficerModalVisible(false);
      setNewOfficerName('');
      setNewOfficerPhone('');
      setSelectedSiteIdsForOfficer([]);
      loadDashboardData();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingOfficer(false);
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
        return { label: lang === 'hi' ? 'पूरा दिन' : 'Full Day', color: '#10B981', bg: 'rgba(16,185,129,0.15)' };
      case 'half':
        return { label: lang === 'hi' ? 'आधा दिन' : 'Half Day', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' };
      case 'stopped':
        return { label: lang === 'hi' ? 'काम बंद' : 'Stopped', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' };
      default:
        return { label: lang === 'hi' ? 'बाकी है' : 'Pending', color: '#71717A', bg: 'rgba(113,113,122,0.15)' };
    }
  };

  const todayDisplayDate = new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const currentRecord = selectedSiteRecords[selectedRecordIndex] || null;
  const audioItem = currentRecord?.media?.find((m: any) => m.kind === 'audio');
  const photosList = currentRecord?.media?.filter((m: any) => m.kind === 'photo') || [];

  // All historical photos across all dates for this site
  const allHistoricalPhotos: any[] = [];
  selectedSiteRecords.forEach((rec: any) => {
    (rec.media || []).forEach((m: any) => {
      if (m.kind === 'photo') {
        allHistoricalPhotos.push({
          ...m,
          recordDate: rec.recordDate,
          submitterName: rec.submitterName,
        });
      }
    });
  });

  const formatChipDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      const todayStr = new Date().toISOString().split('T')[0];
      const isToday = dateStr === todayStr;
      const formatted = d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      return isToday ? `${lang === 'hi' ? 'आज' : 'Today'}, ${formatted}` : formatted;
    }
    return dateStr;
  };

  const getStatusDot = (status?: string) => {
    if (status === 'full') return '🟢';
    if (status === 'half') return '🟡';
    return '🔴';
  };

  return (
    <View style={styles.container}>
      <View style={styles.mainWrapper}>
        {/* TOP BAR: Role Toggle (Admin / Field Officer) & Compact Language Toggle (EN / HN) */}
        <View style={styles.topBar}>
          {/* Role Switcher */}
          <View style={styles.roleToggle}>
            <TouchableOpacity
              style={[styles.roleBtn, styles.roleBtnActive]}
              activeOpacity={1}
            >
              <Text style={[styles.roleBtnText, styles.roleBtnTextActive]}>
                {t('admin')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.roleBtn}
              onPress={() => router.push('/record')}
              activeOpacity={0.8}
            >
              <Text style={styles.roleBtnText} numberOfLines={1}>
                👷 {activeSupervisorName || t('fieldOfficer')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Controls: Language Switcher & Logout */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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

            <TouchableOpacity
              style={styles.ownerLogoutBtn}
              onPress={async () => {
                await clearAuthSession();
                router.replace('/login');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.ownerLogoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Overview & Refresh Bar */}
          <View style={styles.dateBanner}>
            <View>
              <Text style={styles.dateHeading}>{t('dailyOverview')}</Text>
              <Text style={styles.dateSubtext}>📅 {todayDisplayDate}</Text>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={() => {
                setRefreshing(true);
                loadDashboardData();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.refreshIcon}>{refreshing ? '⏳' : '🔄'}</Text>
            </TouchableOpacity>
          </View>

          {/* 4 Status Counters */}
          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, { borderColor: '#10B981' }]}>
              <Text style={styles.metricEmoji}>🟢</Text>
              <Text style={[styles.metricCount, { color: '#10B981' }]}>{fullDayCount}</Text>
              <Text style={styles.metricLabel}>{t('statusFull')}</Text>
            </View>

            <View style={[styles.metricCard, { borderColor: '#F59E0B' }]}>
              <Text style={styles.metricEmoji}>🟡</Text>
              <Text style={[styles.metricCount, { color: '#F59E0B' }]}>{halfDayCount}</Text>
              <Text style={styles.metricLabel}>{t('statusHalf')}</Text>
            </View>

            <View style={[styles.metricCard, { borderColor: '#EF4444' }]}>
              <Text style={styles.metricEmoji}>🔴</Text>
              <Text style={[styles.metricCount, { color: '#EF4444' }]}>{stoppedCount}</Text>
              <Text style={styles.metricLabel}>{t('statusStopped')}</Text>
            </View>

            <View style={[styles.metricCard, { borderColor: '#52525B' }]}>
              <Text style={styles.metricEmoji}>⏳</Text>
              <Text style={[styles.metricCount, { color: '#A1A1AA' }]}>{pendingCount}</Text>
              <Text style={styles.metricLabel}>{t('statusPending')}</Text>
            </View>
          </View>

          {/* Management Action Bar (Single primary Add Work Place button) */}
          <View style={styles.managementBar}>
            <TouchableOpacity
              style={[styles.manageBtn, { flex: 1 }]}
              onPress={() => setAddSiteModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.manageBtnText}>+ {t('addWorkPlace')}</Text>
            </TouchableOpacity>
          </View>

          {/* Work Places List Heading */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('siteSubmissions')}</Text>
            <Text style={styles.sectionBadge}>
              {submittedCount}/{totalSites} {t('reportsReceived')}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>{t('loadingSites')}</Text>
            </View>
          ) : (
            sitesData.map((item, idx) => {
              const badge = getStatusBadge(item.record?.status);
              const isSeen = item.record ? !!acknowledgedRecords[item.record.id] : false;
              const timeDate = item.record
                ? new Date(item.record.updatedAt || item.record.capturedAt || item.record.createdAt)
                : null;
              const timeString = timeDate
                ? timeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <TouchableOpacity
                  key={item.siteId || idx}
                  style={[
                    styles.siteCard,
                    item.record ? styles.siteCardActive : styles.siteCardPending,
                  ]}
                  activeOpacity={0.75}
                  onPress={() => {
                    openSiteDetail(item.siteId, item.siteName, item.record?.id);
                  }}
                >
                  <View style={styles.siteCardHeader}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.siteCardName}>{item.siteName}</Text>
                      <Text style={styles.siteCardSub}>
                        {item.record
                          ? `⏱️ ${t('reportTime')}: ${timeString}${item.record.submitterName ? ` • ${item.record.submitterName}` : ''}`
                          : t('noReportYet')}
                      </Text>
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.color }]}>
                      <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>

                  {/* Assigned Field Officer for this site */}
                  <View style={styles.cardOfficerRow}>
                    <View style={styles.cardOfficerInfo}>
                      <Text style={styles.cardOfficerLabel}>
                        👷 {lang === 'hi' ? 'फील्ड ऑफिसर' : 'Field Officer'}:{' '}
                        {item.assignedSupervisors && item.assignedSupervisors.length > 0 ? (
                          <Text style={styles.cardOfficerName}>
                            {item.assignedSupervisors.map((s) => `${s.name} (${s.phone})`).join(', ')}
                          </Text>
                        ) : (
                          <Text style={styles.cardOfficerUnassigned}>
                            {lang === 'hi' ? 'कोई नियुक्त नहीं ⚠️' : 'Unassigned ⚠️'}
                          </Text>
                        )}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.cardOfficerActionBtn,
                        (!item.assignedSupervisors || item.assignedSupervisors.length === 0) &&
                          styles.cardOfficerActionBtnAlert,
                      ]}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setTargetSiteForAssignment({ id: item.siteId, name: item.siteName });
                        const currentIds = item.assignedSupervisors?.map((s) => s.id) || [];
                        setInitialSupervisorIdsForTargetSite(currentIds);
                        setSelectedSupervisorIdsForTargetSite(currentIds);
                        setAssignSiteModalVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cardOfficerActionBtnText}>
                        {item.assignedSupervisors && item.assignedSupervisors.length > 0
                          ? (lang === 'hi' ? 'बदलें' : 'Change')
                          : (lang === 'hi' ? '+ नियुक्त करें' : '+ Assign')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Issues preview on card */}
                  {item.record?.issues && item.record.issues.length > 0 && (
                    <View style={styles.cardIssuesContainer}>
                      {item.record.issues.map((iss) => (
                        <View key={iss.id} style={styles.cardIssueTag}>
                          <Text style={styles.cardIssueText}>
                            {iss.icon || '⚠️'} {lang === 'hi' ? iss.labelHi : (iss.labelEn || iss.labelHi)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Badges row for photo, voice note, and GPS */}
                  {item.record && (
                    <View style={styles.featurePillsRow}>
                      {!item.record.missingPhoto ? (
                        <View style={styles.featurePill}>
                          <Text style={styles.featurePillText}>📸 {lang === 'hi' ? 'फोटो' : 'Photo'}</Text>
                        </View>
                      ) : (
                        <View style={[styles.featurePill, styles.featurePillMissing]}>
                          <Text style={styles.featurePillMissingText}>📷 {lang === 'hi' ? 'फोटो नहीं' : 'No Photo'}</Text>
                        </View>
                      )}

                      {!item.record.missingVoice ? (
                        <View style={[styles.featurePill, { backgroundColor: 'rgba(37,99,235,0.15)', borderColor: '#2563EB' }]}>
                          <Text style={[styles.featurePillText, { color: '#60A5FA' }]}>🎙️ {lang === 'hi' ? 'आवाज' : 'Voice'}</Text>
                        </View>
                      ) : null}

                      <View style={[styles.featurePill, { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: '#10B981' }]}>
                        <Text style={[styles.featurePillText, { color: '#34D399' }]}>📍 {t('gpsVerified')}</Text>
                      </View>

                      {isSeen && (
                        <View style={[styles.featurePill, { backgroundColor: 'rgba(99,102,241,0.15)', borderColor: '#6366F1' }]}>
                          <Text style={[styles.featurePillText, { color: '#A5B4FC' }]}>✓ {t('markReviewed')}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  <View style={styles.viewDetailRow}>
                    <Text style={styles.viewDetailText}>
                      {item.record ? `${t('viewDetails')} →` : `📅 ${t('dateHistory')} →`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* MODAL 1: ADD WORK PLACE */}
      <Modal
        visible={addSiteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddSiteModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setAddSiteModalVisible(false)}
          />
          <View style={styles.manageSheet}>
            <View style={styles.trayHeader}>
              <Text style={styles.trayTitle}>{t('addWorkPlace')}</Text>
              <TouchableOpacity onPress={() => setAddSiteModalVisible(false)}>
                <Text style={styles.trayCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 1. Site Name */}
            <Text style={styles.inputLabel}>{t('workPlaceName')}</Text>
            <TextInput
              style={styles.trayInput}
              placeholder={lang === 'hi' ? 'कार्यस्थल का नाम' : 'Site Name'}
              placeholderTextColor="#71717A"
              value={newSiteName}
              onChangeText={setNewSiteName}
            />

            {/* 2. Site Category */}
            <Text style={styles.inputLabel}>{t('siteCategory')}</Text>
            <View style={styles.categoryChipsRow}>
              {['Construction', 'Warehouse', 'Retail', 'Manufacturing', 'Office', 'Other'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, newSiteCategory === cat && styles.categoryChipActive]}
                  onPress={() => setNewSiteCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.categoryChipText, newSiteCategory === cat && styles.categoryChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {newSiteCategory === 'Other' && (
              <TextInput
                style={[styles.trayInput, { marginTop: -6, marginBottom: 14 }]}
                placeholder={lang === 'hi' ? 'अपनी साइट श्रेणी दर्ज करें' : 'Enter Custom Category'}
                placeholderTextColor="#71717A"
                value={customCategory}
                onChangeText={setCustomCategory}
                autoFocus
              />
            )}

            {/* 3. Location */}
            <Text style={styles.inputLabel}>{t('location')}</Text>
            <TextInput
              style={styles.trayInput}
              placeholder={lang === 'hi' ? 'स्थान / पता' : 'Site Location / Address'}
              placeholderTextColor="#71717A"
              value={newSiteLocation}
              onChangeText={setNewSiteLocation}
            />

            {/* 4. Assign Officer with + icon on the left */}
            <View style={styles.assignOfficerHeaderRow}>
              <View style={styles.assignOfficerLeftRow}>
                <TouchableOpacity
                  style={styles.plusSquareBtn}
                  onPress={() => setInlineNewOfficerVisible(!inlineNewOfficerVisible)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.plusSquareText}>{inlineNewOfficerVisible ? '✕' : '+'}</Text>
                </TouchableOpacity>
                <Text style={styles.inputLabelNoMargin}>{t('assignFieldOfficer')}</Text>
              </View>
            </View>

            {inlineNewOfficerVisible && (
              <View style={styles.inlineOfficerBox}>
                <Text style={styles.inlineOfficerBoxTitle}>+ {t('addFieldOfficer')}</Text>
                <TextInput
                  style={styles.trayInputSmall}
                  placeholder={lang === 'hi' ? 'अधिकारी का नाम' : 'Officer Name'}
                  placeholderTextColor="#71717A"
                  value={inlineOfficerName}
                  onChangeText={setInlineOfficerName}
                />
                <TextInput
                  style={styles.trayInputSmall}
                  placeholder={lang === 'hi' ? 'फ़ोन नंबर (मोबाइल)' : 'Mobile Phone Number'}
                  placeholderTextColor="#71717A"
                  keyboardType="phone-pad"
                  value={inlineOfficerPhone}
                  onChangeText={setInlineOfficerPhone}
                />
                <TextInput
                  style={styles.trayInputSmall}
                  placeholder={lang === 'hi' ? '4-अंकों का पिन (डिफ़ॉल्ट 1234)' : '4-Digit PIN (Default 1234)'}
                  placeholderTextColor="#71717A"
                  keyboardType="numeric"
                  maxLength={4}
                  value={inlineOfficerPin}
                  onChangeText={setInlineOfficerPin}
                />
                <TouchableOpacity
                  style={styles.inlineOfficerSaveBtn}
                  onPress={() => handleCreateInlineOfficer('newSite')}
                  disabled={savingInlineOfficer}
                >
                  {savingInlineOfficer ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.inlineOfficerSaveBtnText}>
                      ✓ {lang === 'hi' ? 'अधिकारी जोड़ें और चुनें' : 'Add & Select Officer'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <ScrollView style={{ maxHeight: 110, marginBottom: 12 }}>
              {supervisorsList.length === 0 ? (
                <Text style={styles.noDataText}>
                  {lang === 'hi' ? 'कोई अधिकारी नहीं है। ऊपर "+ नया अधिकारी जोड़ें" दबाएं।' : 'No officers found. Tap "+ Add New Officer" above.'}
                </Text>
              ) : (
                supervisorsList.map((sup) => {
                  const isSelected = selectedSupervisorIdsForSite.includes(sup.id);
                  return (
                    <TouchableOpacity
                      key={sup.id}
                      style={[styles.officerSelectItem, isSelected && styles.officerSelectItemActive]}
                      onPress={() => {
                        setSelectedSupervisorIdsForSite((prev) =>
                          isSelected ? prev.filter((id) => id !== sup.id) : [...prev, sup.id]
                        );
                      }}
                    >
                      <Text style={styles.officerSelectName}>👷 {sup.name} ({sup.phone})</Text>
                      <Text style={styles.officerSelectCheck}>{isSelected ? '✓' : '○'}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.saveActionBtn}
              onPress={handleSaveSite}
              disabled={savingSite}
            >
              {savingSite ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveActionText}>{t('save')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: ASSIGN FIELD OFFICER TO WORKPLACE */}
      <Modal
        visible={assignSiteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAssignSiteModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setAssignSiteModalVisible(false)}
          />
          <View style={styles.manageSheet}>
            <View style={styles.trayHeader}>
              <View>
                <Text style={styles.trayTitle}>{t('assignFieldOfficer')}</Text>
                <Text style={styles.traySubtitle}>📍 {targetSiteForAssignment?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setAssignSiteModalVisible(false)}>
                <Text style={styles.trayCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Header row with + button on the left */}
            <View style={styles.assignOfficerHeaderRow}>
              <View style={styles.assignOfficerLeftRow}>
                <TouchableOpacity
                  style={styles.plusSquareBtn}
                  onPress={() => setInlineNewOfficerVisible(!inlineNewOfficerVisible)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.plusSquareText}>{inlineNewOfficerVisible ? '✕' : '+'}</Text>
                </TouchableOpacity>
                <Text style={styles.inputLabelNoMargin}>{t('assignFieldOfficer')}</Text>
              </View>
            </View>

            {inlineNewOfficerVisible && (
              <View style={styles.inlineOfficerBox}>
                <Text style={styles.inlineOfficerBoxTitle}>+ {t('addFieldOfficer')}</Text>
                <TextInput
                  style={styles.trayInputSmall}
                  placeholder={lang === 'hi' ? 'अधिकारी का नाम' : 'Officer Name'}
                  placeholderTextColor="#71717A"
                  value={inlineOfficerName}
                  onChangeText={setInlineOfficerName}
                />
                <TextInput
                  style={styles.trayInputSmall}
                  placeholder={lang === 'hi' ? 'फ़ोन नंबर (मोबाइल)' : 'Mobile Phone Number'}
                  placeholderTextColor="#71717A"
                  keyboardType="phone-pad"
                  value={inlineOfficerPhone}
                  onChangeText={setInlineOfficerPhone}
                />
                <TextInput
                  style={styles.trayInputSmall}
                  placeholder={lang === 'hi' ? '4-अंकों का पिन (डिफ़ॉल्ट 1234)' : '4-Digit PIN (Default 1234)'}
                  placeholderTextColor="#71717A"
                  keyboardType="numeric"
                  maxLength={4}
                  value={inlineOfficerPin}
                  onChangeText={setInlineOfficerPin}
                />
                <TouchableOpacity
                  style={styles.inlineOfficerSaveBtn}
                  onPress={() => handleCreateInlineOfficer('existingSite')}
                  disabled={savingInlineOfficer}
                >
                  {savingInlineOfficer ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.inlineOfficerSaveBtnText}>
                      ✓ {lang === 'hi' ? 'अधिकारी जोड़ें और चुनें' : 'Add & Select Officer'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <ScrollView style={{ maxHeight: 180, marginBottom: 12 }}>
              {supervisorsList.length === 0 ? (
                <Text style={styles.noDataText}>
                  {lang === 'hi' ? 'कोई फ़ील्ड ऑफिसर नहीं है। ऊपर "+ नया अधिकारी जोड़ें" दबाएं।' : 'No officers found. Tap "+ Add New Officer" above.'}
                </Text>
              ) : (
                supervisorsList.map((sup) => {
                  const isSelected = selectedSupervisorIdsForTargetSite.includes(sup.id);
                  return (
                    <TouchableOpacity
                      key={sup.id}
                      style={[styles.officerSelectItem, isSelected && styles.officerSelectItemActive]}
                      onPress={() => {
                        setSelectedSupervisorIdsForTargetSite((prev) =>
                          isSelected ? prev.filter((id) => id !== sup.id) : [...prev, sup.id]
                        );
                      }}
                    >
                      <View>
                        <Text style={styles.officerSelectName}>👷 {sup.name}</Text>
                        <Text style={styles.officerSelectPhone}>📞 {sup.phone}</Text>
                      </View>
                      <Text style={styles.officerSelectCheck}>{isSelected ? '✓' : '○'}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.saveActionBtn}
              onPress={handleSaveSiteAssignment}
              disabled={savingSiteAssignment}
            >
              {savingSiteAssignment ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveActionText}>{t('save')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* DETAIL INSPECTION MODAL (Date-Wise Historical Records & All Photos Gallery) */}
      <Modal
        visible={!!selectedSiteId || !!selectedRecordId}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setSelectedSiteId(null);
          setSelectedRecordId(null);
          if (activeAudioObj) {
            try { activeAudioObj.pause(); } catch {}
            setActiveAudioObj(null);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => {
              setSelectedSiteId(null);
              setSelectedRecordId(null);
              if (activeAudioObj) {
                try { activeAudioObj.pause(); } catch {}
                setActiveAudioObj(null);
              }
            }}
          />
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.modalSiteName}>{selectedSiteName}</Text>
                <Text style={styles.modalDate}>
                  📍 {selectedSiteRecords.length} {t('totalRecordsCount')} • {allHistoricalPhotos.length} {t('historicalPhotosCount')}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setSelectedSiteId(null);
                  setSelectedRecordId(null);
                  if (activeAudioObj) {
                    try { activeAudioObj.pause(); } catch {}
                    setActiveAudioObj(null);
                  }
                }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Segmented Tab Controls: Date History vs All Photos */}
            <View style={styles.historyTabRow}>
              <TouchableOpacity
                style={[styles.historyTabBtn, siteHistoryTab === 'dates' && styles.historyTabBtnActive]}
                onPress={() => setSiteHistoryTab('dates')}
                activeOpacity={0.8}
              >
                <Text style={[styles.historyTabText, siteHistoryTab === 'dates' && styles.historyTabTextActive]}>
                  📅 {t('dateHistory')} ({selectedSiteRecords.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.historyTabBtn, siteHistoryTab === 'allPhotos' && styles.historyTabBtnActive]}
                onPress={() => setSiteHistoryTab('allPhotos')}
                activeOpacity={0.8}
              >
                <Text style={[styles.historyTabText, siteHistoryTab === 'allPhotos' && styles.historyTabTextActive]}>
                  🖼️ {t('allPhotos')} ({allHistoricalPhotos.length})
                </Text>
              </TouchableOpacity>
            </View>

            {detailLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.loadingText}>{t('loadingSites')}</Text>
              </View>
            ) : siteHistoryTab === 'allPhotos' ? (
              /* TAB 2: ALL SITE PHOTOS GALLERY */
              <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.modalSectionLabel}>{t('allSitePhotos')}</Text>
                  <Text style={styles.sectionBadge}>{allHistoricalPhotos.length} {lang === 'hi' ? 'फोटो' : 'Photos'}</Text>
                </View>

                {allHistoricalPhotos.length === 0 ? (
                  <View style={styles.emptyGalleryBox}>
                    <Text style={styles.emptyGalleryIcon}>📷</Text>
                    <Text style={styles.noDataText}>
                      {lang === 'hi' ? 'इस साइट पर अभी तक कोई फोटो अपलोड नहीं की गई है।' : 'No photos uploaded yet for this site.'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.allPhotosGalleryGrid}>
                    {allHistoricalPhotos.map((p, idx) => {
                      const imgUrl = p.url || (p.storageKey?.startsWith('http') ? p.storageKey : `${DEFAULT_API_BASE_URL}/api/v1/dev-storage/files/${encodeURIComponent(p.storageKey)}`);
                      return (
                        <TouchableOpacity
                          key={p.id || idx}
                          style={styles.allPhotoCard}
                          onPress={() => setInspectingOwnerPhoto({ ...p, displayUrl: imgUrl })}
                          activeOpacity={0.85}
                        >
                          <Image source={{ uri: imgUrl }} style={styles.allPhotoThumb} resizeMode="cover" />
                          <View style={styles.allPhotoTopBadge}>
                            <Text style={styles.allPhotoDateText} numberOfLines={1}>
                              📅 {p.recordDate ? formatChipDate(p.recordDate) : 'Site Photo'}
                            </Text>
                          </View>
                          <View style={styles.allPhotoBottomBadge}>
                            <Text style={styles.allPhotoGpsText} numberOfLines={1}>
                              📍 {p.latitude ? `${Number(p.latitude).toFixed(3)}, ${Number(p.longitude).toFixed(3)}` : 'GPS OK'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            ) : (
              /* TAB 1: DATE-WISE SUBMISSION HISTORY */
              selectedSiteRecords.length === 0 ? (
                <View style={styles.emptyGalleryBox}>
                  <Text style={styles.emptyGalleryIcon}>📋</Text>
                  <Text style={styles.noDataText}>{t('noPastRecords')}</Text>
                </View>
              ) : (
                <View style={{ flex: 1 }}>
                  {/* Horizontal Scrollable Date Chips */}
                  <View style={styles.dateSelectorContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateChipsScroll}>
                      {selectedSiteRecords.map((rec, index) => {
                        const isSelected = selectedRecordIndex === index;
                        const dot = getStatusDot(rec.status);
                        return (
                          <TouchableOpacity
                            key={rec.id || index}
                            style={[styles.dateChip, isSelected && styles.dateChipActive]}
                            onPress={() => {
                              setSelectedRecordIndex(index);
                              if (activeAudioObj) {
                                try { activeAudioObj.pause(); } catch {}
                                setActiveAudioObj(null);
                              }
                              setIsPlayingAudio(false);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.dateChipDot}>{dot}</Text>
                            <Text style={[styles.dateChipText, isSelected && styles.dateChipTextActive]}>
                              {formatChipDate(rec.recordDate)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Selected Record Content */}
                  {currentRecord && (
                    <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                      {/* Submitter & Timestamp banner */}
                      <View style={styles.recordSubBanner}>
                        <Text style={styles.recordSubBannerText}>
                          📅 {formatChipDate(currentRecord.recordDate)} • {currentRecord.submitterName ? `👷 ${currentRecord.submitterName}` : 'Field Officer'}
                          {currentRecord.capturedAt ? ` • ${new Date(currentRecord.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </Text>
                      </View>

                      {/* Status */}
                      <View style={styles.modalCard}>
                        <Text style={styles.modalSectionLabel}>{t('statusLabel')}</Text>
                        <View style={styles.modalStatusRow}>
                          <View
                            style={[
                              styles.bigStatusPill,
                              {
                                backgroundColor:
                                  currentRecord.status === 'full'
                                    ? 'rgba(16,185,129,0.15)'
                                    : currentRecord.status === 'half'
                                    ? 'rgba(245,158,11,0.15)'
                                    : 'rgba(239,68,68,0.15)',
                                borderColor:
                                  currentRecord.status === 'full'
                                    ? '#10B981'
                                    : currentRecord.status === 'half'
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
                                    currentRecord.status === 'full'
                                      ? '#34D399'
                                      : currentRecord.status === 'half'
                                      ? '#FBBF24'
                                      : '#F87171',
                                },
                              ]}
                            >
                              {currentRecord.status === 'full'
                                ? (lang === 'hi' ? '🟢 पूरा दिन' : '🟢 Full Day')
                                : currentRecord.status === 'half'
                                ? (lang === 'hi' ? '🟡 आधा दिन' : '🟡 Half Day')
                                : (lang === 'hi' ? '🔴 काम बंद' : '🔴 Work Stopped')}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Voice Note */}
                      <View style={styles.modalCard}>
                        <Text style={styles.modalSectionLabel}>{t('voiceSectionTitle')}</Text>
                        {audioItem ? (
                          <View style={styles.voicePlayerCard}>
                            <TouchableOpacity
                              style={styles.playButton}
                              onPress={() => handleToggleVoicePlayback(audioItem)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.playButtonIcon}>{isPlayingAudio ? '⏸️' : '▶️'}</Text>
                            </TouchableOpacity>
                            <View style={styles.voiceTrackInfo}>
                              <Text style={styles.voiceTrackTitle}>
                                {isPlayingAudio ? t('pause') : t('playPreview')}
                              </Text>
                              <Text style={styles.voiceTrackTime}>
                                {lang === 'hi' ? 'लंबाई: ' : 'Duration: '}{formatTime(audioItem.durationSeconds || 0)}
                              </Text>
                            </View>
                          </View>
                        ) : (
                          <Text style={styles.noDataText}>
                            {lang === 'hi' ? 'कोई आवाज संदेश नहीं' : 'No voice note attached'}
                          </Text>
                        )}
                      </View>

                      {/* Photos */}
                      <View style={styles.modalCard}>
                        <View style={styles.sectionHeaderRow}>
                          <Text style={styles.modalSectionLabel}>{t('photosSectionTitle')}</Text>
                          <Text style={styles.sectionBadge}>{photosList.length} {lang === 'hi' ? 'फोटो' : 'Photos'}</Text>
                        </View>
                        {photosList.length > 0 ? (
                          <View style={styles.ownerPhotoGrid}>
                            {photosList.map((p: any, i: number) => {
                              const imgUrl = p.url || (p.storageKey?.startsWith('http') ? p.storageKey : `${DEFAULT_API_BASE_URL}/api/v1/dev-storage/files/${encodeURIComponent(p.storageKey)}`);
                              return (
                                <TouchableOpacity
                                  key={p.id || i}
                                  style={styles.ownerPhotoBox}
                                  onPress={() => setInspectingOwnerPhoto({ ...p, displayUrl: imgUrl })}
                                  activeOpacity={0.8}
                                >
                                  <Image
                                    source={{ uri: imgUrl }}
                                    style={styles.ownerPhotoThumb}
                                    resizeMode="cover"
                                  />
                                  <View style={styles.watermarkBadge}>
                                    <Text style={styles.watermarkText} numberOfLines={1}>
                                      📍 {p.latitude ? `${Number(p.latitude).toFixed(3)}, ${Number(p.longitude).toFixed(3)}` : 'GPS Tagged'}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ) : (
                          <Text style={styles.noDataText}>
                            {lang === 'hi' ? 'कोई फोटो नहीं है' : 'No photos attached'}
                          </Text>
                        )}
                      </View>

                      {/* Issues Reported */}
                      <View style={styles.modalCard}>
                        <Text style={styles.modalSectionLabel}>{t('issuesReported')}</Text>
                        {currentRecord.issues && currentRecord.issues.length > 0 ? (
                          <View style={styles.issuesRow}>
                            {currentRecord.issues.map((iss: any) => (
                              <View key={iss.id} style={styles.issueTag}>
                                <Text style={styles.issueTagText}>
                                  {iss.icon ? `${iss.icon} ` : '⚠️ '}
                                  {lang === 'hi' ? iss.labelHi : (iss.labelEn || iss.labelHi)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.noIssuesText}>
                            ✓ {lang === 'hi' ? 'कोई समस्या नहीं' : 'No issues reported'}
                          </Text>
                        )}
                      </View>

                      {/* Reviewed Button */}
                      <TouchableOpacity
                        style={[
                          styles.seenButton,
                          currentRecord.id && acknowledgedRecords[currentRecord.id] && styles.seenButtonActive,
                        ]}
                        onPress={() => {
                          if (currentRecord?.id) {
                            setAcknowledgedRecords((prev) => ({
                              ...prev,
                              [currentRecord.id]: true,
                            }));
                          }
                          setSelectedSiteId(null);
                          setSelectedRecordId(null);
                          if (activeAudioObj) {
                            try { activeAudioObj.pause(); } catch {}
                            setActiveAudioObj(null);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.seenButtonText}>
                          {currentRecord?.id && acknowledgedRecords[currentRecord.id]
                            ? `✓ ${t('markReviewed')}`
                            : `✓ ${t('acknowledge')}`}
                        </Text>
                      </TouchableOpacity>
                    </ScrollView>
                  )}
                </View>
              )
            )}
          </View>
        </View>
      </Modal>

      {/* OWNER FULL PHOTO INSPECTION MODAL */}
      <Modal
        visible={!!inspectingOwnerPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setInspectingOwnerPhoto(null)}
      >
        <View style={[styles.modalBackdrop, { justifyContent: 'center' }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setInspectingOwnerPhoto(null)}
          />
          <View style={styles.inspectPhotoCard}>
            <View style={styles.inspectHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inspectTitle}>{lang === 'hi' ? 'साइट फोटो' : 'Site Photo'}</Text>
                <Text style={styles.inspectSub}>
                  ✓ {lang === 'hi' ? 'जीपीएस सत्यापित' : 'GPS Verified'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setInspectingOwnerPhoto(null)} style={{ padding: 4 }}>
                <Text style={styles.trayCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {inspectingOwnerPhoto && (
              <View style={styles.inspectImageWrapper}>
                <Image
                  source={{ uri: inspectingOwnerPhoto.displayUrl }}
                  style={styles.inspectImage}
                  resizeMode="contain"
                />
              </View>
            )}

            <View style={styles.inspectDetailsBox}>
              <Text style={styles.inspectGpsText}>
                📍 Lat: {inspectingOwnerPhoto?.latitude ? Number(inspectingOwnerPhoto.latitude).toFixed(5) : '28.53550'}° N, Long: {inspectingOwnerPhoto?.longitude ? Number(inspectingOwnerPhoto.longitude).toFixed(5) : '77.39100'}° E
              </Text>
              <Text style={styles.inspectTimeText}>
                📅 {inspectingOwnerPhoto?.capturedAt ? new Date(inspectingOwnerPhoto.capturedAt).toLocaleString() : ''}
              </Text>
            </View>

            <View style={styles.inspectActionsRow}>
              <TouchableOpacity
                style={styles.inspectCloseBtn}
                onPress={() => setInspectingOwnerPhoto(null)}
              >
                <Text style={styles.inspectCloseBtnText}>{t('close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
    backgroundColor: '#1E1E1E',
  },
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: '#121212',
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
    backgroundColor: '#121212',
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
  ownerLogoutBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  ownerLogoutText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700',
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
  scrollContent: {
    padding: 12,
    paddingBottom: 30,
  },
  dateBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dateSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  refreshIcon: {
    fontSize: 12,
  },
  refreshText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
  },
  metricEmoji: {
    fontSize: 13,
    marginBottom: 2,
  },
  metricCount: {
    fontSize: 16,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  // Management Buttons Bar
  managementBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  manageBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageBtnSecondary: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  manageBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sectionBadge: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 8,
    fontSize: 12,
  },
  siteCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  siteCardActive: {
    borderColor: '#334155',
  },
  siteCardPending: {
    opacity: 0.85,
  },
  siteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  siteCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  siteCardSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardIssuesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  cardIssueTag: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  cardIssueText: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '600',
  },
  featurePillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  featurePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  featurePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#34D399',
  },
  featurePillMissing: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  featurePillMissingText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#F87171',
  },
  viewDetailRow: {
    marginTop: 6,
    alignItems: 'flex-end',
  },
  viewDetailText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  cardOfficerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181B',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  cardOfficerInfo: {
    flex: 1,
    paddingRight: 8,
  },
  cardOfficerLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
  },
  cardOfficerName: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  cardOfficerUnassigned: {
    color: '#F59E0B',
    fontWeight: '700',
  },
  cardOfficerActionBtn: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  cardOfficerActionBtnAlert: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#F59E0B',
  },
  cardOfficerActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  officerSelectPhone: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  // Modal Backdrop & Sheets
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  manageSheet: {
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
    marginBottom: 10,
  },
  trayTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  traySubtitle: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
    marginTop: 2,
  },
  trayCloseText: {
    fontSize: 15,
    color: '#94A3B8',
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 6,
  },
  trayInput: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 8,
    color: '#FFFFFF',
    fontSize: 13,
  },
  officerSelectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#121212',
    borderRadius: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  officerSelectItemActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  officerSelectName: {
    color: '#E2E8F0',
    fontSize: 12,
  },
  officerSelectCheck: {
    color: '#38BDF8',
    fontWeight: '900',
    fontSize: 14,
  },
  saveActionBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  saveActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  // Record Detail Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#121212',
    marginTop: 50,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  modalSiteName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  modalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  modalBody: {
    padding: 16,
    gap: 12,
  },
  modalCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 8,
  },
  modalStatusRow: {
    flexDirection: 'row',
  },
  bigStatusPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  bigStatusText: {
    fontSize: 13,
    fontWeight: '800',
  },
  voicePlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonIcon: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  voiceTrackInfo: {
    flex: 1,
  },
  voiceTrackTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  voiceTrackTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  photoContainer: {
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  photoStubBox: {
    padding: 16,
    alignItems: 'center',
  },
  photoIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  photoStubLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  photoTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  watermarkBadge: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  watermarkText: {
    fontSize: 9,
    color: '#34D399',
    textAlign: 'center',
    fontWeight: '700',
  },
  noDataText: {
    fontSize: 12,
    color: '#71717A',
    fontStyle: 'italic',
  },
  issuesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  issueTag: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  issueTagText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700',
  },
  noIssuesText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  seenButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  seenButtonActive: {
    backgroundColor: '#10B981',
  },
  seenButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  ownerPhotoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  ownerPhotoBox: {
    width: 90,
    height: 90,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#334155',
  },
  ownerPhotoThumb: {
    width: '100%',
    height: '100%',
  },
  inspectPhotoCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    padding: 14,
    width: '90%',
    maxWidth: 420,
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
    height: 280,
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
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  categoryChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  categoryChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  categoryChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  assignOfficerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  assignOfficerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plusSquareBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  plusSquareText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
    textAlign: 'center',
  },
  inputLabelNoMargin: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  addInlineOfficerToggle: {
    backgroundColor: '#1E293B',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  addInlineOfficerToggleText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '700',
  },
  inlineOfficerBox: {
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E3A8A',
    marginBottom: 12,
  },
  inlineOfficerBoxTitle: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  trayInputSmall: {
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
    fontSize: 13,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inlineOfficerSaveBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 2,
  },
  inlineOfficerSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  // Date History & Photos Gallery styles
  historyTabRow: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  historyTabBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  historyTabBtnActive: {
    backgroundColor: '#2563EB',
  },
  historyTabText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  historyTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  emptyGalleryBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGalleryIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  dateSelectorContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
    backgroundColor: '#161618',
  },
  dateChipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  dateChipActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderColor: '#38BDF8',
  },
  dateChipDot: {
    fontSize: 10,
  },
  dateChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  dateChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  recordSubBanner: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  recordSubBannerText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  allPhotosGalleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  allPhotoCard: {
    width: '48%',
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#334155',
  },
  allPhotoThumb: {
    width: '100%',
    height: '100%',
  },
  allPhotoTopBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  allPhotoDateText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  allPhotoBottomBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  allPhotoGpsText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
});
