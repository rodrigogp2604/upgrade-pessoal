# Upgrade Pessoal — gera o APK e publica no servidor local.
#
# Fluxo: EAS builda na nuvem (esta máquina não tem Android SDK) → o artefato é baixado
# para data/apk/ → o painel passa a mostrar o QR de instalação e o app avisa que existe
# versão nova. Nada disso passa por loja.
#
#   -ForceBuild   builda de novo mesmo já existindo um build pronto desta versão
param([switch]$ForceBuild)

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

# ---------- 2) pré-requisitos do EAS ----------
# O build roda sem interação, então login e vínculo do projeto precisam existir ANTES —
# senão o erro que aparece é do EAS, críptico, no meio do build.
Push-Location $mobile

$projectId = $appJson.expo.extra.eas.projectId
if (-not $projectId) {
  Pop-Location
  Write-Host ""
  Write-Host "Este projeto ainda não está ligado a uma conta Expo. Rode uma vez:" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "    cd mobile" -ForegroundColor White
  Write-Host "    npx eas-cli login     # conta gratuita em expo.dev" -ForegroundColor White
  Write-Host "    npx eas-cli init      # cria o projeto e grava o id em app.json" -ForegroundColor White
  Write-Host ""
  Fail "faltou o vínculo com o EAS (passos acima)"
}

$quem = npx eas-cli whoami 2>&1
if ($LASTEXITCODE -ne 0) {
  Pop-Location
  Write-Host ""
  Write-Host "Você não está logado no EAS. Rode: " -ForegroundColor Yellow -NoNewline
  Write-Host "cd mobile; npx eas-cli login" -ForegroundColor White
  Fail "login do EAS pendente"
}
Write-Host "👤 EAS: $quem" -ForegroundColor DarkGray

# ---------- 3) build na nuvem ----------
# Cota de build não é infinita: se já existe um build PRONTO para esta mesma versão,
# reaproveita. Publicar de novo (depois de um erro na etapa de download, por exemplo)
# não deveria custar um build.
$pronto = $null
if (-not $ForceBuild) {
  $lista = npx eas-cli build:list --platform android --limit 1 --json --non-interactive | ConvertFrom-Json
  $ultimo = $lista[0]
  if ($ultimo -and $ultimo.status -eq "FINISHED" -and $ultimo.appVersion -eq $versao -and [int]$ultimo.appBuildVersion -eq $versionCode) {
    $pronto = $ultimo
    Write-Host ""
    Write-Host "♻️  Já existe build pronto da versão $versao ($($ultimo.id)) — reaproveitando." -ForegroundColor Yellow
    Write-Host "   Use -ForceBuild para buildar mesmo assim." -ForegroundColor DarkGray
  }
}

if (-not $pronto) {
  Write-Host ""
  Write-Host "☁️  Buildando no EAS (a 1ª vez cria o keystore — GUARDE ele, ver docs/SETUP.md)..." -ForegroundColor Cyan
  npx eas-cli build --platform android --profile preview --non-interactive --wait
  if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "o build no EAS falhou (veja o log acima)" }
}

# ---------- 4) baixar o artefato ----------
# Pela URL do artefato, e não por `build:download`: esse subcomando é para builds de
# emulador e não aceita destino. `build:list --json` é estável entre versões da CLI.
New-Item -ItemType Directory -Force $apkDir | Out-Null
$arquivo = Join-Path $apkDir "upgrade-pessoal-$versao.apk"

Write-Host ""
Write-Host "⬇️  Baixando o APK..." -ForegroundColor Cyan

$json = npx eas-cli build:list --platform android --limit 1 --json --non-interactive | ConvertFrom-Json
Pop-Location

$build = $json[0]
if (-not $build) { Fail "não achei nenhum build deste projeto no EAS" }
if ($build.status -ne "FINISHED") { Fail "o último build está em '$($build.status)' — veja em expo.dev" }

$url = $build.artifacts.applicationArchiveUrl
if (-not $url) { Fail "o build terminou mas não tem artefato para baixar" }

# APK tem mais de 100 MB: se o arquivo desta versão já está aqui, não baixa de novo
# (rodar o script depois de um erro na publicação não deveria custar o download inteiro).
if ((Test-Path $arquivo) -and ((Get-Item $arquivo).Length -gt 1MB) -and -not $ForceBuild) {
  Write-Host "   já baixado — reaproveitando o arquivo local" -ForegroundColor DarkGray
} else {
  Invoke-WebRequest -Uri $url -OutFile $arquivo
}

if (-not (Test-Path $arquivo)) { Fail "o APK não foi baixado" }

# ---------- 5) manifesto (o servidor só publica o que tem hash conferido) ----------
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
# UTF-8 SEM BOM: `Set-Content -Encoding UTF8` no Windows PowerShell 5.1 escreve BOM,
# e JSON.parse do Node engasga com ele — o servidor descartaria o manifesto calado.
[System.IO.File]::WriteAllText(
  (Join-Path $apkDir "manifest.json"),
  ($manifesto | ConvertTo-Json),
  [System.Text.UTF8Encoding]::new($false)
)

# limpa versões antigas: o servidor entrega uma só
Get-ChildItem $apkDir -Filter "*.apk" | Where-Object { $_.Name -ne $info.Name } | Remove-Item -Force

Write-Host ""
Write-Host "✅ Publicado: $($info.Name) ($([math]::Round($info.Length/1MB,1)) MB)" -ForegroundColor Green
Write-Host "   sha256: $hash" -ForegroundColor DarkGray
Write-Host ""
Write-Host "   No painel → ícone de celular → QR 'Instalar no celular'." -ForegroundColor White
Write-Host "   Quem já tem o app instalado recebe o aviso de versão nova na próxima sincronização." -ForegroundColor White
