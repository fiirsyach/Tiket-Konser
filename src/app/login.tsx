import { useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, IconButton, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async () => {
    setError('');
    setNotice('');
    if (isRegister && !name.trim()) {
      setError('Masukkan nama lengkap.');
      return;
    }
    try {
      setSubmitting(true);
      if (isRegister) {
        const signedIn = await register({
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim() || undefined,
        });
        if (!signedIn) {
          setIsRegister(false);
          setNotice('Pendaftaran berhasil. Silakan masuk dengan akun customer.');
          return;
        }
      } else {
        await login(email.trim(), password);
      }
      router.back();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Tidak dapat memproses akun.');
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
        <Text variant="headlineLarge" style={styles.heading}>Masuk dulu,{'\n'}lalu pilih konsermu.</Text>
        <View style={styles.modeSwitch}>
          <Button
            mode={isRegister ? 'outlined' : 'contained'}
            onPress={() => { setError(''); setNotice(''); setIsRegister(false); }}
            style={styles.modeButton}
          >
            Masuk
          </Button>
          <Button
            mode={isRegister ? 'contained' : 'outlined'}
            buttonColor={isRegister ? theme.colors.secondary : undefined}
            textColor={isRegister ? theme.colors.onSecondary : undefined}
            onPress={() => { setError(''); setNotice(''); setIsRegister(true); }}
            style={styles.modeButton}
          >
            Daftar
          </Button>
        </View>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 10 }}>
          {isRegister ? 'Daftar dan jangan lewatkan konser favoritmu.' : 'Masuk untuk mengakses tiket dan pesananmu.'}
        </Text>
        {isRegister && <TextInput label="Nama lengkap" value={name} onChangeText={setName} mode="outlined" autoCapitalize="words" left={<TextInput.Icon icon="account-outline" />} />}
        <TextInput label="Email" value={email} onChangeText={setEmail} mode="outlined" keyboardType="email-address" autoCapitalize="none" autoComplete="email" left={<TextInput.Icon icon="email-outline" />} />
        {isRegister && <TextInput label="Nomor telepon (opsional)" value={phone} onChangeText={setPhone} mode="outlined" keyboardType="phone-pad" left={<TextInput.Icon icon="phone-outline" />} />}
        <TextInput
          label="Kata sandi"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          secureTextEntry={!showPassword}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          left={<TextInput.Icon icon="lock-outline" />}
          right={<TextInput.Icon icon={showPassword ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShowPassword(!showPassword)} />}
        />
        {!isRegister && (
          <Button compact mode="text" onPress={() => router.push('/forgot-password')}>
            Lupa kata sandi?
          </Button>
        )}
        {error ? <Text variant="bodySmall" style={{ color: theme.colors.error }}>{error}</Text> : null}
        {notice ? <Text variant="bodySmall" style={{ color: theme.colors.primary }}>{notice}</Text> : null}
        <Button mode="contained" onPress={submit} loading={submitting} disabled={submitting || !email.trim() || !password} contentStyle={styles.submitButton}>
          {isRegister ? 'Daftar' : 'Masuk'}
        </Button>
        <Text variant="bodySmall" style={[styles.terms, { color: theme.colors.onSurfaceVariant }]}>Dengan melanjutkan, kamu menyetujui syarat layanan dan kebijakan privasi.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 24, paddingBottom: 32, gap: 16, justifyContent: 'center' },
  back: { alignSelf: 'flex-start', marginLeft: -8, marginBottom: 4 },
  brand: { alignItems: 'flex-start', marginBottom: 8 },
  heading: { fontWeight: '900', marginTop: 4, lineHeight: 44 },
  modeSwitch: { flexDirection: 'row', gap: 12, marginTop: 2 },
  modeButton: { borderRadius: 28 },
  submitButton: { height: 48 },
  terms: { textAlign: 'center', marginTop: 12, paddingHorizontal: 18 },
});
