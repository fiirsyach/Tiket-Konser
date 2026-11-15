import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Button, Card, Chip, IconButton, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';
import { VenueCategoryMap } from '@/components/venue-category-map';
import { apiRequest, formatCurrency, formatDate, getConcertPoster, getMediaUrl, type Concert, type TicketCategory } from '@/lib/api';
import { openMidtransSnap } from '@/lib/midtrans';

type ConcertResponse = { success: boolean; data: Concert };
type CategoryResponse = { success: boolean; data: TicketCategory[] };
type FavoritesResponse = { success: boolean; data: { concertId: number }[] };
type Seat = { id: number; number: string; row?: string; sectionName?: string; category?: string; price: number | string; status: string };
type SeatResponse = { success: boolean; data: { seats: Seat[] } };
type OrderResponse = { success: boolean; data: { id: number; orderNumber: string }; message?: string };
type PaymentResponse = {
  success: boolean;
  data?: { paymentUrl?: string; snapToken?: string; clientKey?: string; isProduction?: boolean; testMode?: boolean };
  message?: string;
};

export default function ConcertDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [concert, setConcert] = useState<Concert | null>(null);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [concertResponse, categoryResponse, seatResponse] = await Promise.all([
          apiRequest<ConcertResponse>(`/concerts/${encodeURIComponent(String(id))}`),
          apiRequest<CategoryResponse>(`/concerts/${encodeURIComponent(String(id))}/ticket-categories`),
          apiRequest<SeatResponse>(`/seats/concerts/${encodeURIComponent(String(id))}/seats`),
        ]);
        if (!mounted) return;
        setConcert(concertResponse.data);
        setCategories(categoryResponse.data || []);
        setSeats((seatResponse.data?.seats || []).filter((seat) => seat.status === 'available'));
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Gagal memuat konser.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    let mounted = true;
    if (!user || user.role !== 'customer') {
      return () => { mounted = false; };
    }
    apiRequest<FavoritesResponse>('/customer/favorites')
      .then((response) => {
        if (mounted) setFavorite((response.data || []).some((item) => String(item.concertId) === String(id)));
      })
      .catch((favoriteError: unknown) => {
        if (mounted) Alert.alert('Wishlist tidak dapat dimuat', favoriteError instanceof Error ? favoriteError.message : 'Coba lagi nanti.');
      });
    return () => { mounted = false; };
  }, [id, user]);

  const useCategories = categories.length > 0;
  const fallbackVenueAreas = useMemo(() => {
    const seen = new Set<string>();
    return seats.flatMap((seat) => {
      const name = seat.sectionName || seat.category;
      if (!name || seen.has(name)) return [];
      seen.add(name);
      return [{ id: name, name, price: seat.price }];
    });
  }, [seats]);
  const quantity = useCategories ? Object.values(quantities).reduce((sum, count) => sum + count, 0) : selectedSeats.length;
  const subtotal = useMemo(() => {
    if (useCategories) {
      return categories.reduce((sum, category) => sum + Number(category.price) * (quantities[category.id] || 0), 0);
    }
    return seats.filter((seat) => selectedSeats.includes(seat.id)).reduce((sum, seat) => sum + Number(seat.price), 0);
  }, [categories, quantities, seats, selectedSeats, useCategories]);
  const total = subtotal * 1.05;
  const heroImage = getMediaUrl(concert?.banner || concert?.thumbnail) || getConcertPoster(concert?.concertGalleries);

  const changeQuantity = (category: TicketCategory, delta: number) => {
    const current = quantities[category.id] || 0;
    const next = current + delta;
    if (next < 0 || next > Math.max(0, Number(category.quota) - Number(category.sold))) return;
    if (quantity + delta > 10) {
      Alert.alert('Maksimal 10 tiket', 'Satu pesanan dapat membeli maksimal 10 tiket.');
      return;
    }
    setQuantities((currentValues) => ({ ...currentValues, [category.id]: next }));
  };

  const toggleSeat = (seat: Seat) => {
    setSelectedSeats((current) => {
      if (current.includes(seat.id)) return current.filter((idValue) => idValue !== seat.id);
      if (current.length >= 10) {
        Alert.alert('Maksimal 10 tiket', 'Satu pesanan dapat membeli maksimal 10 tiket.');
        return current;
      }
      return [...current, seat.id];
    });
  };

  const toggleFavorite = async () => {
    if (!user) {
      Alert.alert('Masuk untuk menyimpan konser', 'Silakan masuk atau daftar untuk menyimpan konser ke wishlist.', [
        { text: 'Nanti', style: 'cancel' },
        { text: 'Masuk', onPress: () => router.push('/login') },
      ]);
      return;
    }
    if (user.role !== 'customer') {
      Alert.alert('Fitur customer', 'Wishlist hanya tersedia untuk akun customer.');
      return;
    }
    try {
      setFavoriteBusy(true);
      await apiRequest(`/customer/favorites/${encodeURIComponent(String(id))}`, {
        method: favorite ? 'DELETE' : 'POST',
      });
      setFavorite(!favorite);
    } catch (favoriteError) {
      Alert.alert('Wishlist tidak dapat diperbarui', favoriteError instanceof Error ? favoriteError.message : 'Coba lagi nanti.');
    } finally {
      setFavoriteBusy(false);
    }
  };

  const book = async () => {
    if (!user) {
      Alert.alert('Masuk untuk memesan', 'Silakan masuk atau daftar sebelum melanjutkan pemesanan.', [
        { text: 'Nanti', style: 'cancel' },
        { text: 'Masuk', onPress: () => router.push('/login') },
      ]);
      return;
    }
    if (!concert || quantity < 1) {
      Alert.alert('Pilih tiket', 'Pilih setidaknya satu tiket untuk melanjutkan.');
      return;
    }

    let orderId: number | null = null;
    try {
      setBooking(true);
      const order = await apiRequest<OrderResponse>('/orders', {
        method: 'POST',
        body: {
          concertId: concert.id,
          ...(useCategories
            ? { categories: categories.filter((category) => quantities[category.id] > 0).map((category) => ({ ticketCategoryId: category.id, quantity: quantities[category.id] })) }
            : { seats: selectedSeats }),
        },
      });
      orderId = order.data.id;
      const payment = await apiRequest<PaymentResponse>('/payments/create', {
        method: 'POST',
        body: { orderId, method: 'qris' },
      });
      if (payment.data?.testMode) {
        Alert.alert('Pembayaran uji coba', payment.message || 'Pesanan uji coba berhasil diproses.');
      } else {
        const { paymentUrl, snapToken, clientKey, isProduction } = payment.data || {};
        if (!paymentUrl || !snapToken || !clientKey || typeof isProduction !== 'boolean') {
          throw new Error(payment.message || 'Sesi pembayaran Midtrans tidak lengkap.');
        }
        await openMidtransSnap({ paymentUrl });
        Alert.alert('Pesanan dibuat', 'Checkout Midtrans ditutup. Status pesanan akan diperbarui setelah Midtrans mengonfirmasi pembayaran.');
      }
      router.replace('/(tabs)/tickets');
    } catch (bookingError) {
      const message = bookingError instanceof Error ? bookingError.message : 'Coba lagi nanti.';
      if (orderId) {
        Alert.alert('Pesanan dibuat, pembayaran belum selesai', `${message}\n\nKamu dapat melanjutkan pembayaran melalui tab Tiket > Pesanan.`);
        router.replace('/(tabs)/tickets');
      } else {
        Alert.alert('Tidak dapat membuat pesanan', message);
      }
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }
  if (!concert || error) {
    return (
      <View style={styles.center}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Text variant="bodyLarge" style={{ color: theme.colors.error, textAlign: 'center' }}>{error || 'Konser tidak ditemukan.'}</Text>
        <Button onPress={() => router.back()}>Kembali</Button>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header mode="small" elevated={false} style={{ backgroundColor: theme.colors.background }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Detail konser" />
        <Appbar.Action
          icon={user?.role === 'customer' && favorite ? 'heart' : 'heart-outline'}
          disabled={favoriteBusy}
          onPress={() => void toggleFavorite()}
        />
        <Appbar.Action icon="share-variant-outline" onPress={() => Alert.alert(concert.name, 'Ajak temanmu datang ke konser ini!')} />
      </Appbar.Header>
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 28 + insets.bottom }]}>
        {heroImage ? <Image source={{ uri: heroImage }} style={styles.hero} contentFit="cover" /> : <View style={[styles.hero, styles.heroPlaceholder, { backgroundColor: theme.colors.primaryContainer }]}><Text variant="displayMedium">♫</Text></View>}
        <View style={styles.titleRow}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text variant="headlineSmall" style={styles.title}>{concert.name}</Text>
            <Text variant="titleMedium" style={{ color: theme.colors.primary }}>{concert.genre || 'Live music'}</Text>
          </View>
          {concert.genre ? <Chip compact>{concert.genre}</Chip> : null}
        </View>

        <Card mode="contained" style={[styles.infoCard, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Card.Content style={{ gap: 12 }}>
            <InfoLine icon="calendar-month-outline" label={formatDate(concert.date)} />
            <InfoLine icon="clock-outline" label={concert.time?.slice(0, 5) || 'Waktu acara tertera di tiket'} />
            <InfoLine icon="map-marker-outline" label={concert.venue?.name || concert.venueName || 'Lokasi belum tersedia'} detail={[concert.venue?.city || concert.city, concert.venue?.address].filter(Boolean).join(' · ') || null} />
          </Card.Content>
        </Card>

        {concert.description ? (
          <View style={{ gap: 6 }}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Tentang acara</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 22 }}>{concert.description}</Text>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <View>
            <Text variant="titleLarge" style={styles.sectionTitle}>Peta area venue</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Lihat posisi kategori tiket terhadap panggung.
            </Text>
          </View>
          <VenueCategoryMap
            venueName={concert.venue?.name || concert.venueName || 'Denah venue'}
            venueCity={concert.venue?.city || concert.city}
            venueAddress={concert.venue?.address}
            venueType={concert.venueType || concert.venue?.type}
            categories={categories}
            fallbackAreas={fallbackVenueAreas}
          />
        </View>

        <View style={{ gap: 10 }}>
          <View>
            <Text variant="titleLarge" style={styles.sectionTitle}>Pilih tiket</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Biaya layanan 5% ditambahkan saat checkout.</Text>
          </View>
          {useCategories ? categories.map((category) => {
            const available = Math.max(0, Number(category.quota) - Number(category.sold));
            const count = quantities[category.id] || 0;
            return (
              <Card key={category.id} mode="outlined" style={[styles.categoryCard, count > 0 && { borderColor: theme.colors.primary }]}>
                <Card.Content style={styles.categoryContent}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>{category.category}</Text>
                    {category.description ? <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{category.description}</Text> : null}
                    <Text variant="titleSmall" style={{ color: theme.colors.primary, fontWeight: '700' }}>{formatCurrency(category.price)}</Text>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{available.toLocaleString('id-ID')} tersedia</Text>
                  </View>
                  <View style={styles.quantityControl}>
                    <IconButton icon="minus" mode="outlined" size={18} disabled={count === 0} onPress={() => changeQuantity(category, -1)} />
                    <Text variant="titleMedium" style={{ minWidth: 20, textAlign: 'center' }}>{count}</Text>
                    <IconButton icon="plus" mode="outlined" size={18} disabled={available <= count || quantity >= 10} onPress={() => changeQuantity(category, 1)} />
                  </View>
                </Card.Content>
              </Card>
            );
          }) : seats.length ? (
            <View style={styles.seatGrid}>
              {seats.map((seat) => {
                const selected = selectedSeats.includes(seat.id);
                return (
                  <Chip key={seat.id} selected={selected} showSelectedCheck={false} onPress={() => toggleSeat(seat)} style={styles.seatChip}>
                    {seat.sectionName ? `${seat.sectionName} · ` : ''}{seat.row ? `${seat.row}-` : ''}{seat.number} · {formatCurrency(seat.price)}
                  </Chip>
                );
              })}
            </View>
          ) : (
            <Card mode="outlined" style={styles.emptyCard}><Card.Content><Text style={{ color: theme.colors.onSurfaceVariant }}>Tiket untuk konser ini belum tersedia.</Text></Card.Content></Card>
          )}
        </View>
      </ScrollView>
      <View style={[styles.checkout, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }]}>
        <View>
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{quantity} tiket · termasuk biaya layanan</Text>
          <Text variant="titleLarge" style={{ fontWeight: '800', color: theme.colors.primary }}>{formatCurrency(total)}</Text>
        </View>
        <Button mode="contained" onPress={book} loading={booking} disabled={booking || quantity === 0} contentStyle={styles.buyButton}>Pesan tiket</Button>
      </View>
    </View>
  );
}

function InfoLine({ icon, label, detail }: { icon: string; label: string; detail?: string | null }) {
  const theme = useTheme();
  return (
    <View style={styles.infoLine}>
      <IconButton icon={icon} size={21} iconColor={theme.colors.primary} style={{ margin: 0 }} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium" style={{ fontWeight: '600' }}>{label}</Text>
        {detail ? <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{detail}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  page: { paddingHorizontal: 18, paddingBottom: 28, gap: 20 },
  hero: { width: '100%', height: 235, borderRadius: 18, marginTop: 6 },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontWeight: '800' },
  infoCard: { borderRadius: 16 },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontWeight: '800' },
  categoryCard: { borderRadius: 16 },
  categoryContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quantityControl: { flexDirection: 'row', alignItems: 'center' },
  seatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seatChip: { maxWidth: '100%' },
  emptyCard: { borderRadius: 14 },
  checkout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  buyButton: { height: 46, paddingHorizontal: 8 },
});
