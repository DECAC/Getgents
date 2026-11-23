-- Stockage PARTAGÉ des pages (23/11) : `window.storage.set(clé, valeur, true)`
-- des artefacts Claude — les votes, scores, réponses communes d'une page.
-- Chez Claude, ces données vivent dans la base de Claude ; chez Getgents, une
-- mémoire de la page les remplaçait et chaque lecteur avait SON classement.
-- Une ligne par (page, clé), commune à tous les liens de la page.
-- À passer AVANT le déploiement : sans elle, la page reçoit une erreur de
-- stockage lisible, rien d'autre ne change.
create table if not exists public.pages_stockage (
  page_id  uuid not null references public.pages(id) on delete cascade,
  cle      text not null,
  valeur   text not null,
  taille   integer not null,
  maj      timestamptz not null default now(),
  primary key (page_id, cle)
);

alter table public.pages_stockage enable row level security;
