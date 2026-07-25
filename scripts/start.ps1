# Upgrade Pessoal — inicia o painel (sobe o Docker e abre no navegador)
# Sem $ErrorActionPreference='Stop': comandos nativos (docker) não lançam exceção,
# então checamos $LASTEXITCODE explicitamente.

$proj = Split-Path -Parent $PSScriptRoot
Set-Location $proj

# Console em UTF-8 (senão emojis/acentos viram lixo no conhost legado)
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$Host.UI.RawUI.WindowTitle = "Upgrade Pessoal"
Write-Host ""
Write-Host "  🎮 UPGRADE PESSOAL " -ForegroundColor Cyan -NoNewline
Write-Host "— iniciando o painel..." -ForegroundColor White
Write-Host ""

function Fail($msg) {
  Write-Host ""
  Write-Host "❌ $msg" -ForegroundColor Red
  Write-Host ""
  Read-Host "Pressione Enter para fechar"
  exit 1
}

function Test-Docker {
  docker info 2>$null 1>$null
  return ($LASTEXITCODE -eq 0)
}

# ---------- 1) Docker ligado? ----------
if (-not (Test-Docker)) {
  Write-Host "🐳 Docker não está rodando. Abrindo o Docker Desktop..." -ForegroundColor Yellow

  $candidates = @(
    "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
    "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
    "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
  )
  $dd = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $dd) { Fail "Docker Desktop não encontrado. Instale o Docker Desktop e tente de novo." }

  Start-Process $dd | Out-Null
  Write-Host "   Aguardando o Docker subir (normalmente 1-2 min)" -NoNewline

  $ready = $false
  for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 2
    Write-Host "." -NoNewline
    if (Test-Docker) { $ready = $true; break }
  }
  Write-Host ""
  if (-not $ready) { Fail "O Docker não subiu a tempo. Abra o Docker Desktop manualmente e rode o atalho de novo." }
  Write-Host "   ✅ Docker pronto." -ForegroundColor Green
}
else {
  Write-Host "🐳 Docker já está rodando." -ForegroundColor Green
}

# ---------- 2) Sobe o container ----------
Write-Host ""
Write-Host "📦 Subindo o painel (a 1ª vez builda a imagem e demora alguns minutos)..." -ForegroundColor Cyan
Write-Host ""

# --build de propósito: se o código não mudou, o cache resolve em segundos;
# se mudou, garante que a imagem acompanha (evita "imagem velha × banco novo",
# que faria o Prisma abortar para não perder dados).
docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "--- últimas linhas do log ---" -ForegroundColor DarkGray
  docker compose logs --tail 25
  Fail "Falha ao subir o container (veja o log acima)."
}

# ---------- 3) Espera responder e abre ----------
Write-Host ""
Write-Host "⏳ Aguardando o painel responder" -NoNewline
$ok = $false
for ($i = 0; $i -lt 45; $i++) {
  try {
    Invoke-WebRequest -UseBasicParsing "http://localhost:4000/api/health" -TimeoutSec 2 | Out-Null
    $ok = $true; break
  } catch {
    Start-Sleep -Seconds 2
    Write-Host "." -NoNewline
  }
}
Write-Host ""

if (-not $ok) {
  Write-Host ""
  Write-Host "--- últimas linhas do log ---" -ForegroundColor DarkGray
  docker compose logs --tail 25
  Fail "O painel não respondeu em http://localhost:4000"
}

Write-Host ""
Write-Host "  ✅ NO AR! " -ForegroundColor Green -NoNewline
Write-Host "Abrindo http://localhost:4000" -ForegroundColor White
Write-Host ""
Start-Process "http://localhost:4000"
Start-Sleep -Seconds 3
