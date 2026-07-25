# Upgrade Pessoal — para o painel (mantém os dados na pasta data/)
$ErrorActionPreference = "SilentlyContinue"
$proj = Split-Path -Parent $PSScriptRoot
Set-Location $proj
Write-Host "🛑 Parando o painel..." -ForegroundColor Yellow
docker compose down
Write-Host "✅ Parado. Seus dados continuam salvos em data/." -ForegroundColor Green
Start-Sleep -Seconds 1
