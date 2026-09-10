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
- **Jetons OAuth CHIFFRÉS au repos** (migration 018). `enc_version` dit comment
  lire : 0 = clair hérité, 1 = AES-256-GCM. On n'écrit JAMAIS en clair — sans
  `SECRET_BOX_KEY`, l'enregistrement est refusé. Une ligne héritée est
  rechiffrée dès qu'on la LIT, pas seulement à la prochaine écriture.
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
- **`AssistantPanel` est un TIROIR sous 860 px** (`position: fixed`,
  `translateX(100%)`), ramené par une classe `.open` que RIEN n'applique dans
  le code. Monté tel quel dans une coquille qui lui donne toute la place, il
  part hors écran à droite et la page paraît vide. La prop `embedded` annule ce
  comportement — la passer dès qu'un conteneur gère lui-même la taille.

## Pièges déjà payés

- **Le plan Vercel n'est pas un détail de facturation, c'est une contrainte de
  code.** Un passage Pro → Hobby a bloqué les déploiements une heure, sans
  erreur lisible : Hobby plafonne les fonctions à **60 s** alors que **11
  routes déclarent `maxDuration = 300`**, et n'autorise qu'un cron **quotidien**
  là où `vercel.json` en demande un horaire. Symptôme trompeur : le dépôt est à
  jour, le build passe en local, et l'ancien bundle continue d'être servi — on
  débogue alors du code déjà corrigé. **Vérifier l'état du déploiement AVANT de
  conclure qu'un correctif ne marche pas.** Le tell le moins cher : un attribut
  ajouté dans le même commit (ici un `title`) absent du HTML rendu.
- **Les modèles OpenRouter préfixés `~` sont des ALIAS de redirection**
  (`~z-ai/glm-flash-latest`, `~deepseek/deepseek-v4-flash-latest` — 13 entrées,
  `tokenizer: "Router"`, « always redirects to the latest model »). Mesuré :
  ~24 s avant le premier jeton, **identiques sur deux moteurs sans rapport**,
  sans outil ni recherche — la signature d'une couche partagée, pas du modèle.
  Préférer l'identifiant concret (`deepseek/deepseek-v4-flash`).

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

- `reasoningModelId` est configurable, recommandé par l'assistant, affiché —
  et **jamais lu au moment de générer**. Le brancher, ou le retirer.
- Environ 21 boutons textuels sous 40 px sur `/espace/[id]` (décision de
  densité, proposée et non tranchée).

## Langues

**Lot A fait** : le gent répond dans la langue de son interlocuteur
(`lib/langue.ts`, consigne injectée dans `buildGentSystemPrompt`). La langue du
MESSAGE prime ; `Accept-Language` ne sert qu'au premier tour.

**Lots B à D non faits** — et une contrainte à connaître AVANT de les planifier :
`app/[slug]` occupe la RACINE. Un préfixe de langue (`/en/mon-gent`) entrerait
en collision avec l'espace de noms des slugs et casserait les adresses déjà
diffusées. La détection doit donc passer par cookie et en-tête, sans préfixe —
au prix du référencement multilingue, qui est un vrai renoncement à assumer.

L'orchestrateur du salon n'a PAS reçu la consigne : son format de sortie est
strict (JSON dans un marqueur HTML), et un `bad_marker` rend le salon muet.
À traiter séparément, journaux sous les yeux.

## Hébergement

Vercel, plan **Pro** — les 300 s de `maxDuration` en dépendent (voir les pièges).

**Railway est décidé pour plus tard**, et rien ne s'y oppose : l'audit ne
trouve **aucun couplage à Vercel** — pas de `@vercel/*`, pas de `VERCEL_*`, pas
d'API propriétaire. C'est un Next.js standard (`next build && next start`).
Motif : l'application passe son temps à ATTENDRE un modèle (24 s d'attente pour
0,1 s de calcul) ; un process Node permanent n'a pas de `maxDuration`, quand une
plateforme à fonctions facture et plafonne cette attente. À prévoir alors : les
variables (dont `SECRET_BOX_KEY`), le cron de `vercel.json` vers
`/api/routines/run`, et le DNS. Ce qu'on perd — préversions par branche et CDN
mondial — n'est pas utilisé ici : la boucle de test passe par la production, et
le réseau pèse 100 ms face à 24 s de modèle.

## Le dépôt GitHub

**PUBLIC.** Décision assumée après discussion. Conséquence : le secret scanning
et la push protection sont gratuits (ils deviendraient payants en privé).
Aucun secret n'a jamais été committé — vérifié sur 241 commits.

`LICENSE` pose une réserve de droits explicite. Elle EXCLUT les composants
tiers : `public/pdfjs/pdf.worker.min.mjs` reste sous Apache 2.0 (Mozilla), et
les dépendances npm gardent la leur. Ne pas élargir la réserve à ces
fichiers — ce serait juridiquement faux.

## Configuration hors dépôt

`SECRET_BOX_KEY` : sa perte rend **illisibles** toutes les clés OpenRouter
enregistrées par les créateurs. Elle doit vivre ailleurs que sur Vercel.

**BREVO N'EST PAS CONFIGURÉ** en production. Quatre fonctionnalités en
dépendent et ne font donc rien : invitation par e-mail, notification de
signalement, notification d'usage par un invité, note de routine. Les échecs
sont désormais journalisés (tag `getgents:email`) et le panneau de partage
prévient que l'accès a été accordé mais que l'e-mail n'est pas parti. Pour
l'activer : `BREVO_API_KEY` et `BREVO_SENDER_EMAIL`, ET l'authentification du
domaine chez Brevo — sans elle, les envois sont refusés ou finissent en
indésirables.

Les inscriptions sont fermées **chez Supabase** (Authentication → Providers →
Email). `lib/inscriptions.ts` ne fait que rendre l'interface honnête — il ne
ferme rien à lui seul.
