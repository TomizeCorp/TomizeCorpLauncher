#!/usr/bin/env bash
set -euo pipefail
cd /opt/tomize-account-api

read -rp "Adresse e-mail qui recevra les codes administrateur : " admin_email
if [[ ! "$admin_email" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "Adresse e-mail invalide."
  exit 1
fi
read -rsp "Choisissez le mot de passe administrateur (16 caractères minimum) : " admin_password
echo
read -rsp "Confirmez le mot de passe administrateur : " admin_password_confirm
echo
if [[ "$admin_password" != "$admin_password_confirm" || ${#admin_password} -lt 16 ]]; then
  echo "Les mots de passe sont différents ou trop courts."
  exit 1
fi

admin_hash="$(
  printf '%s' "$admin_password" |
    docker run --rm -i node:22-alpine node -e \
      "const c=require('crypto');let d='';process.stdin.on('data',x=>d+=x);process.stdin.on('end',()=>{const s=c.randomBytes(16);c.scrypt(d,s,64,(e,k)=>{if(e)throw e;console.log(s.toString('hex')+':'+k.toString('hex'))})})"
)"
unset admin_password admin_password_confirm

upsert_env() {
  local key="$1" value="$2" temp
  temp="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    BEGIN { found=0 }
    index($0, key "=") == 1 { print key "=" value; found=1; next }
    { print }
    END { if (!found) print key "=" value }
  ' .env > "$temp"
  install -m 600 "$temp" .env
  rm -f "$temp"
}
upsert_env ADMIN_DOMAIN admin-launcher.tomize.fr
upsert_env ADMIN_EMAIL "$admin_email"
upsert_env ADMIN_PASSWORD_HASH "$admin_hash"

docker compose -f compose.yaml -f compose.override.yaml up -d --build api

if ! grep -q '^admin-launcher\.tomize\.fr' /etc/caddy/Caddyfile; then
  cat >> /etc/caddy/Caddyfile <<'CADDY'

admin-launcher.tomize.fr {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
CADDY
fi
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
sleep 3
curl --fail --silent --show-error -H 'Host: admin-launcher.tomize.fr' http://127.0.0.1/ | grep -q 'Administration TomizeCorp'
echo "ADMINISTRATION_TOMIZECORP_DEPLOYEE"
