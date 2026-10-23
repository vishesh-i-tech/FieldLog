import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  Modal,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { DEFAULT_API_BASE_URL } from '../src/constants/config';
import { checkServerHealth, HealthCheckResponse } from '../src/api/client';
import {
  initAuthSession,
  clearAuthSession,
  UserSession,
} from '../src/services/auth.state';
import { FinoraTheme } from '../src/theme/finora';

// Local Finora Image Assets
const HERO_IMAGE = require('../assets/images/hero.jpg');
const AVATAR_IMAGE = require('../assets/images/avatar.jpg');
const MOUNTAIN_BANNER = require('../assets/images/mountains.jpg');

type FinoraTab = 'home' | 'analytics' | 'workplaces' | 'goals' | 'profile';
type AnalyticsPeriod = 'week' | 'month' | 'year';
type WorkplaceFilter = 'all' | 'full' | 'half' | 'stopped';

interface SiteItem {
  id: string;
  name: string;
  category: 'construction' | 'solar' | 'depot' | 'factory' | 'fleet';
  supervisor: string;
  supervisorPhone: string;
  status: 'full' | 'half' | 'stopped' | 'pending';
  time: string;
  compliancePct: number;
  location: string;
  hasVoice: boolean;
  hasPhoto: boolean;
}

