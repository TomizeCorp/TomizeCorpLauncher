$ErrorActionPreference = 'Stop'
$remote = 'root@185.254.18.37'
$command = @'
set -e
if ! grep -q '^avis-epsilon\.tomize\.fr {' /etc/caddy/Caddyfile; then
cat >> /etc/caddy/Caddyfile <<'CADDY'

avis-epsilon.tomize.fr {
    encode zstd gzip
    reverse_proxy https://epsilon-survival-reviews.tomizeyt.chatgpt.site {
        header_up Host epsilon-survival-reviews.tomizeyt.chatgpt.site
    }
}
CADDY
fi
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
sleep 4
curl --fail --silent --show-error https://avis-epsilon.tomize.fr/ | grep -q 'Avis EPSILON'
echo DOMAINE_AVIS_EPSILON_CONFIGURE
'@

Write-Host 'Configuration de avis-epsilon.tomize.fr sur le VPS...'
ssh -tt $remote $command
if ($LASTEXITCODE -ne 0) { throw 'La configuration du domaine a échoué.' }
Write-Host 'Terminé. Vous pouvez fermer cette fenêtre.'
Read-Host
