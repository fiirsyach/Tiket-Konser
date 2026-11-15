import { useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, IconButton, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiRequest } from '@/lib/api';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetComplete, setResetComplete] = useState(false);

  const requestCode = async () => {
    setError('');
    setNotice('');
    try {
      setSubmitting(true);
      const response = await apiRequest<{ message?: string }>('/auth/forgot-password', {
        method: 'POST',
        authenticated: false,
        body: { email: email.trim() },
      });
      setCodeSent(true);
      setNotice(response.message || 'Jika email terdaftar, kode OTP akan dikirim.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Tidak dapat mengirim kode OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async () => {
    setError('');
    setNotice('');
    if (!/^\d{6}$/.test(otp)) {
      setError('Masukkan kode OTP 6 digit.');
      return;
    }
    if (password.length < 8) {
      setError('Kata sandi baru minimal 8 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    try {
      setSubmitting(true);
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        authenticated: false,
        body: { email: email.trim(), otp, newPassword: password },
      });
      setNotice('Kata sandi berhasil diubah. Silakan masuk kembali.');
      setResetComplete(true);
      setOtp('');
      setPassword('');
      setConfirmPassword('');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Tidak dapat mengubah kata sandi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 32 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <IconButton icon="arrow-left" onPress={() => router.back()} style={styles.back} />
        <View style={styles.brand}>
          <Text variant="titleMedium" style={{ color: theme.colors.secondary, letterSpacing: 2, fontWeight: '900' }}>TIKETIN</Text>
        </View>
        <Text variant="headlineMedium" style={styles.heading}>Lupa kata sandi?</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Kami akan mengirim kode OTP 6 digit ke email akunmu. Kode berlaku selama 10 menit.
        </Text>
        {!resetComplete && <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          left={<TextInput.Icon icon="email-outline" />}
          disabled={submitting || codeSent}
        />}
        {codeSent && !resetComplete && (
          <>
            <TextInput
              label="Kode OTP"
              value={otp}
              onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
              mode="outlined"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={6}
              left={<TextInput.Icon icon="numeric" />}
              disabled={submitting}
            />
            <TextInput
              label="Kata sandi baru"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry
              autoComplete="new-password"
              left={<TextInput.Icon icon="lock-outline" />}
              disabled={submitting}
            />
            <TextInput
              label="Konfirmasi kata sandi baru"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              mode="outlined"
              secureTextEntry
              autoComplete="new-password"
              left={<TextInput.Icon icon="lock-outline" />}
              disabled={submitting}
            />
          </>
        )}
        {error ? <Text variant="bodySmall" style={{ color: theme.colors.error }}>{error}</Text> : null}
        {notice ? <Text variant="bodySmall" style={{ color: theme.colors.primary }}>{notice}</Text> : null}
        {!resetComplete && <Button
          mode="contained"
          onPress={() => void (codeSent ? resetPassword() : requestCode())}
          loading={submitting}
          disabled={submitting || !email.trim() || (codeSent && (!otp || !password || !confirmPassword))}
          contentStyle={styles.submitButton}
        >
          {codeSent ? 'Ubah kata sandi' : 'Kirim kode OTP'}
        </Button>}
        {codeSent && !resetComplete && (
          <Button mode="text" onPress={() => { setCodeSent(false); setOtp(''); setError(''); setNotice(''); }} disabled={submitting}>
            Kirim ulang kode
          </Button>
        )}
        {resetComplete && (
          <Button mode="text" onPress={() => router.replace('/login')}>Kembali ke login</Button>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 24, paddingBottom: 32, gap: 14, justifyContent: 'center' },
  back: { alignSelf: 'flex-start', marginLeft: -8, marginBottom: 8 },
  brand: { alignItems: 'flex-start', marginBottom: 8 },
  heading: { fontWeight: '800', marginTop: 4 },
  submitButton: { height: 48 },
});
