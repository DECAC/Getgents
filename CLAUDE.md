# Getgents — mémoire du projet

Ce fichier est lu au démarrage de chaque session. Il existe parce qu'une
session n'a aucun souvenir de la précédente : ce qui n'est pas écrit ici est
perdu, et se redécouvre au prix d'une demi-journée.

Il consigne ce qui ne se déduit PAS du code : les décisions et leurs raisons,
les dettes assumées, et les pièges qui ont déjà coûté cher.

## Le projet

Plateforme de création d'assistants (« gents »), dont seule la partie
« Getgents Pages » est ouverte au public. Next.js 15 App Router (React 19),
français partout — code, commentaires, commits, interface. CSS Modules et
`styles/tokens.css`, jamais Tailwind. Supabase pour la base et
l'authentification. Déploiement Vercel depuis `main`.

Éditeur : un particulier, à titre **personnel et non professionnel** —
il n'y a **pas de société**. **Son nom n'apparaît NULLE PART sur le site
(18/11, demande de l'éditeur)**, sauf dans les CRÉDITS de /a-propos (`CREDITS`,
`lib/legal.ts`, avec son profil LinkedIn) : régime ANONYME de la LCEN
(identité communiquée à l'hébergeur). Un test (`legal.test.ts`) refuse le nom
dans `app/`, `components/`, `public/`, `supabase/templates/`. **Ce régime
tombe dès que le service ENCAISSE** : il faut alors des mentions
professionnelles (identité, adresse, SIREN). Restent hors site : `LICENSE`,
`README.md`, l'historique Git (dépôt public), et l'adresse du vérificateur
Turnstile (`*.charles-decassan.workers.dev`, dans le JavaScript des gents). Les mentions légales l'ont un temps affirmé
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
Pas de démon Docker. **Le conteneur fournit `NEXT_PUBLIC_SUPABASE_URL` et
`SUPABASE_SERVICE_ROLE_KEY`** (20/11) : une ANCIENNE clé, refusée
(« Legacy API keys are disabled ») — `/api/pages` répond 500 au lieu de
passer en mémoire locale. Lancer le serveur local sans elles :
`env -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY npx next dev`. **Conséquence : aucun salon collaboratif ni aucune page
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
  écran doit porter sa propre sortie. **Micro-cravate ignoré sur iPhone (12/10)** :
  il marche dans l'appareil photo, pas dans le prompteur. Hypothèse NON
  vérifiée : les traitements d'APPEL demandés (anti-écho, réduction de
  bruit, gain automatique) font passer iOS en mode voix, qui impose le
  micro intégré. Case « Son brut (micro externe) » dans ⚙ : les coupe et
  relance le flux (vérifié au navigateur : les trois passent à faux),
  mémorisée sur l'appareil. Si elle ne suffit pas, la cause est ailleurs
  (le micro n'est pas présenté à WebKit) — et il n'y a alors rien à faire
  côté page.
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
  avec. **Prise verticale ÉCRASÉE sur iPhone (02/10)** :
  les dimensions étaient lues une seule fois, à la fin de l'analyse du son —
  l'iPhone ne les avait pas encore livrées, le canevas restait carré par
  défaut et l'image 1080×1920 y était étirée. Désormais lues sur les
  événements de la vidéo (`loadedmetadata`, `resize`), export bloqué tant
  qu'elles manquent, et `dessiner` recadre en « couvrant » : jamais
  d'étirement, quoi qu'il arrive.
- **« Le chantier »** (format de gent, 07/10 ; `lib/chantier.ts`) : assistant
  de maître d'œuvre pour une rénovation. Son DOSSIER est l'application —
  cinq artefacts `chantier-*` (Vue d'ensemble, Chantier, Artisans, Devis,
  Planning) posés par la CONFIGURATION, comme le document d'une visionneuse
  (`draftToEspace`). `mergeDossierChantier` ne pose le squelette que si
  AUCUNE partie n'existe : un dossier rempli n'est jamais écrasé, une partie
  supprimée exprès ne revient pas. Les visiteurs reçoivent le squelette
  VIERGE (`espaceForPublicLink`) : la structure est un livrable du gent, le
  contenu (adresse, devis, artisans) est privé. Le gent s'OUVRE sur le
  dossier (`SharedGentShell` : volet large ; sur écran étroit, on arrive sur
  « Le gent »). « Nouvel échange » n'y touche pas : les artefacts ne vivent
  pas dans les fils. Consigne de FORME : retoucher les parties par leur
  identifiant, jamais un second dossier. **Mise à jour AUTOMATIQUE** (choix
  de l'utilisateur, 07/10) : une RETOUCHE d'une partie du dossier
  (`appliquerSansVerdict`) passe par le même chemin que « Garder »
  (`confirmArtefactProposal(…, "add", true)`) — une seule mécanique de
  versions ; une version complète ou un artefact ordinaire restent des
  propositions. La partie garde SA PLACE (`placerMiseAJour` ; un artefact
  ordinaire passe en tête, ce qui aurait mélangé les onglets). La carte sous
  la réponse dit ce qui a changé et offre « Annuler » (`versionRangee`,
  `restaurerVersionArtefact`) tant qu'aucun changement n'est venu depuis.
  **Dossier lu en entier** : `BUDGET_DOSSIER` (6 000 caractères par partie,
  32 000 au total, 8 artefacts, dossier en tête) au lieu de 3 000 / 8 000 /
  5 — coût assumé, jusqu'à ~8 000 jetons de plus par tour sur un dossier
  plein. Après « Nouvel échange », le dossier est sa seule mémoire. **Photos** (07/10, tous les gents) : une photo est une VIDÉO D'UNE
  IMAGE — réduite à 1 600 px dans le navigateur (`lib/extractPhoto.ts`),
  décrite par `/api/video/analyze` (`nature: "photo"`, `consigneVisionPhoto`),
  la description part dans le message. La vision DÉCRIT (et dit ce que
  l'image ne permet pas d'affirmer), le gent CONCLUT. La photo n'est PAS
  gardée dans le fil, seule sa description ; comptes connectés seulement,
  quota « video ». **Adresse e-mail du bot : ABANDONNÉE** (10/11, décision de
  l'utilisateur). Le lot était écrit (`<jeton>@bot.getgents.ai`, Brevo Inbound,
  table `courrier_entrant`) puis retiré — récupérable dans l'historique
  (« Adresse e-mail du gent chantier », annulé juste après). À savoir si on y
  revient : un serveur ne peut PAS écrire dans le dossier, le navigateur
  réécrit le brouillon à chaque frappe ; il faut déposer des opérations que
  le navigateur rejoue.
- **Mini-app à STRUCTURE FIGÉE** (10/11 ; `lib/miniApp.ts`) : « Update »
  faisait tout réécrire au modèle — sections, ordre, indicateurs —, et
  l'ancien tableau était écrasé. Dans le studio, « Figer cette structure »
  tire d'un aperçu réussi un GABARIT (`pinnedArtefact.gabarit`) : ids, types,
  titres, libellés — **AUCUNE donnée** (l'aperçu vient du CV du créateur ; ses
  valeurs seraient relues par le modèle à chaque génération d'un visiteur).
  Avec gabarit, le serveur ramène la réponse à la structure
  (`appliquerDonnees` : même id ET même type, à sa place ; un bloc en trop est
  écarté, un bloc absent est COMPTÉ, jamais inventé — `blocsManquants` dans
  `getgents:artefact generation`). Le gabarit reste côté serveur (absent de
  `espaceForPublicLink`) ; la réponse porte `ordre`, avec lequel le
  navigateur remet depuis SON tableau précédent les blocs non rendus
  (`completerAvecPrecedent` — le serveur ne connaît pas le tableau d'un
  visiteur). Chaque mise à jour RANGE l'état précédent (`versions`, 8) et
  s'annule (« Annuler » / « Rétablir ») ; « Recommencer » efface aussi les
  versions (données de la session quittée). Sans gabarit : comportement
  d'origine, rien à migrer. Vérifié avec un faux modèle (blocs mélangés, un
  en trop, un manquant), pas en production. **Conversation OUVERTE à côté du
  tableau** (`conversationOuverte` : réglage `pinnedArtefact.conversation`,
  sinon vrai dès que la structure est figée — une mini-app d'origine reste
  sans conversation, rien ne change pour les gents diffusés). Le gent voit le
  tableau comme l'artefact « miniapp » (`artefactDuTableau`, bloc `[ESPACE]`)
  et le retouche par opérations ; « Garder » applique la retouche AU TABLEAU
  (`avecNouveauTableau`, donc annulable), jamais un artefact à côté — avec
  verdict, pas d'auto-application. « Mettre à jour » recalcule tout : les
  retouches manuelles n'y survivent pas, la consigne le fait dire au gent.
  Le visiteur ne reçoit pas le gabarit, seulement le booléen `conversation`.
  NON vérifié au navigateur. **Chantier ARRÊTÉ (12/11, décision de
  l'utilisateur)** : lots 1 et 2 en production et gardés. Non faits, et à
  ne pas reprendre sans demande : une entrée « URL » part toujours comme une
  simple chaîne (jamais lue), le crédit d'un lien est décompté même sur
  échec, pas de nouveaux types d'entrées.
- **Connecteur MCP « partager un artefact » — PHASE 0, essai** (12/11 ;
  `lib/mcpPartage.ts`, `app/api/mcp`, `/partage/<jeton>`). Idée produit :
  un commercial génère un artefact dans Claude, ChatGPT…, et dit « partage-le
  à marie@… » ; le connecteur rend un lien privé et le mail à envoyer. La
  question que l'essai doit TRANCHER avant tout le reste : un connecteur ne
  voit pas l'artefact, il ne reçoit que la COPIE que le modèle recopie dans
  l'appel — arrive-t-elle entière et fidèle ? D'où `controleFidelite`
  (longueur, fin attendue du format, marques d'abréviation « ... reste du
  code ») renvoyé au modèle à chaque partage et journalisé
  (`getgents:partage artefact_partage`, avec le User-Agent du client).
  Protocole : JSON-RPC « Streamable HTTP » en réponses JSON simples, sans
  dépendance (vérifié avec le client MCP OFFICIEL : initialize, liste,
  appel). Authentification d'essai SEULEMENT : clé dans l'adresse
  (`MCP_ESSAI_CLE`, ≥ 32 caractères, temps constant, 404 sinon) — elle
  apparaît dans les journaux d'accès : la changer après l'essai ; la phase 1
  la remplace par OAuth lié au compte. **Isolement** : le contenu est du code
  ARBITRAIRE, jamais rendu dans un document Getgents. `/partage/<jeton>`
  l'encadre depuis `/api/partage/<jeton>/contenu`, servi hors middleware sous
  CSP `sandbox` SANS `allow-same-origin` (`CSP_ARTEFACT`) — origine opaque :
  vérifié au navigateur, le script de l'artefact s'exécute mais cookies,
  stockage et page parente lui sont fermés. La phase 1 ajoute quand même un
  DOMAINE séparé (défense en profondeur). React (format Claude) : rendu « au
  mieux » par Babel + esm.sh dans le cadre, repli sur l'erreur et le code ;
  NON vérifié d'ici (le réseau de l'agent refuse unpkg, esm.sh, Tailwind).
  Table `artefacts_partages` (migration 019, à passer AVANT le déploiement) ;
  sans Supabase, en développement, une mémoire locale la remplace. Liens
  valables 30 jours. Pas d'e-mail envoyé : le commercial envoie lui-même.
  Plan complet (phases 1 à 3 : code par e-mail, domaine séparé, assistant
  à côté de l'artefact, retour « ce qu'a lu et demandé le client »)
  suspendu au résultat de l'essai. **Premier essai réel (12/11)** : « le rendu est
  bon, mais aucune donnée ne s'affiche ». Cause la plus probable (artefact non
  relu d'ici) : le script s'arrêtait — sous `sandbox` sans
  `allow-same-origin`, toucher `localStorage` LÈVE une erreur, et
  `window.storage` (stockage des artefacts Claude) n'existe pas hors de
  Claude. `AMORCE_ARTEFACT`, posée avant tout script (`avecAmorce`), les
  remplace par une mémoire de la page (rien n'est gardé entre deux visites)
  et affiche toute erreur restante dans un bandeau (`data-getgents-erreur`).
  Vérifié au navigateur : tableau rempli depuis `localStorage`, lecture de
  `window.storage`, erreur visible. **Essai jugé CONCLUANT par l'utilisateur (12/11)**,
  après correctif : page dessinée, horloge active, aucune erreur. Les blocs
  restés vides étaient VOULUS par l'artefact lui-même (« Poste de pilotage »
  branché sur l'agenda et les e-mails de Claude : « Ouvre la page depuis
  claude.ai »). Enseignement : il y a deux sortes d'artefacts — AUTONOMES
  (données dans la page : se partagent tels quels, c'est l'usage visé) et
  BRANCHÉS sur Claude (ne marchent pas ailleurs, et ne le doivent pas : ce
  serait exposer l'agenda du commercial). D'où la consigne de l'outil
  (version FIGÉE et datée, vérification des données personnelles avant
  envoi) ET un repérage côté serveur qui ne dépend pas du modèle
  (`dependClaude` : `window.claude`, `window.storage`, mention de
  claude.ai), signalé dans la réponse de l'outil. **PHASE 0 VALIDÉE pour Claude
  (12/11, essais de l'utilisateur)** : un artefact autonome arrive COMPLET, un
  artefact React interactif s'affiche et fonctionne (la chaîne Babel + esm.sh
  tient en vrai). ChatGPT non essayé — choix de l'utilisateur : Claude
  d'abord. **Phase 1, lot 1 — connexion OAuth (12/11, écrit, NON essayé
  dans Claude)** : adresse `/api/mcp` SANS clé. Sans jeton : 401 +
  `WWW-Authenticate` → métadonnées (`/.well-known/oauth-protected-resource`,
  racine ET suffixe `/api/mcp` ; `/.well-known/oauth-authorization-server`)
  → inscription dynamique (`/api/oauth/register`, clients PUBLICS seuls,
  retour HTTPS ou localhost) → consentement `/oauth/autoriser` (chemin
  privé : passe par /connexion) → `/api/oauth/token` (PKCE S256
  obligatoire, code 5 min à usage unique, accès 1 h, renouvellement 30 j
  avec ROTATION : un renouvellement rejoué révoque toute la famille).
  Codes et jetons stockés en EMPREINTE SHA-256 seulement (migration 020,
  à passer AVANT le déploiement) ; chaque partage porte `owner_id`. Le
  consentement part par fetch puis `location` : un formulaire redirigé vers
  claude.ai serait bloqué par `form-action 'self'`. `destinationApresConnexion`
  ne contrôle plus que le CHEMIN de `next` : la requête du consentement
  porte `redirect_uri=https://…`, et l'ancien refus de tout `://` renvoyait
  le commercial sur « Mes gents ». Vérifié avec le client MCP OFFICIEL
  (18 contrôles, `next dev` : en `next start` la mémoire locale est refusée,
  c'est voulu) et au navigateur (clic → retour vers claude.ai). **Essai
  réel CONCLUANT dans Claude (12/11)** ; la route d'essai `/api/mcp/<clé>`
  est RETIRÉE — `MCP_ESSAI_CLE` ne sert plus, SUPPRIMÉE de Vercel (13/11). **Lot 2 — gérer
  ses partages (12/11)** : section « Mes partages » de /compte
  (`MesPartages`, `/api/partages`, révocation `DELETE /api/partages/<jeton>`)
  et deux outils du connecteur, `lister_partages` (recherche sans accents
  ni casse, tous les mots exigés — `filtrerPartages`) et `revoquer_partage`
  (marqué destructeur ; la consigne exige de faire choisir l'utilisateur
  quand plusieurs partages correspondent). La garde de propriété est dans
  la REQUÊTE (`owner_id` filtré par `revoquerPartage`) : connaître le jeton
  d'autrui ne suffit pas. La liste ne lit jamais `contenu` (2 Mo par
  ligne). Les partages faits avec l'ancienne clé d'essai n'ont pas de
  propriétaire : ils n'apparaissent nulle part, et expirent seuls. Aucune
  migration (colonnes de la 020). **Essai réel CONCLUANT (12/11).** Piège
  payé : après le déploiement, Claude affirmait n'avoir que
  `partager_artefact` — il garde la liste d'outils lue à l'AJOUT du
  connecteur (`listChanged: false`). Il faut le DÉCONNECTER puis le
  reconnecter, et ouvrir une nouvelle conversation ; rouvrir une
  conversation ne suffit pas. À dire à chaque nouvel outil. **Assistant du
  document (12/11, NON essayé avec un vrai modèle)** : option d'un partage
  (`assistant` dans l'outil, faux par défaut ; case « Assistant IA » dans
  Mes partages). Panneau dans la page Getgents, jamais dans le document
  isolé. **UX choisie par l'utilisateur (12/11, après maquettes)** : REPLIÉ
  à l'arrivée — document plein écran, bouton « ✦ Poser une question » en
  bas à droite (la languette sur le bord a été écartée), bulle de première
  visite à 3 s, une seule fois par navigateur (`getgents:partage:bulleVue`).
  OUVERT = deux cartes DÉTACHÉES (14 px de marge partout, rien ne touche le
  bord ni la barre du haut), le document se RESSERRE à côté : on consulte en
  posant ses questions (la superposition avait été écartée pour ça). Sous
  1 000 px l'assistant passe au-dessus ; sur téléphone, moitié basse, le
  document reste utilisable au-dessus, ⤢ agrandit. ✕ ou Échap replie, le
  fil est gardé. Le cadre n'est JAMAIS démonté (vérifié : un seul
  chargement du document en ouvrant, fermant, agrandissant) — l'artefact
  garde son état. **Essai réel CONCLUANT (12/11).** Ce n'est PAS un
  gent : consigne fixe (`consigneAssistant`, `lib/assistantDocument.ts`) —
  le document SEUL, jamais d'invention (un prix inventé engagerait le
  commercial), document entre balises traité comme une donnée. Le code est
  gardé (les données d'un artefact React y vivent), les `data:` encodés
  retirés, 60 000 caractères au plus. Payé par le PROPRIÉTAIRE
  (`contexteForUser(owner_id)` + son quota), 100 questions par lien
  (`compterQuestion`, colonne `questions`) ; sans raisonnement ni outil.
  **Modèle PROPRE depuis le 13/11 : `MODELE_ASSISTANT_PAGES` = Claude Haiku
  5.5** (`lib/assistantDocument.ts`), il prenait le défaut des gents (Sonnet
  5.5) — changer celui-ci aurait changé l'assistant en silence. Motif :
  tâche étroite (lire, ne rien inventer, marquer `[HORS PAGE]`) et coût —
  prix OpenRouter lus le 13/11, 0,10 $ / 0,50 $ par million de jetons contre
  2 $ / 10 $, soit ~0,85 $ contre ~17 $ pour 500 questions sur une page
  pleine, payés par la clé PLATEFORME pour les invités. Ajouté au catalogue
  (`MODEL_CATALOG`, donc aussi proposé aux gents) : hors catalogue, la clé
  plateforme l'aurait remplacé par Kimi K3 — un test le garde. Qualité NON
  mesurée d'ici : essai à faire sur de vraies pages (React compris), avec
  questions hors page et une question piège sur un prix absent. Si Haiku
  déçoit : mise en cache de la consigne (non vérifiée via OpenRouter) avant
  de revenir à Sonnet. Rien n'est gardé : le fil vit dans la page.
  Migration 021 à passer AVANT le déploiement — `lireArtefact` lit les
  nouvelles colonnes, TOUS les liens tomberaient sans elle. Vérifié en
  local jusqu'à l'appel au modèle (pas de clé OpenRouter ici) et au
  navigateur avec une réponse SIMULÉE. **Rubrique « Pages » (12/11, décidé,
  NON codé)** : les artefacts partagés deviennent un objet de premier plan,
  troisième mode du sélecteur `Utiliser | Construire | Pages`, marque GetSite
  en info-bulle (comme GetSpace / GetStudio — les marques restent en second).
  Nom choisi par l'utilisateur après « Artefacts » (mot de Claude, et déjà
  pris par les artefacts des gents), « Documents », « Site », « Flyers » :
  il voulait un mot commun au français et à l'anglais. Décisions : l'assistant
  IA se règle PAR PAGE ; les liens montrent la DERNIÈRE version (anciennes
  restaurables). Préalable : modèle `pages` + `partages` (aujourd'hui une
  ligne = une copie + un destinataire), reprise par contenu identique, outils
  du connecteur avec identifiant de page (« partage-la aussi à Paul » sans
  recopier). `/pages` n'est PAS encore un slug réservé. Maquettes : liste
  façon « Mes gents », fiche (aperçu réel, destinataires, assistant,
  versions), écran vide qui explique le connecteur. **Lot A (12/11, écrit,
  NON déployé)** : tables `pages` et `pages_versions`, `page_id` sur
  `artefacts_partages` (migration 022, à passer AVANT : la lecture d'un lien
  joint la page). Un partage ne garde PLUS de copie (`contenu` = '') : le
  lien lit la page, donc sa DERNIÈRE version ; un vieux partage sans page
  (clé d'essai) garde la sienne. Un contenu renvoyé À L'IDENTIQUE (empreinte
  md5, même compte) retrouve sa page. Connecteur : `partager_artefact`
  accepte `page` (repartage sans recopie, sans contrôle de fidélité — rien
  n'a été recopié) et rend l'identifiant de page ; `mettre_a_jour_page`
  range l'état précédent (20 versions au plus) et dit combien de liens
  changent ; mise à jour conditionnelle sur la version lue. Assistant PAR
  PAGE : le basculer depuis un lien (Mon compte) vaut pour tous les liens de
  la page. Le lien dit « mis à jour le… » (ou « à HH:MM » le jour même).
  Slug `pages` réservé. Vérifié avec le client MCP officiel (12 contrôles,
  mémoire locale), PAS avec Supabase : la reprise SQL n'a tourné nulle part.
  **Déployé (12/11).** Vocabulaire du connecteur passé à « page » (12/11,
  demande de l'utilisateur) : outil `partager_page`, titres et messages ;
  « artefact » (Claude) et « canvas » (ChatGPT, Mistral) restent comme
  SYNONYMES dans les descriptions — c'est par eux que le modèle reconnaît
  « partage cet artefact ». `partager_artefact` est encore ACCEPTÉ sans être
  annoncé : Claude garde l'ancienne liste d'outils tant qu'on ne reconnecte
  pas. Le code interne et les événements de journal gardent « artefact ».
  **Lot B (12/11, écrit, NON déployé)** : `/pages` (liste, une carte par
  page, vignette = vrai rendu réduit à 30 % dans un cadre isolé, chargé en
  `loading="lazy"`) et `/pages/<id>` (aperçu réel, destinataires avec
  copier / révoquer, « + Partager à… » qui crée un lien SANS Claude — même
  chemin que le repartage du connecteur —, interrupteur d'assistant par page,
  versions avec « Restaurer » qui crée une NOUVELLE version, suppression qui
  coupe tous les liens). Chemin privé (middleware). Aperçu propriétaire :
  `/api/pages/<id>/apercu`, même CSP `sandbox` que chez le client — la
  requête porte les cookies du compte, le document ne les voit pas. Troisième
  mode du sélecteur (`Utiliser | Construire | Pages`, GetSite) : dans un
  rail, l'icône passe AU-DESSUS du libellé (« Construire » était coupé en
  « Const… ») ; sur téléphone, même disposition, libellés masqués sous
  340 px seulement. Rail propre (`RailPages`, styles du rail du studio) :
  « Mes pages », « Connecter Claude / ChatGPT » (guide en 3 étapes, aussi
  écran vide) ; ChatGPT et Mistral annoncés « bientôt », pas avant un essai.
  « Mes partages » RETIRÉ de Mon compte (lien vers la rubrique) : deux
  listes des mêmes liens finiraient par se contredire. Vérifié au navigateur
  (mémoire locale, données créées par le client MCP officiel) : filtres,
  recherche, partage depuis la fiche, copie du mail, révocation, assistant,
  restauration (aperçu revenu à la v1), suppression, téléphone sans
  débordement. PAS avec Supabase. **Déployé (12/11)** ; cartes de la liste
  sans boutons à la demande de l'utilisateur : la carte ENTIÈRE ouvre la
  fiche, « Voir comme le client » reste dans la fiche. **Lot C (12/11)** :
  « Vos dernières pages » sur l'accueil (`StudioHome`, 4 au plus, sous
  « Vos gents »), absente sans page ou sans compte — l'accueil n'en dépend
  pas. Payé en passant : les lignes « Vos gents » de l'accueil sortaient
  SOULIGNÉES (des liens sans `text-decoration: none`). **Accès protégé par
  code (12/11)** : interrupteur PAR PAGE dans la fiche (désactivé par
  défaut). Le porteur du lien ne tape PAS d'adresse : le code (6 chiffres,
  10 min, 5 essais, usage unique, renvoi ≥ 60 s, 10 envois par lien) part à
  l'adresse ENREGISTRÉE du lien, montrée masquée (`m•••@acme.fr`) — un lien
  transféré envoie le code au vrai destinataire. Un lien adressé à un NOM
  est BLOQUÉ quand la protection est active, et la fiche le dit. Validé →
  cookie `gg_acces_<jeton>` signé (HMAC dérivé de `SECRET_BOX_KEY`),
  HttpOnly, 30 jours, propre à CE lien. La page, le document
  (`/api/partage/<jeton>/contenu`) ET l'assistant revérifient : l'écran du
  code n'est pas la seule garde (vérifié : document et assistant appelés
  directement → 403). Le fond flou est un DÉCOR, le document n'est pas
  chargé avant validation. Migration 023 : tables NOUVELLES
  (`pages_protection`, `acces_partages`) — « table absente » (42P01 /
  PGRST205) se lit « aucune page protégée », toute autre erreur REFUSE
  l'accès (« Page momentanément indisponible »). La détection de table
  absente n'est PAS vérifiée contre le vrai PostgREST : si tous les liens
  affichent « indisponible » avant la migration, c'est elle — passer la
  023 répare. En développement sans Brevo, le code est écrit dans le journal
  du serveur (jamais en production). **Essai réel CONCLUANT (13/11)** après un premier échec : Brevo refusait en 401 — le filtrage « IP autorisées » était encore actif (l'invitation était passée par hasard d'une adresse autorisée). Chaque refus est désormais journalisé (`getgents:acces code_refuse`, `cause`) et l'écran affiche une référence (« réf. brevo-401 »). **« Ce qu'a lu le client » (13/11, DÉPLOYÉ, migration 024 passée, essai réel CONCLUANT — e-mail à l'auteur compris ;
  `lib/activitePage.ts`, `lib/server/activitePages.ts`, migration 024 à
  passer AVANT)** — décisions de l'utilisateur après trois maquettes :
  LECTURE et QUESTIONS sont deux flux SANS clé commune. Lecture ANONYME par
  défaut (une ligne par ouverture, le JOUR seulement, ni lien ni appareil) ;
  nominative (dates, durée onglet visible, profondeur, appareil, version, un
  e-mail à l'auteur à la PREMIÈRE lecture partagée) seulement si le visiteur
  clique « Partager » dans un widget (après 10 s, jamais à l'arrivée, ✕ =
  refus, choix gardé par lien dans le navigateur). Questions à l'assistant
  TOUJOURS gardées, sans nom ni lien, datées du jour : jamais rattachables à
  un lecteur. « N'a pas partagé ses données » ne dit PAS si la page a été
  ouverte. Une visite ne change jamais de nature (nouvel identifiant à chaque
  changement de choix) ; sans choix, l'ouverture anonyme part à 30 s ou au
  départ — sinon celui qui accepte comptait deux fois (vu au test). Visites
  et questions de l'AUTEUR non comptées. « La page ne le dit pas » :
  l'assistant commence par `[HORS PAGE]` quand l'information manque
  (`consigneAssistant`), le serveur le lit au passage du flux
  (`avecSuivi`, marquage dans `flush` pour ne pas être coupé), le navigateur
  l'efface. Profondeur : `AMORCE_ARTEFACT` poste `{getgents:"profondeur"}` à
  la page (et répond à `profondeur?`, sinon la valeur du chargement était
  perdue) ; la page n'écoute que SON cadre. « l'auteur » partout ; son nom
  (nom affiché de Mon compte) seulement dans « Vos données sur cette page »
  — sans nom affiché, il n'apparaît pas. Formulations VOULUES par
  l'utilisateur (widget « pour un meilleur suivi », pas de phrase sur les
  questions sous l'assistant, juste un lien « Confidentialité ») ; points
  juridiques signalés et NON tranchés (qui est responsable de traitement,
  portée de « n'engagent pas l'auteur ») — à voir avec un juriste avant
  l'ouverture publique. Effacement : 120 jours après création (lien de 30 j
  + 90 promis), par la tâche horaire (`/api/routines/run`) et à la lecture
  de l'onglet (`purgerActivite`). Vérifié au navigateur (mémoire locale, faux fournisseur d'IA) :
  widget, refus retenu, marqueur jamais montré, 3 ouvertures dont 2
  anonymes, profondeur 100, questions marquées. Puis en production par
  l'utilisateur (13/11) : tout concluant. **Précisions de l'auteur (13/11,
  DÉPLOYÉ, migration 025 passée, essai réel CONCLUANT ; `lib/server/complementsPages.ts`, migration 025 à
  passer AVANT — sans elle l'assistant lit la page seule, rien ne casse)** :
  « Répondre » sous une question « la page ne le dit pas » (ou « + Ajouter
  une précision ») ; la réponse est lue par l'assistant avec la page, pour
  TOUS les destinataires (choix de l'utilisateur). INVISIBLES pour le
  visiteur (choix de l'utilisateur : qu'il ne se sente pas suivi) — ni
  pastille ni sous-titre ; la consigne (`blocComplements`) dit de s'en
  servir sans mentionner leur existence, SANS prétendre qu'elles sont dans
  le document. En contrepartie, plus aucun texte ne dit « d'après ce
  document UNIQUEMENT » / « page SEULE » (sous-titre, mention, page de
  confidentialité) : ce serait devenu faux. La question du visiteur n'est
  jamais publiée ; le « sujet » (prérempli avec elle, modifiable) ne sert
  qu'au repérage. 40 précisions au plus, 1 500 caractères chacune. Vérifié
  au navigateur avec un faux modèle : hors page avant, réponse avec la
  précision après, rien côté visiteur, modifier, retirer. **Questions
  suggérées (13/11, écrit, NON déployé ; `lib/suggestionsPage.ts`,
  `lib/server/suggestionsPages.ts`, migration 026 à passer AVANT — sans elle
  les bulles par défaut restent)** : les bulles de l'assistant (4 au plus,
  ordonnées) remplacent « Résume ce document »… par des questions CHOISIES et
  RELUES par l'auteur — jamais publiées automatiquement : une question peut
  porter un détail propre à un client (« chez Acme »). « ☆ Suggérer » sur une
  question répondue (ou précisée) ; propositions calculées SANS modèle
  (`propositions` : mêmes mots à la ponctuation, aux accents et à la casse
  près, posées ≥ 2 fois, répondues). Une suggestion REFORMULÉE couvre encore
  sa question d'origine et ses variantes (`clesSuggerees`) — sinon la même
  question restait proposée (vu au test). Rien n'indique au visiteur
  qu'elles viennent d'autres visiteurs. Vérifié au navigateur (faux modèle) :
  regroupement, reformulation, plafond de 4, ordre, retrait, bulles chez le
  visiteur sans la question d'origine. **Onglet « Assistant » de la fiche
  (13/11, demande de l'utilisateur)** : trois onglets — Page & destinataires
  / Activité (chiffres, lectures) / Assistant (interrupteur, questions,
  suggestions, précisions ; désactivé = interrupteur et explication seuls).
  `ActivitePage` est monté dès l'ouverture de la fiche (masqué sur « Page »),
  avec une prop `vue` : la pastille « questions sans réponse » de l'onglet
  est juste avant qu'on l'ouvre, et changer d'onglet ne recharge rien. La
  tuile « questions posées » d'Activité mène à l'onglet Assistant. Liste
  des questions BORNÉE (13/11) : doublons regroupés (`regrouperQuestions`,
  « ×3 », état = dernière réponse, une précision sur l'un vaut pour le
  groupe), filtre « Sans réponse (N) | Toutes (N) » ouvert sur « Sans
  réponse » s'il y en a, 15 à la fois (« Afficher N de plus »). Dans un jour,
  les plus posées d'abord : la base ne garde PAS l'heure d'une question,
  l'ordre d'enregistrement ne voulait rien dire. Pastille et filtre comptent
  les questions DISTINCTES ; « N posées » reste le nombre réel. Plafond
  serveur inchangé : 1 000 questions lues par page. **Page par COLLAGE
  (13/11, revirement assumé : l'absence de « + Nouvelle page » était une
  décision du 12/11)** — `lib/importPage.ts`, `components/pages/ImportPage.tsx`,
  `POST /api/pages`, `POST /api/pages/apercu`, `POST /api/pages/<id>/version`.
  Contourne le MCP : marche avec ChatGPT, Mistral, un fichier… et sans
  question de fidélité (l'utilisateur colle le code exact). Titre et format
  DÉDUITS (modifiables) ; un bloc ```…``` qui entoure tout est déballé. L'aperçu
  passe par un FORMULAIRE posté dans le cadre (même CSP `sandbox` que chez le
  client) : un `srcdoc` hériterait de la CSP de Getgents, qui bloquerait les
  scripts de l'artefact. Alertes du même module côté navigateur et serveur :
  coordonnées écrites dans la page (`lib/donneesPersonnelles.ts`, règles
  simples, SANS modèle — une alerte, pas une garantie ; vaut AUSSI pour le
  connecteur, dont le journal ne garde que le NOMBRE), artefact branché sur
  Claude, abréviation. Un code déjà connu rouvre SA page (`?existante=1`).
  Origine `collage` → « Collée à la main » (`libelleOrigine`). « Nouvelle
  version » dans la fiche : `simuler` rend la PREMIÈRE ligne de texte qui
  diffère (pas de comparaison complète, choix de l'utilisateur) et le nombre
  de liens concernés ; même mécanique de versions que le connecteur. Vérifié
  au navigateur (mémoire locale). **Collage d'un vrai canvas ChatGPT :
  CONCLUANT (18/11, essai de l'utilisateur).** Le CONNECTEUR dans ChatGPT
  n'est PAS essayé : il exige le mode développeur, donc un abonnement
  payant, que l'éditeur n'a pas. Risque connu pour ce jour-là : notre
  inscription n'accepte que les clients PUBLICS (`validerInscription`),
  et un refus n'y est pas journalisé — à revoir avant l'essai. **Guides
  par assistant (18/11, demande de l'utilisateur ; `lib/guidesAssistants.ts`,
  `GuideConnexion`)** : entrée du rail « Connecter un assistant IA »
  (`/pages?guide=claude|chatgpt|mistral|perplexity`, l'ancien `?guide=1`
  vaut Claude), un onglet par assistant, deux chemins : copier-coller
  (« marche avec l'offre gratuite ») et connecteur. Le connecteur n'est
  marqué « Essayé » QUE pour Claude ; ailleurs « Pas encore essayé par
  Getgents », copier-coller en premier, et AUCUN menu précis pour Mistral
  et Perplexity (jamais vus d'ici) — un test garde qu'aucun autre guide ne
  se dise essayé. Remplace la mention « ChatGPT et Mistral : bientôt ». Lot suivant : domaine séparé. **Payé en passant (13/11)** : une page collée (aucun lien) était cachée par le filtre par défaut « Actives » — elle n'apparaissait que sur l'accueil. « Actives » inclut désormais les pages jamais partagées (« Pas encore partagée ») ; « Sans lien actif » = des liens, tous révoqués ou expirés. Et `.wrap` n'est plus bridé à 1 200 px : sur grand écran, la grille prend la largeur. Déployé, essai réel CONCLUANT (13/11). **Domaine de contenu `www.getgents-pages.com` (13/11, ACTIVÉ,
  essai réel CONCLUANT ; `lib/domaineContenu.ts`, `lib/adresseSignee.ts`,
  `app/api/contenu/[token]`)** — défense en profondeur choisie par
  l'utilisateur (domaine DISTINCT plutôt qu'un sous-domaine, même site pour le
  navigateur). Le cadre ne reçoit PAS les cookies de getgents.ai (cookies
  tiers, bloqués sur iPhone) : les trois routes d'origine
  (`/api/partage/<jeton>/contenu`, `/api/pages/<id>/apercu`,
  `/api/pages/apercu`) vérifient l'accès comme avant (cookie du code,
  session), puis REDIRIGENT vers une adresse SIGNÉE (HMAC dérivé de
  `SECRET_BOX_KEY`, 10 min) qui dit quoi servir, à qui (propriétaire), et
  quelle origine peut l'encadrer (`frame-ancestors`). Brouillon collé : 307,
  le navigateur reposte le MÊME corps, dont l'adresse porte l'empreinte
  (sinon elle servirait n'importe quel code). Le domaine de contenu ne sert
  QUE `/api/contenu/<adresse>` : middleware (pages) et réécriture
  `beforeFiles` de `next.config.mjs` (routes API, fichiers) répondent 404 à
  tout le reste ; l'adresse présentée à getgents.ai répond 404 aussi.
  `form-action` et `frame-src` de l'application nomment le domaine
  (`form-action` vaut pour les redirections). Sans `DOMAINE_CONTENU` : rien
  ne change, la route nouvelle répond 404. Vérifié au navigateur avec un vrai
  second site (application sur `localhost`, contenu sur `127.0.0.1`) :
  brouillon, fiche, vignettes, lien, page protégée par code (403 sans code,
  aucune adresse émise), adresse retouchée → 404, aucune violation CSP. Piège
  de l'essai local : `upgrade-insecure-requests` réécrivait le domaine local
  en https — levée SEULEMENT pour un domaine de contenu en `http://`. NON
  vérifié : Safari/iPhone réel, et la réécriture par hôte sur Vercel.
- **Offre « Getgents Pages », sur invitation (13/11 ; `lib/offre.ts`,
  `lib/server/offre.ts`)** — décisions de l'utilisateur : ouvrir les pages
  SEULES à des invités, inscriptions toujours fermées (on invite depuis
  Supabase → « Invite user »), marque « Getgents Pages » (pas « GetSite » en
  premier plan : on a retiré les marques du premier plan le 12/11). Deux
  offres : « complète » et « pages ». Les comptes complets sont LISTÉS dans
  `COMPTES_COMPLETS` (identifiants Supabase) ; variable absente = tout le
  monde complet, l'état d'avant. Fermeture à TROIS niveaux (masquer n'est
  pas fermer) : menu (`produitSeul` de `SelecteurMode` : le nom du produit
  à la place des modes), middleware (`/builder`, `/espace`, `/apercu`,
  `/accueil`, `/myspace` → `/pages`, cookies de session recopiés sur la
  redirection), gardes serveur (`refusOffrePages` dans les quatre gardes de
  `gentGuard.ts` ET dans `/api/chat`, qui résout son quota à la main — un
  test exige une garde dans toute route qui appelle `consommerSiPlateforme`).
  Les gents DIFFUSÉS restent en ligne : leurs visiteurs ne passent pas par
  ces gardes. Plafonds (validés) : 50 pages, 200 liens actifs, 500 questions
  à l'assistant par mois (toutes ses pages, depuis le 1er à Paris) —
  `PlafondAtteint`, 409 avec un message qui dit quoi faire, transmis tel
  quel au modèle par le connecteur. Liens vérifiés AVANT de créer une page
  (sinon un refus laisserait une page sans lien). Le plafond de questions
  dit au VISITEUR « l'assistant fait une pause », jamais l'état du compte de
  l'auteur ; une lecture en échec du compteur LAISSE PASSER (le quota de la
  plateforme reste en place). Mon compte d'un compte « pages » : identité,
  « Votre accès » (jauges), zone sensible — ni clé OpenRouter, ni
  consommation des gents. Écran sans page : `AccueilPages` (coller / Claude),
  pour TOUS les comptes. Vérifié au navigateur (mémoire locale, compte
  `dev-local` hors liste) : redirections, menu, accueil, 50 pages puis 409,
  200 liens puis 409 et message dans la fiche ; sans la liste, rien ne
  change. NON vérifié : plafond de questions (il faut 500 appels à
  l'assistant), Mon compte (exige Supabase), et en production. Pas fait :
  la carte « Connecteur Claude » de la maquette (lire et révoquer les jetons
  OAuth du compte). **Lien d'invitation (13/11, `lib/invitation.ts`)** :
  vécu, l'invité arrivait DÉCONNECTÉ sur l'accueil public (« Demander un
  accès »). Le modèle d'e-mail par défaut de Supabase renvoie la session
  dans le FRAGMENT (`#access_token=…&type=invite`), que le serveur ne voit
  jamais, et `/auth/callback` n'attend qu'un `?code=`. Deux chemins mènent
  désormais à `/bienvenue` (mot de passe + nom affiché facultatif, puis
  `/accueil` → `/pages`) : (1) RECOMMANDÉ, modèle « Invite user » réglé sur
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` —
  vérifié CÔTÉ SERVEUR (`verifyOtp`, `app/auth/confirm`) ; (2) repli,
  `AtterrissageLien` (layout racine) lit le fragment, n'ouvre une session
  que pour `invite` ou `recovery` (sinon un lien piégé connecterait à un
  autre compte), efface les jetons de l'adresse. Lien expiré : message qui
  dit quoi faire. Vérifié au navigateur SANS Supabase (erreur expirée,
  jetons effacés, ancre ordinaire intacte) ; le formulaire avec une vraie
  session, PAS vérifié d'ici. **Essai réel CONCLUANT (13/11)**, d'abord
  par le fragment, puis par le modèle personnalisé
  (`supabase/templates/invitation.html`, collé dans Supabase → Invite user,
  objet « Votre accès à Getgents Pages ») : le chemin `/auth/confirm` est
  celui en service. Modifier le modèle exige le SMTP personnalisé (Brevo),
  pas l'offre Pro.
- **La racine getgents.ai est la VITRINE de Getgents Pages** (18/11, décision
  de l'éditeur ; `components/public/VitrinePages.tsx`). Elle présentait les
  gents, qui ne sont pas ouverts au public : on demandait un accès aux gents
  et on recevait Pages. Promesse LARGE choisie par l'éditeur (« Ce que vous
  créez avec l'IA, envoyé à la bonne personne, par un lien privé » ; clients,
  équipe, proches), pas réservée aux vendeurs : l'essai doit dire quels
  usages viennent — la demande d'accès demande « avec qui, et quoi ».
  Formulations gardées par un test (`vitrinePages.test.ts`) : l'assistant
  répond « à partir de la page » (jamais « uniquement »), le détail de
  lecture « seulement si votre lecteur accepte », plafonds lus dans
  `PLAFONDS_PAGES`. Connecté → `/accueil` (→ `/pages` pour un compte
  « pages »). Connexion, demande d'accès, Contact, À propos parlent de Pages ;
  les gents diffusés gardent leur adresse.
- **Accueil d'un compte sans page : l'EXEMPLE d'abord** (18/11, piste D
  parmi quatre maquettes ; `AccueilPages`, `lib/exemplesPages.ts`,
  `POST /api/pages/exemple`). Vécu : l'invité arrivait sans artefact sous la
  main et devait repartir dans Claude avant de rien voir. Deux exemples
  FICTIFS d'un clic — une proposition commerciale (Boulangerie des Halles)
  et un « CV du futur » ludique (Léa Moreau : niveaux, cartes à retourner,
  défi, barre d'exploration). Pages ORDINAIRES (comptées, supprimables),
  `origine` = `exemple:<id>` (colonne libre, aucune migration), assistant
  ACTIVÉ, questions suggérées posées ; un même exemple recliqué rouvre sa
  page. Chacun porte une QUESTION PIÈGE dont il ne dit rien (« payer en
  trois fois », « temps partiel ») : l'assistant répond « la page ne le dit
  pas », l'auteur découvre les précisions. Univers graphique VOLONTAIREMENT
  loin de Claude (pas de crème ni de serif : demande de l'éditeur). Pages
  autonomes, sans coordonnées — un test le garde. **Guide « Découvrez ce que
  vivra votre lecteur »** (`GuideDecouverte`, `lib/guideDecouverte.ts`) sur
  une page d'exemple OU la première page du compte : s'envoyer le lien
  (adresse préremplie), l'ouvrir en NAVIGATION PRIVÉE (les visites de
  l'auteur ne comptent pas), puis — exemple — RÉPONDRE à la question piège
  (choix de l'éditeur : cochée à la précision, pas à l'arrivée), ou — vraie
  page — recevoir une question. Étapes lues dans les faits (liens,
  activité), la fiche se relit au retour sur l'onglet (`focus`) ; « Masquer »
  par page dans le navigateur. Vérifié au navigateur (mémoire locale, faux
  modèle) de bout en bout, PAS en production.
- **Bouton d'ENGAGEMENT d'une page + fiche en QUATRE onglets** (19/11,
  maquettes validées ; `lib/engagement.ts`, `lib/server/engagementPages.ts`,
  `EngagementLecteur`, `BlocEngagement`, `ReponsesPage`, migration 031 à
  passer AVANT le déploiement — sans elle aucun bouton, le bloc le dit).
  Fiche : **Page** (aperçu, Engagement, versions, suppression) ·
  **Destinataires** (liens, accès par code) · **Activité** (Réponses en tête,
  pastille des nouvelles) · **Assistant** — Activité reste un onglet À PART
  (correction de l'éditeur). L'auteur active UN bouton par page, intitulé libre
  (30 car., suggestions en INTENTION, jamais « Bon pour accord »), option
  « laisser un mot » (500). Le bouton vit HORS du document isolé, à côté de
  « Poser une question » ; caché quand l'assistant est ouvert. UNE réponse par
  lien (contrainte unique), nom = celui du LIEN, jamais tapé ; l'auteur
  connecté est refusé (409, « navigation privée »). E-mail à l'auteur à chaque
  réponse (un échec ne perd pas la réponse). Mention FIXE, non réglable.
  **Choix du lecteur** (demande de l'éditeur) : au clic, `AMORCE_ARTEFACT`
  répond à `choix?` en relevant cases, radios, listes, curseurs, nombres et
  `<output>` — JAMAIS un champ de saisie libre (un test le garde) — avec le
  texte SOURCE (pas `innerText` : `text-transform` rendait les titres en
  majuscules) ; libellé = légende, groupe ARIA ou titre précédent. Le lecteur
  VOIT la liste et décoche ; tout est revalidé au serveur (`choixValides`, 20
  au plus). Limite : un total calculé (texte simple) ne remonte pas ; une page
  peut exclure un champ par `data-getgents-ignorer`. Pas de capture des
  boutons d'artefact React (`aria-pressed`). Réponses effacées AVEC la page
  (pas à 120 jours comme la lecture). Vérifié au navigateur (mémoire locale,
  devis d'exemple). **Déployé, essai réel CONCLUANT (19/11)**, migration 031
  passée, e-mail à l'auteur compris.
- **Cinq exemples, question d'accueil, « Adapter avec mon IA »** (19/11 ;
  `lib/exemplesPages.ts`, `AccueilPages`, `PictoPublic`, `AdapterExemple`).
  Trois exemples de plus (devis de salle de bains, comité de direction,
  week-end à Étretat), chacun avec sa question piège (« commencer avant
  Noël », « budget de Vernay », « venir avec son chien »), gardée par un test.
  Devis et week-end posent le BOUTON D'ENGAGEMENT à la création (« Je souhaite
  donner suite », « Je viens », mot autorisé) : on découvre la réponse du
  lecteur et ses choix. L'accueil demande « Avec qui voulez-vous partager ? »
  (clients / équipe / proches / recruteur, pictos « mini-pages » choisis par
  l'éditeur, variante A) ; rien n'est gardé, la question oriente. « Adapter
  avec mon IA » (fiche d'un exemple, à la place de « Nouvelle version ») :
  Getgents n'appelle AUCUN modèle — il copie une consigne + le code
  (`consigneAdaptation` : garder la forme, remplacer tout le fictif, demander
  plutôt qu'inventer, retirer le bandeau, code complet), l'IA de l'utilisateur
  adapte, le résultat se colle en NOUVELLE page — jamais en version de
  l'exemple (recommandation acceptée par l'éditeur). Vérifié au navigateur
  (mémoire locale), ordinateur et téléphone. **Déployé, essai réel CONCLUANT
  (19/11).** Manque connu : l'accueil n'existe que SANS page — après un
  premier exemple, plus aucun chemin vers les autres.
- **Plus de fenêtre « Partager vos données ? » : la lecture se JOINT à une
  réponse** (19/11 ; `useLecture` de `VuePartage`, `lectureValide`,
  `pastillesLecture`, migration 032 à passer AVANT — sans elle, une réponse
  part SANS sa lecture, journal `lecture_sans_colonne`). L'éditeur voulait
  « partagé par défaut » + une phrase sous le bouton : REFUSÉ sur conseil
  (suivi nominatif sans accord préalable, consentement lié à un autre geste —
  RGPD art. 7 —, mention « Rien d'autre n'est envoyé » devenue fausse ; NON
  validé par un juriste). Retenu : ouverture ANONYME envoyée à l'arrivée (une
  ligne, sans lien) ; la visite EN COURS (début, durée onglet visible, partie
  lue) est mesurée DANS la page, rien n'est envoyé ni gardé dans le
  navigateur, et ne part qu'avec la réponse si le lecteur coche « Joindre ma
  lecture de la page » (NON cochée par défaut ; l'appareil est déduit par le
  serveur). PAS de compte des visites précédentes : il faudrait une trace
  avant l'accord. Fiche : pastilles sur la réponse (« N'a pas joint sa
  lecture » sinon), tuile « N / M destinataires ont répondu » ; « Lectures
  partagées » ne s'affiche plus que pour les lectures de l'ANCIENNE fenêtre,
  jusqu'à leur effacement (120 j). L'e-mail « première lecture partagée » ne
  part plus. La route `/lecture` accepte encore `consentement: true` (vieux
  onglets ouverts). Vérifié au navigateur (mémoire locale) : aucune fenêtre
  à 11 s, un seul battement anonyme, case décochée, mention qui s'allonge,
  réponse avec et sans lecture.
- **Envoi par WhatsApp et LIENS DE GROUPE** (19/11, maquettes validées ;
  `lib/groupesPages.ts`, `lib/server/groupesPages.ts`, `ChoixPrenom`,
  migration 033 à passer AVANT — sans elle, créer un groupe répond 503 et
  les liens ordinaires ne changent pas). WhatsApp : AUCUNE API, `wa.me/?text=`
  avec le message prérempli (« Bonjour Marie, voici « … » : lien ») ;
  l'auteur choisit le contact ou le groupe et envoie depuis SON numéro.
  Écartés : automatiser un numéro personnel (interdit par WhatsApp, risque de
  bannissement) et l'API Business de Meta (compte vérifié — donc société —,
  numéro dédié, modèles approuvés, coût, et messages partis du numéro de
  Getgents ; groupes NON vérifiés d'ici). Lien de groupe = UN lien
  (`artefacts_partages`, destinataire = nom du groupe) + liste d'invités
  (`partages_groupes`, 50 au plus, sans doublon à la casse et aux accents
  près) ; le lecteur choisit son prénom (« Qui êtes-vous ? », retenu sur
  l'appareil, « Changer » dans le bandeau), une réponse par (lien, invité) —
  contrainte unique remplacée par un index `(jeton, coalesce(invite,''))`.
  Le prénom n'est PAS vérifié : avertissement à la création, et la
  protection par code bloque déjà un lien adressé à un nom. Les prénoms qui
  ont répondu sont grisés pour tous (choix de l'éditeur : ça pousse les
  retardataires). Activité : grille « a répondu / en attente » et
  « Relancer » (WhatsApp avec les prénoms manquants). « Invités » sur la
  ligne du groupe modifie la liste ; retirer un invité ne supprime pas sa
  réponse. Sans bouton d'engagement, un lien de groupe ne demande pas de
  prénom. Vérifié au navigateur (mémoire locale) : deux réponses, prénom
  hors liste refusé (400), double réponse refusée (409), relance, mobile.
  **Déployé (19/11)**, migrations 032 et 033 passées, essai réel CONCLUANT.
- **Onglet ACTIVITÉ réorganisé** (19/11, maquette validée ; `ReponsesPage`
  devenu le tableau de l'onglet, `lib/syntheseReponses.ts`). Ordre : bandeau
  « N réponses sur M attendues » (un lien personnel compte un, un lien de
  groupe compte chacun de ses invités ; « Il manque… » ; relance directe s'il
  n'y a qu'une cible, sinon ancre vers « Qui a répondu ») → « Ce qu'ils ont
  choisi » (total des choix par section, options les plus choisies d'abord,
  noms sous les minoritaires ; une valeur seulement chiffrée s'affiche avec
  son titre) → réponses filtrables (toutes / nouvelles / avec un mot) → à
  droite : qui a répondu (relance WhatsApp par lien), courbe des ouvertures
  sur 14 jours (`parJour` ajouté à `Activite`, SANS nom), dernières
  questions, anciennes lectures repliées. Export CSV dans le navigateur
  (point-virgule + BOM pour Excel, formules neutralisées, nom de fichier en
  ASCII — sinon « download »). `ActivitePage` ne rend plus rien en vue
  « activite » : il fournit ses chiffres par `onActivite`. Volontairement
  ABSENT : « a ouvert sans répondre » par destinataire (lecture anonyme sans
  accord). Vérifié au navigateur (mémoire locale) : 3 réponses dont 2 de
  groupe, filtres, CSV téléchargé, téléphone sans débordement. **Déployé,
  essai réel CONCLUANT (19/11).**
- **Aperçu du lien (WhatsApp, LinkedIn, Slack…)** (20/11 ; `lib/apercuLien.ts`,
  `lib/server/apercuLien.ts`, `app/partage/[jeton]/opengraph-image.tsx`) :
  `/partage/<jeton>` n'avait AUCUNE balise Open Graph — l'aperçu reprenait la
  description générique du site. Désormais : titre de la page (« · pour
  Marie »), description = `<meta name="description">` de la page, sinon son
  CHAPEAU (paragraphe avant le premier `<h2>` : plus loin, c'est une note),
  sinon une phrase générique ; vignette 1200×630 avec le bouton de réponse.
  Ce que montre l'aperçu, tout le groupe le voit et le service le met en
  cache : destinataire en adresse e-mail JAMAIS affiché, extrait refusé s'il
  contient une coordonnée, page PROTÉGÉE = titre seul (déjà visible sur
  l'écran du code), protection illisible = supposée active. Lien expiré :
  carte générique. WhatsApp garde l'aperçu en cache PAR ADRESSE : essayer
  avec un lien neuf. Payé en passant : le ✦ des vignettes s'affichait en
  carré vide (absent de la police de `next/og`), remplacé par un SVG.
  **Vignette « pages empilées »** (20/11, style B choisi par l'éditeur parmi
  trois ; `lib/vignetteLien.ts`) : couleur tirée du TITRE (4 palettes),
  feuilles inclinées, confettis, étiquette « psst, c'est privé ! » (« protégé
  par code », « lien expiré »). Police Bricolage Grotesque (OFL) dans
  `lib/og/polices`, lue par `readFile` et embarquée par
  `outputFileTracingIncludes` (vérifié dans le `.nft.json` du build) ; sans
  elle, police par défaut et journal `vignette_sans_polices`. Une police
  manuscrite écartée : pas de « é ». L'aperçu par CAPTURE réelle de la page
  a été discuté et NON retenu (Chromium dans une fonction, contenu réel
  montré à tout le fil et caché par Meta). **Déployé, essai réel CONCLUANT
  dans WhatsApp (20/11).**
- **Aperçu du lien par CAPTURE de la page** (25/11, choix de l'éditeur :
  « nette » parmi deux maquettes ; `lib/apercuCapture.ts`,
  `lib/server/captureApercu.ts`, `lib/server/apercusLien.ts`,
  `lib/server/vignetteCapture.tsx`, `BlocApercuLien`, migration 039 à passer
  AVANT — sans elle l'option reste coupée et l'activation répond 503). Revient
  sur le refus du 20/11 parce que c'est une OPTION PAR PAGE, coupée par défaut :
  l'image sort du lien privé (tout le groupe la voit, WhatsApp la garde,
  révoquer ne la retire pas d'un message envoyé) — c'est à l'auteur d'en
  décider, et il VOIT l'image exacte avant d'activer (même fonction que la
  vignette servie). Jamais sur une page protégée par code (capture et
  activation refusées, 409). Capture faite UNE FOIS PAR VERSION, jamais quand
  WhatsApp vient chercher l'image (trop lent) : un vrai Chromium côté serveur
  (`@sparticuz/chromium` 153 + `puppeteer-core` 25.12 sur Vercel, versions
  appariées ; en local le Chromium de Playwright, `CHROMIUM_CAPTURE`), haut de
  la page en 1200×630, document servi sous la CSP `sandbox` des lecteurs,
  requêtes limitées au web PUBLIC (`adresseAutorisee` : ni localhost, ni
  réseau privé, ni 169.254.169.254 — le rebond DNS n'est pas couvert), 20 s
  au plus, page restée vide = pas d'aperçu. Image dans le seau PRIVÉ
  `pages-apercus` (`<page>/v<version>.png`), servie par la route de la
  vignette. Une nouvelle version SUSPEND l'aperçu (vignette ordinaire) jusqu'à
  la capture suivante : refaite à l'ouverture de la fiche, ou par la tâche
  horaire (3 par passage, `recapturerPagesChangees`). Composition : style
  « pages empilées », capture sur la feuille de devant, bouton de réponse,
  étiquette — RIEN de propre au lien (pas « pour Marie »), même image pour
  tous. Binaire embarqué par `outputFileTracingIncludes` (vérifié dans le
  `.nft.json`), `serverExternalPackages`. Vérifié en local (mémoire locale) :
  capture ~1 à 8 s, activation, vignette du lien, nouvelle version → vignette
  ordinaire puis recapture à l'ouverture, page protégée, suppression. NON
  vérifié : Chromium sur Vercel (démarrage à froid, mémoire, polices et
  emoji du paquet), et l'aperçu réel dans WhatsApp — premier essai à lire
  dans `getgents:apercu-lien` (`capture_faite` / `capture_echouee`).
- **Rubrique « Modèles »** (19/11, maquette validée ; « Exemples » renommé
  par l'éditeur — le mot dit qu'on part de la page pour en faire la sienne ;
  `GalerieModeles`, `/pages/modeles`, `modelesEssayes`, `modelesASuggerer`).
  Comble le trou ci-dessus : entrée du rail entre « Mes pages » et
  « Connecter un assistant IA », filtres par public, un modèle déjà essayé
  (page du compte dont l'origine le nomme) affiche « Ouvrir » et « Adapter
  avec mon IA » au lieu d'être recréé. « Mes pages » propose « N autres
  modèles à essayer » TANT QUE le compte n'a QUE des modèles — la carte part
  dès une vraie page. L'accueil d'un compte vide ne change pas. Renommé à
  l'écran seulement (accueil, badge de la fiche, « Modèle Getgents »,
  fenêtre d'adaptation) : le bandeau DANS les pages reste « PAGE D'EXEMPLE »
  (il prévient le LECTEUR que le contenu est fictif), et le code comme
  l'origine `exemple:` en base gardent leur nom — aucune migration. Galerie
  de la COMMUNAUTÉ : conseillée plus tard, ÉDITÉE par l'éditeur (proposer →
  rendre fictif → relecture), jamais en libre-service : les vraies pages
  portent clients et prix, et une page publique de code arbitraire fait de
  l'éditeur un hébergeur à modérer (avis d'un juriste avant).
- **« Nous contacter » dans Mon compte** (20/11 ; `NousContacter`,
  `lib/contact.ts`, `POST /api/contact`) : une phrase, un champ, « Envoyer »
  — PAS de choix « idée / question » (retiré à la demande de l'éditeur).
  Préféré à une tirette sur le bord de l'écran ; l'e-mail à J+3 et l'entrée du
  rail restent en MAQUETTE (`mockups/feedback/`). E-mail vers
  `ADRESSE_NOTIFICATIONS_EDITEUR`, « Répondre » = l'adresse du compte. RIEN
  en base (aucune migration) : un échec Brevo est dit et le texte reste dans
  le champ. Plafond de 5 par heure EN MÉMOIRE de l'instance (approximatif,
  voulu). Vérifié au navigateur sur une page d'essai (Mon compte exige
  Supabase) : échec réel sans Brevo, succès simulé, téléphone. PAS en
  production.
- **Être proposé par les IA : annuaires et pages d'aide** (23/11, demande de
  l'éditeur, qui veut rester DISCRET — aucune promotion en son nom ;
  `lib/connecteurPublic.ts`, `docs/annuaires.md`). Positionnement : PAS
  « publier » (Claude publie déjà un artefact par lien public) mais « envoyer
  à une personne et recueillir sa réponse ». Une seule source pour la page
  `/aide/connecteur` (exigée par l'annuaire de Claude), `/llms.txt`, la fiche
  du registre (`server.json`, nom `ai.getgents/pages`, preuve de domaine
  HTTP : `/.well-known/mcp-registry-auth` lit `MCP_REGISTRE_PREUVE`, 404 sans
  elle) — un test garde leur accord. Page `/aide/partager-un-artefact` :
  comparaison HONNÊTE des trois façons (publication intégrée, fichier,
  Getgents). Conditions d'utilisation `/cgu` rédigées par l'agent, NON
  relues par un juriste. Descriptions des outils et consigne du serveur
  complétées en anglais ; titre du serveur « Getgents Pages » (GetSite
  retiré). ChatGPT ÉCARTÉ : vérification d'identité au nom de publication.
  Ne JAMAIS citer le dépôt GitHub dans une fiche (il porte le nom de
  l'éditeur). Vérifié au navigateur (ordinateur, téléphone). **PUBLIÉ au
  registre MCP officiel (23/11) : `ai.getgents/pages` 1.0.0, statut
  « active »**, depuis l'environnement de l'agent (`mcp-publisher` installé
  par `go install github.com/modelcontextprotocol/registry/cmd/publisher@latest`
  — les téléchargements de github.com sont bloqués, le proxy Go passe ; le
  Mac de l'éditeur n'avait ni OpenSSL 3 ni Homebrew). Clé générée par Node,
  clé privée DÉTRUITE après publication : pour publier une nouvelle version,
  régénérer une paire et remplacer `MCP_REGISTRE_PREUVE`. NON fait :
  soumission à l'annuaire de Claude (côté éditeur, compte payant).
  **Mise aux critères de l'annuaire de Claude (23/11)** : descriptions des
  outils et consigne du serveur réécrites en DESCRIPTIF (« ce que fait
  l'outil, ce qu'il attend ») — l'annuaire rejette les descriptions qui
  « disent à Claude comment se comporter » ; plus de « IMPORTANT »,
  « AVANT de », « Ne dis jamais » (un test le garde). Gardée, en phrase
  factuelle : « le destinataire voit tout, données personnelles
  comprises », pour que Claude vérifie AVANT l'appel — les alertes de la
  réponse arrivent après la création du lien (elles proposent
  `revoquer_partage`). Titre aussi dans `annotations`. `mettre_a_jour_page`
  passe en `destructiveHint: true` (remplace ce que voient tous les liens) :
  Claude demande confirmation à chaque mise à jour. Effet dans Claude après
  DÉCONNEXION/RECONNEXION du connecteur seulement.
  **SOUMIS à l'annuaire des connecteurs de Claude (23/11)** par l'éditeur
  (compte Pro, portail claude.ai/directory/manage). Réponses données :
  API propriétaire, pas de données de santé, pas de contenu sponsorisé,
  les sept engagements de conformité cochés ; prérequis et remarques en
  anglais (`docs/annuaires.md`). Examen automatique, listage « Community »
  attendu ; un passage « Verified » demanderait un compte d'essai DÉDIÉ
  (jamais celui de l'éditeur).
- **Lecteur en anglais, lot 1** (23/11, maquette validée ; `lib/langueLecteur.ts`,
  `lib/server/langueLecteur.ts`, `lib/server/routeLecteur.ts`, `ChoixLangue`,
  `BlocLangue`, migration 034 à passer AVANT — sans elle tout reste en
  « automatique », seul le réglage manuel répond 503). La langue de tout ce
  que voit le LECTEUR suit la PAGE, pas l'auteur : choix du lecteur (FR | EN
  du bandeau, cookie fonctionnel `gg_langue`, un an, `router.refresh` — le
  cadre n'est pas rechargé) > réglage de l'auteur (fiche, onglet Page, table
  `pages_langue`) > `<html lang>` de la page > langue du texte (mots
  courants, SANS modèle) > français. Deux langues seulement. Traduits :
  bandeau, boutons, réponse, code, « Who are you? », assistant (questions
  par défaut ; il répondait déjà dans la langue de la QUESTION),
  confidentialité du lecteur (la page /confidentialite reste en français :
  lien « (in French) »), messages d'erreur des routes du lecteur — traduits
  AU PASSAGE par `avecMessagesTraduits` (table `MESSAGES_EN`, un message
  absent reste en français), aperçu du lien et vignette, e-mail du code,
  modèle de mail du connecteur ET de la fiche, messages WhatsApp et
  relances. Ce que l'auteur écrit (intitulé, questions suggérées) n'est
  JAMAIS traduit ; la fiche propose des intitulés anglais pour une page
  anglaise. L'interface de l'AUTEUR reste en français (lots 2 et 3 non
  faits : vitrine, inscription, aide, juridique ; application de l'auteur,
  modèles). Un test garde que FR et EN ont les mêmes clés. Vérifié au
  navigateur (mémoire locale) : page anglaise, réponse, assistant, bascule
  FR, groupe, code, vignette, fiche, téléphone.
- **QR code d'un lien, prolongation, bandeau d'expiration** (23/11, maquette
  validée ; étape 1 du lot « Partager » — `lib/qrCode.ts`, `lib/dureeLien.ts`,
  `FenetreQr`, `POST /api/partages/prolonger`, aucune migration). Le QR est
  calculé dans le NAVIGATEUR de l'auteur (`qrcode-generator`, MIT ; aucun
  service extérieur) : noir sur blanc, zone de silence de 4 modules,
  correction « M » — pas de logo ni de couleur, ils fragilisent la lecture.
  PNG (échelle ENTIÈRE, ~1 000 px, jamais de module flou), SVG, copie
  d'image ; relu en test avec `jsqr` (devDependency) et vérifié au
  navigateur : le PNG ET le SVG téléchargés redonnent le lien. Bouton
  « ▦ QR code » sur chaque lien actif non bloqué et après la création d'un
  lien. **Le vrai risque d'un QR est l'EXPIRATION** (30 jours : une affiche
  imprimée meurt sans prévenir) : la fenêtre dit jusqu'à quand il marche, et
  **« Prolonger » refait durer 30 jours À PARTIR D'AUJOURD'HUI** (pas un
  ajout), sans changer le lien ni le QR. Un lien RÉVOQUÉ ne revient jamais ;
  un lien EXPIRÉ redevient actif et COMPTE dans le plafond de 200 liens
  actifs (refusé avec le message du plafond sinon) ; prolonger un lien actif
  n'y change rien. Garde de propriété dans la requête (`owner_id`), 50 jetons
  au plus par appel. Le lecteur ne voit jamais l'échéance. Bandeau orange en
  tête de l'onglet quand un lien expire dans moins de 7 jours
  (`SEUIL_BANDEAU_JOURS`) avec « Prolonger » en bloc ; échéance en couleur
  sur chaque ligne. Sur une page protégée par code, la fenêtre rappelle que
  le QR seul n'ouvre rien. Onglet encore nommé « Destinataires » : le renommer
  « Partager » et le réorganiser est le LOT SUIVANT (décidé, nom choisi par
  l'éditeur). Vérifié au navigateur (mémoire locale) : liens actif / bientôt /
  groupe / expiré / révoqué, prolongation depuis la fenêtre, la ligne et le
  bandeau, téléphone sans débordement.
- **Rappel d'expiration par e-mail, 48 h avant** (23/11, étape 2 du lot « Partager » ;
  `lib/jetonRappel.ts`, `lib/emailRappelExpiration.ts`, `lib/rappelsExpiration.ts`,
  `lib/server/rappelsExpiration.ts`, `app/partage/rappel/[token]`, `POST /api/rappel`,
  migration 037 à passer AVANT — sans elle, aucun rappel ne part et la
  prolongation marche quand même, journal `migration_037_absente`). Tâche
  horaire (`/api/routines/run`), UNE fenêtre par jour à 8 h Paris : un lien
  expirant dans 48 h est rappelé au premier passage, donc **le mail arrive
  entre 24 h et 48 h avant l'échéance**, pas à 48 h pile. Un e-mail PAR AUTEUR
  (20 liens listés au plus, « Tout prolonger » pour le reste), marquage
  (`rappel_expiration_le`) APRÈS envoi réussi seulement ; auteur désabonné ou
  sans adresse confirmée : marqué sans envoi ; lecture du compte en échec :
  réessayé le lendemain. Prolonger remet le marquage à zéro. Boutons du mail =
  jetons SIGNÉS (HMAC dérivé de `SECRET_BOX_KEY`, 14 jours, compte + action
  dans le jeton, pas de connexion) vers une page de CONFIRMATION : le GET ne
  change rien (les messageries d'entreprise ouvrent les liens), seul le
  bouton (POST) agit. Désabonnement : « Ne plus recevoir ces rappels » ou
  Mon compte (`rappels_expiration` dans `user_metadata`, activé par défaut).
  Bandeau de la fiche : toujours 7 jours, seuil distinct de l'e-mail. Piège
  payé : `Intl` en `fr-FR` rend l'heure « 08 h » (Number → NaN, aucun rappel
  ne serait parti) — locale `en-GB` + `formatToParts`. Vérifié : tests
  (orchestration avec fausses dépendances, jetons) et page de confirmation au
  navigateur ; l'ENVOI réel (Brevo) et la lecture Supabase n'ont tourné nulle part.
- **Onglet « Destinataires » renommé « Partager »** (23/11, lot suivant du QR) :
  Page = ce qui vaut pour TOUS les liens (aperçu, langue, engagement, fichiers,
  données partagées, versions) ; Partager = liens, groupes, WhatsApp, QR code,
  échéances et accès par code. Le contenu de l'onglet était déjà celui-là
  (étapes 1 et 2) : seuls le nom, l'identifiant interne (`partager`) et le
  titre de bloc (« Liens · N actifs ») ont changé. Vérifié au navigateur.
- **Pages de GROUPE depuis Claude : sans destinataire, votes partagés** (23/11 ;
  vécu : Claude refusait de partager une page de vote pour 9 personnes).
  `partager_page` accepte l'absence de `destinataire` (contenu neuf
  seulement) : page créée SANS lien, l'outil rend l'adresse de sa fiche, où
  l'auteur crée un lien de groupe. **`window.storage` est SERVI** (lot 2,
  `lib/stockagePage.ts`, `lib/server/stockagePages.ts`, migration 035 à
  passer AVANT — sans elle, le stockage partagé répond « indisponible ») :
  l'amorce relaie au PARENT (`stockage?`/`stockage!`, puis une requête par
  opération ; sans réponse en 1,5 s, mémoire de la page comme avant), qui
  appelle `/api/partage/<jeton>/stockage` (lien + code d'accès) ou, dans la
  fiche, `/api/pages/<id>/stockage` (`useStockagePartage`). `shared` vrai =
  commun à TOUS les liens de la page ; faux = localStorage du PARENT, par
  lien et par appareil. Bornes : clé 200, valeur 100 Ko, 500 clés, 2 Mo par
  page, 60 écritures/min par lien (mémoire de l'instance). Bloc « Données
  partagées » (onglet Page) : résumé et « Effacer » ; effacé avec la page.
  `window.storage` n'est plus signalé comme « branché sur Claude » ;
  `window.claude` l'est toujours. Vérifié au navigateur (mémoire locale) :
  deux lecteurs, votes communs, vote personnel retrouvé au rechargement,
  aperçu de l'auteur, effacement. **Fichiers joints** (lot 3,
  `lib/fichiersPage.ts`, `lib/server/fichiersPages.ts`, `BlocFichiers`,
  migration 036 à passer AVANT — seau PRIVÉ `pages-fichiers` + table
  `pages_fichiers` ; sans elle, la fiche le dit et les pages s'affichent sans
  médias) : la page appelle un média par son NOM (`src="musique.mp3"`, ou un
  chemin Claude qui finit par ce nom) ; la fiche liste les fichiers ATTENDUS
  (`fichiersReferences`) et « Ajouter » envoie le fichier choisi SOUS le nom
  attendu. Envoi DIRECT navigateur → Supabase Storage (adresse signée,
  `createSignedUploadUrl`) : une fonction Vercel plafonne le corps à 4,5 Mo.
  Confirmation : l'objet est RELU (taille, type) avant la ligne. Au service
  du document (lien, domaine de contenu, aperçu), chaque référence est
  réécrite vers une adresse signée d'1 h (`contenuAvecFichiers`) — une
  adresse web externe n'est jamais touchée. 50 Mo par fichier, 100 Mo et 20 (relevé le 23/11 pour une bande audio, migration 038 : le seau a son propre plafond, et l'offre gratuite de Supabase borne un fichier à 50 Mo)
  fichiers par page ; images, sons, vidéos, PDF. Le connecteur liste les
  fichiers appelés (`fidelite.fichiers`). Vérifié au navigateur en MÉMOIRE
  LOCALE seulement (fichier servi en `data:`) : le chemin Supabase (envoi
  signé, relecture, adresses signées) n'a tourné NULLE PART — premier essai
  réel à surveiller (`getgents:fichiers`). **Noms LONGS (23/11, vécu sur
  « footix »)** : un fichier nommé « Justice - Flower In A Hurricane (ft X, Y)
  [from Z].mp3 » n'était JAMAIS réécrit — la regex coupait aux espaces,
  parenthèses et virgules, « Remplacer » changeait un fichier que la page ne
  lisait pas, et rien ne le disait. Désormais recherche LITTÉRALE du nom
  (`avecFichiers`, `regexDesNoms` : tel quel, `%20`, `encodeURIComponent`,
  `&amp;`, avec chemin éventuel ; adresse externe jamais touchée) et chaînes
  entre guillemets lues en entier (`fichiersReferences`). **Témoin** dans la
  fiche : « La page n'appelle pas ce fichier » (`fichiersUtilises`, champ
  `utilise` de `GET /fichiers`) — cas d'un son INTÉGRÉ au code en `data:` :
  il faut alors demander à Claude (`mettre_a_jour_page`) d'appeler le fichier
  par son nom. Le connecteur ne peut PAS envoyer de fichier (texte seulement).
- **mcptry et découverte SANS jeton** (23/11 ; l'annuaire mcptry, qui
  recense le registre MCP officiel, a écrit à l'éditeur : Getgents Pages
  792ᵉ/1837 « Communication », 58/100). Deux leviers pris : (1)
  `initialize`, `tools/list` et `ping` (et les notifications) répondent SANS
  jeton (`corpsPublic`, `lib/mcpPartage.ts`, LISTE BLANCHE ; `repondreSansJeton`,
  contexte sans propriétaire dont chaque outil lève — rien ne peut s'écrire) ;
  `tools/call`, un lot mixte, un jeton présent mais invalide, et `GET` restent
  en 401 + `WWW-Authenticate`. Journal `getgents:mcp decouverte_sans_jeton`.
  Vérifié (client OAuth rejoué en local : inscription, code, jeton, partage,
  liste ; sans jeton 200 sur la découverte, 401 sur l'appel). **Essai réel
  CONCLUANT (23/11, l'éditeur : « ça marche »)** : la connexion se déclenche
  toujours dans Claude. Si un AUTRE client se comporte autrement (affiche
  « connecté » sans lancer OAuth avant le premier `tools/call`), RÉTABLIR le
  401 partout (reprendre l'ancien `POST` de `app/api/mcp/route.ts`).
  (2) icône dans `server.json` (`getgents-icone.png`, 1.0.1) ; PAS de lien
  `repository` (le dépôt porte le nom de l'éditeur — un test le garde). La
  republication au registre exige une NOUVELLE clé de preuve
  (`MCP_REGISTRE_PREUVE`, voir `docs/annuaires.md`) : à faire sur demande.
  Non fait : revendiquer la fiche (DNS ou fichier sur getgents.ai, +5 points
  et alertes de panne) — attend les instructions de mcptry.
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
- **Navigation : DEUX MODES, les marques en second** (12/11 ;
  `components/shared/SelecteurMode.tsx`, `lib/navigationModes.ts`). Les
  utilisateurs ne comprenaient pas Getgents / GetSpace / GetStudio : trois
  marques pour deux gestes, derrière un menu déroulant caché sous le logo qui
  ne montrait jamais la section courante (`ProductBrandMenu`, supprimé).
  Désormais : le logo ramène à l'accueil, et un sélecteur toujours visible
  `Utiliser | Construire` (GetSpace | GetStudio en info-bulle) marque la
  position courante. Changer de mode GARDE le gent ouvert (`cibleDuMode` :
  depuis `/builder/<id>`, « Utiliser » ouvre son espace — adresse privée
  comprise ; depuis `/espace/<id>`, « Construire » ses réglages). « Getgents »
  n'est plus une section : c'est l'accueil, qui s'ADAPTE (`StudioHome`) —
  vos gents d'abord si vous en avez (un diffusé s'ouvre pour s'en servir, un
  brouillon ouvre ses réglages), la création dessous ; un nouveau venu voit la
  création. Connexion et racine mènent à `/accueil` (`destinationApresConnexion`).
  « Mes gents » : chaque carte porte **Ouvrir** et **Configurer**,
  « Supprimer » passe sous « ⋯ ». Statuts : les MÊMES mots partout
  (`lib/statutGent.ts` : Brouillon / Diffusé / Privé) — le studio disait
  « Publié », GetSpace « Actif ». Ponts : « Ouvrir ce gent » dans le studio
  d'un gent diffusé (Preview reste la vue d'un visiteur), « Configurer ce
  gent » dans l'espace personnel. L'interface VOUVOIE partout
  (`__tests__/tonVous.test.ts`, GetSpace tutoyait). Payé en passant :
  GetSpace était illisible sur téléphone (la grille réservait une colonne au
  rail devenu tiroir fixe, toute la page tombait dans 66 px). Vérifié au
  navigateur en mode maquette (sans Supabase), PAS avec de vrais
  utilisateurs : rejouer « posez une question à votre gent X », « changez son
  prompt », « créez-en un » et noter le premier clic.
- **Créer et configurer ne partagent plus aucune entrée de menu.** Le rail a
  deux étages : GLOBAL (« + Nouveau gent », Mes gents — l'accueil passe par le
  logo) et, sous le
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

- **Temps de chargement de « Mes pages » et de la fiche** (23/11, ressenti
  « encore un peu long » de l'éditeur, NON mesuré en production — le réseau de
  l'agent ne joint pas getgents.ai). Corrigé dans le code : la liste est lue
  par le SERVEUR avec la page (`app/pages/page.tsx` → `initiales`) au lieu
  d'attendre HTML → JS → `/api/pages` ; `/api/pages/<id>` faisait ~11
  lectures UNE À UNE (dont toute la liste des pages pour savoir si c'était la
  première, et le contenu relu une seconde fois) — désormais `detailEtContenu`
  et `nombreDePages`, en parallèle ; la purge de l'onglet Activité part en
  même temps que la lecture. Aperçus du PROPRIÉTAIRE (vignettes, fiche)
  gardés 5 min dans son navigateur (`cacheDocument`, redirection ET document :
  l'adresse porte `?v=`) ; un lien de destinataire jamais (révocation
  immédiate). Limite : un fichier joint ajouté sans nouvelle version peut
  manquer à une VIGNETTE pendant 5 min (la fiche a `&f=`). Restent : chaque
  route appelle `auth.getUser()` (aller-retour vers Supabase Auth, deux pour
  un document : middleware + page) ; la fiche lance encore ses 8 blocs APRÈS
  `/api/pages/<id>`. **À VÉRIFIER d'abord** : la RÉGION des fonctions Vercel
  (Settings → Functions, défaut `iad1` Washington) contre celle de Supabase
  (Settings → General) — un océan entre les deux coûte ~80-100 ms par
  requête, et une fiche en enchaîne une dizaine.
  **Réglé (23/11)** : Supabase est à FRANCFORT ; `vercel.json` fixe
  `"regions": ["fra1"]` (Francfort), qui l'emporte sur le réglage du tableau
  de bord. Ne pas le retirer, et le changer si Supabase déménage.

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
- **Limite de crédit de la clé OpenRouter de la plateforme (réglée le 18/11)** :
  atteinte, OpenRouter répond 403 « Key limit exceeded ». Le lecteur d'une
  page lisait « Réessayez dans un instant », le visiteur d'un gent « La
  génération a échoué. Réessayez… » — faux, aucune tentative n'y change rien.
  Depuis : « l'assistant de cette page fait une pause » (`messageEchecAssistant`)
  et « ce n'est pas de votre fait » pour les gents (401/402/403). Le journal
  dit la vraie cause : `getgents:openrouter cle_refusee` (`message` d'OpenRouter)
  et `getgents:partage assistant_cle_refusee`. Remède : relever la limite sur
  openrouter.ai, pas de redéploiement.
- **Un état d'échec muet est pire qu'une erreur.** `busy_or_capped` confondait
  « il réfléchit » et « plafond atteint » ; Turnstile échouait sans un mot.

## Dette assumée, à traiter avant l'ouverture publique

- **Security Advisor de Supabase (18/11)** : traité par les migrations 028
  (vue d'annuaire SECURITY DEFINER retirée, elle n'était plus lue) et 029
  (`search_path` figé sur huit fonctions, `purge_usage_counters` et
  `increment_share_refresh` fermées à `anon`). RESTE, accepté : « Leaked
  password protection » exige l'offre Pro de Supabase. Compensé par
  l'invitation (peu de comptes) et la limite d'essais de Supabase.

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

**Next 15.5.29 + React 19 depuis le 18/11** : Next 14.2.35 (dernière 14.x)
cumulait une vingtaine d'avis (dont des dénis de service sur les Server
Components et un XSS lié aux nonces CSP), tous corrigés en 15.5.28. API de
requête asynchrones migrées par le codemod officiel (`await props.params`,
`await cookies()`). Restent deux avis de CONSTRUCTION (postcss embarqué par
Next, source-map-js) : ils ne jouent que sur nos propres feuilles de style.
Inscription OAuth dynamique plafonnée à 200 par heure, refus journalisés
(`getgents:oauth-mcp inscription_refusee`).

Historique : **deux avis de sécurité restaient ouverts**, et ils exigeaient Next 16 — deux
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

**Bascule lancée (13/10)** : motif financier — Vercel Pro à 20 $/mois pour
un usage faible ; Railway facture l'usage (~5 $/mois attendus, à vérifier
sur la facture). Vercel Hobby ÉCARTÉ : 60 s de plafond contre 17 routes à
300 s. Étape 1 faite dans le code : `images.unoptimized` (aucun `next/image`
dans le projet ; `/_next/image` répond 404, l'avis « Image Optimizer » ne
s'applique plus) et `engines.node = 22.x` (version testée). Vérifié :
`next build` puis `PORT=… next start` démarre, le cron refuse sans secret.
Reste, côté utilisateur : projet Railway branché sur `main` ; variables
(`NEXT_PUBLIC_*` présentes À LA CONSTRUCTION, `SECRET_BOX_KEY`,
`CRON_SECRET`, Supabase, OpenRouter, OAuth Google — dont l'URI de redirection
à déclarer pour le nouveau domaine de test) ; cron horaire Railway
`curl -H "Authorization: Bearer $CRON_SECRET" https://getgents.ai/api/routines/run` ;
essai sur l'adresse Railway ; DNS ; Vercel gardé une semaine en secours.

**Bascule MISE DE CÔTÉ (12/11, décision de l'utilisateur)** : Vercel reste
l'hébergeur. Arrêtée au cron de test (refusé en 401 : secret différent entre
les deux services). Les réglages de l'étape 1 restent, ils valent aussi sur
Vercel. Le projet Railway est passé sur l'offre GRATUITE (13/11) : plus de
facture, mais il existe encore — à supprimer si la bascule est abandonnée.

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

`COMPTES_COMPLETS` : identifiants Supabase (Authentication → Users → UID)
des comptes qui gardent les GENTS, séparés par des virgules. Tout compte
absent est « Getgents Pages ». Y mettre SON PROPRE identifiant AVANT de la
régler, sinon on se ferme ses propres gents (la retirer rouvre tout). Lue
à l'exécution (middleware et routes), un redéploiement suffit. RÉGLÉE en
production (13/11) avec le compte de l'éditeur.

`MCP_REGISTRE_PREUVE` : la ligne PUBLIQUE `v=MCPv1; k=ed25519; p=…` qui
prouve au registre MCP officiel la propriété de getgents.ai (procédure dans
`docs/annuaires.md`). Pas un secret. RÉGLÉE en production (23/11) ; la clé
privée correspondante a été détruite après la publication — en changer
la ligne ne casse rien, elle ne sert qu'à publier.

`DOMAINE_CONTENU` = `www.getgents-pages.com` (domaine acheté chez
Squarespace le 13/11). Le `www` est VOULU : Vercel a fait de `www` le
domaine principal et redirige le domaine nu vers lui (308) — avec le
domaine nu dans la variable, chaque cadre suivrait la redirection vers un
hôte qui n'est plus celui configuré, et le code répondrait 404. Elle
active le domaine de contenu des pages partagées. Lue À LA CONSTRUCTION par
`next.config.mjs` — la régler ou la changer exige un REDÉPLOIEMENT. Ordre :
domaine ajouté au projet Vercel et DNS pointé AVANT la variable, sinon les
cadres partent vers un domaine qui ne répond pas. La retirer + redéployer
revient à l'état d'avant (repli immédiat en cas de souci). **Piège payé (16/11)** : un
filtre web d'entreprise a BLOQUÉ le domaine (« Newly Registered and
Observed Domains ») — la plupart des filtres bloquent un domaine de moins
de ~30 jours, certains ensuite tout domaine non catégorisé ; les
destinataires visés sont justement en entreprise. Demandes de
catégorisation faites le 16/11 (catégorie « Business », second choix
« Computers and Internet » ; jamais « Web Hosting » / « File Sharing »,
les plus bloquées) chez Palo Alto, Fortinet, Cisco Talos, Broadcom,
Trellix, puis Zscaler (Site Review, 18/11) : les six principaux sont
demandés. **Parades
écrites (16/11), DÉPLOYÉES, essai réel CONCLUANT (18/11)** : (1) REPLI AUTOMATIQUE (`useCadreAvecRepli`) — le
document poste `{getgents:"pret"}` au tout premier script de
`AMORCE_ARTEFACT` ; si le cadre a fini de charger sans ce signal (page de
blocage du filtre), la page recharge depuis getgents.ai avec `?direct=1`
(ou le champ `direct` pour l'aperçu collé), qui saute la redirection —
l'état d'avant le domaine séparé, mêmes gardes d'accès, même CSP
`sandbox`. Seul le PREMIER chargement de chaque document est jugé (une
navigation interne de l'artefact ne déclenche rien), le repli dure le
temps de la page. Partout : lien du destinataire, fiche, vignettes, aperçu
collé (dont l'aperçu vide, qui porte désormais l'amorce, sinon il forçait
le repli). (2) RACINE du domaine de contenu : page statique qui dit ce
qu'est le domaine (middleware, CSP `default-src 'none'`), pour les
vérificateurs des filtres. Vérifié au navigateur contre un FAUX FILTRE
(domaine de contenu pointé sur un serveur qui ne rend que « Website
blocked ») : document affiché chez le destinataire en ~4 s, fiche,
vignette et aperçu repliés ; sans filtre, rien ne bascule. Piège de test :
`context.route` de Playwright n'intercepte pas la requête qui SUIT une
redirection — le premier essai « réussissait » sans rien bloquer. **« Plein écran » → « Ce site est inaccessible » (19/11, vécu)** : le
lien ouvrait le DOCUMENT lui-même dans un onglet, donc directement le domaine
de contenu, SANS le repli du cadre — sur un réseau qui ne le joint pas,
erreur sèche (le cadre de la fiche, lui, se repliait sans bruit). Depuis :
`/pages/<id>/plein-ecran`, le même `CadreApercu` sur toute la fenêtre, monté
APRÈS l'hydratation (rendu au serveur, son `load` précédait React et rien
n'était jugé). Et un FILET dans `useCadreAvecRepli` (8 s sans signal `pret`,
même sans `load` — un domaine injoignable peut ne jamais le livrer ; ignoré
sans cadre ou pour une vignette `lazy`). Chaque repli est JOURNALISÉ
(`getgents:contenu repli_direct`) : le repli masquait un domaine injoignable
pour tous. Beaucoup de `repli_direct` d'un coup = vérifier DNS et Vercel. Ne
jamais ouvrir un document du domaine de contenu hors d'un cadre avec repli. Cause
CONFIRMÉE (19/11) : le réseau d'ENTREPRISE de l'éditeur (connexion
réinitialisée, pas de page « bloqué ») ; tout passe en 4G. Un filtre qui
COUPE la connexion au lieu d'afficher une page n'envoie pas de `load` à
temps : c'est le cas que couvre le filet de 8 s. **Déployé, essai réel CONCLUANT depuis ce
réseau (19/11)** : aperçu, plein écran et lien du destinataire.

**BREVO EST CONFIGURÉ** en production (12/11, e-mail d'invitation reçu par
l'utilisateur). Il ne l'était pas jusque-là : invitation par e-mail,
notification de signalement, notification d'usage par un invité et note de
routine ne faisaient rien. Variables : `BREVO_API_KEY` (clé API `xkeysib-`,
PAS une clé SMTP `xsmtpsib-`), `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`
(facultatif). Piège payé : premier envoi refusé en **401** — soit le filtrage
« IP autorisées » de Brevo (Vercel appelle depuis des adresses qui changent :
le désactiver, pas lister des IP), soit une mauvaise clé ; le message qui suit
le code dans `getgents:email` tranche. L'authentification du domaine chez
Brevo (DNS) conditionne la délivrabilité : un e-mail en indésirables = DNS.

**Inscription LIBRE PLAFONNÉE (18/11, choix de l'éditeur : option A,
50 comptes ; `/api/inscription`, `lib/server/inscriptions.ts`, migration 030
à passer AVANT le déploiement)** : `INSCRIPTIONS_PLAFOND` (Vercel, lue à
l'exécution) ouvre `/inscription` (adresse, mot de passe, « avec qui, et
quoi » FACULTATIF) tant qu'il reste des places ; absente ou 0 = demande
d'accès comme avant ; plafond atteint = « places prises » + demande d'accès,
et la vitrine suit. Supabase garde ses inscriptions publiques FERMÉES (mon
conseil était l'option B, invitation automatique ; l'éditeur a choisi A) :
c'est le SERVEUR qui crée le compte (`auth.admin.generateLink`
type `signup`, clé de service) APRÈS lecture du compteur — ouvrir Supabase
aurait laissé créer des comptes par son API sans plafond. Lecture du
compteur en échec = FERMÉ. 10 par heure au plus, champ piège. E-mail de
confirmation par BREVO (pas Supabase) vers `/auth/confirm?type=signup` →
`/accueil` → `/pages` ; e-mail non parti = compte retiré. Adresse déjà
inscrite : même écran, e-mail « vous avez déjà un compte » à elle seule
(pas d'énumération). L'éditeur reçoit un e-mail par compte. **Aucun décompte de places à l'écran (20/11, demande de l'éditeur)** : ni « places limitées » sur la vitrine, ni « il en reste N » (vitrine, /inscription) ; plafond atteint = « inscriptions momentanément fermées ». Le plafond reste appliqué côté serveur ; le nombre restant ne figure plus que dans l'e-mail à l'éditeur. **Essai réel CONCLUANT (18/11)** : `generateLink` passe bien avec les
inscriptions Supabase fermées ; lien de l'e-mail → Mes pages. NON vérifié :
une adresse inscrite NON confirmée (reçoit « déjà un compte » sans pouvoir se
connecter). Deux inscriptions simultanées à la 50ᵉ place peuvent faire 51.

**Demande d'accès par FORMULAIRE** (13/11 ; `/inscription`,
`lib/demandeAcces.ts`, `/api/demande-acces`) : le bouton `mailto:` ouvrait
la messagerie du visiteur (et affichait CEO@getgents.ai) ; on perdait ceux
qui n'allaient pas au bout. Désormais adresse + « ce que vous aimeriez
construire » (20 à 1 500 caractères) + Envoyer. La demande est GARDÉE
d'abord (table `demandes_acces`, migration 027 à passer AVANT le
déploiement), l'e-mail part ensuite vers `ADRESSE_DEMANDE_ACCES` avec
`replyTo` = le demandeur (« Répondre » lui écrit directement) ; un e-mail
en échec ne fait pas perdre la demande (`notifie` reste faux). Route OUVERTE :
champ piège (accepté en silence, rien gardé), plafonds lus dans la table
(3 par adresse sur 24 h, 30 au total par heure). Effacées après 12 mois par
la tâche horaire (`purgerDemandesAcces`) — c'est ce qu'annonce la page
Confidentialité. Journal `getgents:acces` (`demande_recue`,
`notification_echouee`, `plafond`, `piege_rempli`) — sans l'adresse.
Vérifié en local (sans Supabase ni Brevo), PAS en production. **Essai réel (13/11)** : demande
gardée, e-mail ACCEPTÉ par Brevo (`notifie` vrai), et reçu sur
CEO@getgents.ai — mais AVEC RETARD (redirection) : sur le moment, on l'a cru
perdu. Leçon : `notifie` vrai = accepté par Brevo ; attendre avant de
conclure à une perte, et lire le statut dans les journaux Brevo. Depuis, les
notifications de l'éditeur (demandes d'accès, signalements, usage d'un lien)
partent vers `ADRESSE_NOTIFICATIONS_EDITEUR`, réglée sur Vercel SEULEMENT
(« Sensitive ») : c'est une adresse PERSONNELLE et le dépôt est public — ne
l'écrire NULLE PART (code, mémoire, commits, journaux, réponses au
navigateur). Absente ou mal formée : repli sur CEO@getgents.ai
(`lib/server/adresseEditeur.ts`). Le journal dit `destinataire: "reglee" |
"defaut" | "invalide"`, jamais l'adresse. CEO@getgents.ai reste l'adresse de
CONTACT affichée. **VALIDÉ en production (13/11)** : e-mail reçu à
l'adresse réglée, « Répondre » vers le demandeur.

**Supabase envoie ses e-mails d'authentification PAR BREVO** (SMTP
personnalisé, 13/11) : invitations, réinitialisations. Avant, l'envoi
intégré de Supabase plafonnait à quelques e-mails par heure — une
invitation tombait en 429 (`/auth/v1/invite`) après deux essais. Clé SMTP
Brevo (`xsmtpsib-`) DISTINCTE de la clé API de l'application ; elle vit dans
Supabase seulement. Plafond d'envoi réglé dans Authentication → Rate Limits.

Les inscriptions sont fermées **chez Supabase** (Authentication → Providers →
Email). `lib/inscriptions.ts` ne fait que rendre l'interface honnête — il ne
ferme rien à lui seul.
