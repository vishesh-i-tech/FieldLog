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
} from '../src/services/auth.state';
import { DEFAULT_API_BASE_URL } from '../src/constants/config';

type AuthScreenMode = 'signin' | 'signup' | 'forgot' | 'verify' | 'newpass' | 'success';

interface OrganizationItem {
  id: string;
  name: string;
}

export default function LoginScreen() {
  const router = useRouter();

  // Screen Modes matching the reference UI
  const [screenMode, setScreenMode] = useState<AuthScreenMode>('signin');
  // Role Selection: 'owner' | 'supervisor'
  const [selectedRole, setSelectedRole] = useState<'owner' | 'supervisor'>('owner');

  // Form Fields - Sign In / Sign Up
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Organizations list for supervisor signup
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  // Forgot password / Recovery states
  const [recoveryMethod, setRecoveryMethod] = useState<'email' | 'phone'>('email');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');

  // Feedback states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check if session already exists
  useEffect(() => {
    initAuthSession().then((user) => {
      if (user) {
        if (user.role === 'owner') {
          router.replace('/owner');
        } else {
          router.replace('/record');
        }
      }
    });

    // Fetch organizations
    fetch(`${DEFAULT_API_BASE_URL}/api/v1/auth/organizations`)
      .then((res) => res.json())
      .then((data) => {
        if (data.organizations && data.organizations.length > 0) {
          setOrganizations(data.organizations);
          setSelectedOrgId(data.organizations[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleSignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (selectedRole === 'owner') {
        if (!email.trim() || !password) {
          throw new Error('Please enter both Email Address and Password.');
        }
        await loginOwner(email.trim(), password);
        router.replace('/owner');
      } else {
        if (!phone.trim() || !pin.trim()) {
          throw new Error('Please enter your Mobile Phone Number and 4-Digit PIN.');
        }
        if (!/^\d{4}$/.test(pin.trim())) {
          throw new Error('PIN must be exactly 4 numeric digits.');
        }
        await loginSupervisor(phone.trim(), pin.trim());
        router.replace('/record');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (selectedRole === 'owner') {
        if (!companyName.trim() || !fullName.trim() || !email.trim() || !phone.trim() || !password) {
          throw new Error('Please fill in all owner registration fields.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
        if (confirmPassword && password !== confirmPassword) {
          throw new Error('Passwords do not match. Please re-enter.');
        }
        await signupOwner({
          companyName: companyName.trim(),
          name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
        });
        setSuccessMessage('Organization and Owner account created successfully in Database!');
        setTimeout(() => router.replace('/owner'), 600);
      } else {
        if (!fullName.trim() || !phone.trim() || !pin.trim()) {
          throw new Error('Please enter Officer Name, Mobile Phone, and 4-Digit PIN.');
        }
        if (!/^\d{4}$/.test(pin.trim())) {
          throw new Error('PIN must be exactly 4 numeric digits.');
        }
        if (confirmPin && pin.trim() !== confirmPin.trim()) {
          throw new Error('PINs do not match. Please re-enter.');
        }
        await signupSupervisor({
          name: fullName.trim(),
          phone: phone.trim(),
          pin: pin.trim(),
          organizationId: selectedOrgId || undefined,
        });
        setSuccessMessage('Field Supervisor registered and assigned to active sites!');
        setTimeout(() => router.replace('/record'), 600);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRecoveryCode = async () => {
    if (!recoveryInput.trim()) {
      setErrorMessage(
        recoveryMethod === 'email'
          ? 'Please enter your registered email address.'
          : 'Please enter your registered phone number.'
      );
      return;
    }
    setErrorMessage(null);
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setScreenMode('verify');
      setOtpDigits(['8', '9', '', '']);
    }, 700);
  };

  const handleVerifyOtp = () => {
    setErrorMessage(null);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setScreenMode('newpass');
    }, 600);
  };

  const handleSaveNewPassword = () => {
    if (!newPasswordInput.trim()) {
      setErrorMessage('Please enter your new password or PIN.');
      return;
    }
    if (confirmNewPasswordInput && newPasswordInput !== confirmNewPasswordInput) {
      setErrorMessage('Passwords/PINs do not match.');
      return;
    }
    setErrorMessage(null);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setScreenMode('success');
    }, 600);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* TOP CURVED HEADER (Reference UI Styling) */}
          <View style={styles.curvedHeader}>
            {/* Top Navigation Row */}
            <View style={styles.headerTopNav}>
              <TouchableOpacity
                style={styles.headerBackBtn}
                onPress={() => {
                  if (screenMode === 'signin') {
                    router.push('/');
                  } else {
                    setErrorMessage(null);
                    setScreenMode('signin');
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.headerBackText}>
                  {screenMode === 'signin' ? '⌂ Diagnostic Hub' : '← Back'}
                </Text>
              </TouchableOpacity>

              {screenMode === 'signup' && (
                <TouchableOpacity
                  onPress={() => setScreenMode('signin')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.headerSkipText}>Skip</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Header Titles */}
            <View style={styles.headerTitleWrap}>
              {screenMode === 'signin' && (
                <>
                  <Text style={styles.headerSubtitle}>Welcome Back!</Text>
                  <Text style={styles.headerTitle}>Sign In</Text>
                </>
              )}

              {screenMode === 'signup' && (
                <>
                  <Text style={styles.headerSubtitle}>Create Your Account</Text>
                  <Text style={styles.headerTitle}>Sign Up</Text>
                </>
              )}

              {screenMode === 'forgot' && (
                <>
                  <Text style={styles.headerSubtitle}>Account Recovery</Text>
                  <Text style={styles.headerTitle}>Forgot Password</Text>
                </>
              )}

              {screenMode === 'verify' && (
                <>
                  <Text style={styles.headerSubtitle}>Secure Verification</Text>
                  <Text style={styles.headerTitle}>Verify Code</Text>
                </>
              )}

              {screenMode === 'newpass' && (
                <>
                  <Text style={styles.headerSubtitle}>Security Update</Text>
                  <Text style={styles.headerTitle}>New Password</Text>
                </>
              )}

              {screenMode === 'success' && (
                <>
                  <Text style={styles.headerSubtitle}>All Set!</Text>
                  <Text style={styles.headerTitle}>Password Changed</Text>
                </>
              )}
            </View>
          </View>

          {/* MAIN FORM CONTAINER (Light Card matching reference) */}
          <View style={styles.formContainer}>
            {/* Notifications */}
            {errorMessage && (
              <View style={styles.errorAlert}>
                <Text style={styles.errorAlertText}>⚠️ {errorMessage}</Text>
              </View>
            )}

            {successMessage && (
              <View style={styles.successAlert}>
                <Text style={styles.successAlertText}>✅ {successMessage}</Text>
              </View>
            )}

            {/* 1. SIGN IN SCREEN */}
            {screenMode === 'signin' && (
              <View>
                {/* Role Switcher Pill (Business Owner vs Field Officer) */}
                <View style={styles.roleSegmentPill}>
                  <TouchableOpacity
                    style={[
                      styles.roleSegmentTab,
                      selectedRole === 'owner' && styles.roleSegmentTabActive,
                    ]}
                    onPress={() => {
                      setSelectedRole('owner');
                      setErrorMessage(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.roleSegmentText,
                        selectedRole === 'owner' && styles.roleSegmentTextActive,
                      ]}
                    >
                      👑 Business Owner
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.roleSegmentTab,
                      selectedRole === 'supervisor' && styles.roleSegmentTabActive,
                    ]}
                    onPress={() => {
                      setSelectedRole('supervisor');
                      setErrorMessage(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.roleSegmentText,
                        selectedRole === 'supervisor' && styles.roleSegmentTextActive,
                      ]}
                    >
                      👷 Field Officer
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Owner Inputs */}
                {selectedRole === 'owner' ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.fieldLabel}>Email Address</Text>
                      <TextInput
                        style={styles.textInput}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Enter your email address"
                        placeholderTextColor="#94A3B8"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.fieldLabel}>Password</Text>
                      <View style={styles.passwordInputWrap}>
                        <TextInput
                          style={styles.passwordInput}
                          value={password}
                          onChangeText={setPassword}
                          placeholder="Enter your password"
                          placeholderTextColor="#94A3B8"
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                        />
                        <TouchableOpacity
                          style={styles.eyeBtn}
                          onPress={() => setShowPassword(!showPassword)}
                        >
                          <Text style={styles.eyeBtnText}>{showPassword ? '👁️' : '🔒'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    {/* Supervisor Inputs */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.fieldLabel}>Phone Number</Text>
                      <TextInput
                        style={styles.textInput}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="e.g. 9811111111"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.fieldLabel}>4-Digit PIN</Text>
                      <View style={styles.passwordInputWrap}>
                        <TextInput
                          style={styles.passwordInput}
                          value={pin}
                          onChangeText={setPin}
                          placeholder="Enter 4-digit PIN"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          maxLength={4}
                          secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity
                          style={styles.eyeBtn}
                          onPress={() => setShowPassword(!showPassword)}
                        >
                          <Text style={styles.eyeBtnText}>{showPassword ? '👁️' : '🔒'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}

                {/* Forgot Password Link */}
                <TouchableOpacity
                  style={styles.forgotPassBtn}
                  onPress={() => {
                    setErrorMessage(null);
                    setRecoveryMethod(selectedRole === 'owner' ? 'email' : 'phone');
                    setScreenMode('forgot');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.forgotPassText}>
                    {selectedRole === 'owner' ? 'Forgot Password?' : 'Forgot PIN?'}
                  </Text>
                </TouchableOpacity>

                {/* Primary Sign In Button */}
                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                  onPress={handleSignIn}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Sign In</Text>
                  )}
                </TouchableOpacity>

                {/* Or Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Bottom Switch Link */}
                <View style={styles.bottomLinkRow}>
                  <Text style={styles.bottomLinkMuted}>Don't Have An Account? </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setErrorMessage(null);
                      setScreenMode('signup');
                    }}
                  >
                    <Text style={styles.bottomLinkBold}>Sign Up</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 2. SIGN UP SCREEN */}
            {screenMode === 'signup' && (
              <View>
                {/* Role Switcher Pill */}
                <View style={styles.roleSegmentPill}>
                  <TouchableOpacity
                    style={[
                      styles.roleSegmentTab,
                      selectedRole === 'owner' && styles.roleSegmentTabActive,
                    ]}
                    onPress={() => {
                      setSelectedRole('owner');
                      setErrorMessage(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.roleSegmentText,
                        selectedRole === 'owner' && styles.roleSegmentTextActive,
                      ]}
                    >
                      👑 Business Owner
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.roleSegmentTab,
                      selectedRole === 'supervisor' && styles.roleSegmentTabActive,
                    ]}
                    onPress={() => {
                      setSelectedRole('supervisor');
                      setErrorMessage(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.roleSegmentText,
                        selectedRole === 'supervisor' && styles.roleSegmentTextActive,
                      ]}
                    >
                      👷 Field Officer
                    </Text>
                  </TouchableOpacity>
                </View>

                {selectedRole === 'owner' ? (
                  <>
                    <View style={styles.twoColumnRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Company Name</Text>
                        <TextInput
                          style={styles.textInput}
                          value={companyName}
                          onChangeText={setCompanyName}
                          placeholder="e.g. Acme Infra"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Owner Name</Text>
                        <TextInput
                          style={styles.textInput}
                          value={fullName}
                          onChangeText={setFullName}
                          placeholder="Your Full Name"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.fieldLabel}>Email Address</Text>
                      <TextInput
                        style={styles.textInput}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="owner@yourcompany.com"
                        placeholderTextColor="#94A3B8"
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.fieldLabel}>Phone Number</Text>
                      <TextInput
                        style={styles.textInput}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="+91 Mobile number"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.fieldLabel}>Password</Text>
                      <TextInput
                        style={styles.textInput}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Min 6 characters"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry
                        autoCapitalize="none"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.fieldLabel}>Confirm Password</Text>
                      <TextInput
                        style={styles.textInput}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Re-enter password"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry
                        autoCapitalize="none"
                      />
                    </View>
                  </>
                ) : (
                  <>
                    {/* Supervisor Signup Fields */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.fieldLabel}>Officer Full Name</Text>
                      <TextInput
                        style={styles.textInput}
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="e.g. Rahul Sharma"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.fieldLabel}>Mobile Phone Number</Text>
                      <TextInput
                        style={styles.textInput}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="10-digit mobile number"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                      />
                    </View>

                    <View style={styles.twoColumnRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>4-Digit PIN</Text>
                        <TextInput
                          style={styles.textInput}
                          value={pin}
                          onChangeText={setPin}
                          placeholder="e.g. 4321"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          maxLength={4}
                          secureTextEntry
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Confirm PIN</Text>
                        <TextInput
                          style={styles.textInput}
                          value={confirmPin}
                          onChangeText={setConfirmPin}
                          placeholder="Re-enter PIN"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          maxLength={4}
                          secureTextEntry
                        />
                      </View>
                    </View>

                    {/* Workplace / Company Selection */}
                    {organizations.length > 0 && (
                      <View style={styles.inputGroup}>
                        <Text style={styles.fieldLabel}>Select Organization / Workspace</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.orgChipScroll}>
                          {organizations.map((org) => (
                            <TouchableOpacity
                              key={org.id}
                              style={[
                                styles.orgChip,
                                selectedOrgId === org.id && styles.orgChipActive,
                              ]}
                              onPress={() => setSelectedOrgId(org.id)}
                            >
                              <Text
                                style={[
                                  styles.orgChipText,
                                  selectedOrgId === org.id && styles.orgChipTextActive,
                                ]}
                              >
                                🏢 {org.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </>
                )}

                {/* Legal Disclaimer matching Reference UI */}
                <Text style={styles.termsNoticeText}>
                  By signing below, you agree to the{' '}
                  <Text style={styles.termsNoticeBold}>Terms of Use</Text> and{' '}
                  <Text style={styles.termsNoticeBold}>Privacy Notice</Text>.
                </Text>

                {/* Primary Sign Up Button */}
                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                  onPress={handleSignUp}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Sign Up</Text>
                  )}
                </TouchableOpacity>

                {/* Bottom Switch Link */}
                <View style={[styles.bottomLinkRow, { marginTop: 20 }]}>
                  <Text style={styles.bottomLinkMuted}>Already Have An Account? </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setErrorMessage(null);
                      setScreenMode('signin');
                    }}
                  >
                    <Text style={styles.bottomLinkBold}>Sign In</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 3. FORGOT PASSWORD SCREEN (Reference UI Frame 4) */}
            {screenMode === 'forgot' && (
              <View style={styles.recoveryContainer}>
                {/* Illustration Badge */}
                <View style={styles.illustrationCircle}>
                  <Text style={styles.illustrationEmoji}>🔐</Text>
                </View>

                <Text style={styles.recoveryPromptText}>
                  Please choose how you want to receive your security verification code:
                </Text>

                {/* Choice Radio Cards */}
                <TouchableOpacity
                  style={[
                    styles.radioOptionCard,
                    recoveryMethod === 'email' && styles.radioOptionCardActive,
                  ]}
                  onPress={() => {
                    setRecoveryMethod('email');
                    setErrorMessage(null);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.radioIconBadge}>
                    <Text style={styles.radioIconText}>✉️</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.radioOptionTitle}>Continue Via Email</Text>
                    <Text style={styles.radioOptionSubtitle}>Send verification code to registered email</Text>
                  </View>
                  <View style={[styles.radioCircle, recoveryMethod === 'email' && styles.radioCircleActive]}>
                    {recoveryMethod === 'email' && <View style={styles.radioCircleDot} />}
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.radioOptionCard,
                    recoveryMethod === 'phone' && styles.radioOptionCardActive,
                  ]}
                  onPress={() => {
                    setRecoveryMethod('phone');
                    setErrorMessage(null);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.radioIconBadge}>
                    <Text style={styles.radioIconText}>📱</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.radioOptionTitle}>Continue Via Phone</Text>
                    <Text style={styles.radioOptionSubtitle}>Send verification code via SMS to phone</Text>
                  </View>
                  <View style={[styles.radioCircle, recoveryMethod === 'phone' && styles.radioCircleActive]}>
                    {recoveryMethod === 'phone' && <View style={styles.radioCircleDot} />}
                  </View>
                </TouchableOpacity>

                {/* Input for selected recovery method */}
                <View style={[styles.inputGroup, { marginTop: 14 }]}>
                  <Text style={styles.fieldLabel}>
                    {recoveryMethod === 'email' ? 'Enter Linked Email Address' : 'Enter Linked Mobile Phone'}
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={recoveryInput}
                    onChangeText={setRecoveryInput}
                    placeholder={
                      recoveryMethod === 'email'
                        ? 'e.g. name@company.com'
                        : 'e.g. 9811111111'
                    }
                    placeholderTextColor="#94A3B8"
                    keyboardType={recoveryMethod === 'email' ? 'email-address' : 'phone-pad'}
                    autoCapitalize="none"
                  />
                </View>

                {/* Submit button */}
                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.primaryButtonDisabled, { marginTop: 16 }]}
                  onPress={handleSendRecoveryCode}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Just Send Code</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* 4. VERIFY YOUR CODE (Reference UI Frame 5) */}
            {screenMode === 'verify' && (
              <View style={styles.recoveryContainer}>
                <View style={styles.illustrationCircle}>
                  <Text style={styles.illustrationEmoji}>📩</Text>
                </View>

                <Text style={styles.recoveryPromptText}>
                  Please enter the 4-digit code sent to{' '}
                  <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                    {recoveryInput || 'your registered account'}
                  </Text>:
                </Text>

                {/* 4-Digit OTP Boxes matching Reference */}
                <View style={styles.otpBoxesRow}>
                  {otpDigits.map((digit, idx) => (
                    <View key={idx} style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}>
                      <Text style={styles.otpBoxText}>{digit || '-'}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.primaryButtonDisabled, { marginTop: 24 }]}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* 5. CREATE NEW PASSWORD (Reference UI Frame 6) */}
            {screenMode === 'newpass' && (
              <View style={styles.recoveryContainer}>
                <View style={styles.illustrationCircle}>
                  <Text style={styles.illustrationEmoji}>🛡️</Text>
                </View>

                <Text style={styles.recoveryPromptText}>
                  Enter and confirm your new secure credentials:
                </Text>

                <View style={[styles.inputGroup, { width: '100%' }]}>
                  <Text style={styles.fieldLabel}>New Password / PIN</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newPasswordInput}
                    onChangeText={setNewPasswordInput}
                    placeholder="Enter new password or 4-digit PIN"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                  />
                </View>

                <View style={[styles.inputGroup, { width: '100%' }]}>
                  <Text style={styles.fieldLabel}>Confirm New Password / PIN</Text>
                  <TextInput
                    style={styles.textInput}
                    value={confirmNewPasswordInput}
                    onChangeText={setConfirmNewPasswordInput}
                    placeholder="Confirm password or PIN"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.primaryButtonDisabled, { marginTop: 16 }]}
                  onPress={handleSaveNewPassword}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save Credentials</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* 6. PASSWORD CHANGED SUCCESS (Reference UI Frame 7) */}
            {screenMode === 'success' && (
              <View style={styles.recoveryContainer}>
                <View style={styles.successCheckCircle}>
                  <Text style={styles.successCheckEmoji}>✓</Text>
                </View>

                <Text style={styles.successHeaderTitle}>Password Changed</Text>
                <Text style={styles.successHeaderSub}>
                  Your security credentials have been updated successfully.
                </Text>

                <TouchableOpacity
                  style={[styles.primaryButton, { marginTop: 28 }]}
                  onPress={() => setScreenMode('signin')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B192C',
  },
  keyboardView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
  },

  // CURVED TOP HEADER (Reference UI Styling)
  curvedHeader: {
    backgroundColor: '#0B192C',
    paddingTop: Platform.OS === 'web' ? 24 : 36,
    paddingHorizontal: 22,
    paddingBottom: 32,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 64,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  headerTopNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerBackBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
  },
  headerBackText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  headerSkipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 6,
  },
  headerTitleWrap: {
    marginTop: 4,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // FORM CONTAINER
  formContainer: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 40,
  },

  // ROLE SELECTOR PILL
  roleSegmentPill: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  roleSegmentTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  roleSegmentTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  roleSegmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  roleSegmentTextActive: {
    color: '#0B192C',
    fontWeight: '800',
  },

  // INPUTS
  inputGroup: {
    marginBottom: 14,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  textInput: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 14,
    color: '#0F172A',
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    height: '100%',
  },
  eyeBtn: {
    paddingLeft: 10,
  },
  eyeBtnText: {
    fontSize: 16,
  },

  // FORGOT PASSWORD
  forgotPassBtn: {
    alignSelf: 'flex-end',
    marginTop: 2,
    marginBottom: 18,
  },
  forgotPassText: {
    color: '#0B192C',
    fontSize: 12,
    fontWeight: '700',
  },

  // PRIMARY BUTTON
  primaryButton: {
    backgroundColor: '#0B192C',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B192C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // DIVIDER
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },

  // BOTTOM LINK
  bottomLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomLinkMuted: {
    color: '#64748B',
    fontSize: 13,
  },
  bottomLinkBold: {
    color: '#0B192C',
    fontSize: 13,
    fontWeight: '800',
  },

  // TERMS NOTICE
  termsNoticeText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  termsNoticeBold: {
    color: '#0B192C',
    fontWeight: '700',
  },

  // RECOVERY & VERIFICATION FLOW
  recoveryContainer: {
    alignItems: 'center',
    paddingTop: 10,
    width: '100%',
  },
  illustrationCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(11, 25, 44, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  illustrationEmoji: {
    fontSize: 32,
  },
  recoveryPromptText: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  radioOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    width: '100%',
    marginBottom: 10,
    gap: 12,
  },
  radioOptionCardActive: {
    borderColor: '#0B192C',
    backgroundColor: 'rgba(11, 25, 44, 0.02)',
  },
  radioIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioIconText: {
    fontSize: 18,
  },
  radioOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  radioOptionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#0B192C',
  },
  radioCircleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0B192C',
  },

  // OTP BOXES
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 12,
  },
  otpBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: '#0B192C',
    backgroundColor: '#F8FAFC',
  },
  otpBoxText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },

  // SUCCESS CIRCLE
  successCheckCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0B192C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#0B192C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  successCheckEmoji: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
  },
  successHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  successHeaderSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },

  // ORGANIZATION CHIPS
  orgChipScroll: {
    flexDirection: 'row',
    marginTop: 4,
  },
  orgChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  orgChipActive: {
    backgroundColor: '#0B192C',
    borderColor: '#0B192C',
  },
  orgChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  orgChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // ALERTS
  errorAlert: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorAlertText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  successAlert: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  successAlertText: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '600',
  },
});
