# ShowTime Mobile

Aplikasi Expo dengan React Native Paper untuk customer, organizer, admin, dan super admin. Data serta tindakan aplikasi memakai REST API backend Express/Sequelize yang sama dengan aplikasi web.

## Menjalankan aplikasi

1. Jalankan backend dari folder `be` dan pastikan database MySQL telah dikonfigurasi.
2. Dari folder `mobile`, instal dependency dan mulai Expo:

   ```sh
   npm install
   npm start
   ```

3. Buka aplikasi dengan Expo Go atau emulator.

Default API URL adalah `http://10.0.2.2:5000/api` untuk Android emulator dan `http://localhost:5000/api` untuk iOS Simulator. Untuk Expo Web di komputer, alamat default `localhost:5000` juga dapat digunakan. Untuk perangkat fisik, `localhost` menunjuk ke perangkat itu sendiri, jadi buat file `.env.local` di folder ini dengan alamat IP komputer yang dapat dijangkau perangkat:

```env
EXPO_PUBLIC_API_URL=http://192.168.137.1:5000/api
```

Ganti alamat IP contoh dengan IP komputer pada jaringan Wi-Fi yang sama. Pastikan port backend dapat diakses dari perangkat. Setelah mengubah alamat ini, restart Expo agar konfigurasi baru terbaca.

Backend mengizinkan origin Expo Web lokal saat `NODE_ENV` bukan `production`. Untuk domain web selain localhost, tambahkan origin frontend yang tepat ke `FRONTEND_URL`. Beberapa origin dapat dipisahkan dengan koma.

Token login disimpan menggunakan Expo SecureStore di iOS/Android. Di web, token menggunakan penyimpanan browser.

### Status pembayaran Midtrans

Web dan mobile menggunakan endpoint backend yang sama (`POST /api/payments/create`) dan sesi Snap yang sama. FE menampilkan Snap.js; aplikasi native membuka `paymentUrl` Snap melalui browser aman Expo karena Snap.js berjalan di browser. Backend meneruskan status pembayaran dari Payment Notification Midtrans ke pesanan. Untuk menerima notifikasi, atur Payment Notification URL di dashboard Midtrans ke URL publik HTTPS backend yang berakhiran `/api/payments/callback`. Alamat lokal atau IP jaringan seperti `192.168.x.x` tidak dapat menerima webhook dari Midtrans.

## Fitur

- Beranda dengan konser pilihan dan acara yang akan datang.
- Pencarian konser berdasarkan kata kunci.
- Detail konser dan pemilihan kategori tiket/kursi.
- Pemesanan serta checkout QRIS lewat API backend.
- Daftar pesanan, status pembayaran, e-tiket, dan QR tiket.
- Wishlist konser, profil, pembaruan kata sandi, dan permintaan reset kata sandi.
- Login untuk seluruh peran, pendaftaran customer/organizer, serta profil organizer.
- Panel sesuai peran untuk dashboard customer/organizer/admin/super admin, pengelolaan konser, kategori tiket, kursi, venue, promo, pencairan dana, refund, pengguna, dan tindakan moderasi yang diizinkan backend.
- Ulasan konser customer serta pengaturan sistem super admin melalui API backend.
- Fitur customer untuk menjelajah artis dan promo.
