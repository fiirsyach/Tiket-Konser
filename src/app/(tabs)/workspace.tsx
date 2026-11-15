import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Dialog, Divider, IconButton, Portal, Text, TextInput, useTheme } from 'react-native-paper';

import { useAuth } from '@/context/auth';
import { apiRequest, formatCurrency, formatDate, getConcertPoster, getMediaUrl, type Concert } from '@/lib/api';

type ModuleDefinition = {
  key: string;
  title: string;
  endpoint: string;
  description: string;
};

type Row = Record<string, unknown>;
type WishlistEntry = { key: string; row: Row; concert: Concert };
type WorkspaceAction = {
  label: string;
  method: 'PUT' | 'POST' | 'DELETE';
  endpoint: string;
  body?: unknown;
  destructive?: boolean;
};
type EditorField = { key: string; label: string; multiline?: boolean; numeric?: boolean };
type EditorConfig = {
  key: string;
  title: string;
  endpoint: string;
  method: 'POST' | 'PUT';
  fields: EditorField[];
  row?: Row;
};

const editorFields: Record<string, EditorField[]> = {
  concerts: [
    { key: 'name', label: 'Nama konser' },
    { key: 'description', label: 'Deskripsi', multiline: true },
    { key: 'date', label: 'Tanggal (YYYY-MM-DD)' },
    { key: 'time', label: 'Waktu (HH:mm)' },
    { key: 'venueType', label: 'Tipe venue (indoor/outdoor)' },
    { key: 'venueName', label: 'Nama venue' },
    { key: 'city', label: 'Kota' },
    { key: 'address', label: 'Alamat', multiline: true },
    { key: 'capacity', label: 'Kuota tiket', numeric: true },
    { key: 'minPrice', label: 'Harga tiket reguler', numeric: true },
    { key: 'genre', label: 'Genre' },
  ],
  tickets: [
    { key: 'concertId', label: 'ID konser', numeric: true },
    { key: 'category', label: 'Nama kategori' },
    { key: 'price', label: 'Harga', numeric: true },
    { key: 'quota', label: 'Kuota', numeric: true },
  ],
  seats: [
    { key: 'concertId', label: 'ID konser', numeric: true },
    { key: 'row', label: 'Baris kursi' },
    { key: 'number', label: 'Nomor kursi', numeric: true },
    { key: 'category', label: 'Kategori' },
    { key: 'price', label: 'Harga', numeric: true },
    { key: 'sectionName', label: 'Nama area' },
  ],
  venues: [
    { key: 'name', label: 'Nama venue' },
    { key: 'city', label: 'Kota' },
    { key: 'address', label: 'Alamat', multiline: true },
    { key: 'capacity', label: 'Kapasitas', numeric: true },
    { key: 'type', label: 'Tipe venue' },
    { key: 'description', label: 'Deskripsi', multiline: true },
  ],
  promos: [
    { key: 'code', label: 'Kode promo' },
    { key: 'name', label: 'Nama promo' },
    { key: 'type', label: 'Tipe (voucher/discount/flash_sale)' },
    { key: 'discountType', label: 'Jenis diskon (percentage/fixed)' },
    { key: 'value', label: 'Nilai diskon', numeric: true },
    { key: 'startDate', label: 'Mulai (ISO date)' },
    { key: 'endDate', label: 'Berakhir (ISO date)' },
  ],
  withdrawals: [{ key: 'amount', label: 'Jumlah pencairan', numeric: true }],
  'payment-refund': [
    { key: 'reason', label: 'Alasan refund', multiline: true },
    { key: 'amount', label: 'Jumlah (kosongkan untuk refund penuh)', numeric: true },
  ],
  reviews: [
    { key: 'concertId', label: 'ID konser', numeric: true },
    { key: 'rating', label: 'Rating (1-5)', numeric: true },
    { key: 'title', label: 'Judul ulasan' },
    { key: 'comment', label: 'Ulasan', multiline: true },
  ],
  system: [{ key: 'settings', label: 'Pengaturan dalam format JSON', multiline: true }],
};

