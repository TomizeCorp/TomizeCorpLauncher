# TomizeCorpLauncher

**TomizeCorpLauncher** est le launcher principal. Il présente les serveurs hébergés par TomizeCorp, dont **EPSILON**, installe Minecraft 1.21.11, synchronise les fichiers et rejoint directement la survie.

Le client EPSILON inclut une mini-carte de surface et les coordonnées permanentes. La touche `B` ouvre la gestion des pings personnels : ajout à la position actuelle, renommage et suppression. La mini-carte n'affiche volontairement aucune information sur les joueurs, les mobs ou les grottes.

## Démarrage

1. Installer Node.js 20 ou plus récent.
2. Exécuter `npm install` puis `npm start`.
3. Dans EPSILON, sélectionner un exécutable Java 21 `javaw.exe`, puis choisir un pseudo.

Le launcher ne collecte aucun identifiant Microsoft ou TLauncher. Le pseudo hors-ligne doit être protégé côté serveur par un plugin d'authentification.

Les comptes TomizeCorp multi-appareils utilisent l’API HTTPS configurée par `accountApiUrl`. Le service Docker/PostgreSQL se trouve dans `account-api/` et son déploiement est expliqué dans `account-api/DEPLOY.md`.

## Configuration obligatoire

Modifier `config/launcher.json` avec la véritable adresse et le port du serveur avant distribution. Pour retirer réellement Solo, Multijoueur et Realms après une déconnexion, placer le mod client de verrouillage `epsilon-lock.jar` dans `server-files/mods`, puis régénérer le manifeste. Le lancement direct fonctionne sans ce mod, mais Minecraft ne permet pas au launcher externe de supprimer ses menus à lui seul.

## Publier des mods et resource packs

Déposer les fichiers dans `server-files/mods`, `server-files/resourcepacks`, `server-files/config`, `server-files/shaderpacks` ou `server-files/defaultconfigs`, puis exécuter :

```powershell
npm run manifest
```

En production, héberger les fichiers et `manifest.json` en HTTPS. Dans `config/launcher.json`, remplacer `manifestUrl` par l'URL HTTPS du manifeste. Les URL de chaque entrée du manifeste doivent aussi pointer vers les fichiers hébergés.

## Générer l'exécutable Windows

```powershell
npm run dist
```

Le fichier portable est créé dans `dist/`.

## Publier une mise à jour automatique

Le launcher utilise les Releases du dépôt public `TomizeCorp/TomizeCorpLauncher`. Après avoir augmenté la version de `package.json`, créer et pousser le tag correspondant :

```powershell
git tag v1.5.0
git push origin v1.5.0
```

GitHub Actions compile et publie automatiquement l'installateur, son blockmap et `latest.yml`. Les launchers installés vérifient la Release au démarrage, téléchargent la mise à jour et proposent de redémarrer. Les comptes locaux et l'instance EPSILON sont conservés.

## Rendu distant

Le launcher distribue [Voxy 0.2.16-beta pour Minecraft 1.21.11](https://modrinth.com/mod/voxy/version/H3w2nVdU), avec Sodium et Fabric API. Voxy remplace Distant Horizons : l'ancien mod distribué par le launcher est retiré automatiquement lors de la synchronisation de l'instance. Les données et configurations de Distant Horizons restent conservées.

Le rendu distant de Voxy nécessite OpenGL 4.6. Les shaders doivent explicitement prendre en charge Voxy pour fonctionner avec son rendu distant.

## Sécurité

- Les chemins `../` et les fichiers hors instance sont refusés.
- Chaque téléchargement est vérifié avec SHA-256 avant installation.
- Seuls les fichiers enregistrés dans `.epsilon-managed.json` peuvent être supprimés lors d'une mise à jour.
