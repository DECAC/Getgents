-- Politiques RLS — et ce qu'elles valent réellement ici.
--
-- Soyons exact : toutes les routes de l'application passent par la clé
-- `service_role`, qui CONTOURNE le RLS. Ces politiques ne protègent donc pas
-- le flux applicatif. Le cloisonnement qui compte est écrit dans les routes,
-- sous la forme d'une règle simple : aucun `from(...)` sans clause
-- d'appartenance DANS le même appel, jamais de filtrage a posteriori en JS.
--
-- Elles sont écrites quand même, pour trois raisons :
--   1. le jour où un client anon touche ces tables (annuaire rendu côté
--      client, Realtime), le défaut est fermé plutôt qu'ouvert ;
--   2. si la clé anon est utilisée par erreur dans un composant client, elle
--      ne donne accès à rien ;
--   3. elles disent le modèle d'accès en un seul endroit lisible.
--
-- Aucune politique d'écriture n'est définie, nulle part : toutes les
-- écritures restent le fait du serveur.

-- ---------------------------------------------------------------- lecture

drop policy if exists published_gents_owner_read on public.published_gents;
create policy published_gents_owner_read on public.published_gents
  for select to authenticated
  using (owner_id = auth.uid());

-- Un gent partagé nominativement se lit par son bénéficiaire, une fois
-- l'invitation scellée sur son compte.
drop policy if exists published_gents_grantee_read on public.published_gents;
create policy published_gents_grantee_read on public.published_gents
  for select to authenticated
  using (
    exists (
      select 1 from public.gent_grants g
      where g.gent_id = published_gents.id
        and g.grantee_id = auth.uid()
        and g.revoked_at is null
    )
  );

-- Un brouillon ne se partage pas : il porte le travail en cours de son auteur.
drop policy if exists gent_drafts_owner_read on public.gent_drafts;
create policy gent_drafts_owner_read on public.gent_drafts
  for select to authenticated
  using (owner_id = auth.uid());

alter table public.gent_grants enable row level security;

-- Chacun voit les invitations qu'il a reçues et celles qu'il a émises.
drop policy if exists gent_grants_visible_read on public.gent_grants;
create policy gent_grants_visible_read on public.gent_grants
  for select to authenticated
  using (grantee_id = auth.uid() or invited_by = auth.uid());

-- `share_links`, `share_events` et `integration_credentials` restent sans
-- aucune politique : un jeton OAuth ou un lien de diffusion n'a aucune raison
-- d'être lu autrement que par le serveur.

-- ------------------------------------------------------- annuaire public

-- L'annuaire est lisible SANS COMPTE. Il ne lit donc jamais la table, dont la
-- colonne `espace` contient le prompt système, la mémoire et les documents du
-- créateur : il lit cette vue, qui ne projette que des colonnes destinées à
-- être vues. C'est une liste blanche, comme espaceForPublicLink côté serveur
-- — toute colonne ajoutée plus tard à la table est exclue par défaut.
create or replace view public.public_gents_directory as
  select
    id,
    public_slug,
    espace ->> 'name'  as name,
    espace ->> 'icon'  as icon,
    espace ->> 'gent'  as gent,
    directory_summary,
    published_at
  from public.published_gents
  where visibility = 'public'
    and public_slug is not null;

-- La vue s'exécute avec les droits de son propriétaire, donc sans repasser
-- par le RLS de la table sous-jacente. C'est ici DÉLIBÉRÉ et sans danger :
-- c'est précisément ce qui permet à un visiteur non connecté de voir
-- l'annuaire, et la vue ne peut rien exposer d'autre que les six colonnes
-- ci-dessus. Ne jamais y ajouter `espace`.
grant select on public.public_gents_directory to anon, authenticated;
