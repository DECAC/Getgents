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
- **« Garder en note » = COPIE FIDÈLE, sans modèle.** Le bouton, à côté de
  « Copier » sous chaque réponse, transforme la réponse TELLE QUELLE en
  artefact (`noteDepuisReponse`, `lib/noteDepuisReponse.ts`) : titres → blocs
  `heading`, tableaux → `table`, le reste en markdown dans des blocs `text`.
  Instantané et gratuit ; garder une réponse, c'est vouloir CE texte, pas une
  réécriture qui pourrait résumer ou inventer. Aucun HTML n'entre dans la
  note (vocabulaire fermé) ; `&lt;`/`&gt;` restent des entités dans le
  markdown pour qu'un « <script> » écrit en toutes lettres reste lisible.
  Choisie parmi trois pistes (maquette : bouton, surlignage d'un passage,
  assemblage de plusieurs réponses) : le surlignage vient ensuite, il
  réutilise la même conversion. **« Mettre en forme »** (vue pleine page
  d'une note) : un appel au modèle (`/api/artefact/mise-en-forme`, consigne
  « ne rien ajouter, ne rien perdre »), sortie repassée par le vocabulaire
  fermé, rangée en NOUVELLE VERSION — la copie fidèle reste restaurable.
  Réservé aux comptes connectés : le visiteur d'un lien n'a personne à qui
  facturer l'appel.
- **« En savoir plus » sur un passage SURLIGNÉ** d'une réponse du gent
  (`BulleSelection`, `lib/enSavoirPlus.ts`) : une bulle propose d'approfondir,
  et part comme un message ordinaire qui cite le passage — le gent y répond
  avec ses outils, aucune route nouvelle. La bulle n'apparaît que si la
  sélection tient dans UNE réponse du gent (`data-reponse-gent`) ; rendue en
  portail (le panneau est un tiroir transformé sur téléphone), SOUS la
  sélection sur écran tactile, où le menu natif occupe le dessus. La même
  bulle accueillera « En faire une note » (surlignage → note).
