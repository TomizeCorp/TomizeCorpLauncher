$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$remoteScript = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'fix-tab-placeholders.sh') -Raw
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remoteScript))

Write-Host 'Connexion au VPS pour corriger le plugin TAB...'
& ssh -p 22 root@185.254.18.37 "echo '$encoded' | base64 -d | bash"
if ($LASTEXITCODE -ne 0) {
    Write-Host 'La correction TAB a échoué.' -ForegroundColor Red
} else {
    Write-Host 'La configuration TAB a été corrigée.' -ForegroundColor Green
}
Read-Host 'Appuyez sur Entrée pour fermer cette fenêtre'
