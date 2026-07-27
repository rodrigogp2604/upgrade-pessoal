# Upgrade Pessoal — gera o APK e publica no servidor local.
#
# Fluxo: EAS builda na nuvem (esta máquina não tem Android SDK) → o artefato é baixado
# para data/apk/ → o painel passa a mostrar o QR de instalação e o app avisa que existe
# versão nova. Nada disso passa por loja.
$ErrorActionPreference = "Stop"
$proj = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $proj "mobile"
$apkDir = Join-Path $proj "data\apk"

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function Fail($msg) {
  Write-Host ""
  Write-Host "❌ $msg" -ForegroundColor Red
  exit 1
}

# ---------- 1) versão ----------
$appJson = Get-Content (Join-Path $mobile "app.json") -Raw | ConvertFrom-Json
$versao = $appJson.expo.version
$versionCode = $appJson.expo.android.versionCode
Write-Host "📦 Versão $versao (versionCode $versionCode)" -ForegroundColor Cyan
Write-Host "   Para publicar uma versão nova, suba os dois em mobile/app.json antes de rodar." -ForegroundColor DarkGray

# ---------- 2) build na nuvem ----------
Push-Location $mobile
Write-Host ""
Write-Host "☁️  Buildando no EAS (a primeira vez pede login e cria o keystore)..." -ForegroundColor Cyan
npx eas-cli build --platform android --profile preview --non-interactive --wait
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "o build no EAS falhou (veja o log acima)" }

# ---------- 3) baixar o artefato ----------
New-Item -ItemType Directory -Force $apkDir | Out-Null
$arquivo = Join-Path $apkDir "upgrade-pessoal-$versao.apk"

Write-Host ""
Write-Host "⬇️  Baixando o APK..." -ForegroundColor Cyan
npx eas-cli build:download --platform android --latest --output "$arquivo" 2>$null

if (-not (Test-Path $arquivo)) {
  # CLIs mais antigas não têm `build:download`: pega a URL do artefato pela listagem
  Write-Host "   (usando build:list como alternativa)" -ForegroundColor DarkGray
  $json = npx eas-cli build:list --platform android --limit 1 --json --non-interactive | ConvertFrom-Json
  $url = $json[0].artifacts.applicationArchiveUrl
  if (-not $url) { Pop-Location; Fail "não achei a URL do artefato do último build" }
  Invoke-WebRequest -Uri $url -OutFile $arquivo
}
Pop-Location

if (-not (Test-Path $arquivo)) { Fail "o APK não foi baixado" }

# ---------- 4) manifesto (o servidor só publica o que tem hash conferido) ----------
$info = Get-Item $arquivo
$hash = (Get-FileHash $arquivo -Algorithm SHA256).Hash.ToLower()

if ($info.Length -lt 1MB) { Fail "o arquivo baixado tem $([math]::Round($info.Length/1KB)) KB — não parece um APK" }

$manifesto = [ordered]@{
  version     = $versao
  versionCode = $versionCode
  builtAt     = (Get-Date).ToString("o")
  file        = $info.Name
  sizeBytes   = $info.Length
  sha256      = $hash
}
$manifesto | ConvertTo-Json | Set-Content (Join-Path $apkDir "manifest.json") -Encoding UTF8

# limpa versões antigas: o servidor entrega uma só
Get-ChildItem $apkDir -Filter "*.apk" | Where-Object { $_.Name -ne $info.Name } | Remove-Item -Force

Write-Host ""
Write-Host "✅ Publicado: $($info.Name) ($([math]::Round($info.Length/1MB,1)) MB)" -ForegroundColor Green
Write-Host "   sha256: $hash" -ForegroundColor DarkGray
Write-Host ""
Write-Host "   No painel → ícone de celular → QR 'Instalar no celular'." -ForegroundColor White
Write-Host "   Quem já tem o app instalado recebe o aviso de versão nova na próxima sincronização." -ForegroundColor White
