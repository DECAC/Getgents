-- LIEN DE GROUPE (19/11, maquettes validées) : un seul lien à poster dans un
-- groupe WhatsApp. Chaque invité choisit son prénom en ouvrant la page et
-- répond UNE fois. Le prénom est choisi par le lecteur, PAS vérifié : réservé
-- aux proches, jamais à une page protégée par code (un nom n'a pas d'adresse).
--
-- À passer AVANT le déploiement : sans elle, la création d'un lien de groupe
-- est refusée (le bloc le dit) et les liens ordinaires ne changent pas.

create table if not exists public.partages_groupes (
  jeton      text primary key references public.artefacts_partages(jeton) on delete cascade,
  invites    jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.partages_groupes enable row level security;

-- Une réponse par lien ET par invité : l'ancienne contrainte « une par lien »
-- devient « une par (lien, invité) » — l'invité est vide pour un lien ordinaire.
alter table public.pages_reponses add column if not exists invite text;
alter table public.pages_reponses drop constraint if exists pages_reponses_jeton_key;
create unique index if not exists pages_reponses_jeton_invite_idx on public.pages_reponses (jeton, coalesce(invite, ''));
