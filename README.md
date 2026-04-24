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

- lokal: otomatis memakai file `.data/metatah-rsvp.json` saat dijalankan di komputer sendiri tanpa env Redis
- production: otomatis memakai Upstash Redis bila `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` tersedia

Mode ini dibuat supaya development tetap mudah, tapi deploy online tetap aman dan persisten.

## Deploy Yang Direkomendasikan

Rekomendasi utama untuk proyek ini adalah:

1. push project ke GitHub
2. import repo ke Vercel
3. pasang integrasi Upstash Redis dari Vercel Marketplace
4. pastikan env `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` masuk ke project
5. lakukan deploy production

Setelah itu RSVP akan tersimpan online dan jumlah `hadir` atau `tidak hadir` akan terlihat untuk semua pengunjung.

## Checklist Deploy Vercel

1. Buka Vercel dan pilih `Add New Project`
2. Import repository GitHub untuk folder `my-app`
3. Di project Vercel, buka `Storage`
4. Tambahkan `Upstash Redis`
5. Konfirmasi bahwa env berikut tersedia:

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

6. Deploy ulang bila env baru saja ditambahkan

## Build Check

```bash
npm run lint
npm run build
```
