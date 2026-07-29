# Borobudur Aggregated Heatmap Dashboard

Dashboard web yang memvisualisasikan kepadatan pengunjung Candi Borobudur.

Titik GPS mentah dari aplikasi mobile tersimpan di Hyperbase (ScyllaDB BaaS).
Backend membacanya, membersihkannya, menyaring titik di luar kawasan candi,
mengagregasinya ke dalam grid tetap, lalu menyajikannya sebagai GeoJSON.
Frontend melakukan *polling* atas GeoJSON tersebut dan menggambarnya sebagai
heatmap Leaflet.

Yang keluar dari backend hanyalah sel grid berisi cacah titik — **tidak pernah**
titik per pengunjung, dan tidak pernah `visitor_id`. Privasi terjaga oleh bentuk
tipenya, bukan oleh kebijakan.

---

## Mulai dari mana

<div class="grid cards" markdown>

- :material-file-document-outline: **[Blueprint Proyek](BLUEPRINT.md)**

    Naskah utuh: latar belakang, tujuan, ruang lingkup, rancangan,
    implementasi, pengujian, dan status. **Mulai di sini.**

- :material-api: **[Kontrak API](API.md)**

    Dokumen yang mengikat untuk seluruh endpoint — parameter, bentuk respons,
    kode galat.

- :material-sitemap-outline: **[Arsitektur](ARCHITECTURE.md)**

    Lapisan backend, pola *repository*, dan alur data — ringkas.

- :material-server-network: **[Deployment](DEPLOYMENT.md)**

    Topologi Docker Compose, templat lingkungan, dan langkah verifikasi.

</div>

---

## Tumpukan teknologi

| Lapisan | Teknologi |
|---|---|
| Frontend | React 18, Vite 6, TypeScript, Tailwind CSS v4, Leaflet + `leaflet.heat`, Recharts |
| Backend | Node.js, Express 4, TypeScript, Swagger (OpenAPI 3.0.3) |
| Data lokasi | Hyperbase — BaaS di atas ScyllaDB |
| Autentikasi | PostgreSQL, bcrypt, JWT dalam cookie `httpOnly` |
| Machine Learning | DBSCAN — berjalan langsung di backend (TypeScript); eksplorasi parameter dengan Python + scikit-learn |
| Deployment | Docker Compose, nginx, Cloudflare Tunnel |

---

## Peta dokumen

**Spesifikasi**

- [PRD.md](PRD.md) — dokumen kebutuhan produk
- [ARCHITECTURE.md](ARCHITECTURE.md) — ringkasan arsitektur
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — rencana pengerjaan bertahap

**Referensi teknis**

- [API.md](API.md) — kontrak endpoint (mengikat)
- [DATA_FLOWS.md](DATA_FLOWS.md) — diagram sekuens generator tiruan dan autentikasi
- [HYPERBASE_SCHEMA.md](HYPERBASE_SCHEMA.md) — model data Hyperbase (mengikat)
- [HYPERBASE_INTEGRATION.md](HYPERBASE_INTEGRATION.md) — rincian integrasi
- [HYPERBASE_AUTH_INTEGRATION.md](HYPERBASE_AUTH_INTEGRATION.md) — arsip, sudah digantikan

**Operasional**

- [DEPLOYMENT.md](DEPLOYMENT.md) — topologi dan prosedur
- [FURTHER_DEVELOPMENT.md](FURTHER_DEVELOPMENT.md) — pekerjaan lanjutan

!!! note "Bahasa"
    Blueprint dan halaman beranda ini ditulis dalam bahasa Indonesia. Dokumen
    teknis rujukan ditulis dalam bahasa Inggris, dan istilah teknis, nama kode,
    serta nama endpoint sengaja tidak diterjemahkan agar cocok persis dengan
    yang ada di dalam kode.
