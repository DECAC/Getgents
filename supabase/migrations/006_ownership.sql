-- Propriété des gents : la colonne qui manquait pour qu'un gent appartienne
-- à quelqu'un.
--
-- Jusqu'ici les quatre tables sont anonymes : `published_gents` et
-- `gent_drafts` ont pour seule clé l'identifiant du gent, et GET /api/gents
-- renvoie la base entière à qui possède le secret d'instance — unique et
-- partagé par tous. Il n'existe donc aucun moyen de dire à qui appartient un
-- gent, ni de filtrer une liste.
--
-- La colonne est NULLABLE à ce stade, volontairement : les gents déjà en
-- base n'ont pas de propriétaire, et ils ne peuvent en recevoir un qu'au
-- premier login (migration 010 + lib/server/claimOrphans.ts). Un NOT NULL ici
-- ferait échouer la migration sur les lignes existantes. Le passage en NOT
-- NULL viendra dans un lot ultérieur, une fois la reprise faite.
--
-- `on delete cascade` : supprimer un compte supprime ses gents. C'est le
-- comportement attendu d'un « supprimer mon compte », et il évite des lignes
-- orphelines impossibles à rattacher.

alter table public.published_gents
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

alter table public.gent_drafts
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

-- Les liens de partage et les jetons OAuth appartiennent au créateur du gent,
-- pas au gent lui-même : sans propriétaire, n'importe quel compte pourrait
-- révoquer les liens d'un autre, ou envoyer des e-mails depuis sa boîte.
alter table public.share_links
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

alter table public.integration_credentials
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

-- Chaque écran de liste filtre sur cette colonne : sans index, le coût croît
-- avec le nombre TOTAL de gents de la plateforme, pas avec celui du compte.
create index if not exists published_gents_owner_idx on public.published_gents (owner_id);
create index if not exists gent_drafts_owner_idx on public.gent_drafts (owner_id);
create index if not exists share_links_owner_idx on public.share_links (owner_id);
create index if not exists integration_credentials_owner_idx on public.integration_credentials (owner_id);