export default function FinoraFieldLogApp() {
  const router = useRouter();

  // Navigation & Mode
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState<FinoraTab>('home');
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);

  // Home Screen States
  const [balanceVisible, setBalanceVisible] = useState(true);

  // Analytics Screen States
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('month');
  const [selectedBarIndex, setSelectedBarIndex] = useState<number>(4); // June / Active

  // Workplaces Screen States
  const [workplaceFilter, setWorkplaceFilter] = useState<WorkplaceFilter>('all');
  const [selectedSiteDetail, setSelectedSiteDetail] = useState<SiteItem | null>(null);
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [siteToReassign, setSiteToReassign] = useState<SiteItem | null>(null);
  const [newSupervisorName, setNewSupervisorName] = useState('');

  // Quick Record Modal State
  const [quickRecordVisible, setQuickRecordVisible] = useState(false);
  const [quickStatus, setQuickStatus] = useState<'full' | 'half' | 'stopped'>('full');
  const [quickSelectedSite, setQuickSelectedSite] = useState('Highway Solar Farm 4A');
  const [quickNotes, setQuickNotes] = useState('');
  const [quickSubmittedSuccess, setQuickSubmittedSuccess] = useState(false);

  // Our Operational Workplace Data
  const [sitesList, setSitesList] = useState<SiteItem[]>([
    {
      id: 'site-01',
      name: 'Highway Solar Farm 4A',
      category: 'solar',
      supervisor: 'Ayesha Khan',
      supervisorPhone: '+91 98765 43210',
      status: 'full',
      time: 'Today, 10:24 AM',
      compliancePct: 98,
      location: 'KM 42, North Express Corridor',
      hasVoice: true,
      hasPhoto: true,
    },
    {
      id: 'site-02',
      name: 'Downtown Metro Terminal',
      category: 'construction',
      supervisor: 'Vikram Singh',
      supervisorPhone: '+91 98111 22334',
      status: 'half',
      time: 'Today, 09:15 AM',
      compliancePct: 84,
      location: 'South Depot Sector 12',
      hasVoice: true,
      hasPhoto: true,
    },
    {
      id: 'site-03',
      name: 'North Logistics Depot',
      category: 'depot',
      supervisor: 'Rajesh Sharma',
      supervisorPhone: '+91 98222 33445',
      status: 'full',
      time: 'Today, 08:30 AM',
      compliancePct: 100,
      location: 'Plot 4, Industrial Zone A',
      hasVoice: false,
      hasPhoto: true,
    },
    {
      id: 'site-04',
      name: 'Greenfield Cement Plant',
      category: 'factory',
      supervisor: 'Pooja Verma',
      supervisorPhone: '+91 98333 44556',
      status: 'stopped',
      time: 'Yesterday, 06:45 PM',
      compliancePct: 62,
      location: 'Eastern Bypass Gate 2',
      hasVoice: true,
      hasPhoto: true,
    },
    {
      id: 'site-05',
      name: 'River Valley Bridge Works',
      category: 'construction',
      supervisor: 'Ayesha Khan',
      supervisorPhone: '+91 98765 43210',
      status: 'full',
      time: 'Yesterday, 08:15 PM',
      compliancePct: 95,
      location: 'Bridge Pier 7, South Bank',
      hasVoice: true,
      hasPhoto: true,
    },
    {
      id: 'site-06',
      name: 'Rural Fleet & Khata Yard',
      category: 'fleet',
      supervisor: 'Amit Patel',
      supervisorPhone: '+91 98444 55667',
      status: 'full',
      time: 'Apr 28, 02:32 PM',
      compliancePct: 92,
      location: 'Central Machinery Yard',
      hasVoice: true,
      hasPhoto: true,
    },
  ]);

  // Load backend session & health
  useEffect(() => {
    initAuthSession().then((user) => {
      if (user) {
        setCurrentUser(user);
      }
    });

    checkServerHealth(DEFAULT_API_BASE_URL).then((res) => {
      setHealthData(res);
    });
  }, []);

  // Handle Quick Reassign
  const handleConfirmReassign = () => {
    if (!siteToReassign || !newSupervisorName.trim()) return;
    setSitesList((prev) =>
      prev.map((s) =>
        s.id === siteToReassign.id
          ? { ...s, supervisor: newSupervisorName.trim() }
          : s
      )
    );
    setReassignModalVisible(false);
    setSiteToReassign(null);
    setNewSupervisorName('');
  };

  // Handle Quick Record Submit
  const handleQuickRecordSubmit = () => {
    setQuickSubmittedSuccess(true);
    setTimeout(() => {
      setQuickSubmittedSuccess(false);
      setQuickRecordVisible(false);
      setQuickNotes('');
    }, 1200);
  };

  // Category Icon & Color Helper
  const getCategoryMeta = (cat: SiteItem['category']) => {
    switch (cat) {
      case 'solar':
        return { icon: '☀️', bg: '#ECFDF5', color: '#059669', label: 'Solar Farm' };
      case 'construction':
        return { icon: '🏗️', bg: '#FFF7ED', color: '#EA580C', label: 'Construction' };
      case 'depot':
        return { icon: '📦', bg: '#EFF6FF', color: '#2563EB', label: 'Logistics' };
      case 'factory':
        return { icon: '🏭', bg: '#FAF5FF', color: '#9333EA', label: 'Plant' };
      case 'fleet':
        return { icon: '🚜', bg: '#FEF3C7', color: '#D97706', label: 'Machinery' };
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: SiteItem['status']) => {
    switch (status) {
      case 'full':
        return { text: 'Full Day', color: '#059669', bg: '#D1FAE5', sign: '+' };
      case 'half':
        return { text: 'Half Day', color: '#D97706', bg: '#FEF3C7', sign: '+' };
      case 'stopped':
        return { text: 'Stopped', color: '#DC2626', bg: '#FEE2E2', sign: '-' };
      default:
        return { text: 'Pending', color: '#6B7280', bg: '#F3F4F6', sign: '•' };
    }
  };

  // Filtered sites for Workplaces tab
  const filteredSites = sitesList.filter((site) => {
    if (workplaceFilter === 'all') return true;
    return site.status === workplaceFilter;
  });

  // Calculate Verification Stats
  const totalSites = sitesList.length;
  const verifiedSites = sitesList.filter((s) => s.status !== 'pending').length;
  const fullDayCount = sitesList.filter((s) => s.status === 'full').length;
  const halfDayCount = sitesList.filter((s) => s.status === 'half').length;
  const stoppedCount = sitesList.filter((s) => s.status === 'stopped').length;
  const verifiedPercentage = Math.round((verifiedSites / totalSites) * 100);

  // -------------------------------------------------------------
  // SCREEN 1: ONBOARDING / LANDING VIEW (Finora Screen 1)
  // -------------------------------------------------------------
  if (showOnboarding) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.onboardingScroll} showsVerticalScrollIndicator={false}>
          {/* Top Logo */}
          <View style={styles.onboardingLogoRow}>
            <View style={styles.logoLeafBadge}>
              <Text style={styles.logoLeafIcon}>🌿</Text>
            </View>
            <Text style={styles.logoBrandText}>Finora FieldLog</Text>
          </View>

          {/* Headline & Subtitle */}
          <View style={styles.onboardingHeroTextWrapper}>
            <Text style={styles.onboardingHeadline}>
              Take Control{'\n'}of Your Operations
            </Text>
            <Text style={styles.onboardingSubtitle}>
              Record smart, verify on-site with verifiable GPS & voice notes, reach 100% compliance.
            </Text>
          </View>

          {/* Hero Illustration */}
          <View style={styles.onboardingIllustrationCard}>
            <Image source={HERO_IMAGE} style={styles.onboardingImage} resizeMode="cover" />
          </View>

          {/* Primary Action Button */}
          <TouchableOpacity
            style={styles.onboardingPrimaryBtn}
            activeOpacity={0.85}
            onPress={() => setShowOnboarding(false)}
          >
            <Text style={styles.onboardingPrimaryBtnText}>Get Started →</Text>
          </TouchableOpacity>

          {/* Secondary Action */}
          <TouchableOpacity
            style={styles.onboardingSecondaryRow}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.onboardingSecondaryMuted}>Already have an account? </Text>
            <Text style={styles.onboardingSecondaryLink}>Sign In</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------
  // MAIN APP INTERFACE WITH 5 FINORA TABS
  // -------------------------------------------------------------
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainCanvas}>
        {/* ========================================================= */}
        {/* TAB 1: HOME (Finora Screen 2)                             */}
        {/* ========================================================= */}
        {activeTab === 'home' && (
          <ScrollView
            style={styles.tabScrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Top Bar Greeting */}
            <View style={styles.homeHeaderRow}>
              <View>
                <Text style={styles.homeGreetingMuted}>Good Morning,</Text>
                <Text style={styles.homeUserName}>
                  {currentUser ? currentUser.name : 'Ayesha Khan'} 👋
                </Text>
              </View>
              <TouchableOpacity
                style={styles.avatarWrapper}
                onPress={() => setActiveTab('profile')}
              >
                <Image source={AVATAR_IMAGE} style={styles.avatarImage} />
                <View style={styles.avatarOnlineDot} />
              </TouchableOpacity>
            </View>

            {/* Dark Forest Emerald Hero Card */}
            <View style={styles.heroGradientCard}>
              <View style={styles.heroCardTopRow}>
                <Text style={styles.heroCardLabel}>Total Operational Sites</Text>
                <TouchableOpacity
                  onPress={() => setBalanceVisible(!balanceVisible)}
                  style={styles.heroEyeButton}
                >
                  <Text style={styles.heroEyeIcon}>{balanceVisible ? '👁️' : '🔒'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.heroCardBalance}>
                {balanceVisible ? `${verifiedSites} / ${totalSites} Sites` : '••••••••'}
              </Text>

              <View style={styles.heroCardBottomRow}>
                <View style={styles.heroGrowthBadge}>
                  <Text style={styles.heroGrowthText}>
                    🟢 {verifiedPercentage}% Verified Today
                  </Text>
                </View>
                <View style={styles.heroVisaBadge}>
                  <Text style={styles.heroVisaText}>FIELDLOG PRO</Text>
                </View>
              </View>
            </View>

            {/* 4 Quick Action Circle Buttons */}
            <View style={styles.actionCirclesRow}>
              <TouchableOpacity
                style={styles.actionCircleItem}
                onPress={() => setQuickRecordVisible(true)}
              >
                <View style={styles.actionCircleButton}>
                  <Text style={styles.actionCircleEmoji}>📝</Text>
                </View>
                <Text style={styles.actionCircleLabel}>Record</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCircleItem}
                onPress={() => setActiveTab('workplaces')}
              >
                <View style={styles.actionCircleButton}>
                  <Text style={styles.actionCircleEmoji}>📍</Text>
                </View>
                <Text style={styles.actionCircleLabel}>Sites</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCircleItem}
                onPress={() => router.push('/record')}
              >
                <View style={styles.actionCircleButton}>
                  <Text style={styles.actionCircleEmoji}>🎙️</Text>
                </View>
                <Text style={styles.actionCircleLabel}>Voice SOP</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCircleItem}
                onPress={() => setActiveTab('analytics')}
              >
                <View style={styles.actionCircleButton}>
                  <Text style={styles.actionCircleEmoji}>⚡</Text>
                </View>
                <Text style={styles.actionCircleLabel}>Analytics</Text>
              </TouchableOpacity>
            </View>

            {/* Section Header: Recent Workplace Submissions */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Submissions</Text>
              <TouchableOpacity onPress={() => setActiveTab('workplaces')}>
                <Text style={styles.sectionSeeAll}>See All →</Text>
              </TouchableOpacity>
            </View>

            {/* Feed Cards */}
            <View style={styles.recentListContainer}>
              {sitesList.slice(0, 5).map((site) => {
                const meta = getCategoryMeta(site.category);
                const badge = getStatusBadge(site.status);
                return (
                  <TouchableOpacity
                    key={site.id}
                    style={styles.recentCard}
                    activeOpacity={0.7}
                    onPress={() => setSelectedSiteDetail(site)}
                  >
                    <View style={[styles.recentIconBox, { backgroundColor: meta.bg }]}>
                      <Text style={styles.recentIconEmoji}>{meta.icon}</Text>
                    </View>

                    <View style={styles.recentInfoCol}>
                      <Text style={styles.recentSiteName} numberOfLines={1}>
                        {site.name}
                      </Text>
                      <Text style={styles.recentMetaText}>
                        {site.supervisor} • {site.time}
                      </Text>
                    </View>

                    <View style={[styles.statusPillBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.statusPillText, { color: badge.color }]}>
                        {badge.sign} {badge.text}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* ========================================================= */}
        {/* TAB 2: ANALYTICS (Finora Screen 3)                        */}
        {/* ========================================================= */}
        {activeTab === 'analytics' && (
          <ScrollView
            style={styles.tabScrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.innerHeaderRow}>
              <TouchableOpacity onPress={() => setActiveTab('home')} style={styles.backButton}>
                <Text style={styles.backButtonIcon}>←</Text>
              </TouchableOpacity>
              <Text style={styles.innerHeaderTitle}>Operations Analytics</Text>
              <View style={styles.headerRightIconBox}>
                <Text style={styles.headerRightIconEmoji}>📅</Text>
              </View>
            </View>

            {/* Segmented Filter Pills */}
            <View style={styles.segmentedTabsRow}>
              {(['week', 'month', 'year'] as AnalyticsPeriod[]).map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.segmentButton,
                    analyticsPeriod === period && styles.segmentButtonActive,
                  ]}
                  onPress={() => setAnalyticsPeriod(period)}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      analyticsPeriod === period && styles.segmentButtonTextActive,
                    ]}
                  >
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Total Metric Card */}
            <View style={styles.analyticsTotalCard}>
              <Text style={styles.analyticsTotalLabel}>Total Field Verifications</Text>
              <Text style={styles.analyticsTotalValue}>124 Logs</Text>
              <View style={styles.analyticsTrendRow}>
                <Text style={styles.analyticsTrendText}>▲ 8.2% vs last month</Text>
              </View>
            </View>

            {/* Interactive Bar Chart matching Finora Screen 3 */}
            <View style={styles.barChartCard}>
              {/* Highlight Tooltip */}
              <View style={styles.chartTooltipWrapper}>
                <View style={styles.chartTooltipBubble}>
                  <Text style={styles.chartTooltipText}>24 Logs</Text>
                </View>
              </View>

              {/* Bars */}
              <View style={styles.chartBarsRow}>
                {[
                  { month: 'Jan', height: 45 },
                  { month: 'Feb', height: 60 },
                  { month: 'Mar', height: 95 },
                  { month: 'Apr', height: 50 },
                  { month: 'May', height: 110 },
                  { month: 'Jun', height: 80 },
                ].map((bar, idx) => {
                  const isSelected = selectedBarIndex === idx;
                  return (
                    <TouchableOpacity
                      key={bar.month}
                      style={styles.barColumn}
                      onPress={() => setSelectedBarIndex(idx)}
                    >
                      <View
                        style={[
                          styles.barFill,
                          { height: bar.height },
                          isSelected && styles.barFillActive,
                        ]}
                      />
                      <Text
                        style={[
                          styles.barMonthLabel,
                          isSelected && styles.barMonthLabelActive,
                        ]}
                      >
                        {bar.month}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Top Reported Obstacles / Issues breakdown */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Top Reported Issues</Text>
              <Text style={styles.sectionSeeAll}>See All →</Text>
            </View>

            <View style={styles.categoryBreakdownList}>
              {[
                { title: 'Rain / Bad Weather', pct: '38%', count: '24 sites', color: '#EA580C', bg: '#FFF7ED', icon: '🌧️' },
                { title: 'Machine / Vehicle breakdown', pct: '24%', count: '16 sites', color: '#2563EB', bg: '#EFF6FF', icon: '🚜' },
                { title: 'Material / Stock Shortage', pct: '18%', count: '12 sites', color: '#D97706', bg: '#FEF3C7', icon: '🧱' },
                { title: 'Less Manpower / Staff', pct: '12%', count: '8 sites', color: '#DC2626', bg: '#FEE2E2', icon: '👥' },
                { title: 'Power / Fuel Cut', pct: '8%', count: '5 sites', color: '#7C3AED', bg: '#FAF5FF', icon: '⚡' },
              ].map((cat, idx) => (
                <View key={idx} style={styles.categoryRowCard}>
                  <View style={[styles.catIconBox, { backgroundColor: cat.bg }]}>
                    <Text style={styles.catEmoji}>{cat.icon}</Text>
                  </View>
                  <View style={styles.catDetailsCol}>
                    <Text style={styles.catTitle}>{cat.title}</Text>
                    <View style={styles.catProgressBg}>
                      <View
                        style={[
                          styles.catProgressFill,
                          { width: cat.pct as any, backgroundColor: cat.color },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.catRightCol}>
                    <Text style={styles.catPct}>{cat.pct}</Text>
                    <Text style={styles.catCount}>{cat.count}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {/* ========================================================= */}
        {/* TAB 3: WORKPLACES (Finora Screen 4 & 5)                   */}
        {/* ========================================================= */}
        {activeTab === 'workplaces' && (
          <ScrollView
            style={styles.tabScrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.innerHeaderRow}>
              <TouchableOpacity onPress={() => setActiveTab('home')} style={styles.backButton}>
                <Text style={styles.backButtonIcon}>←</Text>
              </TouchableOpacity>
              <Text style={styles.innerHeaderTitle}>Workplace Compliance</Text>
              <TouchableOpacity
                onPress={() => router.push('/owner')}
                style={styles.headerRightIconBox}
              >
                <Text style={styles.headerRightIconEmoji}>⚙️</Text>
              </TouchableOpacity>
            </View>

            {/* Target Card (Finora Screen 5: Budget) */}
            <View style={styles.budgetHeroCard}>
              <View style={styles.budgetTopRow}>
                <View>
                  <Text style={styles.budgetLabel}>Daily Verification Target</Text>
                  <Text style={styles.budgetValue}>{totalSites} Sites</Text>
                </View>
                <TouchableOpacity
                  style={styles.budgetEditBtn}
                  onPress={() => setQuickRecordVisible(true)}
                >
                  <Text style={styles.budgetEditBtnText}>+ Record</Text>
                </TouchableOpacity>
              </View>

              {/* Dual-color Progress Bar */}
              <View style={styles.budgetProgressBarBg}>
                <View
                  style={[
                    styles.budgetProgressFill,
                    { width: `${(verifiedSites / totalSites) * 100}%` as any },
                  ]}
                />
              </View>
              <View style={styles.budgetMetaRow}>
                <Text style={styles.budgetMetaText}>
                  🟢 {verifiedSites} verified
                </Text>
                <Text style={styles.budgetMetaText}>
                  ⏳ {totalSites - verifiedSites} pending
                </Text>
              </View>
            </View>

            {/* Status Filter Pills */}
            <View style={styles.filterPillsRow}>
              {(['all', 'full', 'half', 'stopped'] as WorkplaceFilter[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.filterPill,
                    workplaceFilter === f && styles.filterPillActive,
                  ]}
                  onPress={() => setWorkplaceFilter(f)}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      workplaceFilter === f && styles.filterPillTextActive,
                    ]}
                  >
                    {f === 'all'
                      ? 'All'
                      : f === 'full'
                      ? 'Full Day'
                      : f === 'half'
                      ? 'Half Day'
                      : 'Stopped'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Donut Status Breakdown Card */}
            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownCardTitle}>Status Breakdown</Text>
              <View style={styles.donutRow}>
                <View style={styles.donutCircle}>
                  <Text style={styles.donutCentralPct}>{verifiedPercentage}%</Text>
                  <Text style={styles.donutCentralLabel}>Verified</Text>
                </View>
                <View style={styles.donutLegendCol}>
                  <View style={styles.donutLegendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.legendLabel}>Full Day ({fullDayCount})</Text>
                    <Text style={styles.legendPct}>72%</Text>
                  </View>
                  <View style={styles.donutLegendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.legendLabel}>Half Day ({halfDayCount})</Text>
                    <Text style={styles.legendPct}>18%</Text>
                  </View>
                  <View style={styles.donutLegendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.legendLabel}>Stopped ({stoppedCount})</Text>
                    <Text style={styles.legendPct}>10%</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Field Tip Banner */}
            <View style={styles.tipBannerCard}>
              <Text style={styles.tipIcon}>💡</Text>
              <View style={styles.tipTextCol}>
                <Text style={styles.tipTitle}>Supervisor Tip</Text>
                <Text style={styles.tipDesc}>
                  Stamping GPS photos within 50m of site boundary provides 100% verifiable compliance for owners.
                </Text>
              </View>
            </View>

            {/* Workplace Cards List */}
            <View style={styles.workplaceList}>
              {filteredSites.map((site) => {
                const meta = getCategoryMeta(site.category);
                const badge = getStatusBadge(site.status);
                return (
                  <View key={site.id} style={styles.siteCard}>
                    <View style={styles.siteCardMainRow}>
                      <View style={[styles.recentIconBox, { backgroundColor: meta.bg }]}>
                        <Text style={styles.recentIconEmoji}>{meta.icon}</Text>
                      </View>
                      <View style={styles.siteCardInfo}>
                        <Text style={styles.siteCardTitle}>{site.name}</Text>
                        <Text style={styles.siteCardLocation}>📍 {site.location}</Text>
                        <Text style={styles.siteCardSupervisor}>
                          Officer: <Text style={{ fontWeight: '600', color: '#111827' }}>{site.supervisor}</Text>
                        </Text>
                      </View>
                      <View style={[styles.statusPillBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.statusPillText, { color: badge.color }]}>
                          {badge.text}
                        </Text>
                      </View>
                    </View>

                    {/* Action Footer: 1-click Reassign & View */}
                    <View style={styles.siteCardFooterRow}>
                      <TouchableOpacity
                        style={styles.siteReassignBtn}
                        onPress={() => {
                          setSiteToReassign(site);
                          setNewSupervisorName(site.supervisor);
                          setReassignModalVisible(true);
                        }}
                      >
                        <Text style={styles.siteReassignBtnText}>🔄 Reassign Officer</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.siteViewDetailsBtn}
                        onPress={() => setSelectedSiteDetail(site)}
                      >
                        <Text style={styles.siteViewDetailsBtnText}>Inspect Log →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* ========================================================= */}
        {/* TAB 4: GOALS & FLEET (Finora Screen 6 & 7)                 */}
        {/* ========================================================= */}
        {activeTab === 'goals' && (
          <ScrollView
            style={styles.tabScrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.innerHeaderRow}>
              <TouchableOpacity onPress={() => setActiveTab('home')} style={styles.backButton}>
                <Text style={styles.backButtonIcon}>←</Text>
              </TouchableOpacity>
              <Text style={styles.innerHeaderTitle}>Operations Milestones</Text>
              <TouchableOpacity
                onPress={() => setQuickRecordVisible(true)}
                style={styles.headerRightIconBox}
              >
                <Text style={styles.headerRightIconEmoji}>➕</Text>
              </TouchableOpacity>
            </View>

            {/* Scenic Mountain Hero Banner (Finora Screen 6) */}
            <View style={styles.goalsHeroCard}>
              <Image source={MOUNTAIN_BANNER} style={styles.goalsHeroImage} resizeMode="cover" />
              <View style={styles.goalsHeroOverlay}>
                <Text style={styles.goalsHeroTitle}>Build Operational Excellence</Text>
                <Text style={styles.goalsHeroSubtitle}>
                  Set verification targets, track field machinery, make ground reality verifiable.
                </Text>
              </View>
            </View>

            {/* Milestones Cards */}
            <View style={styles.milestonesList}>
              {[
                { title: 'Zero Downtime Protocol', current: '18 / 20 Sites', pct: 90, icon: '🛡️', color: '#059669' },
                { title: 'GPS Geofencing Compliance', current: '15 / 20 Sites', pct: 75, icon: '🛰️', color: '#2563EB' },
                { title: 'Rural Fleet & Khata Verification', current: '12 / 15 Tractors', pct: 80, icon: '🚜', color: '#D97706' },
                { title: 'Voice SOP Adoption', current: '16 / 20 Sites', pct: 80, icon: '🎙️', color: '#9333EA' },
              ].map((item, idx) => (
                <View key={idx} style={styles.milestoneCard}>
                  <View style={styles.milestoneTopRow}>
                    <Text style={styles.milestoneIcon}>{item.icon}</Text>
                    <View style={styles.milestoneTitleCol}>
                      <Text style={styles.milestoneTitle}>{item.title}</Text>
                      <Text style={styles.milestoneCurrent}>{item.current}</Text>
                    </View>
                    <Text style={[styles.milestonePct, { color: item.color }]}>
                      {item.pct}%
                    </Text>
                  </View>
                  <View style={styles.milestoneProgressBg}>
                    <View
                      style={[
                        styles.milestoneProgressFill,
                        { width: `${item.pct}%` as any, backgroundColor: item.color },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>

            {/* Fleet & Khata Performance Button */}
            <TouchableOpacity
              style={styles.exploreFleetBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/owner')}
            >
              <Text style={styles.exploreFleetBtnText}>Explore Owner Master Dashboard →</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ========================================================= */}
        {/* TAB 5: PROFILE (Finora Screen 8)                          */}
        {/* ========================================================= */}
        {activeTab === 'profile' && (
          <ScrollView
            style={styles.tabScrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.innerHeaderRow}>
              <TouchableOpacity onPress={() => setActiveTab('home')} style={styles.backButton}>
                <Text style={styles.backButtonIcon}>←</Text>
              </TouchableOpacity>
              <Text style={styles.innerHeaderTitle}>Profile</Text>
              <TouchableOpacity
                onPress={() => router.push('/owner')}
                style={styles.headerRightIconBox}
              >
                <Text style={styles.headerRightIconEmoji}>⚙️</Text>
              </TouchableOpacity>
            </View>

            {/* Profile Header Card */}
            <View style={styles.profileUserHeader}>
              <Image source={AVATAR_IMAGE} style={styles.profileAvatar} />
              <View style={styles.profileUserInfo}>
                <Text style={styles.profileName}>
                  {currentUser ? currentUser.name : 'Ayesha Khan'}
                </Text>
                <Text style={styles.profileEmail}>
                  {currentUser ? currentUser.email || currentUser.phone : 'ayesha.khan@gmail.com'}
                </Text>
                <View style={styles.profileRoleBadge}>
                  <Text style={styles.profileRoleBadgeText}>
                    {currentUser?.role === 'owner' ? '🏢 Workplace Owner' : '👷 Field Supervisor'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Operational Health Card (Finora Screen 8: Financial Health) */}
            <View style={styles.healthCard}>
              <View style={styles.healthLeftCol}>
                <Text style={styles.healthLabel}>Operational Compliance</Text>
                <View style={styles.healthStatusRow}>
                  <Text style={styles.healthStatusTitle}>Excellent</Text>
                  <Text style={styles.healthStatusArrow}>↗</Text>
                </View>
                <Text style={styles.healthSubtitle}>
                  Keep going! Field logs are verified and compliant.
                </Text>
              </View>
              <View style={styles.healthGaugeBox}>
                <View style={styles.healthGaugeCircle}>
                  <Text style={styles.healthGaugePct}>92%</Text>
                </View>
              </View>
            </View>

            {/* Profile Menu List */}
            <View style={styles.profileMenuList}>
              {[
                { title: 'Personal Information', icon: '👤', action: () => {} },
                { title: 'Assigned Workplaces', icon: '📍', action: () => setActiveTab('workplaces') },
                { title: 'Security & PIN Settings', icon: '🛡️', action: () => router.push('/login') },
                { title: 'Notification Alerts', icon: '🔔', action: () => {} },
                { title: 'Database & Server Status', icon: '⚡', action: () => {} },
                { title: 'Help & Field Support', icon: '❓', action: () => {} },
                { title: 'View Onboarding Intro', icon: '🌿', action: () => setShowOnboarding(true) },
              ].map((menu, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.profileMenuItem}
                  activeOpacity={0.7}
                  onPress={menu.action}
                >
                  <View style={styles.profileMenuIconBox}>
                    <Text style={styles.profileMenuIconEmoji}>{menu.icon}</Text>
                  </View>
                  <Text style={styles.profileMenuTitle}>{menu.title}</Text>
                  <Text style={styles.profileMenuChevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Neon DB Status Info */}
            <View style={styles.serverStatusCard}>
              <Text style={styles.serverStatusTitle}>Backend & Neon Database</Text>
              <Text style={styles.serverStatusText}>
                Status: {healthData?.status === 'healthy' ? '🟢 Online & Connected' : '🟡 Connecting...'}
              </Text>
              {healthData?.databaseLatencyMs && (
                <Text style={styles.serverStatusLatency}>
                  Latency: {healthData.databaseLatencyMs}ms • Uptime: {Math.round((healthData.uptimeSeconds || 0) / 60)} min
                </Text>
              )}
            </View>

            {/* Log Out Pill Button (Finora Screen 8) */}
            <TouchableOpacity
              style={styles.logoutBtn}
              activeOpacity={0.8}
              onPress={async () => {
                await clearAuthSession();
                setCurrentUser(null);
                router.push('/login');
              }}
            >
              <Text style={styles.logoutBtnText}>⟲ Log Out →</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ========================================================= */}
        {/* FLOATING BOTTOM NAVIGATION BAR (Finora 5-tab)             */}
        {/* ========================================================= */}
        <View style={styles.bottomTabBar}>
          {[
            { id: 'home', label: 'Home', icon: '🏠' },
            { id: 'analytics', label: 'Analytics', icon: '📊' },
            { id: 'workplaces', label: 'Sites', icon: '📍' },
            { id: 'goals', label: 'Goals', icon: '🎯' },
            { id: 'profile', label: 'Profile', icon: '👤' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={styles.tabBarItem}
                onPress={() => setActiveTab(tab.id as FinoraTab)}
              >
                <Text style={[styles.tabBarIcon, isActive && styles.tabBarIconActive]}>
                  {tab.icon}
                </Text>
                <Text style={[styles.tabBarLabel, isActive && styles.tabBarLabelActive]}>
                  {tab.label}
                </Text>
                {isActive && <View style={styles.activeTabDot} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ========================================================= */}
        {/* MODAL 1: INSPECT RECORD / SITE DETAIL DRAWER              */}
        {/* ========================================================= */}
        <Modal
          visible={selectedSiteDetail !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedSiteDetail(null)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={() => setSelectedSiteDetail(null)}
            />
            {selectedSiteDetail && (
              <View style={styles.modalSheetCard}>
                <View style={styles.modalHandleBar} />
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalSheetTitle}>{selectedSiteDetail.name}</Text>
                  <TouchableOpacity onPress={() => setSelectedSiteDetail(null)}>
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.modalBadgeRow}>
                    <View style={styles.modalStatusPill}>
                      <Text style={styles.modalStatusPillText}>
                        Status: {selectedSiteDetail.status.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.modalGpsPill}>
                      <Text style={styles.modalGpsPillText}>🛰️ GPS Verifiable</Text>
                    </View>
                  </View>

                  <Text style={styles.modalSectionLabel}>Location & Boundary</Text>
                  <Text style={styles.modalSectionValue}>📍 {selectedSiteDetail.location}</Text>

                  <Text style={styles.modalSectionLabel}>Assigned Field Officer</Text>
                  <Text style={styles.modalSectionValue}>
                    👤 {selectedSiteDetail.supervisor} ({selectedSiteDetail.supervisorPhone})
                  </Text>

                  <Text style={styles.modalSectionLabel}>Verification Timestamp</Text>
                  <Text style={styles.modalSectionValue}>🕒 {selectedSiteDetail.time}</Text>

                  <View style={styles.modalActionButtonsRow}>
                    <TouchableOpacity
                      style={styles.modalPrimaryBtn}
                      onPress={() => {
                        const site = selectedSiteDetail;
                        setSelectedSiteDetail(null);
                        setSiteToReassign(site);
                        setNewSupervisorName(site.supervisor);
                        setReassignModalVisible(true);
                      }}
                    >
                      <Text style={styles.modalPrimaryBtnText}>🔄 Reassign Officer</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.modalSecondaryBtn}
                      onPress={() => {
                        setSelectedSiteDetail(null);
                        router.push('/record');
                      }}
                    >
                      <Text style={styles.modalSecondaryBtnText}>Submit New Log</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        </Modal>

        {/* ========================================================= */}
        {/* MODAL 2: 1-CLICK REASSIGN FIELD OFFICER                   */}
        {/* ========================================================= */}
        <Modal
          visible={reassignModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setReassignModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={() => setReassignModalVisible(false)}
            />
            <View style={styles.reassignDialogCard}>
              <Text style={styles.reassignDialogTitle}>Reassign Field Officer</Text>
              <Text style={styles.reassignDialogSubtitle}>
                Site: {siteToReassign?.name}
              </Text>

              <Text style={styles.reassignInputLabel}>Select or Enter Officer Name:</Text>
              <TextInput
                style={styles.reassignTextInput}
                value={newSupervisorName}
                onChangeText={setNewSupervisorName}
                placeholder="e.g. Vikram Singh"
                placeholderTextColor="#9CA3AF"
              />

              {/* Quick Suggestions */}
              <View style={styles.quickOfficerChipsRow}>
                {['Ayesha Khan', 'Vikram Singh', 'Rajesh Sharma', 'Amit Patel'].map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={styles.officerChip}
                    onPress={() => setNewSupervisorName(name)}
                  >
                    <Text style={styles.officerChipText}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.reassignActionsRow}>
                <TouchableOpacity
                  style={styles.reassignCancelBtn}
                  onPress={() => setReassignModalVisible(false)}
                >
                  <Text style={styles.reassignCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.reassignConfirmBtn}
                  onPress={handleConfirmReassign}
                >
                  <Text style={styles.reassignConfirmBtnText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ========================================================= */}
        {/* MODAL 3: QUICK DAILY RECORD MODAL                         */}
        {/* ========================================================= */}
        <Modal
          visible={quickRecordVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setQuickRecordVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={() => setQuickRecordVisible(false)}
            />
            <View style={styles.modalSheetCard}>
              <View style={styles.modalHandleBar} />
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalSheetTitle}>Quick Daily Log</Text>
                <TouchableOpacity onPress={() => setQuickRecordVisible(false)}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {quickSubmittedSuccess ? (
                <View style={styles.quickSuccessContainer}>
                  <Text style={styles.quickSuccessIcon}>✅</Text>
                  <Text style={styles.quickSuccessTitle}>Log Verified & Recorded!</Text>
                  <Text style={styles.quickSuccessSubtitle}>
                    Stored in database with simulated GPS stamp.
                  </Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.modalSectionLabel}>Select Workplace</Text>
                  <View style={styles.quickSiteSelectorRow}>
                    {sitesList.slice(0, 3).map((site) => (
                      <TouchableOpacity
                        key={site.id}
                        style={[
                          styles.quickSiteChip,
                          quickSelectedSite === site.name && styles.quickSiteChipActive,
                        ]}
                        onPress={() => setQuickSelectedSite(site.name)}
                      >
                        <Text
                          style={[
                            styles.quickSiteChipText,
                            quickSelectedSite === site.name && styles.quickSiteChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {site.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.modalSectionLabel}>Workplace Attendance Status</Text>
                  <View style={styles.quickStatusRow}>
                    <TouchableOpacity
                      style={[
                        styles.quickStatusBtn,
                        quickStatus === 'full' && styles.quickStatusBtnFullActive,
                      ]}
                      onPress={() => setQuickStatus('full')}
                    >
                      <Text style={styles.quickStatusEmoji}>🟢</Text>
                      <Text style={styles.quickStatusText}>Full Day</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.quickStatusBtn,
                        quickStatus === 'half' && styles.quickStatusBtnHalfActive,
                      ]}
                      onPress={() => setQuickStatus('half')}
                    >
                      <Text style={styles.quickStatusEmoji}>🟡</Text>
                      <Text style={styles.quickStatusText}>Half Day</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.quickStatusBtn,
                        quickStatus === 'stopped' && styles.quickStatusBtnStoppedActive,
                      ]}
                      onPress={() => setQuickStatus('stopped')}
                    >
                      <Text style={styles.quickStatusEmoji}>🔴</Text>
                      <Text style={styles.quickStatusText}>Stopped</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.modalSectionLabel}>Notes / Ground Observations</Text>
                  <TextInput
                    style={styles.quickNotesInput}
                    value={quickNotes}
                    onChangeText={setQuickNotes}
                    placeholder="e.g. Foundations completed, machinery active..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                  />

                  <TouchableOpacity
                    style={styles.modalPrimaryBtn}
                    onPress={handleQuickRecordSubmit}
                  >
                    <Text style={styles.modalPrimaryBtnText}>Submit Verified Log →</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.fullCameraLinkBtn}
                    onPress={() => {
                      setQuickRecordVisible(false);
                      router.push('/record');
                    }}
                  >
                    <Text style={styles.fullCameraLinkText}>
                      Open Full Native Camera & Voice Recorder →
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

// =====================================================================
// FINORA STYLESHEET (Pixel-matched to Finora Design System)
// =====================================================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  mainCanvas: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  tabScrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110, // space for bottom tab bar
  },

  // -------------------------------------------------------------
  // SCREEN 1: ONBOARDING STYLES
  // -------------------------------------------------------------
  onboardingScroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  onboardingLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  logoLeafBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoLeafIcon: {
    fontSize: 20,
  },
  logoBrandText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: -0.5,
  },
  onboardingHeroTextWrapper: {
    width: '100%',
    marginBottom: 20,
  },
  onboardingHeadline: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 38,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  onboardingSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  onboardingIllustrationCard: {
    width: '100%',
    height: 320,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 28,
    backgroundColor: '#E6ECE9',
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  onboardingImage: {
    width: '100%',
    height: '100%',
  },
  onboardingPrimaryBtn: {
    width: '100%',
    height: 56,
    backgroundColor: '#059669',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 18,
  },
  onboardingPrimaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  onboardingSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onboardingSecondaryMuted: {
    fontSize: 14,
    color: '#6B7280',
  },
  onboardingSecondaryLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },

  // -------------------------------------------------------------
  // SCREEN 2: HOME DASHBOARD STYLES
  // -------------------------------------------------------------
  homeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  homeGreetingMuted: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  homeUserName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.3,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarOnlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  // Dark Forest Emerald Hero Card
  heroGradientCard: {
    backgroundColor: '#064E3B',
    borderRadius: 24,
    padding: 22,
    marginBottom: 22,
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 6,
  },
  heroCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heroCardLabel: {
    fontSize: 14,
    color: '#A7F3D0',
    fontWeight: '600',
  },
  heroEyeButton: {
    padding: 4,
  },
  heroEyeIcon: {
    fontSize: 16,
  },
  heroCardBalance: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  heroCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroGrowthBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  heroGrowthText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#34D399',
  },
  heroVisaBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  heroVisaText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // 4 Action Circle Buttons
  actionCirclesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 26,
    paddingHorizontal: 6,
  },
  actionCircleItem: {
    alignItems: 'center',
  },
  actionCircleButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  actionCircleEmoji: {
    fontSize: 24,
  },
  actionCircleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  sectionSeeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },

  // Recent Workplace Feed
  recentListContainer: {
    gap: 12,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6ECE9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  recentIconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  recentIconEmoji: {
    fontSize: 22,
  },
  recentInfoCol: {
    flex: 1,
  },
  recentSiteName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  recentMetaText: {
    fontSize: 12,
    color: '#6B7280',
  },
  statusPillBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // -------------------------------------------------------------
  // SCREEN 3: ANALYTICS STYLES
  // -------------------------------------------------------------
  innerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6ECE9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  innerHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerRightIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6ECE9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightIconEmoji: {
    fontSize: 18,
  },
  segmentedTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#E6ECE9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#059669',
  },
  segmentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  segmentButtonTextActive: {
    color: '#FFFFFF',
  },
  analyticsTotalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E6ECE9',
  },
  analyticsTotalLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 6,
  },
  analyticsTotalValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  analyticsTrendRow: {
    flexDirection: 'row',
  },
  analyticsTrendText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },

  // Interactive Bar Chart
  barChartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#E6ECE9',
  },
  chartTooltipWrapper: {
    alignItems: 'center',
    marginBottom: 12,
  },
  chartTooltipBubble: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  chartTooltipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  chartBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    paddingTop: 10,
  },
  barColumn: {
    alignItems: 'center',
    width: 38,
  },
  barFill: {
    width: 18,
    backgroundColor: '#D1FAE5',
    borderRadius: 9,
    marginBottom: 8,
  },
  barFillActive: {
    backgroundColor: '#059669',
  },
  barMonthLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  barMonthLabelActive: {
    color: '#059669',
    fontWeight: '800',
  },

  // Category Breakdown Rows
  categoryBreakdownList: {
    gap: 12,
  },
  categoryRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6ECE9',
  },
  catIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  catEmoji: {
    fontSize: 20,
  },
  catDetailsCol: {
    flex: 1,
    marginRight: 12,
  },
  catTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  catProgressBg: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  catProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  catRightCol: {
    alignItems: 'flex-end',
  },
  catPct: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  catCount: {
    fontSize: 12,
    color: '#6B7280',
  },

  // -------------------------------------------------------------
  // SCREEN 4 & 5: WORKPLACES & BUDGET STYLES
  // -------------------------------------------------------------
  budgetHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E6ECE9',
  },
  budgetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  budgetLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  budgetValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
  },
  budgetEditBtn: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  budgetEditBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  budgetProgressBarBg: {
    height: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 10,
  },
  budgetProgressFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 5,
  },
  budgetMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  budgetMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },

  // Filter Pills
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6ECE9',
  },
  filterPillActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },

  // Donut Breakdown Card
  breakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E6ECE9',
  },
  breakdownCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  donutCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 10,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCentralPct: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  donutCentralLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  donutLegendCol: {
    gap: 8,
  },
  donutLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 13,
    color: '#374151',
    width: 120,
  },
  legendPct: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },

  // Field Tip Card
  tipBannerCard: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    marginBottom: 16,
  },
  tipIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  tipTextCol: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 3,
  },
  tipDesc: {
    fontSize: 12,
    color: '#047857',
    lineHeight: 18,
  },

  // Workplace List & Card
  workplaceList: {
    gap: 12,
  },
  siteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6ECE9',
  },
  siteCardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  siteCardInfo: {
    flex: 1,
    marginRight: 8,
  },
  siteCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  siteCardLocation: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  siteCardSupervisor: {
    fontSize: 12,
    color: '#4B5563',
  },
  siteCardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  siteReassignBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  siteReassignBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  siteViewDetailsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  siteViewDetailsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },

  // -------------------------------------------------------------
  // SCREEN 6 & 7: GOALS & FLEET STYLES
  // -------------------------------------------------------------
  goalsHeroCard: {
    width: '100%',
    height: 180,
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  goalsHeroImage: {
    width: '100%',
    height: '100%',
  },
  goalsHeroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(6, 78, 59, 0.75)',
  },
  goalsHeroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  goalsHeroSubtitle: {
    fontSize: 12,
    color: '#D1FAE5',
    lineHeight: 16,
  },
  milestonesList: {
    gap: 12,
    marginBottom: 20,
  },
  milestoneCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6ECE9',
  },
  milestoneTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  milestoneIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  milestoneTitleCol: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  milestoneCurrent: {
    fontSize: 12,
    color: '#6B7280',
  },
  milestonePct: {
    fontSize: 14,
    fontWeight: '800',
  },
  milestoneProgressBg: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  milestoneProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  exploreFleetBtn: {
    backgroundColor: '#059669',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  exploreFleetBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // -------------------------------------------------------------
  // SCREEN 8: PROFILE STYLES
  // -------------------------------------------------------------
  profileUserHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#059669',
    marginBottom: 12,
  },
  profileUserInfo: {
    alignItems: 'center',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  profileRoleBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  profileRoleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },

  // Health Card
  healthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#064E3B',
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
  },
  healthLeftCol: {
    flex: 1,
    marginRight: 14,
  },
  healthLabel: {
    fontSize: 12,
    color: '#A7F3D0',
    fontWeight: '600',
    marginBottom: 4,
  },
  healthStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  healthStatusTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginRight: 6,
  },
  healthStatusArrow: {
    fontSize: 20,
    color: '#34D399',
    fontWeight: '800',
  },
  healthSubtitle: {
    fontSize: 12,
    color: '#D1FAE5',
    lineHeight: 16,
  },
  healthGaugeBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthGaugeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 5,
    borderColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthGaugePct: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Profile Menu Items
  profileMenuList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E6ECE9',
    marginBottom: 16,
  },
  profileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  profileMenuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  profileMenuIconEmoji: {
    fontSize: 18,
  },
  profileMenuTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  profileMenuChevron: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  serverStatusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6ECE9',
    marginBottom: 20,
  },
  serverStatusTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  serverStatusText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
    marginBottom: 2,
  },
  serverStatusLatency: {
    fontSize: 12,
    color: '#6B7280',
  },
  logoutBtn: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },

  // -------------------------------------------------------------
  // FLOATING BOTTOM TAB BAR
  // -------------------------------------------------------------
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E6ECE9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 14 : 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  tabBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    width: 60,
  },
  tabBarIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabBarIconActive: {
    transform: [{ scale: 1.1 }],
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabBarLabelActive: {
    color: '#059669',
    fontWeight: '800',
  },
  activeTabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#059669',
    marginTop: 2,
  },

  // -------------------------------------------------------------
  // MODALS & DRAWERS (Rule 6 Compliant)
  // -------------------------------------------------------------
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 34,
    maxHeight: '85%',
  },
  modalHandleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalSheetTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
  },
  modalCloseText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6B7280',
    padding: 6,
  },
  modalBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modalStatusPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  modalStatusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  modalGpsPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  modalGpsPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 4,
  },
  modalSectionValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
    marginBottom: 8,
  },
  modalActionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  modalPrimaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSecondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },

  // 1-Click Reassign Dialog
  reassignDialogCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 24,
    marginBottom: 'auto',
    marginTop: 'auto',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  reassignDialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  reassignDialogSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  reassignInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  reassignTextInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    marginBottom: 12,
  },
  quickOfficerChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  officerChip: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  officerChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  reassignActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  reassignCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reassignCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  reassignConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reassignConfirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Quick Record Modal Extras
  quickSiteSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  quickSiteChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  quickSiteChipActive: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#059669',
  },
  quickSiteChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  quickSiteChipTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  quickStatusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  quickStatusBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  quickStatusBtnFullActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  quickStatusBtnHalfActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  quickStatusBtnStoppedActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  quickStatusEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  quickStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  quickNotesInput: {
    height: 70,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    padding: 12,
    fontSize: 14,
    color: '#111827',
    marginBottom: 18,
    textAlignVertical: 'top',
  },
  fullCameraLinkBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  fullCameraLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  quickSuccessContainer: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  quickSuccessIcon: {
    fontSize: 54,
    marginBottom: 14,
  },
  quickSuccessTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  quickSuccessSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
