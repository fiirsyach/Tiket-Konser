import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Card, Chip, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiRequest, formatDate, getMediaUrl, type Ticket } from '@/lib/api';

type TicketResponse = { success: boolean; data: Ticket };
type QrResponse = { success: boolean; data: { ticketNumber: string; qrCode: string; status: string } };

export default function TicketDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [qrCode, setQrCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiRequest<TicketResponse>(`/customer/tickets/${encodeURIComponent(String(id))}`),
      apiRequest<QrResponse>(`/customer/tickets/${encodeURIComponent(String(id))}/qr`),
    ]).then(([ticketResponse, qrResponse]) => {
      if (!mounted) return;
      setTicket(ticketResponse.data);
      setQrCode(qrResponse.data.qrCode);
    }).catch((loadError: unknown) => {
      if (mounted) setError(loadError instanceof Error ? loadError.message : 'Tiket tidak dapat dimuat.');
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [id]);

  const image = getMediaUrl(ticket?.concert?.thumbnail);
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header style={{ backgroundColor: theme.colors.background }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="E-tiket" />
      </Appbar.Header>
      {loading ? <View style={styles.center}><ActivityIndicator size="large" /></View> : error || !ticket ? (
        <View style={styles.center}><Text style={{ color: theme.colors.error, textAlign: 'center' }}>{error || 'Tiket tidak ditemukan.'}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 32 + insets.bottom }]}>
          <Card mode="contained" style={[styles.ticket, { backgroundColor: theme.colors.surface }]}>
            {image ? <Image source={{ uri: image }} style={styles.banner} contentFit="cover" /> : null}
            <Card.Content style={styles.content}>
              <Chip compact style={{ alignSelf: 'flex-start' }}>{ticket.status}</Chip>
              <Text variant="headlineSmall" style={styles.title}>{ticket.concert?.name || 'Konser'}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{formatDate(ticket.concert?.date)} · {ticket.concert?.time?.slice(0, 5) || ''}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{ticket.concert?.venue?.name || ticket.concert?.venueName || ''}</Text>
              <View style={[styles.dash, { borderColor: theme.colors.outlineVariant }]} />
              <View style={styles.row}><Text style={styles.label}>Pesanan</Text><Text variant="bodyMedium">{ticket.order?.orderNumber || '-'}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Kategori</Text><Text variant="bodyMedium">{ticket.category || 'Regular'}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Nomor tiket</Text><Text variant="bodyMedium" style={{ fontWeight: '700' }}>{ticket.ticketNumber}</Text></View>
              {ticket.seat?.number ? <View style={styles.row}><Text style={styles.label}>Kursi</Text><Text variant="bodyMedium">{ticket.seat.sectionName ? `${ticket.seat.sectionName} · ` : ''}{ticket.seat.row ? `${ticket.seat.row}-` : ''}{ticket.seat.number}</Text></View> : null}
              <View style={[styles.qrBox, { backgroundColor: '#fff', borderColor: theme.colors.outlineVariant }]}>
                {qrCode ? <Image source={{ uri: qrCode }} style={styles.qr} contentFit="contain" /> : <Text>QR tiket tidak tersedia</Text>}
              </View>
              <Text variant="bodySmall" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>Tunjukkan QR ini di pintu masuk acara. Jangan bagikan kepada orang lain.</Text>
            </Card.Content>
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  page: { padding: 18, paddingBottom: 32 },
  ticket: { borderRadius: 20, overflow: 'hidden' },
  banner: { height: 170, width: '100%' },
  content: { gap: 12, padding: 20 },
  title: { fontWeight: '800' },
  dash: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { color: '#77717c', fontSize: 13 },
  qrBox: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center', padding: 12, borderWidth: 1, borderRadius: 12, marginTop: 6 },
  qr: { width: 190, height: 190 },
  hint: { textAlign: 'center' },
});