const modulesByRole: Record<string, ModuleDefinition[]> = {
  customer: [
    { key: 'overview', title: 'Ringkasan akun', endpoint: '/customer/dashboard', description: 'Aktivitas dan statistik tiketmu.' },
    { key: 'wishlist', title: 'Wishlist', endpoint: '/customer/wishlist', description: 'Konser yang kamu simpan.' },
    { key: 'reviews', title: 'Ulasan', endpoint: '/customer/reviews', description: 'Ulasan konser yang pernah kamu kirim.' },
    { key: 'promos', title: 'Promo', endpoint: '/concerts/flash-sale', description: 'Penawaran dan konser promo.' },
  ],
  organizer: [
    { key: 'overview', title: 'Ringkasan organizer', endpoint: '/organizer/dashboard', description: 'Performa acara dan penjualan.' },
    { key: 'concerts', title: 'Konser', endpoint: '/organizer/concerts', description: 'Kelola dan ajukan acara.' },
    { key: 'tickets', title: 'Kategori tiket', endpoint: '/organizer/tickets', description: 'Kategori dan kuota tiket.' },
    { key: 'seats', title: 'Kursi', endpoint: '/organizer/seats', description: 'Kelola kursi dan denah.' },
    { key: 'venues', title: 'Venue', endpoint: '/organizer/venues', description: 'Kelola lokasi acara.' },
    { key: 'gallery', title: 'Galeri', endpoint: '/organizer/gallery', description: 'Media acara yang diunggah.' },
    { key: 'promos', title: 'Promo', endpoint: '/organizer/promos', description: 'Kode dan periode promosi.' },
    { key: 'orders', title: 'Pesanan', endpoint: '/organizer/orders', description: 'Pesanan pada acaramu.' },
    { key: 'revenue', title: 'Pendapatan', endpoint: '/organizer/revenue', description: 'Ringkasan penerimaan.' },
    { key: 'analytics', title: 'Analitik', endpoint: '/organizer/analytics', description: 'Statistik acara dan penjualan.' },
    { key: 'withdrawals', title: 'Pencairan dana', endpoint: '/organizer/withdrawals', description: 'Riwayat pencairan dana.' },
    { key: 'profile', title: 'Profil organizer', endpoint: '/organizer/profile', description: 'Data organisasi dan rekening.' },
  ],
  admin: [
    { key: 'overview', title: 'Ringkasan admin', endpoint: '/admin/dashboard', description: 'Aktivitas platform.' },
    { key: 'pending-concerts', title: 'Persetujuan konser', endpoint: '/admin/concerts/pending', description: 'Tinjau acara yang menunggu persetujuan.' },
    { key: 'organizers', title: 'Organizer', endpoint: '/admin/organizers', description: 'Verifikasi akun organizer.' },
    { key: 'orders', title: 'Pesanan', endpoint: '/admin/orders', description: 'Pantau pesanan customer.' },
    { key: 'payments', title: 'Pembayaran', endpoint: '/admin/payments', description: 'Pantau transaksi pembayaran.' },
    { key: 'refunds', title: 'Refund', endpoint: '/admin/refunds', description: 'Tinjau pengajuan pengembalian dana.' },
  ],
  super_admin: [
    { key: 'overview', title: 'Ringkasan super admin', endpoint: '/super-admin/dashboard', description: 'Status dan aktivitas seluruh platform.' },
    { key: 'users', title: 'Pengguna', endpoint: '/super-admin/users', description: 'Kelola akun dan status pengguna.' },
    { key: 'organizers', title: 'Organizer', endpoint: '/super-admin/organizers', description: 'Verifikasi akun organizer.' },
    { key: 'concerts', title: 'Konser', endpoint: '/super-admin/concerts', description: 'Tinjau dan moderasi acara.' },
    { key: 'payments', title: 'Pembayaran', endpoint: '/super-admin/payments', description: 'Konfirmasi transaksi atau ajukan refund.' },
    { key: 'reports', title: 'Laporan', endpoint: '/super-admin/reports', description: 'Laporan operasional platform.' },
    { key: 'analytics', title: 'Analitik', endpoint: '/super-admin/analytics', description: 'Statistik platform.' },
    { key: 'system', title: 'Pengaturan sistem', endpoint: '/super-admin/system', description: 'Konfigurasi platform.' },
  ],
};

