import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@/lib/storage';
import { getUserErrorMessage } from '@/lib/errorHandler';
import { signInUser } from '@/lib/firebaseHelpers';
import { AuthBrandHeader } from '@/src/_components/auth/AuthBrandHeader';
import { AuthKeyboardScroll } from '@/src/_components/auth/AuthKeyboardScroll';
import CustomButton from '@/src/_components/auth/CustomButton';
import { safeRouterBack } from '@/lib/safeRouterBack';
import { auth } from '@/config/firebase';
import { sendEmailVerification } from 'firebase/auth';
import COLORS from '@/src/theme/colors';

export default function VerifyLoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const result = await signInUser(email.trim(), password);

      if (result.success) {
        await new Promise(resolve => setTimeout(resolve, 800));
        const token = await AsyncStorage.getItem('token');
        const userId = await AsyncStorage.getItem('userId');
        if (token && userId) {
          setTimeout(() => {
            try {
              router.replace('/(tabs)/home');
            } catch {
              router.push('/(tabs)/home');
            }
          }, 100);
        }
      } else {
        setError(getUserErrorMessage(result.error || 'Login failed'));
      }
    } catch (err: any) {
      setError(getUserErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    try {
      if (auth && auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        Alert.alert('Sent', 'Verification link has been resent to your email.');
      } else {
        Alert.alert('Notice', 'Please check your email inbox for the verification link sent during registration.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to resend verification link.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AuthKeyboardScroll contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => safeRouterBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View style={styles.titleSection}>
            <AuthBrandHeader
              title="Welcome!"
              subtitle="Please verify your email link, then enter your password to continue."
            />
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              importantForAutofill="yes"
              editable={!loading}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCorrect={false}
                autoCapitalize="none"
                autoFocus={true}
                autoComplete="password"
                textContentType="password"
                importantForAutofill="yes"
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(v => !v)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Error Message */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Forgot Password */}
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/auth/forgot-password', params: { email } })}
            style={{ alignSelf: 'flex-end', marginBottom: 16 }}
          >
            <Text style={styles.forgotPassword}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <CustomButton
            title={loading ? 'Logging in...' : 'Login'}
            onPress={handleLogin}
            variant="primary"
            style={styles.loginButton}
            loading={loading}
            disabled={loading}
          />

          {/* Resend Verification Link */}
          <TouchableOpacity
            onPress={handleResendVerification}
            style={styles.resendBtn}
            disabled={resending}
          >
            <Text style={styles.resendBtnText}>
              {resending ? 'Resending...' : "Didn't receive email? Resend link"}
            </Text>
          </TouchableOpacity>
        </View>
      </AuthKeyboardScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  header: {
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
    marginLeft: -4,
  },
  titleSection: {
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    padding: 4,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    marginBottom: 12,
  },
  forgotPassword: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  loginButton: {
    marginTop: 8,
  },
  resendBtn: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendBtnText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
