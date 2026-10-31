# Engagements – Triathlon U14 (migration Netlify)

Ce dossier contient :
- `index.html` : interface hébergée sur Netlify ;
- `Code.gs` : API Google Apps Script qui lit/écrit dans le Google Sheets existant ;
- `netlify/functions/api.js` : passerelle serveur Netlify vers Apps Script.

## Important
Le classeur Google Sheets existant est conservé. Ne supprime pas ton ancien projet Apps Script ni ton déploiement avant d'avoir testé la nouvelle version.

## Configuration à faire
1. Dans ton projet Apps Script existant, remplace le contenu de `Code.gs` par le fichier `Code.gs` de ce dossier.
2. Enregistre.
3. Dans Apps Script, fais **Déployer > Gérer les déploiements > Modifier** (ou nouveau déploiement), choisis **Application Web**, exécuter en tant que **Moi**, accès **Tout le monde**, puis déploie.
4. Copie l'URL qui finit par `/exec`.
5. Dans Netlify, importe le dossier du projet (ou son dépôt GitHub). Le dossier publié doit contenir `index.html` et `netlify/functions/api.js`.
6. Dans les variables d'environnement Netlify, ajoute :
   - `APPS_SCRIPT_URL` = l'URL `/exec` de ton nouveau déploiement Apps Script ;
   - `APPS_SCRIPT_TOKEN` = la valeur de `API_TOKEN` dans `Code.gs`.
7. Redéploie le site Netlify.

## Test
Ouvre l'adresse Netlify. Vérifie que les compétitions et athlètes chargent, puis fais un engagement test. Vérifie ensuite la ligne ajoutée dans l'onglet `Reponses`.

## Sécurité et limites
- Les visiteurs n'ont pas besoin de compte Google.
- Le script s'exécute avec les droits du propriétaire du classeur.
- Le jeton est conservé côté serveur Netlify, pas dans le HTML public.
- L'API Apps Script doit être déployée pour être appelée par Netlify.
- Le formulaire affiche les noms d'athlètes ; ne publie pas d'autres données personnelles dans le HTML.
