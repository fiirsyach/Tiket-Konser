import { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, SegmentedButtons, Text, useTheme } from 'react-native-paper';

import { useAuth } from '@/context/auth';
import { apiRequest, formatCurrency, formatDate, getConcertPoster, getMediaUrl, getOrderStatusLabel, type Order, type Ticket } from '@/lib/api';
import { openMidtransSnap } from '@/lib/midtrans';

type ListResponse<T> = { success: boolean; data: T[] };
type PaymentResponse = {
  success: boolean;
  data?: { paymentUrl?: string; snapToken?: string; clientKey?: string; isProduction?: boolean; testMode?: boolean };
  message?: string;
};

export default function TicketsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [section, setSection] = useState('tickets');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setTickets([]);
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [ticketResponse, orderResponse] = await Promise.all([
        apiRequest<ListResponse<Ticket>>('/customer/tickets?limit=50'),
        apiRequest<ListResponse<Order>>('/customer/orders?limit=50'),
      ]);
      setTickets(ticketResponse.data || []);
      setOrders(orderResponse.data || []);
    } catch (error) {
      Alert.alert('Tidak dapat memuat tiket', error instanceof Error ? error.message : 'Coba lagi nanti.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const payOrder = async (order: Order) => {
    try {
      setPayingId(order.id);
      const response = await apiRequest<PaymentResponse>('/payments/create', {
        method: 'POST',
        body: { orderId: order.id, method: 'qris' },
      });
      if (response.data?.testMode) {
        Alert.alert('Pembayaran uji coba', response.message || 'Pesanan uji coba berhasil diproses.');
      } else {
        const { paymentUrl, snapToken, clientKey, isProduction } = response.data || {};
        if (!paymentUrl || !snapToken || !clientKey || typeof isProduction !== 'boolean') {
          throw new Error(response.message || 'Sesi pembayaran Midtrans tidak lengkap.');
        }
        await openMidtransSnap({ paymentUrl });
        Alert.alert('Checkout ditutup', 'Status pesanan akan diperbarui setelah Midtrans mengonfirmasi pembayaran.');
      }
      await load();
    } catch (error) {
      Alert.alert('Pembayaran belum berhasil', error instanceof Error ? error.message : 'Coba lagi nanti.');
    } finally {
      setPayingId(null);
    }
  };

  const cancelOrder = (order: Order) => {
    Alert.alert(
      'Batalkan pesanan?',
      'Pesanan yang dibatalkan tidak dapat dibayar lagi.',
      [
        { text: 'Tidak', style: 'cancel' },
        {
          text: 'Ya, batalkan',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setPayingId(order.id);
                await apiRequest(`/orders/${order.id}/cancel`, { method: 'PUT' });
                await load();
                Alert.alert('Pesanan dibatalkan', 'Pesanan berhasil dibatalkan.');
              } catch (error) {
                Alert.alert('Tidak dapat membatalkan pesanan', error instanceof Error ? error.message : 'Coba lagi nanti.');
              } finally {
                setPayingId(null);
              }
            })();
          },
        },
      ],
    );
  };

  if (!user) {
    return (
      <View style={[styles.guest, { backgroundColor: theme.colors.background }]}>
        <Text variant="displaySmall">🎟️</Text>
        <Text variant="headlineSmall" style={styles.guestTitle}>Tiketmu ada di sini</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>Masuk untuk melihat e-tiket dan pesanan konser.</Text>
        <Button mode="contained" onPress={() => router.push('/login')} style={styles.loginButton}>Masuk atau daftar</Button>
      </View>
    );
  }

  if (user.role !== 'customer') {
    return (
      <View style={[styles.guest, { backgroundColor: theme.colors.background }]}>
        <Text variant="headlineSmall" style={styles.guestTitle}>Panel {user.role.replace('_', ' ')}</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>Menu tiket customer hanya tersedia untuk akun customer.</Text>
        <Button mode="contained" onPress={() => router.push('/(tabs)/workspace')}>Buka panel akun</Button>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.page}>
      <Text variant="headlineSmall" style={styles.heading}>Tiket & pesanan</Text>
      <SegmentedButtons
        value={section}
        onValueChange={setSection}
        buttons={[
          { value: 'tickets', label: 'E-tiket' },
          { value: 'orders', label: `Pesanan${orders.length ? ` (${orders.length})` : ''}` },
        ]}
      />
      {loading ? <ActivityIndicator style={{ marginTop: 36 }} /> : section === 'tickets' ? (
        tickets.length ? tickets.map((ticket) => {
          const image = getMediaUrl(ticket.concert?.thumbnail || ticket.concert?.banner)
            || getConcertPoster(ticket.concert?.concertGalleries);
          return (
            <Card key={ticket.id} mode="outlined" style={styles.card} onPress={() => router.push({ pathname: '/ticket/[id]', params: { id: String(ticket.id) } })}>
              <Card.Content style={styles.cardContent}>
                {image ? <Image source={{ uri: image }} style={styles.ticketImage} contentFit="cover" /> : <View style={[styles.ticketImage, styles.placeholder, { backgroundColor: theme.colors.primaryContainer }]}><Text>♫</Text></View>}
                <View style={styles.ticketInfo}>
                  <Text variant="titleMedium" numberOfLines={2} style={{ fontWeight: '700' }}>{ticket.concert?.name || 'Konser'}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{formatDate(ticket.concert?.date)}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{ticket.category}{ticket.seat?.number ? ` · Kursi ${ticket.seat.number}` : ''}</Text>
                  <Text variant="labelSmall" style={{ color: theme.colors.primary }}>{ticket.ticketNumber}</Text>
                </View>
                <Chip compact>{ticket.status}</Chip>
              </Card.Content>
            </Card>
          );
        }) : <EmptyState message="Belum ada e-tiket. Temukan konser dan pesan tiket pertamamu." />
      ) : orders.length ? orders.map((order) => {
        const pending = order.status === 'pending';
        return (
          <Card key={order.id} mode="outlined" style={styles.orderCard} onPress={() => router.push({ pathname: '/order/[id]', params: { id: String(order.id) } })}>
            <Card.Content style={{ gap: 8 }}>
              <View style={styles.orderHeader}>
                <Text
                  variant="labelMedium"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[styles.orderNumber, { color: theme.colors.onSurfaceVariant }]}
                >
                  {order.orderNumber}
                </Text>
                <Chip compact style={styles.orderStatus}>{getOrderStatusLabel(order)}</Chip>
              </View>
              <Text variant="titleMedium" style={{ fontWeight: '700' }}>{order.concert?.name || 'Konser'}</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{formatDate(order.concert?.date)} · {order.orderTickets?.length || 0} tiket</Text>
              <View style={styles.orderFooter}>
                <Text variant="titleSmall" style={{ color: theme.colors.primary, fontWeight: '700' }}>{formatCurrency(order.totalAmount)}</Text>
                {pending && (
                  <View style={styles.orderActions}>
                    <Button mode="outlined" compact disabled={payingId !== null} onPress={(event) => { event.stopPropagation(); cancelOrder(order); }}>
                      Batalkan
                    </Button>
                    <Button mode="contained" compact loading={payingId === order.id} disabled={payingId !== null} onPress={(event) => { event.stopPropagation(); void payOrder(order); }}>
                      Bayar sekarang
                    </Button>
                  </View>
                )}
              </View>
            </Card.Content>
          </Card>
        );
      }) : <EmptyState message="Riwayat pesananmu akan tampil di sini." />
      }
      <Button mode="text" onPress={() => load()} style={{ marginTop: 8 }}>Muat ulang</Button>
    </ScrollView>
  );
}

function EmptyState({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <Text variant="displaySmall">🎫</Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>{message}</Text>
      <Button mode="outlined" onPress={() => router.push('/(tabs)/explore')}>Jelajahi konser</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 36, gap: 16 },
  heading: { fontWeight: '800' },
  card: { borderRadius: 16 },
  cardContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ticketImage: { width: 76, height: 82, borderRadius: 12 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  ticketInfo: { flex: 1, gap: 4 },
  orderCard: { borderRadius: 16 },
  orderHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderNumber: { flex: 1, minWidth: 0 },
  orderStatus: { flexShrink: 0, margin: 0 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 4 },
  orderActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  empty: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 48, gap: 14 },
  guest: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  guestTitle: { fontWeight: '800', textAlign: 'center' },
  loginButton: { marginTop: 8 },
});
