-- Courrier entrant : les e-mails transférés à l'adresse d'un gent (chantier).
-- Le serveur y DÉPOSE les retouches du dossier ; c'est le navigateur du
-- propriétaire qui les applique à l'ouverture, par le même chemin que
-- « Garder » (versions, « Annuler »). Écrire directement dans le brouillon
-- serait écrasé par la sauvegarde automatique du navigateur.
create table if not exists public.courrier_entrant (
  id uuid primary key default gen_random_uuid(),
  gent_id text not null,
  owner_id uuid not null,
  recu_le timestamptz not null default now(),
  objet text not null default '',
  resume text not null default '',
  retouches jsonb not null default '[]'::jsonb,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'applique'))
);

create index if not exists courrier_entrant_attente_idx
  on public.courrier_entrant (owner_id, statut, recu_le);

-- Même régime que gent_drafts : service_role seul, aucune policy publique.
alter table public.courrier_entrant enable row level security;
