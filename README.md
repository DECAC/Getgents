# Getgents

Plateforme de création d'assistants — des « gents » — que l'on configure à
partir de ses propres documents, puis que l'on partage ou publie.

Service en ligne : **https://getgents.ai**
Éditeur : Charles de Cassan · Mentions légales : https://getgents.ai/mentions-legales

---

## Ce dépôt n'est pas un logiciel libre

Le code est **consultable**, il n'est pas **réutilisable**. Voir [LICENSE](LICENSE).

En droit d'auteur, un dépôt sans licence est intégralement réservé. Beaucoup
l'ignorent et supposent qu'un dépôt public est ouvert à l'usage : il ne l'est
pas ici, et le fichier `LICENSE` le dit explicitement pour lever le doute.

Vous pouvez lire ce code, l'étudier, en analyser la sécurité et nous signaler
ce que vous y trouvez. Vous ne pouvez pas l'exécuter ailleurs, le modifier, le
redistribuer, ni l'exploiter — sans accord écrit préalable.

Une demande d'autorisation ou de partenariat est la bienvenue :
**ceo@getgents.ai**

## Une copie ne fonctionnerait pas telle quelle

Ce dépôt ne contient **aucun secret** : ni clé d'API, ni identifiant, ni jeton.
C'est délibéré et vérifié. Un clone ne donne donc accès à aucune donnée — ni
aux comptes, ni aux gents, ni aux conversations, qui vivent tous en base et
n'y figurent pas.

Faire tourner une instance supposerait de fournir sa propre infrastructure :
un projet Supabase avec les migrations de `supabase/`, une clé OpenRouter, un
compte d'envoi d'e-mails, des clés Cloudflare Turnstile, des identifiants
OAuth Google, et une `SECRET_BOX_KEY` de chiffrement. Ce serait une coquille
vide, sans rapport avec le service en ligne.

## Ne pas se faire passer pour Getgents

Au-delà du code, la dénomination **« Getgents »**, ses emblèmes et son
identité visuelle ne doivent pas être repris d'une manière qui prêterait à
confusion avec le service d'origine. Une instance montée à partir de ce code
n'est pas Getgents et ne doit pas se présenter comme telle — c'est une
question de loyauté envers les personnes qui y confient leurs documents.

## Sécurité

Une vulnérabilité à signaler ? `https://getgents.ai/.well-known/security.txt`,
ou directement **ceo@getgents.ai**. Les signalements de bonne foi sont
accueillis avec reconnaissance.

## Composants tiers

Les dépendances npm conservent leur propre licence. Un seul composant est
versionné ici : `public/pdfjs/pdf.worker.min.mjs` — PDF.js, Mozilla
Foundation, licence Apache 2.0. La réserve de droits de ce dépôt ne s'y
applique pas.

---

Note pour les sessions d'assistance automatisée : les conventions du projet,
les décisions structurantes et les pièges déjà rencontrés sont consignés dans
[CLAUDE.md](CLAUDE.md).
