import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Button, Card, Divider, List, Text, TextInput, useTheme } from 'react-native-paper';

import { useAuth } from '@/context/auth';
import { apiRequest, getMediaUrl, type User } from '@/lib/api';

type ProfileData = User & {
  companyName?: string;
  city?: string;
  address?: string;
  user?: User;
};
type ProfileResponse = { success: boolean; data: ProfileData };

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, loading, logout, updateUser } = useAuth();
  const [profile, setProfile] = useState<User | null>(user);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user || !['customer', 'organizer'].includes(user.role)) {
      setProfile(user);
      setName(user?.name || '');
      setPhone(user?.phone || '');
      return;
    }
    try {
      const path = user.role === 'organizer' ? '/organizer/profile' : '/customer/profile';
      const response = await apiRequest<ProfileResponse>(path);
      const account = response.data.user || response.data;
      setProfile(account);
      setName(account.name || '');
      setPhone(account.phone || '');
      setCompanyName(response.data.companyName || '');
      setCity(response.data.city || '');
      setAddress(response.data.address || '');
      setBio(account.bio || '');
      setCountry(account.country || '');
    } catch (error) {
      Alert.alert('Profil tidak dapat dimuat', error instanceof Error ? error.message : 'Coba lagi nanti.');
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const save = async () => {
    if (!user || !['customer', 'organizer'].includes(user.role)) return;
    try {
      setSaving(true);
      const path = user.role === 'organizer' ? '/organizer/profile' : '/customer/profile';
      const body = user.role === 'organizer'
        ? { name: name.trim(), phone: phone.trim() || null, companyName: companyName.trim(), city: city.trim(), address: address.trim() }
        : { name: name.trim(), phone: phone.trim() || null, bio: bio.trim() || null, city: city.trim() || null, country: country.trim() || null, address: address.trim() || null };
      const response = await apiRequest<ProfileResponse>(path, {
        method: 'PUT',
        body,
      });
      const account = response.data.user || response.data;
      setProfile(account);
      updateUser(account);
      Alert.alert('Berhasil', 'Profil berhasil diperbarui.');
    } catch (error) {
      Alert.alert('Gagal menyimpan profil', error instanceof Error ? error.message : 'Coba lagi nanti.');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (user?.role !== 'customer') return;
    if (newPassword.length < 8) {
      Alert.alert('Kata sandi terlalu pendek', 'Kata sandi baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Konfirmasi tidak cocok', 'Pastikan kata sandi baru dan konfirmasinya sama.');
      return;
    }
    try {
      setSaving(true);
      await apiRequest('/customer/profile', {
        method: 'PUT',
        body: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Berhasil', 'Kata sandi berhasil diperbarui.');
    } catch (error) {
      Alert.alert('Kata sandi tidak dapat diperbarui', error instanceof Error ? error.message : 'Coba lagi nanti.');
    } finally {
      setSaving(false);
    }
  };

  const signOut = () => {
    Alert.alert('Keluar dari akun?', 'Kamu tetap bisa melihat konser tanpa masuk.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: () => { void logout().catch((error) => Alert.alert('Gagal keluar', error.message)); },
      },
    ]);
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator /></View>;

  if (!user) {
    return (
      <View style={[styles.guest, { backgroundColor: theme.colors.background }]}>
        <Avatar.Icon size={88} icon="account-outline" style={{ backgroundColor: theme.colors.primaryContainer }} color={theme.colors.primary} />
        <Text variant="headlineSmall" style={styles.title}>Akun konsermu</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>Masuk atau buat akun untuk menyimpan konser favorit dan mengelola tiket.</Text>
        <Button mode="contained" onPress={() => router.push('/login')} style={styles.signIn}>Masuk atau daftar</Button>
        <Button mode="text" onPress={() => router.push('/(tabs)/explore')}>Jelajahi konser</Button>
      </View>
    );
  }

  const avatarUrl = getMediaUrl(profile?.avatar);
  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.page}>
      <Text variant="headlineSmall" style={styles.title}>Profil saya</Text>
      <Card mode="contained" style={[styles.profileCard, { backgroundColor: theme.colors.primaryContainer }]}>
        <Card.Content style={styles.profileHeader}>
          {avatarUrl
            ? <Avatar.Image size={66} source={{ uri: avatarUrl }} />
            : <Avatar.Text size={66} label={name.split(' ').slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'T'} />}
          <View style={{ flex: 1 }}>
            <Text variant="titleLarge" style={{ fontWeight: '800' }}>{profile?.name || user.name}</Text>
            <Text variant="bodyMedium">{profile?.email || user.email}</Text>
            <Text variant="labelMedium" style={{ color: theme.colors.primary, marginTop: 3 }}>{user.role.replace('_', ' ')}</Text>
          </View>
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={styles.section}>Informasi akun</Text>
      {['customer', 'organizer'].includes(user.role) && <TextInput label="Nama lengkap" value={name} onChangeText={setName} mode="outlined" autoCapitalize="words" />}
      <TextInput label="Email" value={profile?.email || user.email} mode="outlined" disabled />
      {['customer', 'organizer'].includes(user.role) && (
        <>
          <TextInput label="Nomor telepon" value={phone} onChangeText={setPhone} mode="outlined" keyboardType="phone-pad" />
          {user.role === 'customer' && (
            <>
              <TextInput label="Bio" value={bio} onChangeText={setBio} mode="outlined" multiline />
              <TextInput label="Kota" value={city} onChangeText={setCity} mode="outlined" />
              <TextInput label="Negara" value={country} onChangeText={setCountry} mode="outlined" />
              <TextInput label="Alamat" value={address} onChangeText={setAddress} mode="outlined" multiline />
            </>
          )}
          {user.role === 'organizer' && (
            <>
              <TextInput label="Nama organisasi" value={companyName} onChangeText={setCompanyName} mode="outlined" />
              <TextInput label="Kota" value={city} onChangeText={setCity} mode="outlined" />
              <TextInput label="Alamat" value={address} onChangeText={setAddress} mode="outlined" multiline />
            </>
          )}
          <Button mode="contained" onPress={save} loading={saving} disabled={saving || !name.trim() || (user.role === 'organizer' && (!companyName.trim() || !city.trim() || !address.trim()))} style={styles.saveButton}>Simpan profil</Button>
        </>
      )}
      {user.role === 'customer' && (
        <>
          <Text variant="titleMedium" style={styles.section}>Keamanan</Text>
          <TextInput label="Kata sandi saat ini" value={currentPassword} onChangeText={setCurrentPassword} mode="outlined" secureTextEntry />
          <TextInput label="Kata sandi baru" value={newPassword} onChangeText={setNewPassword} mode="outlined" secureTextEntry />
          <TextInput label="Konfirmasi kata sandi baru" value={confirmPassword} onChangeText={setConfirmPassword} mode="outlined" secureTextEntry />
          <Button mode="outlined" onPress={() => void changePassword()} loading={saving} disabled={saving || !currentPassword || !newPassword || !confirmPassword}>
            Perbarui kata sandi
          </Button>
        </>
      )}

      <Text variant="titleMedium" style={styles.section}>Lainnya</Text>
      <Card mode="outlined" style={styles.menuCard}>
        <List.Item title="Panel akun" description="Buka fitur sesuai peran akunmu" left={(props) => <List.Icon {...props} icon="view-dashboard-outline" />} onPress={() => router.push('/(tabs)/workspace')} />
        <Divider />
        {user.role === 'customer' && (
          <List.Item title="Riwayat pesanan" description="Lihat status dan pembayaran" left={(props) => <List.Icon {...props} icon="receipt-text-outline" />} onPress={() => router.push('/(tabs)/tickets')} />
        )}
        {user.role === 'customer' && <Divider />}
        <List.Item title="Jelajahi konser" description="Temukan acara berikutnya" left={(props) => <List.Icon {...props} icon="music-note-outline" />} onPress={() => router.push('/(tabs)/explore')} />
      </Card>
      <Button mode="outlined" textColor={theme.colors.error} onPress={signOut} style={styles.signOut}>Keluar dari akun</Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 36, gap: 14 },
  title: { fontWeight: '800' },
  profileCard: { borderRadius: 18, marginTop: 2 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12 },
  section: { fontWeight: '700', marginTop: 8 },
  saveButton: { marginTop: 4 },
  menuCard: { borderRadius: 16, overflow: 'hidden' },
  signOut: { borderRadius: 12, marginTop: 10 },
  guest: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  signIn: { marginTop: 8 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
