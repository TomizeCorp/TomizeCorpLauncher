$ErrorActionPreference = 'Stop'

$clientId = '1528488560813015210'
$server = 'root@185.254.18.37'

Write-Host 'Configuration de la connexion Discord pour avis-epsilon.tomize.fr' -ForegroundColor Cyan
$secureSecret = Read-Host 'Client Secret Discord (la saisie reste masquee)' -AsSecureString
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)

try {
    $clientSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    if ([string]::IsNullOrWhiteSpace($clientSecret)) {
        throw 'Le Client Secret ne peut pas etre vide.'
    }

    $secretBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($clientSecret))
    $remoteScript = @"
set -euo pipefail
cd /opt/tomize-account-api
touch .env
grep -vE '^(DISCORD_CLIENT_ID|DISCORD_CLIENT_SECRET|DISCORD_REDIRECT_URI|REVIEWS_SITE_URL)=' .env > .env.tomize.tmp || true
printf '%s\n' 'DISCORD_CLIENT_ID=$clientId' >> .env.tomize.tmp
printf 'DISCORD_CLIENT_SECRET=%s\n' "`$(printf '%s' '$secretBase64' | base64 -d)" >> .env.tomize.tmp
printf '%s\n' 'DISCORD_REDIRECT_URI=https://api.tomize.fr/v1/reviews/discord/callback' >> .env.tomize.tmp
printf '%s\n' 'REVIEWS_SITE_URL=https://avis-epsilon.tomize.fr' >> .env.tomize.tmp
chmod 600 .env.tomize.tmp
mv .env.tomize.tmp .env
docker compose up -d --build db api
for attempt in 1 2 3 4 5 6; do
  status="`$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/v1/reviews/discord/login || true)"
  if [ "`$status" = '302' ]; then
    echo 'CONNEXION_DISCORD_CONFIGUREE'
    exit 0
  fi
  sleep 2
done
echo "Le test OAuth a retourne le statut `$status." >&2
exit 1
"@

    Write-Host 'Mot de passe SSH du VPS demande maintenant...' -ForegroundColor Yellow
    $remoteScript | & ssh.exe $server 'bash -s'
    if ($LASTEXITCODE -ne 0) {
        throw 'La configuration Discord a echoue.'
    }

    Write-Host ''
    Write-Host 'Connexion Discord configuree avec succes.' -ForegroundColor Green
}
finally {
    if ($secretPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    }
    $clientSecret = $null
    $secretBase64 = $null
}

Read-Host 'Appuyez sur Entree pour fermer'
