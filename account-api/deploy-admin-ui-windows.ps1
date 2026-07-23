$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = 'root@185.254.18.37:/opt/tomize-account-api/'

Write-Host 'Mise à jour du logo TomizeCorp (mot de passe SSH demandé)...'
scp "$source/server.js" "$source/Dockerfile" $target
if ($LASTEXITCODE -ne 0) { throw "La copie des fichiers a échoué." }
scp -r "$source/admin" $target
if ($LASTEXITCODE -ne 0) { throw "La copie de l'interface a échoué." }

Write-Host 'Redémarrage du site (mot de passe SSH demandé une seconde fois)...'
ssh -tt root@185.254.18.37 "cd /opt/tomize-account-api && docker compose -f compose.yaml -f compose.override.yaml up -d --build api"
if ($LASTEXITCODE -ne 0) { throw "La mise à jour distante a échoué." }

Write-Host 'LOGO_TOMIZECORP_DEPLOYE'
Read-Host
