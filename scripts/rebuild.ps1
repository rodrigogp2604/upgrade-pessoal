# Upgrade Pessoal — reconstrói a imagem após mudar o código
$ErrorActionPreference = "Stop"
$proj = Split-Path -Parent $PSScriptRoot
Set-Location $proj
Write-Host "🔧 Reconstruindo a imagem..." -ForegroundColor Cyan
docker compose up -d --build
Write-Host "✅ Pronto. Abrindo http://localhost:4000" -ForegroundColor Green
Start-Process "http://localhost:4000"
