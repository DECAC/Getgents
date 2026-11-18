-- Inscription libre PLAFONNÉE (18/11) : une ligne par compte créé par le
-- formulaire /inscription. Elle sert à compter (le plafond
-- `INSCRIPTIONS_PLAFOND`), à mesurer l'essai, et garde la réponse
-- facultative « avec qui, et quoi ».
--
-- À passer AVANT le déploiement : sans elle, le formulaire reste fermé
-- (la lecture du compteur échoue, et l'on ne crée jamais de compte sans
-- savoir combien il y en a déjà).

create table if not exists public.inscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  pour_quoi   text,
  created_at  timestamptz not null default now()
);

create index if not exists inscriptions_created_at_idx on public.inscriptions (created_at);

alter table public.inscriptions enable row level security;
