# sync-data.ps1 — kirim data produksi lokal ke server Ubuntu via SCP.
# Jalankan dari mesin Windows yang berisi data asli (folder server AbsenTray V2).
#
# Penggunaan:
#   .\deploy\sync-data.ps1 -Server 192.168.1.180 -User fahri
#   .\deploy\sync-data.ps1 -Server 192.168.1.180 -User fahri -DataDir D:\src\AbsenTrayV2\server
#
param(
  [string]$Server = "192.168.1.180",
  [string]$User = "fahri",
  [string]$DataDir = "$PSScriptRoot\..\server",
  [string]$RemoteDest = "/home/$User/absentray-data"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
  Write-Error "SCP tidak ditemukan. Aktifkan OpenSSH Client di Windows (Settings > Apps > Optional Features > OpenSSH Client)."
}

if (-not (Test-Path $DataDir)) {
  Write-Error "DataDir tidak ditemukan: $DataDir"
}

$files = @("map_user.csv", "sent_log.txt")
$present = foreach ($f in $files) {
  if (Test-Path (Join-Path $DataDir $f)) { $f }
}

if ($present.Count -lt $files.Count) {
  Write-Host "Sebagian file data tidak ada di $DataDir:" -ForegroundColor Yellow
  foreach ($f in $files) {
    $ok = Test-Path (Join-Path $DataDir $f)
    Write-Host "  - $f : $(if ($ok) {'ada'} else {'tidak (dilewati)'})"
  }
}

Write-Host "Kirim $($present.Count) file data ke $User@$Server ..." -ForegroundColor Cyan
ssh "$User@$Server" "mkdir -p $RemoteDest"
foreach ($f in $present) {
  $src = Join-Path $DataDir $f
  Write-Host "  -> $f"
  scp "$src" "$User@$Server`:$RemoteDest/$f"
}

Write-Host "Selesai. Di server jalankan perintah berikut:" -ForegroundColor Cyan
Write-Host "  cd /path/to/AbsenTrayV2/deploy && ./import-data.sh $RemoteDest/map_user.csv $RemoteDest/sent_log.txt" -ForegroundColor Gray