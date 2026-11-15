import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const defaultHost = Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api';
export const API_URL = process.env.EXPO_PUBLIC_API_URL || defaultHost;
const TOKEN_KEY = 'tiket-dummy-auth-token';
const REQUEST_TIMEOUT_MS = 12_000;

export async function getToken() {
  if (Platform.OS === 'web') {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

type ApiOptions = Omit<RequestInit, 'body'> & { body?: unknown; authenticated?: boolean };

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, authenticated = true, headers, ...requestOptions } = options;
  const token = authenticated ? await getToken() : null;
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    response = await fetch(`${API_URL}${path}`, {
    ...requestOptions,
    signal: controller.signal,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        `Waktu koneksi ke ${API_URL} habis. Periksa alamat IP API, koneksi Wi-Fi yang sama, dan pastikan backend serta akses firewall Windows aktif.`
      );
    }
    if (error instanceof TypeError) {
      throw new Error(`Tidak dapat terhubung ke backend di ${API_URL}. Pastikan backend aktif dan alamat API dapat dijangkau dari perangkat.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `Request failed (${response.status})`);
  }
  return payload as T;
}

export function getMediaUrl(path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const origin = API_URL.replace(/\/api\/?$/, '');
  return `${origin}/${path.replace(/^\/+/, '')}`;
}

export function getConcertPoster(galleries?: { image?: string | null; type?: string | null }[] | null) {
  if (!Array.isArray(galleries)) return null;
  const poster = galleries.find((gallery) =>
    ['poster', 'banner'].includes((gallery.type || '').toLowerCase()) && gallery.image
  ) || galleries.find((gallery) => gallery.image);
  return getMediaUrl(poster?.image);
}

export function formatCurrency(value?: number | string | null) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

export function formatDate(value?: string | null) {
  if (!value) return 'Jadwal belum tersedia';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Jadwal belum tersedia';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

export type Concert = {
  id: number;
  slug?: string;
  name: string;
  description?: string | null;
  date?: string;
  time?: string;
  thumbnail?: string | null;
  banner?: string | null;
  concertGalleries?: { id: number; image: string; type?: string | null }[];
  genre?: string | null;
  minPrice?: string | number;
  maxPrice?: string | number;
  availableTickets?: number;
  venueName?: string | null;
  venueType?: string | null;
  city?: string | null;
  venue?: {
    name?: string;
    city?: string;
    address?: string;
    type?: string;
  } | null;
  organizer?: { name?: string } | null;
};

export type User = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  bio?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  avatar?: string | null;
  role: string;
  status?: string;
};

export type TicketCategory = {
  id: number;
  category: string;
  description?: string | null;
  price: string | number;
  quota: number;
  sold: number;
};

export type Ticket = {
  id: number;
  ticketNumber: string;
  category: string;
  price: string | number;
  status: string;
  qrCode?: string | null;
  concert?: Concert;
  seat?: { number?: string; row?: string; sectionName?: string } | null;
  order?: { orderNumber?: string };
};

export type Order = {
  id: number;
  orderNumber: string;
  status: string;
  totalAmount: string | number;
  createdAt: string;
  concert?: Concert;
  orderTickets?: Ticket[];
  orderPayment?: { id?: number; status?: string; method?: string } | null;
};

export function getOrderStatusLabel(order: Pick<Order, 'status' | 'orderPayment'>) {
  if (order.status === 'paid' || order.orderPayment?.status === 'completed') return 'Lunas';
  if (order.status === 'expired') return 'Kedaluwarsa';
  if (order.status === 'cancelled') return 'Dibatalkan';
  if (order.status === 'refunded' || order.orderPayment?.status === 'refunded') return 'Dikembalikan';
  if (order.orderPayment?.status === 'failed') return 'Pembayaran gagal';
  if (order.orderPayment?.status === 'processing') return 'Memproses pembayaran';
  if (order.status === 'pending') return 'Menunggu pembayaran';
  return order.status;
}
