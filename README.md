# EPSILON Launcher

Le projet contient deux interfaces : **TomizeCorpLauncher**, la bibliothèque principale, puis **EPSILON Launcher**, le client autonome ouvert par le bouton Jouer. EPSILON installe Minecraft 1.21.11, synchronise les fichiers et rejoint directement la survie avec un profil hors-ligne.

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

## Sécurité

- Les chemins `../` et les fichiers hors instance sont refusés.
- Chaque téléchargement est vérifié avec SHA-256 avant installation.
- Seuls les fichiers enregistrés dans `.epsilon-managed.json` peuvent être supprimés lors d'une mise à jour.
