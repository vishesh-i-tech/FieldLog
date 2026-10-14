import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  loginOwner,
  signupOwner,
  loginSupervisor,
  signupSupervisor,
  initAuthSession,
  getCurrentUser,
} from '../src/services/auth.state';

export default function LoginScreen() {
  const router = useRouter();

  // Auth Modes: 'signin' | 'signup'
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  // Roles: 'owner' | 'supervisor'
  const [selectedRole, setSelectedRole] = useState<'owner' | 'supervisor'>('owner');

  // Form Fields
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check if already logged in
    initAuthSession().then((user) => {
      if (user) {
        if (user.role === 'owner') {
          router.replace('/owner');
        } else {
          router.replace('/record');
        }
      }
    });
  }, []);

  // 1-Tap Quick Fill Demo Credentials
  const fillOwnerDemo = () => {
    setSelectedRole('owner');
    setAuthMode('signin');
    setEmail('owner@fieldlog.dev');
    setPassword('Password123!');
    setErrorMessage(null);
  };

  const fillSupervisorDemo = () => {
    setSelectedRole('supervisor');
    setAuthMode('signin');
    setPhone('9811111111');
    setPin('1234');
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (selectedRole === 'owner') {
        if (authMode === 'signin') {
          if (!email || !password) {
            throw new Error('Please enter both email and password.');
          }
          await loginOwner(email, password);
          router.replace('/owner');
        } else {
          if (!companyName || !fullName || !email || !phone || !password) {
            throw new Error('Please fill in all owner registration fields.');
          }
          if (password.length < 6) {
            throw new Error('Password must be at least 6 characters long.');
          }
          await signupOwner({
            companyName: companyName.trim(),
            name: fullName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            password,
          });
          setSuccessMessage('Organization and Owner account created successfully!');
          setTimeout(() => router.replace('/owner'), 600);
        }
      } else {
        // Supervisor
        if (authMode === 'signin') {
          if (!phone || !pin) {
            throw new Error('Please enter your phone number and 4-digit PIN.');
          }
          if (!/^\d{4}$/.test(pin.trim())) {
            throw new Error('PIN must be exactly 4 digits.');
          }
          await loginSupervisor(phone, pin);
          router.replace('/record');
        } else {
          if (!fullName || !phone || !pin) {
            throw new Error('Please enter name, phone, and 4-digit PIN.');
          }
          if (!/^\d{4}$/.test(pin.trim())) {
            throw new Error('PIN must be exactly 4 digits.');
          }
          await signupSupervisor({
            name: fullName.trim(),
            phone: phone.trim(),
            pin: pin.trim(),
          });
          setSuccessMessage('Supervisor registered successfully! Assigned to active sites.');
          setTimeout(() => router.replace('/record'), 600);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Logo & Header */}
          <View style={styles.headerContainer}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoIcon}>📍</Text>
            </View>
            <Text style={styles.appTitle}>FieldLog</Text>
            <Text style={styles.appSubtitle}>
              {authMode === 'signin' ? 'Welcome back • Sign in to continue' : 'Create a new account'}
            </Text>
          </View>

          {/* Card Container */}
          <View style={styles.card}>
            {/* 1. Mode Switcher (Sign In vs Sign Up) */}
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[styles.segmentButton, authMode === 'signin' && styles.segmentButtonActive]}
                onPress={() => {
                  setAuthMode('signin');
                  setErrorMessage(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, authMode === 'signin' && styles.segmentTextActive]}>
                  Sign In
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentButton, authMode === 'signup' && styles.segmentButtonActive]}
                onPress={() => {
                  setAuthMode('signup');
                  setErrorMessage(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, authMode === 'signup' && styles.segmentTextActive]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>

            {/* 2. Role Selector Tabs */}
            <Text style={styles.fieldLabel}>Select your role:</Text>
            <View style={styles.roleTabsContainer}>
              <TouchableOpacity
                style={[
                  styles.roleTab,
                  selectedRole === 'owner' && styles.roleTabActiveOwner,
                ]}
                onPress={() => {
                  setSelectedRole('owner');
                  setErrorMessage(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.roleTabEmoji}>👑</Text>
                <View>
                  <Text style={[styles.roleTabTitle, selectedRole === 'owner' && styles.roleTabTitleActive]}>
                    Business Owner
                  </Text>
                  <Text style={styles.roleTabSub}>Web Dashboard & Review</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleTab,
                  selectedRole === 'supervisor' && styles.roleTabActiveSupervisor,
                ]}
                onPress={() => {
                  setSelectedRole('supervisor');
                  setErrorMessage(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.roleTabEmoji}>👷</Text>
                <View>
                  <Text
                    style={[
                      styles.roleTabTitle,
                      selectedRole === 'supervisor' && styles.roleTabTitleActive,
                    ]}
                  >
                    Field Supervisor
                  </Text>
                  <Text style={styles.roleTabSub}>Daily Reporting (Phone / PIN)</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Error & Success Messages */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>✅ {successMessage}</Text>
              </View>
            ) : null}

            {/* 3. Form Inputs based on Role & AuthMode */}
            <View style={styles.formContainer}>
              {/* OWNER SIGNUP: Company Name */}
              {selectedRole === 'owner' && authMode === 'signup' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Company / Organization Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Apex Infra & Logistics"
                    placeholderTextColor="#64748B"
                    value={companyName}
                    onChangeText={setCompanyName}
                  />
                </View>
              )}

              {/* BOTH SIGNUP: Full Name */}
              {authMode === 'signup' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Your Full Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Vikram Malhotra / Ramesh Kumar"
                    placeholderTextColor="#64748B"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>
              )}

              {/* OWNER: Email */}
              {selectedRole === 'owner' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="owner@company.com"
                    placeholderTextColor="#64748B"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              )}

              {/* OWNER SIGNUP OR SUPERVISOR BOTH: Phone Number */}
              {(selectedRole === 'supervisor' || (selectedRole === 'owner' && authMode === 'signup')) && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 9811111111"
                    placeholderTextColor="#64748B"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
              )}

              {/* OWNER: Password */}
              {selectedRole === 'owner' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Password *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••••••"
                    placeholderTextColor="#64748B"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>
              )}

              {/* SUPERVISOR: 4-digit PIN */}
              {selectedRole === 'supervisor' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>4-Digit PIN *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 1234"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    maxLength={4}
                    secureTextEntry
                    value={pin}
                    onChangeText={setPin}
                  />
                  <Text style={styles.inputHint}>4 numeric digits for instant field login</Text>
                </View>
              )}

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {authMode === 'signin' ? 'Sign In →' : 'Create Account →'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Quick-fill Demo Chips */}
            <View style={styles.demoSection}>
              <Text style={styles.demoSectionLabel}>⚡ 1-Tap Demo Testing Credentials:</Text>
              <View style={styles.demoChipsRow}>
                <TouchableOpacity style={styles.demoChip} onPress={fillOwnerDemo}>
                  <Text style={styles.demoChipText}>👑 Owner: owner@fieldlog.dev</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.demoChip} onPress={fillSupervisorDemo}>
                  <Text style={styles.demoChipText}>👷 Supervisor: 9811111111 (PIN 1234)</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  logoIcon: {
    fontSize: 28,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  appSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },
  card: {
    width: '100%',
    backgroundColor: '#131C2E',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#0B0F19',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  segmentTextActive: {
    color: '#F8FAFC',
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  roleTabsContainer: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 20,
  },
  roleTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B0F19',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  roleTabActiveOwner: {
    borderColor: '#7C3AED',
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
  },
  roleTabActiveSupervisor: {
    borderColor: '#0284C7',
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
  },
  roleTabEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  roleTabTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#94A3B8',
  },
  roleTabTitleActive: {
    color: '#F8FAFC',
  },
  roleTabSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '600',
  },
  successBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '600',
  },
  formContainer: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  input: {
    backgroundColor: '#0B0F19',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
  },
  inputHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  demoSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  demoSectionLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  demoChipsRow: {
    gap: 6,
  },
  demoChip: {
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  demoChipText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '600',
  },
});
