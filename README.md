# Concert Ticket Booking Platform — Backend

REST API untuk platform pemesanan tiket konser. Backend ini dibuat menggunakan Node.js, Express, Sequelize, dan MySQL, dengan autentikasi JWT serta integrasi pembayaran Midtrans.

## Fitur

- Registrasi, login, dan manajemen sesi pengguna berbasis JWT.
- Pengelolaan konser, venue, galeri, kategori, dan promosi.
- Pemesanan tiket, pemilihan kursi, serta pengelolaan tiket digital dan QR.
- Integrasi pembayaran Midtrans, termasuk callback status pembayaran.
- Endpoint dan akses terpisah untuk customer, organizer, admin, dan super admin.
- Worker untuk menangani pesanan yang kedaluwarsa.
- File upload yang disajikan melalui direktori `/uploads`.

## Teknologi

- Node.js dan Express
- MySQL dan Sequelize
- JWT dan bcrypt
- Midtrans Snap
- Multer untuk upload file

## Persyaratan

- Node.js dan npm
- MySQL

## Menjalankan secara lokal

1. Masuk ke direktori backend:

   ```bash
   cd be
   ```

2. Install dependensi:

   ```bash
   npm install
   ```

3. Buat database MySQL kosong dengan konfigurasi berikut. Backend akan membuat tabel dari model Sequelize saat startup:

   ```sql
   CREATE DATABASE showtime_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

   Jika membuat tabel manual dari skema sebelumnya, hapus kolom/foreign key `Concerts.artistId`, hapus tabel Artists, dan tambahkan `TicketCategories.organizerId` beserta foreign key ke `Users(id)`.

4. Buat file `.env` di direktori `be` dan isi konfigurasi yang diperlukan (Udah dikirim di wa)

5. Jalankan server:

   ```bash
   npm run dev
   ```

   Untuk menjalankan tanpa Nodemon:

   ```bash
   npm start
   ```

Server berjalan di `http://localhost:5000` secara default. Saat mulai, server menghubungkan database, menyinkronkan model Sequelize dengan skema yang ada, membuat akun super admin awal bila belum tersedia, lalu memulai worker kedaluwarsa pesanan.

## Endpoint utama

Semua endpoint API menggunakan prefix `/api`.

| Prefix | Kegunaan |
| --- | --- |
| `/api/auth` | Registrasi, login, refresh token, dan autentikasi |
| `/api/customer` | Fitur customer |
| `/api/organizer` | Fitur organizer |
| `/api/admin` | Fitur admin |
| `/api/super-admin` | Fitur super admin |
| `/api/concerts` | Data dan pengelolaan konser |
| `/api/venues` | Data dan pengelolaan venue |
| `/api/orders` | Pemesanan |
| `/api/payments` | Pembayaran dan callback Midtrans |
| `/api/promos` | Promosi |
| `/api/users` | Pengelolaan pengguna |
| `/api/tickets` | Tiket |
| `/api/gallery` | Galeri |
| `/api/seats` | Kursi dan layout kursi |

Endpoint pemeriksaan server:

```http
GET /api/health
```

File yang diunggah tersedia melalui prefix `/uploads`, contohnya `http://localhost:5000/uploads/...`.

## Catatan konfigurasi

- `FRONTEND_URL` menentukan origin frontend yang diizinkan oleh CORS. Beberapa origin dapat dipisahkan dengan koma.
- Jangan gunakan secret contoh atau kredensial pengembangan pada lingkungan produksi.
- Akun super admin awal menggunakan hash password yang dicantumkan pada SQL seed. Pastikan Anda mengetahui password plaintext yang sesuai sebelum login.
- Callback Midtrans tersedia di `POST /api/payments/callback`. Atur URL callback di dashboard Midtrans agar mengarah ke server backend.
