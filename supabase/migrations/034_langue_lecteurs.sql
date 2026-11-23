-- Getgents Pages : langue de ce que voit le LECTEUR (lot anglais 1, 23/11).
--
-- Réglage PAR PAGE choisi par l'auteur dans la fiche : français ou anglais.
-- Sans ligne, « automatique » : la langue suit la page (déclarée, sinon
-- celle du texte). Table NOUVELLE : déployé avant cette migration, le code
-- lit « table absente » comme « automatique » — rien ne casse ; seul le
-- réglage manuel est refusé.

create table if not exists public.pages_langue (
  page_id     uuid primary key references public.pages(id) on delete cascade,
  langue      text not null check (langue in ('fr', 'en')),
  updated_at  timestamptz not null default now()
);

alter table public.pages_langue enable row level security;
