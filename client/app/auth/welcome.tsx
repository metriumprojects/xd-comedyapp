import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { handleSocialAuthResult, signInWithApple, signInWithGoogle, signInWithSnapchat, signInWithTikTok } from '../../services/socialAuthService';
import { AuthBrandHeader } from '@/src/_components/auth/AuthBrandHeader';
import CustomButton from '@/src/_components/auth/CustomButton';
import SocialButton from '@/src/_components/auth/SocialButton';
import COLORS from '@/src/theme/colors';

export default function WelcomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      await handleSocialAuthResult(result, router);
    } catch (error) {
      console.error('Google Sign-In error:', error);
      Alert.alert('Error', 'Failed to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      const result = await signInWithApple();
      await handleSocialAuthResult(result, router);
    } catch (error) {
      console.error('Apple Sign-In error:', error);
      Alert.alert('Error', 'Failed to sign in with Apple. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTikTokSignIn = async () => {
    setLoading(true);
    try {
      const result = await signInWithTikTok();
      await handleSocialAuthResult(result, router);
    } catch (error) {
      console.error('TikTok Sign-In error:', error);
      Alert.alert('Error', 'Failed to sign in with TikTok. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSnapchatSignIn = async () => {
    setLoading(true);
    try {
      const result = await signInWithSnapchat();
      await handleSocialAuthResult(result, router);
    } catch (error) {
      console.error('Snapchat Sign-In error:', error);
      Alert.alert('Error', 'Failed to sign in with Snapchat. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.content}>
          <AuthBrandHeader variant="welcome" subtitle="Discover the planets!" />

          {/* Main Action Buttons */}
          <View style={styles.buttonContainer}>
            <CustomButton
              title="Sign up"
              onPress={() => router.push('/auth/signup-options')}
              variant="secondary"
              style={styles.mainButton}
            />
            <CustomButton
              title="Login"
              onPress={() => router.push('/auth/login-options')}
              variant="primary"
              style={styles.mainButton}
            />
          </View>

          {/* Social Login Section */}
          <View style={styles.socialSection}>
            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.line} />
            </View>

            <View style={{ marginBottom: 21 }}>
              <Text style={styles.agreementText}>
                By continuing, you agree to our{' '}
                <Text style={styles.footerLink} onPress={() => router.push('/legal/terms' as any)}>Terms of Service</Text> and{' '}
                <Text style={styles.footerLink} onPress={() => router.push('/legal/privacy' as any)}>Privacy Policy</Text>.
              </Text>
            </View>

            <SocialButton provider="google" onPress={handleGoogleSignIn} style={styles.socialButton} disabled={loading} />
            <SocialButton provider="apple" onPress={handleAppleSignIn} style={styles.socialButton} disabled={loading} />
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
    padding: 20,
    paddingBottom: 80,
    justifyContent: 'center',
  },
  buttonContainer: {
    marginTop: 15,
    marginBottom: 3,
  },
  mainButton: {
    marginBottom: 8,
  },
  socialSection: {
    marginBottom: 0,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: 10,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  socialButton: {
    marginBottom: 8,
  },
  snapButton: {
    backgroundColor: '#FFFC00',
    borderColor: '#FFFC00',
    marginBottom: 0,
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
    paddingBottom: 5,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  footerLink: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  agreementText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  legalLink: {
    fontSize: 12,
    color: COLORS.info,
    textDecorationLine: 'underline',
  },
});
