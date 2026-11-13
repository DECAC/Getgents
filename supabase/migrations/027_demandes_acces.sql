-- Demandes d'accès (13/11) : le formulaire de /inscription remplace le lien
-- mailto. La demande est GARDÉE d'abord, l'e-mail à l'éditeur part ensuite —
-- un e-mail perdu ne doit pas faire perdre une demande. La table sert aussi
-- aux plafonds anti-abus de la route ouverte (par adresse, et au total).
-- À passer AVANT le déploiement : /api/demande-acces en dépend.
create table if not exists public.demandes_acces (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  motivation  text not null,
  created_at  timestamptz not null default now(),
  notifie     boolean not null default false
);

create index if not exists demandes_acces_email_idx on public.demandes_acces (email, created_at);
create index if not exists demandes_acces_date_idx on public.demandes_acces (created_at);

-- Même régime que les autres tables : RLS sans policy, service_role seul.
alter table public.demandes_acces enable row level security;
