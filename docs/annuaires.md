# Annuaires du connecteur Getgents Pages

Textes à coller dans les annuaires, et procédure. La source des descriptions
est `lib/connecteurPublic.ts` : la changer là d'abord, puis ici.

Adresse du connecteur : `https://getgents.ai/api/mcp` (Streamable HTTP, OAuth).
Documentation publique : `https://getgents.ai/aide/connecteur`.
Confidentialité : `https://getgents.ai/confidentialite`.
Conditions : `https://getgents.ai/cgu`.
Contact : `ceo@getgents.ai`.
Icône : `public/brand/getgents-icone.png` (1024 × 1024).

**Discrétion** : ne jamais citer le dépôt GitHub (son historique et `LICENSE`
portent le nom de l'éditeur). Vérifier, avant d'envoyer, quel nom d'éditeur
chaque annuaire affiche.

## Fiche (anglais)

- **Name** : Getgents Pages
- **Tagline** (≤ 100) : Send an AI artifact privately: one link per recipient, their reply and choices, a Q&A assistant.
- **Description** :
  Share a Claude artifact — a page, a quote, a proposal, a small app — with a
  specific person or group through a private link. Each recipient gets their
  own link (optionally protected by a one-time code sent to their e-mail),
  can reply in one click with the choices they made in the page, and can ask
  questions to an assistant that answers from the page. Update the page and
  every link shows the new version; revoke a link at any time. Getgents sends
  no e-mail: Claude gives you the link and a draft to send yourself.
  The interface and the reader pages are in French.
- **Example prompts** :
  - "Share this page with marie@acme.com"
  - "Send this quote to Paul, with the assistant so he can ask questions"
  - "Update the page I sent to Marie with this new version"
  - "Which links did I send this week?"
  - "Revoke the link sent to Paul"
- **Category** : Productivity / Sales (selon les catégories proposées)

## Fiche (français)

- **Nom** : Getgents Pages
- **Accroche** : Envoyez un artefact Claude par un lien privé : un lien par destinataire, sa réponse, un assistant.
- **Description** :
  Envoyez un artefact Claude — une page, un devis, une proposition, une petite
  application — à une personne ou à un groupe par un lien privé. Chaque
  destinataire a son lien (protégé, si vous le voulez, par un code envoyé à
  son adresse), peut vous répondre en un clic avec les choix faits dans la
  page, et poser ses questions à un assistant qui lit la page. Corrigez la
  page : tous ses liens montrent la nouvelle version. Coupez un lien à tout
  moment. Getgents n'envoie aucun e-mail : Claude vous rend le lien et le
  message à envoyer vous-même.

## 1. Registre MCP officiel (nom `ai.getgents/pages`)

Preuve de domaine par HTTP : aucun nom propre, seulement le domaine.

```bash
# Sur votre ordinateur (OpenSSL 3 ; sur Mac, celui de Homebrew)
openssl genpkey -algorithm Ed25519 -out key.pem
PUBLIC_KEY="$(openssl pkey -in key.pem -pubout -outform DER | tail -c 32 | base64)"
echo "v=MCPv1; k=ed25519; p=${PUBLIC_KEY}"
```

1. Copier la ligne affichée dans Vercel, variable `MCP_REGISTRE_PREUVE`
   (elle est PUBLIQUE, ce n'est pas un secret), puis redéployer.
   Vérifier : `https://getgents.ai/.well-known/mcp-registry-auth` affiche la ligne.
2. `key.pem` est la clé PRIVÉE : la garder hors du dépôt, hors du chat.
3. Installer `mcp-publisher` (voir la doc du registre), puis, depuis le dossier
   qui contient `server.json` :

```bash
MCP_PRIVATE_KEY="$(openssl pkey -in key.pem -noout -text | sed -n '/priv:/,/pub:/p' | sed '1d;$d' | tr -d ' :\n')" \
  mcp-publisher login http --domain "getgents.ai"
mcp-publisher publish
```

Commandes tirées de la documentation du registre le 23/11 (registre « en
préversion ») : en cas d'écart, `mcp-publisher --help` fait foi.

## 2. Annuaire des connecteurs de Claude

Depuis un compte Claude payant : portail de soumission indiqué par
`claude.com/docs/connectors/building/submission`. Avant d'envoyer :
essayer chaque outil comme connecteur personnalisé (déjà fait le 12/11) et
avec l'inspecteur MCP. Listé d'abord comme connecteur « Community ».

## 3. ChatGPT

Écarté pour l'instant : OpenAI exige une vérification d'identité au nom de
publication (personne ou société), et le connecteur n'a jamais été essayé
dans ChatGPT.
