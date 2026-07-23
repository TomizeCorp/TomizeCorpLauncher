$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = 'root@185.254.18.37:/opt/tomize-account-api/'

Write-Host 'Copie du panneau administrateur sur le VPS (mot de passe SSH demandé)...'
scp "$source/server.js" "$source/package.json" "$source/Dockerfile" "$source/compose.yaml" "$source/deploy-admin.sh" $target
scp -r "$source/admin" $target

Write-Host 'Installation sécurisée (mot de passe SSH demandé une seconde fois)...'
ssh root@185.254.18.37 "sed -i 's/\r$//' /opt/tomize-account-api/deploy-admin.sh && chmod +x /opt/tomize-account-api/deploy-admin.sh && /opt/tomize-account-api/deploy-admin.sh"

Write-Host 'Terminé. Vous pouvez fermer cette fenêtre.'
Read-Host
