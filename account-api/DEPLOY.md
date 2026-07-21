# Déployer l’API TomizeCorp sur Debian 13

## Pré requis

- Faire pointer l’enregistrement DNS `A` de `api.tomize.fr` vers l’adresse IPv4 publique du VPS.
- Autoriser les ports TCP 80 et 443 vers le VPS.
- Disposer d’un utilisateur Debian avec `sudo` ou de l’accès `root`.

## Installer Docker

Suivre le dépôt officiel Docker pour Debian :

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "Types: deb
URIs: https://download.docker.com/linux/debian
Suites: trixie
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc" | sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

## Installer le service

Copier le dossier `account-api` dans `/opt/tomize-account-api`, puis :

```bash
cd /opt/tomize-account-api
cp .env.example .env
openssl rand -base64 48
```

Placer des secrets différents et longs dans `POSTGRES_PASSWORD` et `SESSION_PEPPER` du fichier `.env`, puis démarrer :

```bash
sudo docker compose up -d --build
sudo docker compose ps
curl --fail https://api.tomize.fr/health
```

La réponse attendue est `{"ok":true}`.

## Sauvegardes

Sauvegarder régulièrement PostgreSQL hors du VPS :

```bash
sudo docker compose exec -T db pg_dump -U tomize tomize_accounts | gzip > "tomize-accounts-$(date +%F).sql.gz"
```

Ne jamais publier `.env`, les sauvegardes SQL ou les clés SSH.
