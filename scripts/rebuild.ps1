# Upgrade Pessoal — reconstrói a imagem após mudar o código
$ErrorActionPreference = "Stop"
$proj = Split-Path -Parent $PSScriptRoot
Set-Location $proj
. "$PSScriptRoot\lan-ip.ps1"

# mesmo no rebuild o IP precisa ir junto, senão o QR de pareamento sai com o IP do Docker
$ip = Get-LanIPv4
if ($ip) {
    $env:HOST_LAN_IP = $ip
    Write-Host "🌐 IP desta máquina na rede: $ip" -ForegroundColor Cyan
}

Write-Host "🔧 Reconstruindo a imagem..." -ForegroundColor Cyan
docker compose up -d --build
Write-Host "✅ Pronto. Abrindo http://localhost:4000" -ForegroundColor Green
Start-Process "http://localhost:4000"
