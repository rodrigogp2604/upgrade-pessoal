# Upgrade Pessoal — backup do progresso (copia a pasta data/)
$ErrorActionPreference = "Stop"
$proj = Split-Path -Parent $PSScriptRoot
$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$dest = Join-Path $proj "backups\data_$stamp"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Path (Join-Path $proj "data\*") -Destination $dest -Recurse -Force
Write-Host "💾 Backup salvo em: $dest" -ForegroundColor Green
Read-Host "Enter para fechar"
