-- Brouillons du builder : jusqu'ici ils ne vivaient que dans le localStorage du
-- navigateur, donc un gent en cours de construction était perdu en changeant de
-- machine, de navigateur, ou en vidant le cache. Même modèle que
-- published_gents : le document est stocké en JSONB, le schéma applicatif
-- évoluant trop vite pour être figé en colonnes.
create table if not exists public.gent_drafts (
  id text primary key,
  draft jsonb not null,
  updated_at timestamptz not null default now()
);

-- Réutilise le trigger de fraîcheur défini en 001.
drop trigger if exists gent_drafts_updated_at on public.gent_drafts;
create trigger gent_drafts_updated_at
  before update on public.gent_drafts
  for each row execute function public.set_updated_at();

-- RLS activé sans policy publique : seul le serveur Next.js (service_role,
-- qui bypasse RLS) lit/écrit. Les clés anon n'ont aucun accès — un brouillon
-- contient le prompt système et les sources de connaissance du créateur.
alter table public.gent_drafts enable row level security;
