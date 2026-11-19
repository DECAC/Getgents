-- Bouton d'ENGAGEMENT d'une page (19/11) : l'auteur propose à ses lecteurs
-- un bouton (« Je souhaite donner suite »…) ; le clic lui est transmis, avec
-- le nom du LIEN et, si l'auteur l'a permis, un mot du lecteur.
--
-- À passer AVANT le déploiement pour que le bloc s'enregistre. Sans elle :
-- le bloc dit « pas encore installé », aucun bouton ne s'affiche, rien ne
-- casse.

create table if not exists public.pages_engagement (
  page_id     uuid primary key references public.pages(id) on delete cascade,
  actif       boolean not null default false,
  intitule    text not null,
  mot         boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- UNE réponse par lien (contrainte unique sur le jeton).
create table if not exists public.pages_reponses (
  id           uuid primary key default gen_random_uuid(),
  page_id      uuid not null references public.pages(id) on delete cascade,
  jeton        text not null unique references public.artefacts_partages(jeton) on delete cascade,
  destinataire text not null,
  intitule     text not null,
  mot          text,
  version      integer not null default 1,
  created_at   timestamptz not null default now(),
  vue_at       timestamptz
);

create index if not exists pages_reponses_page_idx on public.pages_reponses (page_id, created_at desc);

alter table public.pages_engagement enable row level security;
alter table public.pages_reponses enable row level security;
