#!/usr/bin/env bash
set -euo pipefail

mapfile -t tab_configs < <(find /var/lib /opt /home -type f -path '*/plugins/TAB/*.yml' 2>/dev/null)
if (( ${#tab_configs[@]} == 0 )); then
  echo "Aucune configuration du plugin TAB trouvée."
  exit 1
fi

changed=0
for config in "${tab_configs[@]}"; do
  if grep -qE '%luckperms-(prefix|suffix)%' "$config"; then
    backup="${config}.backup-tomizecorp"
    cp --preserve=all "$config" "$backup"
    sed -i \
      -e 's/%luckperms-prefix%/%prefix%/g' \
      -e 's/%luckperms-suffix%/%suffix%/g' \
      "$config"
    echo "Corrigé : $config"
    echo "Sauvegarde : $backup"
    changed=$((changed + 1))
  fi
done

if (( changed == 0 )); then
  echo "Les placeholders LuckPerms incorrects n'ont été trouvés dans aucun fichier TAB."
  exit 2
fi

echo "Correction terminée. Recharge TAB avec /tab reload ou redémarre le serveur Minecraft."
