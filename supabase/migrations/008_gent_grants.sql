-- Partage nominatif : donner accès à une PERSONNE, pas à qui détient un lien.
--
-- Le point délicat, et la raison de la forme de cette table : on invite une
-- ADRESSE, pas un compte. Le destinataire n'est très souvent pas encore
-- inscrit au moment de l'invitation. L'accès est donc résolu par e-mail tant
-- que `grantee_id` est nul, puis SCELLÉ sur l'identifiant du compte à la
-- première connexion confirmée.
--
-- Sans ce scellement, l'accès resterait attaché à une chaîne de caractères :
-- un changement d'adresse chez le fournisseur d'authentification, ou une
-- réinscription avec l'adresse d'un ancien collègue, transférerait
-- silencieusement des droits. Et le scellement n'a lieu que si l'e-mail est
-- CONFIRMÉ, sans quoi il suffirait de s'inscrire avec l'adresse d'autrui pour
-- hériter de ses accès (contrainte appliquée côté applicatif, à la connexion).

create table if not exists public.gent_grants (
  id            uuid primary key default gen_random_uuid(),
  gent_id       text not null,
  -- Toujours en minuscules, sans espaces : la normalisation est faite côté
  -- applicatif (lib/emailIdentity.ts) pour être testable, et garantie ici par
  -- la contrainte ci-dessous.
  invited_email text not null,
  grantee_id    uuid references auth.users(id) on delete cascade,
  role          text not null check (role in ('viewer', 'editor')),
  invited_by    uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  revoked_at    timestamptz,
  constraint gent_grants_email_normalized check (invited_email = lower(btrim(invited_email))),
  constraint gent_grants_email_shape check (invited_email like '%_@_%._%')
);

-- Une seule invitation par couple (gent, adresse) : ré-inviter quelqu'un doit
-- mettre à jour l'invitation existante, pas en empiler une seconde qui
-- laisserait deux rôles contradictoires en vigueur.
create unique index if not exists gent_grants_gent_email_idx
  on public.gent_grants (gent_id, invited_email);

-- « Quels gents ont été partagés avec moi ? » — la question posée à chaque
-- chargement de la liste, avant et après scellement.
create index if not exists gent_grants_email_active_idx
  on public.gent_grants (invited_email)
  where revoked_at is null;

create index if not exists gent_grants_grantee_active_idx
  on public.gent_grants (grantee_id)
  where revoked_at is null;

-- « Avec qui ai-je partagé ce gent ? » — l'écran de partage du studio.
create index if not exists gent_grants_gent_idx on public.gent_grants (gent_id);
