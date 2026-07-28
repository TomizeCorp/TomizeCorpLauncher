$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = 'root@185.254.18.37:/opt/tomize-account-api/'

Write-Host 'Copie de l API des avis EPSILON sur le VPS...'
scp "$source/server.js" "$source/package.json" "$source/Dockerfile" "$source/compose.yaml" $target
if ($LASTEXITCODE -ne 0) { throw "La copie des fichiers a échoué." }
scp -r "$source/admin" $target
if ($LASTEXITCODE -ne 0) { throw "La copie de l administration a échoué." }

Write-Host 'Redémarrage sécurisé de l API...'
ssh -tt root@185.254.18.37 "cd /opt/tomize-account-api && docker compose -f compose.yaml -f compose.override.yaml up -d --build api && sleep 4 && curl --fail --silent http://127.0.0.1:3000/health && echo && echo DEPLOIEMENT_AVIS_TERMINE"
if ($LASTEXITCODE -ne 0) { throw "Le déploiement distant a échoué." }

Write-Host 'Terminé. Vous pouvez fermer cette fenêtre.'
Read-Host
