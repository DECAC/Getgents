-- Reprise des gents existants par le premier compte.
--
-- Les gents déjà en base n'ont pas de propriétaire (colonne ajoutée en 006,
-- nullable). Ils ne peuvent en recevoir un qu'une fois qu'un compte existe —
-- ce qu'une migration SQL ne peut pas savoir, l'identifiant du premier
-- inscrit n'étant pas connu à l'avance.
--
-- D'où ces deux morceaux : une table à ligne unique qui rend l'opération
-- non rejouable, et une fonction qui fait la reprise en une seule
-- transaction. Sans la table, une seconde exécution ré-attribuerait les
-- gents rendus orphelins entre-temps (suppression d'un compte).

create table if not exists public.app_bootstrap (
  -- `check (id = 1)` : la table ne peut contenir qu'une seule ligne. C'est ce
  -- qui règle la course entre deux inscriptions simultanées — le second
  -- perdant, sans dommage ni message d'erreur à traiter.
  id integer primary key default 1 check (id = 1),
  claimed_by uuid not null references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now()
);

alter table public.app_bootstrap enable row level security;

/*
 * Attribue au compte donné tous les gents sans propriétaire — une seule fois
 * dans la vie de l'instance. Renvoie le nombre de gents repris, ou -1 si la
 * reprise a déjà eu lieu (pour distinguer « rien à reprendre » de « pas mon
 * tour », deux situations très différentes à diagnostiquer).
 */
create or replace function public.claim_orphan_gents(p_user uuid)
returns integer language plpgsql security definer as $$
declare
  repris integer;
begin
  insert into public.app_bootstrap (id, claimed_by)
  values (1, p_user)
  on conflict (id) do nothing;

  if not found then
    return -1;  -- un autre compte a déjà pris la main
  end if;

  update public.published_gents set owner_id = p_user where owner_id is null;
  get diagnostics repris = row_count;

  update public.gent_drafts            set owner_id = p_user where owner_id is null;
  update public.share_links            set owner_id = p_user where owner_id is null;
  update public.integration_credentials set owner_id = p_user where owner_id is null;

  return repris;
end $$;

revoke all on function public.claim_orphan_gents(uuid) from public, anon, authenticated;
