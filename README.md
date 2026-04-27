# Mepandes Invitation

Website undangan mepandes interaktif berbasis Next.js dengan:

- halaman pembuka surat
- countdown realtime acara
- galeri nama dan foto yang mepandes
- RSVP online
- halaman ucapan terima kasih

## Jalankan Lokal

```bash
npm install
npm run dev
```

Website akan terbuka di `http://localhost:3000`.

## RSVP Storage

Proyek ini memakai 2 mode penyimpanan RSVP:

- online: memakai Supabase bila `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` tersedia
- lokal: otomatis memakai file `.data/metatah-rsvp.json` hanya untuk development saat env Supabase belum diisi

Mode ini dibuat supaya development tetap mudah, tapi deploy online tetap aman dan persisten.

## Deploy Yang Direkomendasikan

Rekomendasi utama untuk proyek ini adalah:

1. push project ke GitHub
2. import repo ke Vercel
3. buat project Supabase dan tabel `rsvp_entries`
4. pastikan env `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` masuk ke project
5. lakukan deploy production

Setelah itu RSVP akan tersimpan online dan jumlah `hadir` atau `tidak hadir` akan terlihat untuk semua pengunjung.

## Checklist Deploy Vercel

1. Buka Vercel dan pilih `Add New Project`
2. Import repository GitHub untuk folder `my-app`
3. Di project Vercel, buka `Settings > Environment Variables`
4. Konfirmasi bahwa env berikut tersedia:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

5. Deploy ulang bila env baru saja ditambahkan

Panduan SQL dan setup Supabase ada di [SUPABASE_RSVP_SETUP.md](/Users/gunggus/Desktop/METATAH3D/my-app/SUPABASE_RSVP_SETUP.md).

## Build Check

```bash
npm run lint
npm run build
```
