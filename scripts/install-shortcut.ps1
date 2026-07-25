# Cria o atalho "Subir a Torre" na área de trabalho (com o ícone da Torre)
$ErrorActionPreference = "Stop"
$proj = Split-Path -Parent $PSScriptRoot
$start = Join-Path $proj "scripts\start.ps1"
$icon = Join-Path $proj "assets\torre.ico"

$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "Subir a Torre.lnk"

# remove o atalho da era anterior, se existir
$old = Join-Path $desktop "Upgrade Pessoal.lnk"
if (Test-Path $old) { Remove-Item $old -Force }

$ps = (Get-Command powershell.exe).Source
$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($lnkPath)
$sc.TargetPath = $ps
# Janela VISÍVEL de propósito: a 1ª execução builda a imagem e demora;
# sem feedback o usuário acha que o atalho não fez nada.
$sc.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$start`""
$sc.WorkingDirectory = $proj
$sc.WindowStyle = 1  # janela normal
$sc.IconLocation = "$icon,0"
$sc.Description = "Upgrade Pessoal — abre o painel e sobe mais um andar da Torre"
$sc.Save()

Write-Host "✅ Atalho criado: $lnkPath" -ForegroundColor Green
