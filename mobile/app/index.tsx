import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { checkServerHealth, HealthCheckResponse } from '../src/api/client';
import { DEFAULT_API_BASE_URL } from '../src/constants/config';
import { useRouter } from 'expo-router';

export default function StatusScreen() {
  const router = useRouter();
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_BASE_URL);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const performHealthCheck = async (urlToTest = apiUrl) => {
    setLoading(true);
    try {
      const result = await checkServerHealth(urlToTest);
      setHealthData(result);
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    performHealthCheck(apiUrl);
  }, []);

  const getStatusBadge = () => {
    if (loading) {
      return {
        bg: '#1E293B',
        border: '#334155',
        text: 'Checking Connection...',
        color: '#94A3B8',
        icon: '🔄',
      };
    }
    if (!healthData) {
      return {
        bg: '#1E293B',
        border: '#334155',
        text: 'Not Checked',
        color: '#94A3B8',
        icon: '⏳',
      };
    }

    if (healthData.status === 'healthy') {
      return {
        bg: 'rgba(16, 185, 129, 0.15)',
        border: '#10B981',
        text: 'All Systems Operational',
        color: '#34D399',
        icon: '✅',
      };
    }
    if (healthData.status === 'pending_configuration') {
      return {
        bg: 'rgba(245, 158, 11, 0.15)',
        border: '#F59E0B',
        text: 'Backend OK • Awaiting Neon .env',
        color: '#FBBF24',
        icon: '⚠️',
      };
    }
    if (healthData.status === 'degraded') {
      return {
        bg: 'rgba(234, 179, 8, 0.15)',
        border: '#EAB308',
        text: 'Neon Waking Up / Connecting...',
        color: '#FDE047',
        icon: '⏳',
      };
    }
    return {
      bg: 'rgba(239, 68, 68, 0.15)',
      border: '#EF4444',
      text: 'Backend Unreachable',
      color: '#F87171',
      icon: '❌',
    };
  };

  const badge = getStatusBadge();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Title */}
        <View style={styles.header}>
          <Text style={styles.title}>FieldLog</Text>
          <Text style={styles.subtitle}>System Health & Diagnostic Hub</Text>
        </View>

        {/* Big Status Badge */}
        <View style={[styles.badgeContainer, { backgroundColor: badge.bg, borderColor: badge.border }]}>
          <Text style={styles.badgeIcon}>{badge.icon}</Text>
          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
        </View>

        {/* Detailed Status Cards */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Server & Database Diagnostic</Text>

          {/* Backend Status Row */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fastify Backend:</Text>
            <Text style={[styles.infoValue, { color: healthData?.status === 'offline' ? '#F87171' : '#34D399' }]}>
              {healthData?.status === 'offline' ? 'Offline' : 'Online (Port 4000)'}
            </Text>
          </View>

          {/* Neon Database Row */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Neon Postgres:</Text>
            <Text
              style={[
                styles.infoValue,
                {
                  color:
                    healthData?.database === 'connected'
                      ? '#34D399'
                      : healthData?.database === 'not_configured'
                      ? '#FBBF24'
                      : '#F87171',
                },
              ]}
            >
              {healthData?.database === 'connected'
                ? 'Connected'
                : healthData?.database === 'not_configured'
                ? 'Not Configured Yet'
                : healthData?.database === 'unreachable'
                ? 'Unreachable'
                : 'Connecting / Degraded'}
            </Text>
          </View>

          {/* Latency if available */}
          {healthData?.databaseLatencyMs !== undefined && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Neon Latency:</Text>
              <Text style={styles.infoValue}>{healthData.databaseLatencyMs} ms</Text>
            </View>
          )}

          {/* Uptime if available */}
          {healthData?.uptimeSeconds !== undefined && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Server Uptime:</Text>
              <Text style={styles.infoValue}>{healthData.uptimeSeconds} seconds</Text>
            </View>
          )}

          {/* Last Check Timestamp */}
          {lastChecked && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Pinged:</Text>
              <Text style={styles.infoValue}>{lastChecked}</Text>
            </View>
          )}

          {/* Message / Guidance */}
          {healthData?.message && (
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{healthData.message}</Text>
              {healthData.instruction && (
                <Text style={styles.instructionText}>{healthData.instruction}</Text>
              )}
            </View>
          )}

          {/* Error explanation if present */}
          {healthData?.error && (
            <View style={[styles.messageBox, styles.errorBox]}>
              <Text style={styles.errorText}>{healthData.error}</Text>
            </View>
          )}
        </View>

        {/* API URL Configuration Card */}
        <View style={styles.card}>
          <View style={styles.urlHeaderRow}>
            <Text style={styles.cardHeader}>Backend URL (Phone → Laptop)</Text>
            <TouchableOpacity onPress={() => setIsEditingUrl(!isEditingUrl)}>
              <Text style={styles.editButtonText}>{isEditingUrl ? 'Done' : 'Change IP'}</Text>
            </TouchableOpacity>
          </View>

          {isEditingUrl ? (
            <TextInput
              style={styles.urlInput}
              value={apiUrl}
              onChangeText={setApiUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://192.168.x.x:4000"
              placeholderTextColor="#64748B"
            />
          ) : (
            <Text style={styles.urlDisplay}>{apiUrl}</Text>
          )}
          <Text style={styles.urlHint}>
            Both devices must be on the same Wi-Fi. Default set to your laptop's Wi-Fi IP.
          </Text>
        </View>

        {/* Open Phase 3 Today's Record Screen Button */}
        <TouchableOpacity
          style={styles.openRecordButton}
          onPress={() => router.push('/record')}
          activeOpacity={0.8}
        >
          <Text style={styles.openRecordIcon}>📝</Text>
          <View style={styles.openRecordTextContainer}>
            <Text style={styles.openRecordTitle}>आज का रिकॉर्ड भरें</Text>
            <Text style={styles.openRecordSubtitle}>Test Today's Record (Live Camera + GPS)</Text>
          </View>
          <Text style={styles.openRecordArrow}>→</Text>
        </TouchableOpacity>

        {/* Phase Progress Notice */}
        <View style={styles.footerNotice}>
          <Text style={styles.footerTitle}>Phase 3 Ready for Phone Testing</Text>
          <Text style={styles.footerDescription}>
            Phase 1 (Auth & Multi-tenancy) and Phase 2 (Work Places & Assignments) are complete. Test Phase 3's Today's Record screen with live camera and GPS above.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  badgeIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  badgeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#131C2E',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  infoLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  messageBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#1E293B',
    borderRadius: 8,
  },
  messageText: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 18,
  },
  instructionText: {
    fontSize: 12,
    color: '#FBBF24',
    marginTop: 6,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  errorText: {
    fontSize: 13,
    color: '#FCA5A5',
    lineHeight: 18,
  },
  urlHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editButtonText: {
    color: '#38BDF8',
    fontWeight: '600',
    fontSize: 13,
  },
  urlDisplay: {
    fontSize: 15,
    fontFamily: 'monospace',
    color: '#38BDF8',
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 8,
    marginTop: 6,
  },
  urlInput: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#F8FAFC',
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38BDF8',
    marginTop: 6,
  },
  urlHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
    lineHeight: 16,
  },
  actionButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 54, // Big touch target
  },
  actionButtonDisabled: {
    backgroundColor: '#1E3A8A',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  openRecordButton: {
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginBottom: 20,
    minHeight: 64,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  openRecordIcon: {
    fontSize: 26,
    marginRight: 14,
  },
  openRecordTextContainer: {
    flex: 1,
  },
  openRecordTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  openRecordSubtitle: {
    color: '#BAE6FD',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  openRecordArrow: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginLeft: 8,
  },
  footerNotice: {
    padding: 16,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  footerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
  },
  footerDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
});
