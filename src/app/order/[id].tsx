import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Button, Card, Chip, Divider, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiRequest, formatCurrency, formatDate, getOrderStatusLabel, type Order } from '@/lib/api';

type OrderResponse = { success: boolean; data: Order };

export default function OrderDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    apiRequest<OrderResponse>(`/customer/orders/${encodeURIComponent(String(id))}`)
      .then((response) => { if (mounted) setOrder(response.data); })
      .catch((loadError: unknown) => { if (mounted) setError(loadError instanceof Error ? loadError.message : 'Pesanan tidak dapat dimuat.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [id]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header style={{ backgroundColor: theme.colors.background }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Detail pesanan" />
      </Appbar.Header>
      {loading ? <View style={styles.center}><ActivityIndicator size="large" /></View> : error || !order ? (
        <View style={styles.center}><Text style={{ color: theme.colors.error }}>{error || 'Pesanan tidak ditemukan.'}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 18 + insets.bottom }]}>
          <Card mode="outlined" style={styles.card}>
            <Card.Content style={{ gap: 12 }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>NOMOR PESANAN</Text>
                  <Text variant="titleMedium" style={{ fontWeight: '700' }}>{order.orderNumber}</Text>
                </View>
                <Chip compact>{getOrderStatusLabel(order)}</Chip>
              </View>
              <Divider />
              <Text variant="headlineSmall" style={{ fontWeight: '800' }}>{order.concert?.name || 'Konser'}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{formatDate(order.concert?.date)}</Text>
              <Divider />
              {(order.orderTickets || []).map((ticket, index) => (
                <View key={ticket.id} style={styles.ticketRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleSmall" style={{ fontWeight: '700' }}>{ticket.category || `Tiket ${index + 1}`}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{ticket.ticketNumber || `Tiket ${index + 1}`}</Text>
                  </View>
                  <Text variant="bodyMedium">{formatCurrency(ticket.price)}</Text>
                </View>
              ))}
              <Divider />
              <View style={styles.row}><Text style={{ color: theme.colors.onSurfaceVariant }}>Status pembayaran</Text><Text variant="bodyMedium">{order.orderPayment?.status || order.status}</Text></View>
              <View style={styles.row}><Text style={{ color: theme.colors.onSurfaceVariant }}>Metode</Text><Text variant="bodyMedium">{order.orderPayment?.method || '-'}</Text></View>
              <View style={styles.row}><Text variant="titleMedium" style={{ fontWeight: '800' }}>Total</Text><Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: '800' }}>{formatCurrency(order.totalAmount)}</Text></View>
              {order.status === 'paid' && (
                <Button mode="contained" onPress={() => router.push('/(tabs)/tickets')}>Lihat e-tiket</Button>
              )}
            </Card.Content>
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  page: { padding: 18 },
  card: { borderRadius: 18 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  ticketRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
