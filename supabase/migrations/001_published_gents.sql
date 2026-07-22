-- Gents publiés : source de vérité côté serveur (le localStorage du
-- navigateur n'est plus qu'un cache). Le document espace complet est stocké
-- en JSONB : le schéma applicatif (conversations, artefacts, connecteurs…)
-- évolue vite, on ne le fige pas en colonnes à ce stade (Phase 0).
create table if not exists public.published_gents (
  id text primary key,
  espace jsonb not null,
  updated_at timestamptz not null default now()
);

-- Trace de fraîcheur maintenue automatiquement.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists published_gents_updated_at on public.published_gents;
create trigger published_gents_updated_at
  before update on public.published_gents
  for each row execute function public.set_updated_at();

-- RLS activé sans aucune policy publique : seul le serveur Next.js
-- (service_role, qui bypasse RLS) peut lire/écrire. Les clés anon/publiques
-- n'ont donc aucun accès à cette table.
alter table public.published_gents enable row level security;
