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
  par essai, et une boucle `curl` d'attente. Même piège avec une boucle sur
  `/proc` qui filtre la ligne de commande : le shell qui l'exécute contient le
  motif. Exclure `$$` et les lignes qui commencent par `/bin/bash`.
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

- **Le raisonnement n'est PAS configurable, et c'est délibéré.**
  `supportsReasoningStream` l'active pour tout modèle `anthropic/claude*` ou
  `openai/o*` — écrite comme garde d'erreur (l'envoyer à Mistral casse), elle
  sert de politique. `reasoningModelId` a été RETIRÉ de l'interface plutôt que
  branché : mesuré, le modèle ne raisonne que sur les questions qui le méritent
  (0 s sur un tour simple, 6,6 s sur un tour complexe). Un réglage aurait coûté
  un chantier pour un défaut que personne n'a. Ne pas le réintroduire sans
  mesure contraire.

- **La décision de produire un artefact a UNE seule source** :
  `consigneArtefacts` (`lib/artefactSignal.ts`), réglée par le créateur
  (`frequenceArtefacts` : discret / équilibré / proactif). Deux consignes
  contraires ont coexisté dans le même prompt (« systématiquement » contre
  « uniquement quand le contenu s'y prête »), et une troisième se cachait dans
  la consigne du RÉSUMÉ DE PROFIL (« dès qu'on parle d'une personne,
  propose ») — sur un gent vitrine, un artefact à chaque tour. **Les consignes
  de format (dashboard, profil…) choisissent la FORME, jamais la fréquence** ;
  un test (`decisionArtefact.test.ts`) le garde. La mémoire des verdicts
  voyage DANS l'historique (`historiquePourModele`), pas dans le prompt
  système : il est construit par le navigateur sur les deux chemins, donc
  aucune route n'a à changer. La mesure (`getgents:artefact`) n'est QUE dans
  les journaux Vercel, qui ne se gardent pas : pour des chiffres sur la durée,
  il faudra une table ou un drain de journaux.
- **Un artefact est une suite de BLOCS, pas l'un de 7 types.** Le modèle
  n'apprend qu'un format, `{title, blocks}`, pris dans un vocabulaire FERMÉ
  (`VOCABULAIRE_BLOCS`, `lib/dashboardArtefact.ts`) : jamais de HTML ni de
  code libre — c'est ce qui protège les pages publiques du XSS stocké. Le
  « type » affiché est DÉDUIT (`formeDeduite`). Les formes historiques
  (`kind: report/checklist/…`) restent LUES, sans migration. Chaque bloc a un
  `id` stable : c'est le socle des retouches ciblées et des versions, étape
  suivante. Tout code qui parcourt les blocs doit traiter chaque type — deux
  conversions jetaient la frise sans bruit (canevas d'aperçu, e-mail).
- **Retoucher = des OPÉRATIONS sur des blocs, jamais une régénération.**
  `{cible, operations:[modifier|ajouter|supprimer|deplacer]}`
  (`lib/operationsBlocs.ts`) : tout bloc non visé reste identique, un bloc
  introuvable est ignoré ET compté, jamais deviné. Le modèle voit les
  artefacts gardés et leurs `id` dans un bloc `[ESPACE]…[/ESPACE]` joint au
  DERNIER message utilisateur — pas au prompt système, que le serveur
  assemble sur un lien public sans connaître ce que le visiteur a gardé ; le
  dernier, parce que la route ne transmet que 20 messages. Coût : jusqu'à
  8 000 caractères par tour quand des artefacts sont gardés. Les artefacts
  historiques (checklist, graphique, carte, rapport) sont convertis en blocs
  au vol (`versBlocs`) : tous sont retouchables. Chaque changement range
  l'état précédent (`versions`, 8 au plus) ; restaurer est lui-même un
  changement — rien n'est jamais détruit.
- **« Réponse ou artefact » se choisit APRÈS, jamais avant.** Poser la
  question avant chaque réponse coûterait un appel au modèle de plus à chaque
  tour. Le gent qui juge un artefact utile sans le produire émet
  `<!--ARTEFACT_POSSIBLE-->` → bouton « En faire un artefact ». Quand il en
  produit un, son texte se réduit à UNE phrase (plus de double rédaction) ;
  la carte d'échec offre alors « Répondre dans le fil », sinon un artefact
  perdu laisserait l'utilisateur sans rien. Deux demandes depuis le dernier
  « réponds dans le fil » = préférence `[PRÉFÉRENCE]`, déduite de
  l'historique, sans état stocké.
- **Un ajout du même genre se FOND dans le bloc existant** (`cibleDeFusion`,
  `lib/operationsBlocs.ts`). Vécu : « ajoute Maltem avant Cegedim » a créé une
  seconde frise « Parcours ». La consigne demande de modifier le bloc ; le
  garde-fou rattrape le modèle qui ne le fait pas, en tête ou en fin selon où
  il voulait placer le bloc.
- **Un artefact gardé s'ouvre en PLEINE PAGE** (outils, onglet, PDF) ; seul
  l'aperçu en attente de verdict garde sa fenêtre. **Outils** : édition à la
  main sur un brouillon, repassé par `parseDashboard` à l'enregistrement, qui
  crée une version. Couleur d'accent dans une palette FERMÉE (`ACCENTS`) —
  jamais de couleur libre, ce serait du CSS arbitraire sur une page publique.
- **« Ouvrir dans un onglet »** : `/artefact/<id>` (slug réservé) reçoit une
  COPIE par le localStorage et y renvoie ses modifications ; l'onglet
  d'origine les applique sur l'événement `storage`, qui ne se déclenche que
  dans les AUTRES onglets. Copies purgées après 7 jours. Rien côté serveur :
  l'onglet ne fonctionne que dans le navigateur qui l'a ouvert.
- **`artefactsModifiables`** (studio, faux par défaut) : autorise les
  VISITEURS à éditer et restaurer leurs artefacts. Chacun modifie SA copie,
  dans son navigateur — ce n'est PAS de la co-édition, qui exigera des
  artefacts stockés côté serveur.
- **Facturation LLM** : `lib/server/openRouterKey.ts` est le SEUL endroit qui
  lit `OPENROUTER_API_KEY`. Un `ContexteLlm` explicite est passé en paramètre,
  jamais un `AsyncLocalStorage` : un chemin oublié serait un bug de
  facturation silencieux, le compilateur doit le refuser. Un test de
  discipline garde l'invariant.
- **Co-édition d'un artefact : chantier du mode COLLABORATIF, pas encore
  fait.** Aujourd'hui, `artefactsModifiables` laisse chaque visiteur retoucher
  SA copie (navigateur). Travailler à plusieurs sur le même artefact exige de
  le stocker côté serveur — à traiter avec le salon, pas avant.
- **Salon collaboratif** : le modèle dépend de la PHASE
  (`lib/collabModels.ts`) — un modèle rapide en collecte, celui du créateur en
  propositions. Mesuré : 82-91 % du temps d'un tick est l'appel au modèle.
- **Créer et configurer ne partagent plus aucune entrée de menu.** Le rail a
  deux étages : GLOBAL (« + Nouveau gent », Accueil, Mes gents) et, sous le
  nom du gent ouvert, SES réglages : Configurer (dont les formats Mini App,
  Visionneuse, Event Manager, sous un filet — une section « Formats » à part
  se lisait comme une information) puis Diffuser et suivre. L'ancien menu « Créer » créait un gent depuis la liste et changeait
  d'onglet depuis un gent : une fois sur deux, on voulait régler son gent et
  on en fabriquait un. Créer passe par UN formulaire (`NouveauGentDialog` →
  `creerGent`, `lib/builderDraftStorage.ts`) : une phrase facultative et un
  format, qui est ACTIVÉ. Un gent s'ouvre sur « Prompt & Modèle »
  (`ONGLET_PAR_DEFAUT`) ; l'écran « que voulez-vous construire ? »
  (AccueilTab) est supprimé — il posait la question de la création à un gent
  déjà créé. Ne rien remettre qui crée depuis une entrée de navigation.
- **Preview = ce que voit un VISITEUR, pas l'espace du créateur.** Le bouton
  ouvre `/apercu/<id>` (privé, slug réservé) : l'écran du lien
  (`SharedGentShell`), la consigne « invité » (`variant: "sharedLink"`), sur
  la version de TRAVAIL projetée par `espacePourApercu` — fil vierge, ni
  artefacts gardés, ni mémoire, ni fichiers, ni profil. Il ouvrait
  `/espace/<id>` : autre coquille, et un gent qui tenait compte de tous les
  essais précédents — il ne répondait donc pas comme devant un inconnu. Le
  mode `apercu` du fournisseur ne relit ni ne RÉÉCRIT rien : un fil d'essai
  écraserait la version de travail. Les appels passent par les routes du
  créateur, cette version n'étant pas en base. `/espace/<id>` reste l'usage
  personnel du gent, plus un banc d'essai.
- **Ouvrir un onglet ne modifie JAMAIS le gent.** L'onglet Event Manager
  posait son gabarit à l'ouverture sur tout gent sans salon : prompt, nom et
  emblème d'un gent conversationnel étaient remplacés au simple passage.
  L'activation est un clic, qui garde le prompt écrit et le nom choisi.
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

- **Un gent public en 404 avec des données intactes = `SUPABASE_SERVICE_ROLE_KEY`
  absente ou périmée sur Vercel.** Vécu : la ligne `published_gents` était
  correcte (slug, `visibility = public`, versions renseignées) et la page
  tombait quand même. `lireGentPublic` confondait une ERREUR d'accès avec
  « rien trouvé » — même 404, aucune trace. Depuis, `event: gent_introuvable`
  nomme la cause (`supabase_non_configure` / `erreur_supabase` /
  `aucune_ligne_publique` / `ligne_sans_contenu`) : **lire ce journal AVANT
  d'interroger la base.** Deux rappels qui vont avec : la clé de service a été
  renouvelée après la faille d'exfiltration du prototype — la régénérer côté
  Supabase sans la reporter sur Vercel reproduit exactement ce symptôme ; et
  `NEXT_PUBLIC_SUPABASE_URL` est figée À LA CONSTRUCTION, donc toute correction
  exige un REDÉPLOIEMENT, pas un redémarrage.
- **Gmail « Bad Request — reconnecter le compte Google » = `invalid_grant`.**
  Google refuse le jeton de renouvellement : accès révoqué, mot de passe
  changé, ou — cause la plus probable pour un projet perso — écran de
  consentement OAuth en statut « Test », dont les jetons meurent au bout de
  7 JOURS. Seule la description (« Bad Request ») était affichée. Depuis, le
  message nomme la cause, `getgents:oauth refresh_revoque` le journalise, et
  le jeton mort est SUPPRIMÉ pour que l'onglet Connecteurs cesse d'afficher
  « connecté ». Reconnecter répare ; passer l'application en « Production »
  (Google Cloud → écran de consentement OAuth) empêche la récidive.
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

**Cloudflare Workers a été essayé, puis DÉBRANCHÉ.** L'intégration ajoutait un
contrôle à chaque PR, et ce contrôle échouait toujours : le dépôt n'a ni
`wrangler.toml`, ni adaptateur (`@opennextjs/cloudflare`), ni la moindre
dépendance Cloudflare — c'est un Next.js standard, déployé par Vercel. Rien à
réparer, donc, mais il fallait la couper plutôt que la tolérer : **un contrôle
qui échoue toujours ne signale plus rien**, et on apprend à passer outre le
rouge le jour où il est vrai. Ne pas la rebrancher sans adaptateur.

**Deux avis de sécurité restent ouverts**, et ils exigent Next 16 — deux
majeures d'écart. « DoS via Image Optimizer » ne vise que les applications
**auto-hébergées** : sur Vercel l'optimiseur est celui de la plateforme, donc
l'avis ne s'applique pas. **Il s'appliquerait sur Railway** — à traiter AVANT
cette bascule, pas après. L'autre (postcss, XSS à la sérialisation CSS) arrive
par Next et ne joue qu'à la construction, sur nos propres feuilles de style.

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
