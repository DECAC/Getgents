-- Pages (GetSite) : questions suggérées aux visiteurs dans l'assistant.
--
-- Choisies et relues par l'auteur (jamais publiées automatiquement), 4 au
-- plus, dans l'ordre voulu. Sans ligne : les suggestions par défaut.
-- Table NOUVELLE : déployé avant la migration, les visiteurs voient les
-- suggestions par défaut et le volet dit que la migration manque.

create table if not exists public.pages_suggestions (
  page_id     uuid primary key references public.pages(id) on delete cascade,
  questions   jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.pages_suggestions enable row level security;
