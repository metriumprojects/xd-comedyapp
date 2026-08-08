import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { handleSocialAuthResult, signInWithApple, signInWithGoogle } from '../../services/socialAuthService';
import { AuthBrandHeader } from '@/src/_components/auth/AuthBrandHeader';
import CustomButton from '@/src/_components/auth/CustomButton';
import SocialButton from '@/src/_components/auth/SocialButton';
import { safeRouterBack } from '@/lib/safeRouterBack';
import COLORS from '@/src/theme/colors';

export default function LoginOptionsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');

  const handleNext = () => {
    setError('');
    if (!identifier.trim()) {
      setError('Please enter your email');
      return;
    }
    router.push({
      pathname: '/auth/login-password',
      params: { identifier: identifier.trim() },
    });
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const result = await signInWithGoogle();
    await handleSocialAuthResult(result, router);
    setLoading(false);
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    const result = await signInWithApple();
    await handleSocialAuthResult(result, router);
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Balanced Header & Logo Section */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => safeRouterBack()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            
            <View style={styles.logoContainer}>
              <AuthBrandHeader subtitle="How would you like to login?" />
            </View>

            {/* Empty placeholder to balance the back button width */}
            <View style={styles.headerPlaceholder} />
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <TextInput
              style={styles.input}
              placeholder="Please enter your email"
              placeholderTextColor={COLORS.textMuted}
              value={identifier}
              onChangeText={setIdentifier}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              editable={!loading}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <CustomButton
              title="Next"
              onPress={handleNext}
              variant="primary"
              style={styles.nextButton}
              disabled={loading}
            />

            <Text style={styles.noAccountText}>
              Don't have an account?{' '}
              <Text
                style={styles.footerLink}
                onPress={() => router.push('/auth/signup-options')}
              >
                Sign up
              </Text>
            </Text>
          </View>

          {/* Social Login Options */}
          <View style={styles.socialSection}>
            <SocialButton
              provider="google"
              onPress={handleGoogleSignIn}
              style={styles.socialButton}
            />
            <SocialButton
              provider="apple"
              onPress={handleAppleSignIn}
              style={styles.socialButton}
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={{ fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginTop: 15 }}>
              By logging in, you agree to our{' '}
              <Text style={{ fontWeight: '600' }} onPress={() => router.push('/legal/terms' as any)}>Terms of Service</Text> and{' '}
              <Text style={{ fontWeight: '600' }} onPress={() => router.push('/legal/privacy' as any)}>Privacy Policy</Text>.
            </Text>
          </View>
        </View>
      </ScrollView>
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
    padding: 16,
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    minHeight: 50,
    width: '100%',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 24,
  },
  headerPlaceholder: {
    width: 44,
  },
  formContainer: {
    marginTop: 15,
    marginBottom: 15,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 14,
    marginBottom: 10,
  },
  nextButton: {
    marginBottom: 14,
  },
  noAccountText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  socialSection: {
    marginBottom: 15,
  },
  socialButton: {
    marginBottom: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingBottom: 10,
  },
  footerLink: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
