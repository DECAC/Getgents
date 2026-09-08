# Getgents — mémoire du projet

Ce fichier est lu au démarrage de chaque session. Il existe parce qu'une
session n'a aucun souvenir de la précédente : ce qui n'est pas écrit ici est
perdu, et se redécouvre au prix d'une demi-journée.

Il consigne ce qui ne se déduit PAS du code : les décisions et leurs raisons,
les dettes assumées, et les pièges qui ont déjà coûté cher.

## Le projet

Plateforme de création d'assistants (« gents »). Next.js 14 App Router,
français partout — code, commentaires, commits, interface. CSS Modules et
`styles/tokens.css`, jamais Tailwind. Supabase pour la base et
l'authentification. Déploiement Vercel depuis `main`.

Éditeur : **Charles de Cassan**, à titre **personnel et non professionnel** —
il n'y a **pas de société**. Les mentions légales l'ont un temps affirmé
(« The G Company », directeur « Gary Gentle ») : c'était faux, et corrigé au
commit `929d4c1`. Ne pas réintroduire de raison sociale sans immatriculation :
un test (`__tests__/legal.test.ts`) l'interdit.

## Discipline de travail

- **Branche de développement** : `claude/initial-commit-3ontnr`. `main` est la
  production ; on y bascule par avance rapide, jamais par fusion.
- **Vérifier `origin/main` AVANT de pousser.** Le dépôt reçoit aussi des
  commits écrits ailleurs (Cursor). Une divergence impose un rebase, avec
  arbitrage à la main — c'est arrivé, et le correctif d'en face était meilleur
  que le mien sur un point.
- **Jest est en `testEnvironment: "node"`** : il ne teste que des fonctions
  pures de `lib/`. Tout le rendu se vérifie au navigateur avec Playwright
  (`/opt/pw-browsers/chromium`), pas par des tests de composants.
- **Ne jamais `pkill -f "next start"`** : le motif correspond au shell de
  l'agent, qui se tue lui-même (sortie 144). Utiliser `nohup`, un port unique
  par essai, et une boucle `curl` d'attente.
- **Nettoyer AVANT de committer**, et relire `git status`. Un `playwright`
  s'est déjà glissé dans `package.json` de production.
- **Une migration dont le code dépend se passe AVANT le déploiement.** Sinon
  la production casse entre les deux.

## Environnement de l'agent

Le proxy sortant bloque `*.supabase.co`, `getgents.ai`, `challenges.cloudflare.com`
et les sites des catégoriseurs. `openrouter.ai` et `api.github.com` passent.
Pas de démon Docker. **Conséquence : aucun salon collaboratif ni aucune page
en production ne peut être exercé depuis ici.** Des identifiants n'y
changeraient rien — c'est le réseau, pas l'accès. La boucle qui fonctionne est
l'utilisateur qui joue le scénario et colle les journaux Vercel.

## Décisions structurantes

- **Facturation LLM** : `lib/server/openRouterKey.ts` est le SEUL endroit qui
  lit `OPENROUTER_API_KEY`. Un `ContexteLlm` explicite est passé en paramètre,
  jamais un `AsyncLocalStorage` : un chemin oublié serait un bug de
  facturation silencieux, le compilateur doit le refuser. Un test de
  discipline garde l'invariant.
- **Salon collaboratif** : le modèle dépend de la PHASE
  (`lib/collabModels.ts`) — un modèle rapide en collecte, celui du créateur en
  propositions. Mesuré : 82-91 % du temps d'un tick est l'appel au modèle.
- **Menu « Créer » du studio** : depuis un gent ouvert, ces entrées CHANGENT
  D'ONGLET. Elles allouaient un gent neuf à chaque clic. Ne pas revenir en
  arrière.
- **Le studio enregistre tout seul**, à chaque frappe. Le bouton
  « Enregistrer » ne crée pas une sauvegarde manquante : il rend l'écriture
  visible et supprime l'anti-rebond.
- **Un clic explicite REESSAIE toujours**, même après un 401/503. Le drapeau
  `remoteAvailable` ne coupe que les synchronisations de fond.
- **Attribution « Propulsé par »** figée à la diffusion, pas résolue au rendu :
  sinon chaque visiteur d'une page publique interrogerait le compte du
  propriétaire.
- **L'onglet Aperçu est retiré VOLONTAIREMENT** — entrée du rail et étape du
  plan de construction. Ne pas le « réparer » en croyant à un oubli.
  ATTENTION à ne pas en déduire que l'aperçu d'application est mort : SEUL
  l'écran de prévisualisation du créateur a disparu. `appPreview` est bien
  VIVANT — l'assistant du builder produit toujours des modules, `WorkspaceCanvas`
  les rend à l'utilisateur final, et ils partent dans le gent diffusé comme dans
  les liens de partage. Le créateur voit le résultat par le bouton Preview, qui
  ouvre l'espace réel. Seul `ApercuTab` est du code sans point d'entrée.
- **Les composants qui s'affichent pour un invité vont dans
  `SharedGentShell`**, PAS dans `CenterHeader` : la page `/l/<jeton>` a son
  propre en-tête. Un bouton de signalement monté au mauvais endroit ne
  s'affichait nulle part, et rien ne le signalait.

## Pièges déjà payés

- **Un verrou sans expiration est une panne en attente.** `orchestrating` est
  resté bloqué à `true` après une fonction tuée par un déploiement, rendant un
  salon muet définitivement. Expiration à 3 minutes depuis la migration 015.
- **Ne pas déployer pendant que l'utilisateur teste** : cela tue les requêtes
  en vol. Ça a coûté trois diagnostics.
- **`last_seen_at` n'est pas un ordre de tri** : il est réécrit à chaque
  sondage du client, toutes les 2,5 s.
- **Un état d'échec muet est pire qu'une erreur.** `busy_or_capped` confondait
  « il réfléchit » et « plafond atteint » ; Turnstile échouait sans un mot.

## Dette assumée, à traiter avant l'ouverture publique

- **`005_integration_credentials.sql` stocke les jetons OAuth Gmail EN CLAIR.**
  Ce sont les accès à la boîte mail des utilisateurs. `lib/server/secretBox.ts`
  (AES-256-GCM) est prêt depuis le lot 8 ; prévoir une lecture tolérante
  (`enc_version = 0` → clair, rechiffré à la prochaine écriture).
- `reasoningModelId` est configurable, recommandé par l'assistant, affiché —
  et **jamais lu au moment de générer**. Le brancher, ou le retirer.
- Environ 21 boutons textuels sous 40 px sur `/espace/[id]` (décision de
  densité, proposée et non tranchée).

## Configuration hors dépôt

`SECRET_BOX_KEY` : sa perte rend **illisibles** toutes les clés OpenRouter
enregistrées par les créateurs. Elle doit vivre ailleurs que sur Vercel.

Les inscriptions sont fermées **chez Supabase** (Authentication → Providers →
Email). `lib/inscriptions.ts` ne fait que rendre l'interface honnête — il ne
ferme rien à lui seul.
