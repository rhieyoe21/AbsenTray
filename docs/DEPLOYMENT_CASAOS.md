# Deployment Docker — AbsenTray V2 di Ubuntu + CasaOS

Panduan menjalankan AbsenTray V2 sebagai **satu container** (API + frontend
statis + WebSocket) di Ubuntu yang memakai **CasaOS**. Cocok untuk Home Server
atau server lokal kantor.

```
Akses      →  http://<SERVER_IP>:5000   (dashboard + API satu port)
Device FP  →  <FP_IP>:4370
WAHA API   →  http://<SERVER_IP>:5555
```

---

## 1. Prasyarat

- Ubuntu 22.04 / 24.04 dengan **CasaOS** terpasang (Docker sudah termasuk)
- Docker Engine 24+ & Docker Compose v2
- Node *tidak wajib* di server — image dibangun penuh di dalam Docker
- Server dapat menjangkau device fingerprint (`:4370`) dan WAHA (`:5555`)

Cek di terminal CasaOS (Apps → Terminal, atau SSH):

```bash
docker --version
docker compose version
```

---

## 2. Mendapatkan kode di server

```bash
cd /DATA/AppData 2>/dev/null || cd /opt

git clone https://github.com/rhieyoe21/AbsenTray.git AbsenTrayV2
cd AbsenTrayV2
```

> Data & `.env` lokal **tidak** ada di repo (dijaga agar tak bocor). Nilai nyata
> diisi lewat berkas `.env` + volume di bawah.

---

## 3. Konfigurasi lingkungan

```bash
cp deploy/docker.env.example .env
nano .env
```

Isi nilai produksi:

```ini
# Device fingerprint
FINGERPRINT_IP=192.168.1.102      # IP mesin absen
FINGERPRINT_PORT=4370
FINGERPRINT_TIMEOUT=10000
POLLING_INTERVAL=30000

# WAHA WhatsApp API
WAHA_URL=http://192.168.1.180:5555
WAHA_API_KEY=KUNCI_DARI_DASHBOARD_WAHA
WAHA_SESSION=default

# Alerta admin (nomor internasional tanpa "0" di depan)
ADMIN_WHATSAPP=628XXXXXXXXXX

# CORS: '*' utk akses langsung; atau masukkan origin spesifik
CLIENT_URL=*
```

---

## 4. (Opsional) Impor data produksi

Letakkan data asli di folder proyek sebelum `up`. Data akan dibaca **saat
container pertama-start** oleh entrypoint (impor karyawan & migrasi riwayat).

```bash
cp /jalur/lokal/map_user.csv .        # daftar karyawan (uid,nama,wa)
cp /jalur/lokal/sent_log.txt .        # riwayat pesan terkirim (opsional)
```

Data yang tersimpan di volume (`./data/attendance.db`) akan tetap bertahan pada
deploy berikutnya; pastikan tidak tertimpa.

---

## 5. Bangun & mulai

```bash
docker compose up -d --build
```

Gantinya, dari **CasaOS Apps** → *Add → Custom App*: tempel isi
`docker-compose.yml` (root proyek), lalu Build & Run.

Verifikasi:

```bash
docker compose ps                    # status: Up (healthy)
docker logs -f absentray             # inisialisasi + log server
```

---

## 6. Cek kesehatan & integrasi

```bash
# Health endpoint
curl -s http://localhost:5000/health
# {"status":"ok","version":"1.0.0","serveClient":true}

# User terimpor?
curl -s http://localhost:5000/api/users | head -c 400
```

Di browser → `http://<SERVER_IP>:5000`:

1. **Ringkasan** → baris *Perangkat fingerprint* & *WhatsApp API* hijau
   (atau tekan **Perbarui/Hubungkan**).
2. **Pengaturan → Uji koneksi → Kirim pesan uji** → nomor admin.
3. **Jadwal** → aktifkan mode jadwal bila polling dibatasi jam kerja.

---

## 7. Update versi

```bash
cd /DATA/AppData/AbsenTrayV2
git pull
docker compose up -d --build
```

`–build` membangun ulang image; volume data tetap.

---

## 8. Backup

Cukup cadangkan folder data:

```bash
tar -czf absentray-data-$(date +%F).tgz \
  data backups                                   # dari folder proyek
```

Crontab harian (opsional):

```bash
crontab -e
0 3 * * * cd /DATA/AppData/AbsenTrayV2 && tar -czf backups/manual-$(date +\%F).tgz data
```

---

## 9. Pemecahan masalah Docker/CasaOS

| Gejala | Solusi |
|---|---|
| `port is already allocated` | Ubah `ports` di compose (`"5001:5000"`) atau hentikan app lain |
| Container restart loop | `docker logs absentray`; cek `better-sqlite3` tersegmen (native) — base `node:20-slim` menyediakan prebuild |
| Device merah | `ping <FP_IP>`; pastikan tak ada software lain mengunci `:4370` |
| WAHA merah | `curl http://<SERVER_IP>:5555/health`; sesi `default` discan QR |
| Frontend blank / CORS | Pastikan `CLIENT_URL` di `.env` sesuai origin browser; restart `docker compose up -d` |
| Perubahan skema DB | Inisialisasi otomatis idempotent saat start (entrypoint) |

---

## 10. Referensi

- [DEPLOYMENT.md](./DEPLOYMENT.md) — deploy native (PM2)
- [CONFIGURATION.md](./CONFIGURATION.md)
- [WAHA_INTEGRATION.md](./WAHA_INTEGRATION.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)