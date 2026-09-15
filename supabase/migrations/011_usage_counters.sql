-- Plafonds d'usage par compte.
--
-- Les routes LLM n'avaient aucune borne : un appelant pouvait boucler
-- indefiniment, chaque tour etant facture chez OpenRouter. Le decompte vit en
-- base et non en memoire, parce qu'en execution serverless chaque requete peut
-- atterrir sur une instance differente : un compteur en memoire ne compterait
-- qu'une fraction des appels.

create table if not exists public.usage_counters (
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('llm', 'image', 'video')),
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (user_id, kind, window_start)
);

-- Purge : les fenetres anciennes n'ont aucune valeur une fois passees.
create index if not exists usage_counters_window_idx on public.usage_counters (window_start);

alter table public.usage_counters enable row level security;

/*
 * Incremente et decide, en une seule instruction atomique.
 *
 * Le `on conflict ... do update` avec la clause `where` fait tout le travail :
 * si le plafond est atteint, la mise a jour n'a pas lieu et `found` est faux.
 * Faire un select puis un update laisserait passer deux requetes concurrentes
 * arrivees ensemble — ce qui est exactement le cas qu'un plafond doit couvrir.
 *
 * Renvoie le compte apres increment, ou -1 si le plafond est atteint.
 */
create or replace function public.bump_usage(
  p_user uuid,
  p_kind text,
  p_window timestamptz,
  p_limit integer
) returns integer language plpgsql security definer as $$
declare
  nouveau integer;
begin
  insert into public.usage_counters (user_id, kind, window_start, count)
  values (p_user, p_kind, p_window, 1)
  on conflict (user_id, kind, window_start) do update
    set count = usage_counters.count + 1
    where usage_counters.count < p_limit
  returning count into nouveau;

  if nouveau is null then
    return -1;  -- plafond atteint
  end if;
  return nouveau;
end $$;

revoke all on function public.bump_usage(uuid, text, timestamptz, integer) from public, anon, authenticated;

/* Menage des fenetres de plus de 48 h — appelable depuis le cron horaire. */
create or replace function public.purge_usage_counters()
returns integer language plpgsql security definer as $$
declare
  supprimes integer;
begin
  delete from public.usage_counters where window_start < now() - interval '48 hours';
  get diagnostics supprimes = row_count;
  return supprimes;
end $$;
