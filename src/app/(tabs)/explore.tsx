import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Chip, IconButton, Searchbar, Text, useTheme } from 'react-native-paper';

import { ConcertCard } from '@/components/concert-card';
import { apiRequest, type Concert } from '@/lib/api';

type ConcertResponse = { success: boolean; data: Concert[] };

export default function ExploreScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('Semua');
  const [filtersVisible, setFiltersVisible] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const search = query.trim();
        const path = search
          ? `/concerts/search?q=${encodeURIComponent(search)}&limit=30`
          : '/concerts?limit=30';
        const response = await apiRequest<ConcertResponse>(path);
        if (active) setConcerts(response.data || []);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Gagal memuat konser.');
      } finally {
        if (active) setLoading(false);
      }
    }, query ? 350 : 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const filteredConcerts = useMemo(() => concerts.filter((concert) => {
    if (selectedFilter === 'Semua') return true;
    if (selectedFilter === 'Jakarta') {
      return (concert.venue?.city || concert.city || '').toLocaleLowerCase('id-ID').includes('jakarta');
    }
    if (selectedFilter === 'Pop') return (concert.genre || '').toLocaleLowerCase('id-ID') === 'pop';
    const date = concert.date ? new Date(concert.date) : null;
    const now = new Date();
    return date !== null && !Number.isNaN(date.getTime()) &&
      date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }), [concerts, selectedFilter]);

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text variant="headlineSmall" style={styles.title}>Jelajah konser</Text>
      <View style={styles.searchRow}>
        <Searchbar placeholder="Cari artis, kota, genre" value={query} onChangeText={setQuery} style={styles.search} elevation={0} />
        <IconButton
          icon="tune-variant"
          mode="outlined"
          accessibilityLabel={filtersVisible ? 'Sembunyikan filter' : 'Tampilkan filter'}
          onPress={() => setFiltersVisible((visible) => !visible)}
          style={styles.filterToggle}
        />
      </View>
      {filtersVisible && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickSearch}>
          {['Semua', 'Jakarta', 'Bulan ini', 'Pop'].map((label) => (
            <Chip
              key={label}
              selected={selectedFilter === label}
              showSelectedCheck={false}
              mode="outlined"
              onPress={() => setSelectedFilter(label)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedFilter === label ? theme.colors.primary : 'transparent',
                  borderColor: selectedFilter === label ? theme.colors.primary : theme.colors.outlineVariant,
                },
              ]}
              textStyle={[
                styles.filterText,
                { color: selectedFilter === label ? theme.colors.onPrimary : theme.colors.onSurfaceVariant },
              ]}
            >
              {label}
            </Chip>
          ))}
        </ScrollView>
      )}
      <Text variant="titleMedium" style={styles.resultTitle}>{query ? 'Hasil pencarian' : selectedFilter === 'Semua' ? 'Konser pilihan' : selectedFilter}</Text>
      {loading ? <ActivityIndicator style={{ marginTop: 36 }} /> : error ? (
        <Text style={{ color: theme.colors.error, marginTop: 18 }}>{error}</Text>
      ) : filteredConcerts.length ? (
        <View style={styles.grid}>
          {filteredConcerts.map((concert) => (
            <View key={concert.id} style={styles.gridItem}>
              <ConcertCard
                concert={concert}
                imageHeight={250}
                onPress={() => router.push({ pathname: '/concert/[id]', params: { id: String(concert.id) } })}
              />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.noResults}>
          <IconButton icon="music-note-off-outline" size={38} iconColor={theme.colors.onSurfaceVariant} />
          <Text variant="titleMedium" style={{ fontWeight: '700' }}>Konser belum ditemukan</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>Coba kata kunci atau filter yang lain.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 36, gap: 14 },
  title: { fontWeight: '800' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: { flex: 1, borderRadius: 16 },
  filterToggle: { borderRadius: 16, margin: 0 },
  quickSearch: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  filterChip: { borderRadius: 24 },
  filterText: { fontWeight: '700' },
  resultTitle: { fontWeight: '700', marginTop: 8, marginBottom: 2 },
  grid: { gap: 14 },
  gridItem: { width: '100%' },
  noResults: { alignItems: 'center', paddingVertical: 48, gap: 6 },
});
