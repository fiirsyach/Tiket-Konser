import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, Text, useTheme } from 'react-native-paper';

import { formatCurrency, formatDate, getConcertPoster, getMediaUrl, type Concert } from '@/lib/api';

export function ConcertCard({ concert, onPress, imageHeight = 148 }: { concert: Concert; onPress: () => void; imageHeight?: number }) {
  const theme = useTheme();
  const image = getMediaUrl(concert.thumbnail || concert.banner) || getConcertPoster(concert.concertGalleries);

  return (
    <Card mode="outlined" onPress={onPress} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
      {image ? (
        <Image source={{ uri: image }} style={[styles.image, { height: imageHeight }]} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.image, styles.imageFallback, { height: imageHeight, backgroundColor: theme.colors.primaryContainer }]}>
          <Text variant="headlineMedium" style={{ color: theme.colors.onPrimaryContainer }}>♫</Text>
        </View>
      )}
      <Card.Content style={styles.content}>
        <View style={styles.topRow}>
          <Chip compact style={styles.genre} textStyle={styles.genreText}>{concert.genre || 'Konser'}</Chip>
          {concert.availableTickets !== undefined && (
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {concert.availableTickets.toLocaleString('id-ID')} tiket
            </Text>
          )}
        </View>
        <Text variant="titleMedium" numberOfLines={2} style={styles.title}>{concert.name}</Text>
        <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
          {concert.genre || concert.organizer?.name || 'Live music'}
        </Text>
        <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
          {formatDate(concert.date)} · {concert.venue?.city || concert.city || 'Indonesia'}
        </Text>
        <Text variant="titleSmall" style={[styles.price, { color: theme.colors.primary }]}>
          Mulai {formatCurrency(concert.minPrice)}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderRadius: 20 },
  image: { width: '100%' },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  content: { gap: 6, paddingTop: 12, paddingBottom: 14 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  genre: { alignSelf: 'flex-start', height: 28 },
  genreText: { fontSize: 11, marginVertical: 0 },
  title: { fontWeight: '700', minHeight: 44 },
  price: { fontWeight: '700', marginTop: 3 },
});
