import { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Button, Card, IconButton, Searchbar, Text, useTheme } from 'react-native-paper';

import { ConcertCard } from '@/components/concert-card';
import { useAuth } from '@/context/auth';
import { apiRequest, formatDate, formatCurrency, getConcertPoster, getMediaUrl, type Concert } from '@/lib/api';

type ConcertListResponse = { success: boolean; data: Concert[] };
type DashboardResponse = { success: boolean; data: { stats?: { upcomingEvents?: number }; publishedConcerts?: Concert[] } };

export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [featured, setFeatured] = useState<Concert[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const requests: Promise<unknown>[] = [
        apiRequest<ConcertListResponse>('/concerts?limit=12'),
        apiRequest<ConcertListResponse>('/concerts/featured'),
      ];
      if (user?.role === 'customer') {
        requests.push(apiRequest<DashboardResponse>('/customer/dashboard'));
      }
      const results = await Promise.all(requests);
      setConcerts((results[0] as ConcertListResponse).data || []);
      setFeatured((results[1] as ConcertListResponse).data || []);
      if (user?.role === 'customer' && results[2]) {
        const dashboard = results[2] as DashboardResponse;
        setUpcomingEvents(dashboard.data.stats?.upcomingEvents || 0);
      } else {
        setUpcomingEvents(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal memuat konser.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const hero = featured[0] || concerts[0];
  const heroImage = getMediaUrl(hero?.banner || hero?.thumbnail) || getConcertPoster(hero?.concertGalleries);

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <View>
          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>SELAMAT DATANG</Text>
          <Text variant="headlineSmall" style={styles.greeting}>{user ? `Hai, ${user.name.split(' ')[0]}!` : 'Temukan konsermu'}</Text>
        </View>
        <IconButton
          icon={user ? 'bell-outline' : 'account-outline'}
          mode="contained-tonal"
          containerColor={theme.colors.surfaceVariant}
          onPress={() => router.push(!user ? '/login' : user.role === 'customer' ? '/(tabs)/tickets' : '/(tabs)/workspace')}
        />
      </View>

      <Searchbar
        placeholder="Cari artis, konser, atau kota"
        value=""
        onFocus={() => router.push('/(tabs)/explore')}
        style={styles.search}
        elevation={0}
      />

      {user && (
        <Card mode="contained" style={[styles.ticketBanner, { backgroundColor: theme.colors.surfaceVariant }]} onPress={() => router.push('/(tabs)/tickets')}>
          <Card.Content style={styles.bannerContent}>
            <View style={{ flex: 1 }}>
              <Text variant="labelLarge" style={{ color: theme.colors.secondary }}>TIKET KAMU</Text>
              <Text variant="headlineSmall" style={[styles.bannerTitle, { color: theme.colors.onSurface }]}>{upcomingEvents === null ? 'Lihat konser berikutnya' : `${upcomingEvents} acara menantimu`}</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Buka tiket dan riwayat pesanan</Text>
            </View>
            <Avatar.Icon size={52} icon="ticket-confirmation-outline" style={{ backgroundColor: theme.colors.primaryContainer }} color={theme.colors.onPrimaryContainer} />
          </Card.Content>
        </Card>
      )}

      {hero && (
        <Card mode="contained" style={styles.hero} onPress={() => router.push({ pathname: '/concert/[id]', params: { id: String(hero.id) } })}>
          {heroImage ? <Image source={{ uri: heroImage }} style={styles.heroImage} contentFit="cover" /> : <View style={[styles.heroImage, styles.heroFallback, { backgroundColor: theme.colors.primaryContainer }]}><Text variant="displaySmall">♫</Text></View>}
          <View style={styles.heroShade} />
          <View style={styles.heroText}>
            <Text variant="labelLarge" style={styles.heroEyebrow}>PILIHAN MINGGU INI</Text>
            <Text variant="headlineMedium" numberOfLines={2} style={styles.heroTitle}>{hero.name}</Text>
            <Text variant="bodyMedium" style={styles.heroSub}>{formatDate(hero.date)} · {hero.venue?.city || hero.city || 'Indonesia'}</Text>
            <Button mode="contained" compact style={styles.heroButton} onPress={() => router.push({ pathname: '/concert/[id]', params: { id: String(hero.id) } })}>Lihat konser</Button>
          </View>
        </Card>
      )}

      <View style={styles.sectionHeading}>
        <View>
          <Text variant="titleLarge" style={styles.sectionTitle}>Pilihan untukmu</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Konser yang sedang ramai dibicarakan</Text>
        </View>
        <Button compact onPress={() => router.push('/(tabs)/explore')}>Lihat semua</Button>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginVertical: 32 }} />
      ) : error ? (
        <Card mode="outlined" style={styles.empty}>
          <Card.Content style={{ alignItems: 'center', gap: 12 }}>
            <Text style={{ textAlign: 'center' }}>{error}</Text>
            <Button mode="outlined" onPress={() => load(true)}>Coba lagi</Button>
          </Card.Content>
        </Card>
      ) : (
        <View style={styles.grid}>
          {(featured.length ? featured.slice(0, 4) : concerts.slice(0, 4)).map((concert) => (
            <View key={concert.id} style={styles.gridItem}>
              <ConcertCard concert={concert} onPress={() => router.push({ pathname: '/concert/[id]', params: { id: String(concert.id) } })} />
            </View>
          ))}
        </View>
      )}

      <View style={styles.sectionHeading}>
        <View>
          <Text variant="titleLarge" style={styles.sectionTitle}>Segera hadir</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Amankan tiket sebelum kehabisan</Text>
        </View>
      </View>
      {concerts.slice(0, 6).map((concert) => {
        const image = getMediaUrl(concert.thumbnail || concert.banner) || getConcertPoster(concert.concertGalleries);
        return (
          <Card key={`upcoming-${concert.id}`} mode="outlined" style={styles.rowCard} onPress={() => router.push({ pathname: '/concert/[id]', params: { id: String(concert.id) } })}>
            <Card.Content style={styles.rowContent}>
              {image ? <Image source={{ uri: image }} style={styles.rowImage} contentFit="cover" /> : <View style={[styles.rowImage, styles.rowFallback, { backgroundColor: theme.colors.primaryContainer }]}><Text>♫</Text></View>}
              <View style={{ flex: 1, gap: 3 }}>
                <Text variant="titleSmall" numberOfLines={1} style={{ fontWeight: '700' }}>{concert.name}</Text>
                <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>{concert.genre || 'Live music'} · {concert.venue?.city || concert.city || 'Indonesia'}</Text>
                <Text variant="labelMedium" style={{ color: theme.colors.primary }}>{formatDate(concert.date)} · {formatCurrency(concert.minPrice)}</Text>
              </View>
              <IconButton icon="chevron-right" size={20} />
            </Card.Content>
          </Card>
        );
      })}
      {refreshing && <ActivityIndicator style={{ marginVertical: 12 }} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 34, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { fontWeight: '800', marginTop: 2 },
  search: { borderRadius: 14 },
  ticketBanner: { borderRadius: 18 },
  bannerContent: { minHeight: 120, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18 },
  bannerTitle: { color: '#fff', fontWeight: '800', marginVertical: 5 },
  hero: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#19191f' },
  heroImage: { width: '100%', height: 265 },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,10,14,0.52)' },
  heroText: { position: 'absolute', left: 18, right: 18, bottom: 18, gap: 7 },
  heroEyebrow: { color: '#ffb28e', letterSpacing: 1.2 },
  heroTitle: { color: '#fff', fontWeight: '800' },
  heroSub: { color: '#f4eaf4' },
  heroButton: { alignSelf: 'flex-start', marginTop: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  sectionTitle: { fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: '48%', flexGrow: 1, flexBasis: '45%' },
  empty: { borderRadius: 16, paddingVertical: 10 },
  rowCard: { borderRadius: 16 },
  rowContent: { paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowImage: { width: 64, height: 64, borderRadius: 12 },
  rowFallback: { alignItems: 'center', justifyContent: 'center' },
});
