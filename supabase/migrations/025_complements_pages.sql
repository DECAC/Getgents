-- Pages (GetSite) : précisions de l'auteur.
--
-- Depuis l'onglet Activité, l'auteur répond à une question restée sans
-- réponse (« la page ne le dit pas ») ; sa réponse est lue par l'assistant
-- avec la page, pour TOUS les destinataires, sans que le visiteur en voie la
-- source. La question du visiteur n'est jamais publiée : seule la réponse
-- de l'auteur l'est, avec un sujet qu'il peut reformuler.
--
-- Table NOUVELLE : déployé avant la migration, l'assistant lit la page seule
-- (comportement d'avant) et l'onglet dit que la migration manque.

create table if not exists public.pages_complements (
  id           uuid primary key default gen_random_uuid(),
  page_id      uuid not null references public.pages(id) on delete cascade,
  question_id  uuid references public.pages_questions(id) on delete set null,
  sujet        text not null default '',
  texte        text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists pages_complements_page on public.pages_complements (page_id, created_at);

alter table public.pages_complements enable row level security;
