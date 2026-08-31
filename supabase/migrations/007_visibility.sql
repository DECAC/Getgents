-- Visibilité d'un gent : privé, partagé nominativement, ou public.
--
-- La diffusion existante passe par un lien tokenisé (`share_links`), qui
-- répond à « je donne accès à CETTE personne ». Elle ne répond pas à « je
-- rends ce gent visible de tous » : il n'y a ni annuaire, ni adresse stable,
-- ni moyen de savoir qu'un gent est public. D'où ces colonnes.
--
-- La visibilité ne concerne QUE `published_gents` : un brouillon est privé
-- par nature, il n'a pas de version diffusée à montrer.

alter table public.published_gents
  add column if not exists visibility text not null default 'private';

-- Contrainte ajoutée séparément et de façon idempotente : `add column ...
-- check (...)` échouerait au rejeu de la migration.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'published_gents_visibility_check'
  ) then
    alter table public.published_gents
      add constraint published_gents_visibility_check
      check (visibility in ('private', 'shared', 'public'));
  end if;
end $$;

alter table public.published_gents
  add column if not exists published_at timestamptz;

-- Adresse publique stable : /g/<slug>. Distincte de l'identifiant du gent,
-- qui est un `draft-<horodatage>` illisible et qui ne doit pas devenir une
-- URL publique.
alter table public.published_gents
  add column if not exists public_slug text;

-- Le pitch de l'annuaire est SAISI par le créateur. Il ne doit surtout pas
-- être dérivé du prompt système, qui est son travail et n'a pas à être exposé.
alter table public.published_gents
  add column if not exists directory_summary text;

-- Unicité du slug, mais seulement là où il existe : un index unique simple
-- interdirait plus d'un gent sans slug (tous les gents privés).
create unique index if not exists published_gents_public_slug_idx
  on public.published_gents (public_slug)
  where public_slug is not null;

-- L'annuaire ne lit que les gents publics : l'index partiel ne porte que sur
-- eux, et reste petit même si la plateforme compte surtout des gents privés.
create index if not exists published_gents_directory_idx
  on public.published_gents (published_at desc)
  where visibility = 'public';