- **« Le Prompteur »** (format de gent, 30/09 ; `lib/prompteur.ts`,
  `components/prompteur/Prompteur.tsx`) : la conversation écrit une capsule
  vidéo LinkedIn, le prompteur la fait lire au rythme de la voix et
  l'enregistre. Le gent encadre chaque version COMPLÈTE du texte à dire
  entre `<!--SCRIPT-->` et `<!--/SCRIPT-->` (consigne `consignePrompteur`,
  jointe par `buildGentSystemPrompt`, FORME seulement) ; les marqueurs
  partent, le texte reste dans la réponse, et `m.script` porte la dernière
  version. Le bouton « Prompteur » sous la réponse VALIDE : copie fidèle
  gardée (type « Script », `lancerPrompteur`) puis lecture — le gent ne
  décide jamais de l'artefact. Suivi : « voix » (reconnaissance vocale du
  navigateur + `alignerPosition`, prudente : deux mots consécutifs ou un mot
  long, jamais en arrière), repli « rythme » (niveau du micro : avance quand
  on parle) et « régulier ». Enregistrement MediaRecorder dans le
  navigateur, recadré par un canevas (carré par défaut, vertical sur
  téléphone), MP4 sinon WebM, téléchargé — RIEN côté serveur. Vérifié au
  navigateur avec caméra et micro SIMULÉS ; le suivi « voix » réel (Google
  pour Chrome, Apple pour Safari) ne peut pas l'être d'ici. **Piège payé :
  `Permissions-Policy` interdisait `camera` et `microphone` sur tout le
  site** (`next.config.mjs`) — getUserMedia échouait avant même de demander
  l'accord. Désormais `(self)`. **Premier essai sur iPhone (30/09) : écran
  figé au clic, et aucune trace du texte à la réouverture.** Non reproduit
  ici (pas de WebKit). Trois parades : le script est gardé AVANT
  l'ouverture (prompteur ouvert au tour suivant, après l'enregistrement de
  l'espace) ; une limite d'erreur (`LimitePrompteur`) affiche le détail au
  lieu d'emporter la page ; sur téléphone, les commandes passent EN HAUT —
  en bas, la barre flottante de Safari récent les recouvrait. L'utilisateur
  est sur **Chrome iPhone** : même moteur que Safari (règle d'Apple), donc
  même reconnaissance vocale (Apple) et même barre flottante. Sur iPhone, la
  vidéo s'enregistre par la feuille de partage (« Enregistrer / partager »,
  `navigator.share` avec fichier → Photos, LinkedIn), plus naturelle qu'un
  téléchargement qui part dans Fichiers. **Deuxième essai réel (30/09,
  Chrome iPhone)** : caméra OK une fois autorisée dans l'app Réglages ;
  reconnaissance vocale refusée → repli « rythme », qui prenait du RETARD
  au débit naturel. Cause : il avançait à la vitesse moyenne (pauses
  comprises) pendant la parole seule. Désormais `FACTEUR_ARTICULATION`
  (×1,3 en parole), maintien de 500 ms entre les mots, 160 mots/min par
  défaut, et toucher un mot en pleine lecture corrige la vitesse d'un
  dixième (`vitesseCorrigee`). La vignette se réduit en pastille pendant la
  lecture, les réglages se replient derrière ⚙, l'en-tête tient sur une
  ligne, les messages s'effacent seuls : l'écran est au texte. Micro-cravate
  (30/09) : le prompteur prenait le micro retenu par le système, sans le
  dire. Les réglages ⚙ montrent désormais le micro ACTIF (nom de la piste) et
  proposent les autres dès qu'il y en a plusieurs (`enumerateDevices`, relu
  au branchement) ; en changer relance le flux avec `deviceId` exact. Sur
  iPhone, seul le micro de l'iPhone est listé : une page web n'a que ce
  que le système lui présente (micro Bluetooth, jack caméra TRS…) — test à
  faire dans l'app Dictaphone. Caméra ET micro sont désormais choisis dans ⚙
  (`choixRef`), lignes toujours présentes : elles n'existaient que caméra
  DÉMARRÉE, donc disparaissaient quand il fallait en changer (PC, caméra
  occupée par une visio → `NotReadableError`, message dédié). **Test son**
  (⚙, `TestSon`) : vu-mètre en continu (échelle en dB, `niveauAffiche`) et
  une phrase de 5 s enregistrée PUIS rejouée, sur la même piste que la vidéo
  (mêmes traitements) ; `verdictSon` oriente (muet, faible, saturé), l'oreille
  juge. **Définition sur PC (30/09, « basse déf »)** : cause NON établie
  d'ici (caméra simulée en 1080p). Trois corrections et un témoin : H.264
  High 4.0 avant le Baseline 3.0 (profil de définition STANDARD, 720×576 au
  plus), débit selon la taille (`debitVideo`, 3 à 12 Mb/s au lieu de 5 fixes),
  webcam poussée à sa meilleure définition par `applyConstraints` (pas sur
  iPhone), et ⚙ AFFICHE « Image l×h → capsule l×h » — le témoin qui tranche.
  Un vertical 9:16 tiré d'une webcam paysage 1080p fait 608×1080 : c'est la
  caméra, pas l'encodage. **Carte « Votre capsule est prête » sans
  sortie** (02/10, iPhone) : elle couvre tout l'écran, en-tête et son ×
  compris — on ne pouvait plus quitter le prompteur. Elle a désormais son
  propre ×, et fermer une prise ni téléchargée ni partagée demande
  confirmation (elle n'existe que dans le navigateur). Tout calque plein
  écran doit porter sa propre sortie.
- **Habillage d'une capsule** (02/10 ; `lib/habillage.ts`,
  `lib/musiqueHabillage.ts`, `components/habillage/`) : depuis la carte
  « Votre capsule est prête », un atelier ajoute sous-titres, effets et
  musique, avec 5 STYLES qui règlent l'image ET le son, retouchables onglet
  par onglet. Ce n'est PAS un artefact au sens des blocs : la vidéo n'existe
  que dans le navigateur (aucun stockage serveur), seul le style choisi est
  mémorisé (localStorage, par appareil). **Sous-titres sans transcription** :
  le texte est le script ; on repère la parole dans la piste son
  (`segmentsParole`, seuil adaptatif) et on y répartit les mots au poids
  syllabique (`alignerMots`). Pas de service de reconnaissance à payer ni à
  autoriser — mais un mot improvisé n'apparaît pas : chaque sous-titre
  s'édite, et un curseur de calage décale l'ensemble. Ponctuation française
  (« demain ? ») rattachée au mot (`motsDuTexte`) : sinon « ? » faisait un
  sous-titre à lui seul. **Musiques GÉNÉRÉES** (Web Audio hors temps réel,
  `synthese.ts`) : libres de droits par construction, mais ce sont des fonds
  sonores simples — NON écoutées depuis l'agent, seulement mesurées
  (niveau sous la voix, pas de saturation). Musique importée possible,
  droits à la charge de l'utilisateur. La musique baisse sous la voix
  (`enveloppeMusique`). **Export en TEMPS RÉEL** : la vidéo est rejouée dans
  un canevas (`dessiner`, même fonction que l'aperçu) et réenregistrée avec
  voix + musique mêlées ; un onglet caché arrête l'export (le canevas ne
  s'anime plus). Un limiteur protège le mélange : sans lui, la crête
  mesurée était 1,00. Vérifié au navigateur avec une voix SIMULÉE (fichier
  de phrases et de pauses) ; non vérifié sur iPhone (`createMediaElementSource`,
  `ctx.filter` absent de Safari ancien → étalonnage sauté). Piège de test :
  la CSP (`connect-src`) interdit `fetch` sur une adresse `blob:` — l'atelier
  lit le Blob directement ; un test qui relit le fichier exporté doit
  contourner la CSP (`bypassCSP`). Le prompteur ignore ses raccourcis tant
  que l'atelier est ouvert : Échap y aurait fermé le prompteur, et la prise
  avec.
- **« Ce qu'il sait de moi »** (espace personnel, `MemoireGent`) : la
  mémoire du gent (`memory`, usage, `memoryNote`) écrite par l'utilisateur —
  métier, situation, ton — jointe à chaque tour, 4 000 caractères au plus.
  Le champ existait depuis longtemps mais son écran vivait dans l'ancienne
  coquille : plus aucun moyen de le remplir. Par gent, pas par compte : une
  mémoire COMMUNE à tous les gents exigera un stockage par compte (table et
  migration).
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
- **L'espace personnel (`/espace/<id>`) tourne sur la version DIFFUSÉE**, avec
  l'usage (conversations, notes, mémoire) de la version de travail —
  `composerVersionPersonnelle` pour lire, `fusionnerUsage` pour écrire
  (`lib/versionPersonnelle.ts`). Il tournait sur la version de travail : un
  essai raté dans le studio cassait l'usage quotidien. L'écriture ne reporte
  QUE l'usage : écrire l'espace entier réécrirait la configuration diffusée
  par-dessus le travail en cours du studio. Les versions diffusées viennent de
  `GET /api/gents` (`diffuses`), en mémoire seulement (quota du cache local) ;
  hors ligne, l'espace retombe sur la version de travail. Un gent jamais
  diffusé tourne sur sa version de travail, et l'en-tête le dit.
- **Amorces tirées de la boîte mail** (gent Gmail, espace personnel) :
  `/api/amorces/gmail`, PROPRIÉTAIRE seulement, lit l'expéditeur et l'objet
  des messages des 7 derniers jours — jamais le corps — et un modèle rapide
  en tire 4 questions (`lib/amorcesContextuelles.ts`), renouvelées toutes les
  6 h. Rangées dans `amorcesContextuelles` (usage), JAMAIS dans `starters`
  que reçoivent les visiteurs ; retirées de l'aperçu, de la projection
  publique et de la version diffusée. Un formulaire d'amorce (« jump form »)
  les masque : il se retire désormais dans Configurer → Options. Produites à
  l'OUVERTURE de l'espace (effet du fournisseur), pas à l'affichage des
  bulles : celles-ci ne s'affichent que sur une conversation vide, et un
  espace rouvert sur son dernier échange ne les produisait jamais. Réglage
  `amorcesAuto` (studio, section Questions d'amorce ; absent = activé) avec
  « Tester maintenant », qui montre les questions ou la cause de l'échec.
  Dans la coquille des visiteurs (et de l'espace personnel), les amorces
  vivent dans la CONVERSATION, sur tout fil vide : le volet ne les montre
  jamais. Réservées au téléphone et à la bande, elles manquaient après
  « Nouvel échange » dès que le volet était ouvert sur des notes gardées.
- **Diffusion PRIVÉE** (studio → Diffusion, `diffusionPrivee`) : le gent est
  réservé à son créateur, dans GetSpace, à une adresse lisible
  `/espace/<adressePrivee>` — sans `draft-…`, résolue dans le navigateur
  parmi les gents du compte (`lib/diffusionPrivee.ts`) ; ouvert par
  `/espace/draft-…`, la barre d'adresse est réécrite. Tous les autres modes
  sont fermés CÔTÉ SERVEUR (`gentPrive`, `espacePourVisiteur`,
  lib/server/gentVersions.ts) : page publique, liens et salon, WhatsApp
  entrant, invitations suspendues (`requireGentAccess`), création de
  publication/lien/invitation refusée (409). Rien n'est supprimé : décocher
  rouvre tout tel quel. La case s'applique TOUT DE SUITE dans les deux sens :
  la cocher écrit la version de travail, qui fait foi dès qu'elle porte le
  réglage (booléen explicite, `false` compris) — la version diffusée ne
  décide que si la version de travail n'en dit rien. L'espace personnel LIT
  ce réglage sur la version de travail mais ne le RÉÉCRIT jamais (absent de
  `fusionnerUsage`). La note de routine reste envoyée : c'est un envoi, pas
  un accès au gent.
- **L'espace personnel a la MÊME interface que les visiteurs**
  (`SharedGentBody` avec `personnelDe`) : retour « Mes gents », « Ouvrir
  dans GetStudio », version affichée. L'ancienne coquille (rail des gents,
  `Center`, `Aside`, `ResvModal`) n'est plus servie : ces composants sont du
  code mort, à retirer dans un passage dédié.
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
- **Des intégrations qui défilent puis une bulle VIDE = fonction coupée à
  300 s avant que le modèle n'écrive.** La boucle d'outils pouvait
  consommer tout le temps en appels Gmail. Depuis : budget de 170 s pour les
  outils (`lib/boucleOutils.ts`), après quoi le modèle rédige avec ce qu'il a
  (`getgents:chat budget_outils_atteint`), et une réponse sans rien de
  visible affiche `MESSAGE_REPONSE_VIDE` au lieu du silence. Le budget se
  vérifie au DÉBUT d'un tour : un tour d'outils très long peut encore
  déborder. Pour diagnostiquer, lire `getgents:chat tour_outils` (tours,
  outils appelés, `finishReason`, longueur du contenu).
- **Retirer les outils ne dit pas au modèle de conclure.** Vécu (Claude,
  bilan Gmail sur trois expéditeurs) : cinq tours d'outils, puis un dernier
  tour sans outils → `finishReason: stop`, 0 caractère. Le visiteur restait
  devant « je cherche aussi… », sans suite, et le repli ne partait pas
  puisqu'une phrase avait déjà été envoyée. Depuis : `CONSIGNE_DERNIER_TOUR`
  est jointe au tour sans outils, 8 tours au lieu de 6 (le budget de TEMPS
  protège déjà des 300 s), et une fin sans texte final envoie
  `MESSAGE_REPONSE_FINALE_MANQUANTE` (`getgents:chat reponse_finale_vide`).
- **Le modèle testé n'était pas toujours celui affiché.** Deux défauts
  coexistaient : le sélecteur du studio montrait Kimi K3 (premier du
  catalogue) quand rien n'était choisi, pendant que le gent tournait sur
  Claude Sonnet 5 ; et la clé plateforme remplace EN SILENCE un modèle hors
  catalogue (`resolveModelId`). Depuis : un seul défaut
  (`MODELE_CHAT_PAR_DEFAUT`, `lib/modeleConversation.ts`), le modèle réel
  est écrit dans le bandeau de l'aperçu et le rapport, et
  `getgents:chat` porte `gentId` et `modeleDemande` quand il y a eu
  substitution. Rappel : l'aperçu est une PHOTO prise au clic sur Preview —
  changer le modèle ensuite dans le studio n'agit pas sur un aperçu ouvert.
  **Remplacer un modèle ≠ le retirer du catalogue.** Sur la clé plateforme,
  un identifiant inconnu retombe sur `DEFAULT_CHAT_MODEL_ID` = Kimi K3 (le
  modèle du builder), PAS sur le défaut des gents : retirer Sonnet 5 aurait
  basculé en silence tous les gents réglés dessus vers Kimi. D'où
  `MODELES_REMPLACES` (`lib/modeleConversation.ts`, 29/09 : Sonnet 5 →
  Sonnet 5.5, nouveau défaut) : chaque lecture d'un modèle passe par
  `modeleActuel` (moteur de chat toutes clés, `resolveModelId`, salon,
  budget de documents, libellés, proposition de l'assistant du builder), et
  le studio réécrit le réglage du gent à la lecture (`migrerModelesDraft`).
  Pour le prochain remplacement : une ligne dans cette table, et vérifier
  l'identifiant sur `openrouter.ai/api/v1/models` (joignable d'ici).
- **Des gents impossibles à supprimer = les DÉMONSTRATIONS du code.**
  `GENT_DRAFTS` (voyage, succession, toilettes publiques, Radar Emploi,
  Élysée) était chargé dans l'état du studio, puis ENREGISTRÉ par sa
  persistance automatique — sur le serveur — comme des gents du compte, à
  chaque ouverture ; « Mes gents » les listait aussi d'office. Depuis, ni
  `seedDrafts` ni `listVisibleDrafts` ne les incluent, et GetSpace écarte les
  espaces de démonstration (`INITIAL_ESPACES`) dès que les gents du compte
  sont connus. Ils restent dans le code pour les tests. Même endroit : la
  persistance écrivait le cache sous la clé COMMUNE à tous les comptes ; elle
  passe par `writeStoredDrafts` (clé du compte) et efface l'ancienne copie.
  **Ils sont REVENUS après ce correctif** : la synchronisation renvoyait au
  serveur TOUT gent du cache local absent du serveur (« publié hors ligne »).
  Le cache d'un autre navigateur (autre machine, téléphone) les recréait donc
  à chaque ouverture — comme n'importe quel gent supprimé ailleurs. Depuis
  (`reconcilier`, `lib/reconciliation.ts`, studio ET GetSpace) : absent du
  serveur APRÈS y avoir été = supprimé, écarté ; seul un gent que le serveur
  n'a jamais confirmé est envoyé. La liste des confirmés (`…:connus`, clé du
  compte) n'est CRÉÉE que par une liste du serveur ; un vieux cache sans
  liste n'envoie rien. Les identifiants de démonstration ne sont PAS
  bloqués : un gent réellement utilisé (Élysée) cesserait d'être enregistré.
- **Un gent Gmail qui « n'a pas le contenu » d'une newsletter.** Vécu sur
  MyClaw et The Batch : trois défauts empilés. `gmail_get_message` ne lisait
  que la partie `text/plain`, VIDE ou réduite à « voir en ligne » dans une
  newsletter HTML — le gent résumait l'aperçu. `gmail_search` rendait des
  IDENTIFIANTS seuls — le gent annonçait des newsletters « qui parlent d'IA »
  sans en avoir lu une. Et les résultats d'outils ne voyagent PAS d'un tour à
  l'autre (l'historique n'a que le texte) : à « plus de détails ? », il
  répondait qu'il n'avait rien. Depuis : corps tiré du HTML
  (`corpsDuMessage`, `lib/gmailContenu.ts`), recherche enrichie
  d'expéditeur/objet/date/aperçu, conseil d'ÉLARGIR joint à une recherche
  vide (la consigne du prompt seule ne suffisait pas), et consigne de RELIRE
  un e-mail pour une question de suivi. Même le conseil joint au résultat n'a
  pas suffi (journaux du 25/09, Gemini 2.5 Flash) : tour 0 sans aucun outil
  sur « la newsletter The Batch de cette semaine », puis une recherche vide
  conclue en 88 caractères. D'où deux gestes qui ne dépendent PLUS du
  modèle : le premier tour IMPOSE `gmail_search` quand la question porte sur
  la boîte (`demandePorteSurLaBoite` ; `tool_choice`, repli sans forçage si
  le fournisseur refuse — `forcage_outil_refuse` ; jamais avec le
  raisonnement, qu'Anthropic refuse avec un outil imposé), et le SERVEUR
  élargit une recherche vide (`requetesElargies` ; `getgents:gmail
  recherche`). Non vérifié en réel depuis l'agent : ni Gmail ni clé
  OpenRouter ici — lire `force` dans `tour_outils`.
  Les MOTS-CLÉS ne suffisaient pas (26/09) : « Résume-moi les deux VERBATIM
  de Dialange » n'en contenait aucun, et Gemini a répondu « je n'ai pas
  trouvé d'e-mails de Dialange » SANS avoir cherché — une recherche inventée.
  Depuis (`doitImposerRechercheMail`) : sur un gent dont Gmail est le SEUL
  outil, la recherche est imposée à toute question sauf une politesse
  (« merci », « ok »…) ; le filtre par mots-clés ne sert plus qu'aux gents
  qui ont d'autres outils. Coût : 1 à 3 s par question. VÉRIFIÉ en
  production le 26/09 par l'utilisateur (question Dialange rejouée).
- **Une question de confirmation PERD le message trouvé.** Vécu (01/10,
  « Résume le dernier mail de Décibels ») : la recherche rend UN message, le
  gent affiche expéditeur et objet puis demande « est-ce celui-ci ? ».
  L'utilisateur confirme — et le gent ne le retrouve plus. Les résultats
  d'outils ne voyagent PAS d'un tour à l'autre : l'identifiant avait disparu,
  et il a cherché l'objet au caractère près (`[TEST] Décibels #7 | …`), que
  Gmail ne rend jamais. Deux correctifs, et une cause de fond qui reste.
  (1) La consigne jointe aux résultats dépend désormais du NOMBRE : un seul
  message → « lis-le maintenant, ne demande pas confirmation » ; plusieurs →
  lire le plus probable dans le même tour avant de faire choisir.
  (2) `requetesElargies` n'élargissait pas vraiment : ses deux barreaux ne
  retiraient que des OPÉRATEURS, en gardant guillemets et ponctuation — le
  repli était la même phrase introuvable. Deux barreaux ajoutés : sans
  ponctuation, puis les deux mots les plus DISTINCTIFS (`motsDistinctifs` :
  noms propres d'abord, puis les plus longs, sans trait d'union ni nombre —
  ici « Décibels Conseil »), et en tout dernier recours UN seul mot
  (« Décibels ») : le second mot peut venir du nom affiché de l'expéditeur,
  pas forcément indexé. Gmail joint par ET, donc retirer un mot élargit.
  La requête du tour 2 est RECONSTITUÉE d'après le texte du gent, pas lue :
  le journal `getgents:gmail recherche` (`requete`, `requeteElargie`) tranche.
  **La cause de fond n'est pas corrigée** : rien ne transporte les résultats
  d'outils d'un tour au suivant. Le jour où il faudra la traiter, le modèle
  existe déjà — le bloc `[ESPACE]` joint au DERNIER message utilisateur
  (`avecContexteEspace`, `lib/historiqueModele.ts`) ; il faudra que le
  serveur renvoie les résultats au client, qui ne garde aujourd'hui que le
  détail des appels EN ÉCHEC (`toolDetail`).
- **getgents.ai « tourne sans fin » = Supabase qui ne répond pas.** Vécu
  (29/09), sans aucun déploiement depuis trois jours. Le middleware demande à
  Supabase qui est connecté, à CHAQUE page, et attendait sans limite : un
  utilisateur CONNECTÉ restait devant une page blanche (un anonyme n'a pas
  de session, donc pas d'appel — le test le plus rapide est une fenêtre de
  navigation privée). Reproduit ici avec un serveur muet : plus de 45 s sans
  réponse. Depuis : tout appel d'authentification est borné à 6 s
  (`fetchAvecDelai`, `lib/delaiFetch.ts`, dans `createAuthClient`), et le
  middleware répond 503 « Le service de connexion ne répond pas » sur une
  page privée (`getgents:auth supabase_injoignable`) au lieu de renvoyer vers
  /connexion, qui échouerait aussi. Ça rend la panne VISIBLE, pas réparée :
  la cause est chez Supabase (projet en pause, incident) — tableau de bord
  Supabase d'abord.
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