function isRecord(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isConcert(value: unknown): value is Concert {
  return isRecord(value) && typeof value.id === 'number' && typeof value.name === 'string';
}

function extractWishlistEntries(value: unknown): WishlistEntry[] {
  if (!isRecord(value) || !Array.isArray(value.data)) return [];
  return value.data.flatMap((candidate) => {
    if (!isRecord(candidate) || !isConcert(candidate.concert)) return [];
    const id = candidate.id ?? candidate.concertId;
    if (typeof id !== 'string' && typeof id !== 'number') return [];
    return [{ key: String(id), row: candidate, concert: candidate.concert }];
  });
}

function extractRows(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  if (Array.isArray(value.data)) return value.data.filter(isRecord);
  if (isRecord(value.data)) return extractRows(value.data);
  for (const nested of Object.values(value)) {
    if (Array.isArray(nested)) return nested.filter(isRecord);
    if (isRecord(nested)) {
      const rows = extractRows(nested);
      if (rows.length) return rows;
    }
  }
  return [];
}

function scalarSummary(value: unknown, depth = 0): [string, string][] {
  if (!isRecord(value) || depth > 2) return [];
  const result: [string, string][] = [];
  for (const [key, item] of Object.entries(value)) {
    if (result.length >= 8) break;
    if (key === 'success' || key === 'message') continue;
    if (item === null || item === undefined || Array.isArray(item) || /(password|token|secret|key|qrcode)/i.test(key)) continue;
    if (isRecord(item)) result.push(...scalarSummary(item, depth + 1));
    else if (['string', 'number', 'boolean'].includes(typeof item)) {
      result.push([key.replace(/([A-Z])/g, ' $1'), String(item)]);
    }
    if (result.length >= 8) return result.slice(0, 8);
  }
  return result;
}

function rowId(row: Row) {
  const id = row.id ?? row.userId ?? row.concertId ?? row.orderId ?? row.paymentId;
  return id === null || id === undefined ? null : String(id);
}

function rowTitle(row: Row) {
  for (const key of ['name', 'title', 'companyName', 'orderNumber', 'ticketNumber', 'code', 'email']) {
    if (typeof row[key] === 'string' && row[key]) return row[key] as string;
  }
  return `Data #${rowId(row) || '-'}`;
}

function rowDetails(row: Row) {
  return Object.entries(row)
    .filter(([key, value]) => key !== 'id' && value !== null && value !== undefined && !isRecord(value) && !Array.isArray(value))
    .filter(([key]) => !/(password|token|secret|key|qrcode)/i.test(key))
    .slice(0, 5)
    .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1')}: ${String(value)}`);
}

function getActions(role: string, moduleKey: string, row: Row): WorkspaceAction[] {
  const id = rowId(row);
  if (!id) return [];
  const status = String(row.status || row.verificationStatus || '').toLowerCase();
  if (role === 'customer' && moduleKey === 'wishlist') {
    const concert = isRecord(row.concert) ? row.concert : null;
    const concertId = row.concertId ?? concert?.id ?? id;
    return [{ label: 'Hapus dari wishlist', method: 'DELETE', endpoint: `/customer/favorites/${concertId}`, destructive: true }];
  }
  if (role === 'customer' && moduleKey === 'reviews') {
    return [{ label: 'Hapus ulasan', method: 'DELETE', endpoint: `/customer/reviews/${id}`, destructive: true }];
  }
  if (role === 'organizer' && moduleKey === 'concerts') {
    const actions: WorkspaceAction[] = [];
    if (['draft', 'rejected'].includes(status)) actions.push({ label: 'Ajukan', method: 'POST', endpoint: `/organizer/concerts/${id}/submit` });
    if (status === 'approved') actions.push({ label: 'Publikasikan', method: 'POST', endpoint: `/organizer/concerts/${id}/publish` });
    if (['published', 'on_sale'].includes(status)) actions.push({ label: 'Batalkan publikasi', method: 'POST', endpoint: `/organizer/concerts/${id}/unpublish` });
    if (['draft', 'pending'].includes(status)) actions.push({ label: 'Hapus', method: 'DELETE', endpoint: `/organizer/concerts/${id}`, destructive: true });
    return actions;
  }
  if (role === 'organizer' && moduleKey === 'withdrawals' && !['cancelled', 'rejected', 'paid'].includes(status)) {
    return [{ label: 'Batalkan pencairan', method: 'PUT', endpoint: `/organizer/withdrawals/${id}/cancel`, destructive: true }];
  }
  if (role === 'organizer' && moduleKey === 'tickets') {
    return [{ label: 'Hapus kategori', method: 'DELETE', endpoint: `/organizer/tickets/${id}`, destructive: true }];
  }
  if (role === 'organizer' && moduleKey === 'seats') {
    return [{ label: 'Hapus kursi', method: 'DELETE', endpoint: `/organizer/seats/${id}`, destructive: true }];
  }
  if (role === 'organizer' && moduleKey === 'venues') {
    return [{ label: 'Hapus venue', method: 'DELETE', endpoint: `/organizer/venues/${id}`, destructive: true }];
  }
  if (role === 'organizer' && moduleKey === 'promos') {
    return [{ label: 'Hapus promo', method: 'DELETE', endpoint: `/organizer/promos/${id}`, destructive: true }];
  }
  if (role === 'admin' && moduleKey === 'pending-concerts') {
    return [
      { label: 'Setujui', method: 'PUT', endpoint: `/admin/concerts/${id}/approve` },
      { label: 'Tolak', method: 'PUT', endpoint: `/admin/concerts/${id}/reject`, destructive: true },
    ];
  }
  if (role === 'admin' && moduleKey === 'organizers') {
    return [
      { label: 'Verifikasi', method: 'PUT', endpoint: `/admin/organizers/${id}/verify` },
      { label: 'Tolak', method: 'PUT', endpoint: `/admin/organizers/${id}/reject`, destructive: true },
    ];
  }
  if (role === 'admin' && moduleKey === 'refunds') {
    return [
      { label: 'Setujui refund', method: 'PUT', endpoint: `/admin/refunds/${id}`, body: { action: 'approve' } },
      { label: 'Tolak refund', method: 'PUT', endpoint: `/admin/refunds/${id}`, body: { action: 'reject' }, destructive: true },
    ];
  }
  if (role === 'super_admin' && moduleKey === 'users') {
    if (row.role === 'super_admin') return [];
    return status === 'blocked'
      ? [
          { label: 'Buka blokir', method: 'PUT', endpoint: `/super-admin/users/${id}/unblock` },
          { label: 'Hapus pengguna', method: 'DELETE', endpoint: `/super-admin/users/${id}`, destructive: true },
        ]
      : [
          { label: 'Blokir pengguna', method: 'PUT', endpoint: `/super-admin/users/${id}/block`, destructive: true },
          { label: 'Hapus pengguna', method: 'DELETE', endpoint: `/super-admin/users/${id}`, destructive: true },
        ];
  }
  if (role === 'super_admin' && moduleKey === 'organizers') {
    return [
      { label: 'Verifikasi', method: 'PUT', endpoint: `/super-admin/organizers/${id}/verify` },
      { label: 'Tolak', method: 'PUT', endpoint: `/super-admin/organizers/${id}/reject`, destructive: true },
    ];
  }
  if (role === 'super_admin' && moduleKey === 'concerts') {
    return [
      { label: 'Setujui', method: 'PUT', endpoint: `/super-admin/concerts/${id}/approve` },
      { label: 'Tolak', method: 'PUT', endpoint: `/super-admin/concerts/${id}/reject`, destructive: true },
      { label: 'Hapus', method: 'DELETE', endpoint: `/super-admin/concerts/${id}`, destructive: true },
    ];
  }
  if (role === 'super_admin' && moduleKey === 'payments') {
    return [{ label: 'Konfirmasi pembayaran', method: 'PUT', endpoint: `/super-admin/payments/${id}/confirm` }];
  }
  return [];
}

export default function WorkspaceScreen() {
  const theme = useTheme();
  const { user, loading: authLoading } = useAuth();
  const modules = useMemo(() => user ? modulesByRole[user.role] || [] : [], [user]);
  const [activeKey, setActiveKey] = useState('overview');
  const [payload, setPayload] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionKey, setActionKey] = useState('');
  const [editor, setEditor] = useState<EditorConfig | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [savingEditor, setSavingEditor] = useState(false);
  const [notice, setNotice] = useState('');
  const activeModule = modules.find((item) => item.key === activeKey) || modules[0];
  const rows = extractRows(payload);
  const summary = scalarSummary(payload);
  const wishlistEntries = activeKey === 'wishlist' ? extractWishlistEntries(payload) : [];

  const load = useCallback(async () => {
    if (!activeModule) return;
    setLoading(true);
    setError('');
    try {
      setPayload(await apiRequest<unknown>(activeModule.endpoint));
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : 'Data tidak dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }, [activeModule]);

  useEffect(() => {
    if (!user || !activeModule) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return load();
    });
    return () => { active = false; };
  }, [activeModule, load, user]);

  const openEditor = (key: string, row?: Row) => {
    const id = rowId(row || {});
    let endpoint = '';
    let method: EditorConfig['method'] = 'POST';
    if (key === 'concerts') {
      endpoint = id ? `/organizer/concerts/${id}` : '/organizer/concerts';
      method = id ? 'PUT' : 'POST';
    } else if (key === 'reviews' && user?.role === 'customer') {
      endpoint = id ? `/customer/reviews/${id}` : '/customer/reviews';
      method = id ? 'PUT' : 'POST';
    } else if (['tickets', 'seats', 'venues', 'promos'].includes(key)) {
      endpoint = `/organizer/${key}${id ? `/${id}` : ''}`;
      method = id ? 'PUT' : 'POST';
    } else if (key === 'withdrawals') {
      endpoint = '/organizer/withdraw';
    } else if (key === 'payment-refund' && id) {
      endpoint = `/super-admin/payments/${id}/refund`;
    } else if (key === 'system') {
      endpoint = '/super-admin/system';
      method = 'PUT';
    } else {
      return;
    }

    const fields = editorFields[key] || [];
    const values: Record<string, string> = {};
    for (const field of fields) {
      if (key === 'system' && field.key === 'settings') {
        const currentSettings = payload && isRecord(payload) && 'data' in payload ? payload.data : payload;
        values[field.key] = JSON.stringify(currentSettings || {}, null, 2);
      } else if (key === 'payment-refund' && field.key === 'amount') {
        values[field.key] = '';
      } else {
        const value = row?.[field.key];
        values[field.key] = value === null || value === undefined ? '' : String(value);
      }
    }
    setFormValues(values);
    setEditor({ key, title: `${id ? 'Ubah' : 'Tambah'} ${key === 'payment-refund' ? 'refund' : key}`, endpoint, method, fields, row });
    setError('');
    setNotice('');
  };

  const saveEditor = async () => {
    if (!editor) return;
    try {
      setSavingEditor(true);
      const body: Record<string, unknown> = {};
      for (const field of editor.fields) {
        const value = formValues[field.key]?.trim() || '';
        if (value) body[field.key] = value;
      }
      if (editor.key === 'venues') body.capacity = Number(formValues.capacity || 0);
      if (editor.key === 'tickets') {
        body.price = Number(formValues.price);
        body.quota = Number(formValues.quota);
        if (!editor.row) body.concertId = Number(formValues.concertId);
      }
      if (editor.key === 'seats') {
        body.concertId = Number(formValues.concertId);
        body.number = Number(formValues.number);
        body.price = Number(formValues.price || 0);
      }
      if (editor.key === 'promos') body.value = Number(formValues.value);
      if (editor.key === 'reviews') {
        body.rating = Number(formValues.rating);
        if (!editor.row) body.concertId = Number(formValues.concertId);
      }
      if (editor.key === 'withdrawals') body.amount = Number(formValues.amount);
      if (editor.key === 'concerts') {
        const quota = Number(formValues.capacity);
        const price = Number(formValues.minPrice || 0);
        body.capacity = quota;
        body.totalTickets = quota;
        body.minPrice = price;
        body.maxPrice = price;
        if (!editor.row) {
          body.sections = [{ name: 'Regular', category: 'regular', price, type: 'standing', capacity: quota }];
          body.status = 'draft';
        }
      }
      if (editor.key === 'payment-refund' && formValues.amount?.trim()) body.amount = Number(formValues.amount);
      if (editor.key === 'system') {
        const settings: unknown = JSON.parse(formValues.settings || '{}');
        if (!isRecord(settings)) throw new Error('Pengaturan harus berupa objek JSON.');
        delete body.settings;
        Object.assign(body, settings);
      }
      await apiRequest(editor.endpoint, { method: editor.method, body });
      setEditor(null);
      setNotice('Perubahan berhasil disimpan.');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Perubahan tidak dapat disimpan.');
    } finally {
      setSavingEditor(false);
    }
  };

  const runAction = (action: WorkspaceAction) => {
    const perform = async () => {
      try {
        setActionKey(action.endpoint);
        await apiRequest(action.endpoint, { method: action.method, body: action.body });
        await load();
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : 'Aksi tidak dapat diproses.');
      } finally {
        setActionKey('');
      }
    };
    if (action.destructive) {
      Alert.alert('Konfirmasi tindakan', `Lanjutkan: ${action.label.toLowerCase()}?`, [
        { text: 'Batal', style: 'cancel' },
        { text: action.label, style: 'destructive', onPress: () => { void perform(); } },
      ]);
    } else {
      void perform();
    }
  };

  if (authLoading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!user) {
    return (
      <View style={styles.center}>
        <Text variant="headlineSmall" style={styles.heading}>Panel akun</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>Masuk untuk membuka fitur customer, organizer, atau admin.</Text>
        <Button mode="contained" onPress={() => router.push('/login')}>Masuk atau daftar</Button>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>{user.role.replace('_', ' ').toUpperCase()}</Text>
          <Text variant="headlineSmall" style={styles.heading}>{activeKey === 'overview' ? 'Panel' : activeModule?.title}</Text>
        </View>
        {activeKey !== 'overview' && <Button compact onPress={() => setActiveKey('overview')}>Menu</Button>}
      </View>

      {activeKey === 'overview' ? (
        <View style={styles.modules}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Halo, {user.name}. Pilih fitur yang ingin dibuka.</Text>
          {modules.map((item) => (
            <Card key={item.key} mode="outlined" style={styles.moduleCard} onPress={() => setActiveKey(item.key)}>
              <Card.Content style={styles.moduleContent}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="titleMedium" style={{ fontWeight: '700' }}>{item.title}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{item.description}</Text>
                </View>
                <Text variant="titleLarge" style={{ color: theme.colors.primary }}>›</Text>
              </Card.Content>
            </Card>
          ))}
          {loading ? <ActivityIndicator style={{ marginTop: 16 }} /> : error ? (
            <Text variant="bodySmall" style={{ color: theme.colors.error }}>{error}</Text>
          ) : summary.length > 0 ? (
            <Card mode="contained" style={styles.dataCard}><Card.Content style={{ gap: 10 }}>
              {summary.map(([label, value]) => <View key={label} style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>)}
            </Card.Content></Card>
          ) : null}
        </View>
      ) : (
        <>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{activeModule?.description}</Text>
          {!!notice && <Text variant="bodySmall" style={{ color: theme.colors.primary }}>{notice}</Text>}
          {user.role === 'organizer' && ['concerts', 'tickets', 'seats', 'venues', 'promos', 'withdrawals'].includes(activeKey) && (
            <Button mode="contained" icon="plus" onPress={() => openEditor(activeKey)}>
              {activeKey === 'withdrawals' ? 'Ajukan pencairan' : `Tambah ${activeModule?.title.toLowerCase()}`}
            </Button>
          )}
          {user.role === 'customer' && activeKey === 'reviews' && (
            <Button mode="contained" icon="plus" onPress={() => openEditor('reviews')}>Tulis ulasan</Button>
          )}
          {user.role === 'super_admin' && activeKey === 'system' && (
            <Button mode="contained" icon="pencil" onPress={() => openEditor('system')}>Ubah pengaturan</Button>
          )}
          <Button mode="text" icon="refresh" onPress={() => void load()} disabled={loading}>Muat ulang</Button>
          {loading ? <ActivityIndicator style={{ marginTop: 24 }} /> : error ? (
            <Card mode="outlined" style={styles.dataCard}><Card.Content style={{ gap: 10 }}>
              <Text style={{ color: theme.colors.error }}>{error}</Text>
              <Button mode="outlined" onPress={() => void load()}>Coba lagi</Button>
            </Card.Content></Card>
          ) : (
            activeKey === 'wishlist' ? (
              <View style={styles.wishlistList}>
                <Card mode="contained" style={[styles.wishlistSummary, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Card.Content style={styles.wishlistSummaryContent}>
                    <View style={styles.wishlistSummaryInfo}>
                      <View style={[styles.wishlistSummaryIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                        <MaterialCommunityIcons name="heart-multiple" size={23} color={theme.colors.onPrimaryContainer} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="titleMedium" style={{ fontWeight: '800' }}>Konser favoritmu</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Tersimpan rapi, siap kamu kunjungi lagi.</Text>
                      </View>
                    </View>
                    <View style={[styles.wishlistCount, { backgroundColor: theme.colors.surface }]}>
                      <Text variant="titleLarge" style={{ color: theme.colors.primary, fontWeight: '800' }}>{wishlistEntries.length}</Text>
                      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>KONSER</Text>
                    </View>
                  </Card.Content>
                </Card>

                {wishlistEntries.length > 0 ? wishlistEntries.map((entry) => {
                  const concert = entry.concert;
                  const poster = getMediaUrl(concert.banner || concert.thumbnail) || getConcertPoster(concert.concertGalleries);
                  const available = Number(concert.availableTickets);
                  const hasAvailability = Number.isFinite(available);
                  const isSoldOut = hasAvailability && available <= 0;
                  const removeAction = getActions(user.role, activeKey, entry.row)[0];

                  return (
                    <Card key={entry.key} mode="outlined" style={[styles.wishlistCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                      <View style={styles.wishlistPosterWrap}>
                        {poster ? (
                          <Image source={{ uri: poster }} style={styles.wishlistPoster} contentFit="cover" transition={160} />
                        ) : (
                          <View style={[styles.wishlistPoster, styles.wishlistPosterFallback, { backgroundColor: theme.colors.primaryContainer }]}>
                            <MaterialCommunityIcons name="music-note" size={42} color={theme.colors.onPrimaryContainer} />
                          </View>
                        )}
                        <View style={styles.wishlistPosterShade} />
                        <View style={styles.wishlistPosterTop}>
                          <Chip compact style={styles.wishlistGenre} textStyle={styles.wishlistGenreText}>{concert.genre || 'Konser'}</Chip>
                          {removeAction && (
                            <IconButton
                              icon="heart"
                              mode="contained"
                              containerColor="rgba(16, 16, 22, 0.78)"
                              iconColor={theme.colors.error}
                              accessibilityLabel="Hapus dari wishlist"
                              disabled={!!actionKey}
                              loading={actionKey === removeAction.endpoint}
                              onPress={() => runAction(removeAction)}
                            />
                          )}
                        </View>
                        {hasAvailability && (
                          <Chip
                            compact
                            style={[styles.wishlistStock, { backgroundColor: isSoldOut ? theme.colors.errorContainer : theme.colors.surface }]}
                            textStyle={{ color: isSoldOut ? theme.colors.onErrorContainer : theme.colors.onSurface, fontSize: 11, fontWeight: '700' }}
                          >
                            {isSoldOut ? 'Tiket habis' : `${available.toLocaleString('id-ID')} tiket tersedia`}
                          </Chip>
                        )}
                      </View>
                      <Card.Content style={styles.wishlistBody}>
                        <View style={{ gap: 3 }}>
                          <Text variant="titleLarge" numberOfLines={2} style={styles.wishlistTitle}>{concert.name}</Text>
                          <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
                            {concert.organizer?.name || concert.genre || 'Konser pilihanmu'}
                          </Text>
                        </View>

                        <View style={styles.wishlistDetails}>
                          <View style={styles.wishlistDetailRow}>
                            <MaterialCommunityIcons name="calendar-month-outline" size={18} color={theme.colors.primary} />
                            <Text variant="bodySmall" numberOfLines={1} style={[styles.wishlistDetailText, { color: theme.colors.onSurfaceVariant }]}>
                              {formatDate(concert.date)}{concert.time ? ` · ${concert.time.slice(0, 5)}` : ''}
                            </Text>
                          </View>
                          <View style={styles.wishlistDetailRow}>
                            <MaterialCommunityIcons name="map-marker-outline" size={18} color={theme.colors.secondary} />
                            <Text variant="bodySmall" numberOfLines={1} style={[styles.wishlistDetailText, { color: theme.colors.onSurfaceVariant }]}>
                              {concert.venue?.name || concert.venueName || 'Lokasi belum diatur'} · {concert.venue?.city || concert.city || 'Indonesia'}
                            </Text>
                          </View>
                        </View>

                        <View style={[styles.wishlistFooter, { borderTopColor: theme.colors.outlineVariant }]}>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>MULAI DARI</Text>
                            <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: '800' }}>{formatCurrency(concert.minPrice)}</Text>
                          </View>
                          <Button
                            mode="contained"
                            compact
                            icon="ticket-outline"
                            onPress={() => router.push({ pathname: '/concert/[id]', params: { id: String(concert.id) } })}
                          >
                            Lihat tiket
                          </Button>
                        </View>
                      </Card.Content>
                    </Card>
                  );
                }) : (
                  <Card mode="outlined" style={[styles.wishlistEmpty, { borderColor: theme.colors.outlineVariant }]}>
                    <Card.Content style={styles.wishlistEmptyContent}>
                      <View style={[styles.wishlistEmptyIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                        <MaterialCommunityIcons name="heart-outline" size={30} color={theme.colors.onPrimaryContainer} />
                      </View>
                      <Text variant="titleLarge" style={{ fontWeight: '800', textAlign: 'center' }}>Wishlist masih kosong</Text>
                      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                        Simpan konser yang kamu suka, lalu temukan semuanya di sini.
                      </Text>
                      <Button mode="contained" icon="magnify" onPress={() => router.push('/(tabs)/explore')}>Jelajahi konser</Button>
                    </Card.Content>
                  </Card>
                )}
              </View>
            ) : (
            <>
              {rows.map((row, index) => {
                const actions = getActions(user.role, activeKey, row);
                return (
                  <Card key={rowId(row) || `${activeKey}-${index}`} mode="outlined" style={styles.dataCard}>
                    <Card.Content style={{ gap: 8 }}>
                      <Text variant="titleMedium" style={{ fontWeight: '700' }}>{rowTitle(row)}</Text>
                      {rowDetails(row).map((detail) => <Text key={detail} variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{detail}</Text>)}
                      {user.role === 'organizer' && ['concerts', 'tickets', 'seats', 'venues', 'promos'].includes(activeKey) && (
                        <Button mode="outlined" icon="pencil" onPress={() => openEditor(activeKey, row)}>Ubah</Button>
                      )}
                      {user.role === 'customer' && activeKey === 'reviews' && (
                        <Button mode="outlined" icon="pencil" onPress={() => openEditor('reviews', row)}>Ubah ulasan</Button>
                      )}
                      {user.role === 'super_admin' && activeKey === 'payments' && String(row.status).toLowerCase() === 'completed' && (
                        <Button mode="outlined" icon="cash-refund" onPress={() => openEditor('payment-refund', row)}>Ajukan refund</Button>
                      )}
                      {actions.length > 0 && <Divider style={{ marginTop: 4 }} />}
                      {actions.map((action) => (
                        <Button
                          key={action.endpoint}
                          mode={action.destructive ? 'outlined' : 'contained-tonal'}
                          textColor={action.destructive ? theme.colors.error : undefined}
                          loading={actionKey === action.endpoint}
                          disabled={!!actionKey}
                          onPress={() => runAction(action)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </Card.Content>
                  </Card>
                );
              })}
              {!rows.length && summary.length > 0 && (
                <Card mode="contained" style={styles.dataCard}><Card.Content style={{ gap: 10 }}>
                  {summary.map(([label, value]) => <View key={label} style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>)}
                </Card.Content></Card>
              )}
              {!rows.length && !summary.length && (
                <Card mode="outlined" style={styles.dataCard}><Card.Content>
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>Belum ada data untuk ditampilkan.</Text>
                </Card.Content></Card>
              )}
            </>
            )
          )}
        </>
      )}
      <Portal>
        <Dialog visible={!!editor} onDismiss={() => { if (!savingEditor) setEditor(null); }} style={styles.dialog}>
          <Dialog.Title>{editor?.title}</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={styles.editorFields} keyboardShouldPersistTaps="handled">
              {editor?.fields.map((field) => (
                <TextInput
                  key={field.key}
                  label={field.label}
                  value={formValues[field.key] || ''}
                  onChangeText={(value) => setFormValues((current) => ({ ...current, [field.key]: value }))}
                  mode="outlined"
                  multiline={field.multiline}
                  keyboardType={field.numeric ? 'numeric' : 'default'}
                  style={styles.editorInput}
                />
              ))}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditor(null)} disabled={savingEditor}>Batal</Button>
            <Button onPress={() => void saveEditor()} loading={savingEditor} disabled={savingEditor}>Simpan</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 36, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heading: { fontWeight: '800' },
  modules: { gap: 10, marginTop: 4 },
  moduleCard: { borderRadius: 16 },
  moduleContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dataCard: { borderRadius: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  detailLabel: { flex: 1, color: '#77717c', textTransform: 'capitalize' },
  detailValue: { flex: 1, textAlign: 'right', fontWeight: '600' },
  dialog: { maxHeight: '90%' },
  editorFields: { maxHeight: 420 },
  editorInput: { marginBottom: 10 },
  wishlistList: { gap: 14 },
  wishlistSummary: { borderRadius: 18 },
  wishlistSummaryContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14 },
  wishlistSummaryInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  wishlistSummaryIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  wishlistCount: { minWidth: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  wishlistCard: { borderRadius: 18, overflow: 'hidden' },
  wishlistPosterWrap: { height: 178, position: 'relative', backgroundColor: '#22222b' },
  wishlistPoster: { width: '100%', height: '100%' },
  wishlistPosterFallback: { alignItems: 'center', justifyContent: 'center' },
  wishlistPosterShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.16)' },
  wishlistPosterTop: { position: 'absolute', top: 8, left: 10, right: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wishlistGenre: { backgroundColor: 'rgba(16, 16, 22, 0.78)' },
  wishlistGenreText: { color: '#fff', fontSize: 11 },
  wishlistStock: { position: 'absolute', bottom: 10, left: 10 },
  wishlistBody: { gap: 12, paddingTop: 14, paddingBottom: 14 },
  wishlistTitle: { fontWeight: '800' },
  wishlistDetails: { gap: 8 },
  wishlistDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wishlistDetailText: { flex: 1 },
  wishlistFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  wishlistEmpty: { borderRadius: 18, paddingVertical: 8 },
  wishlistEmptyContent: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  wishlistEmptyIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
});
