-- Ordre d'affichage des participants, et verrou d'orchestration expirable.

-- ── 1. Ordre d'affichage des participants ──────────────────────────────
--
-- La liste de gauche changeait d'ordre toute seule, sous les yeux des
-- participants. Ce n'etait pas un caprice du rendu : la requete triait sur
-- `last_seen_at`, et cette colonne est reecrite a CHAQUE sondage du client,
-- soit toutes les 2,5 secondes. Trois participants actifs produisaient donc
-- six ordres possibles, en rotation permanente.
--
-- `last_seen_at` reste utile — c'est elle qui dit qui est en ligne — mais elle
-- ne peut pas servir d'ordre stable. On ajoute donc la date d'arrivee, qui ne
-- bouge jamais et porte en plus un sens : l'ordre dans lequel les gens ont
-- rejoint la mission.

alter table public.collab_participants
  add column if not exists joined_at timestamptz not null default now();

-- Les salons deja ouverts n'ont pas de date d'arrivee. `last_seen_at` en est
-- la meilleure approximation disponible : pour un participant inactif, elle
-- vaut encore sa date d'arrivee ; pour les autres, l'ordre obtenu est
-- arbitraire mais il sera desormais FIXE, ce qui est tout ce qu'on demande.
update public.collab_participants
   set joined_at = last_seen_at
 where joined_at > last_seen_at;

-- L'index sert le tri de la liste, toujours filtree par session.
create index if not exists collab_participants_ordre_idx
  on public.collab_participants (session_id, joined_at, id);


-- ── 2. Le verrou d'orchestration doit pouvoir expirer ─────────────────────
--
-- `orchestrating` etait un booleen sans date. La prise et la liberation
-- encadrent un appel au modele de plusieurs secondes ; si le processus meurt
-- entre les deux — fonction interrompue par un deploiement, plantage de
-- l'hote, coupure reseau — le `finally` qui libere n'est jamais execute et le
-- drapeau reste a `true` DEFINITIVEMENT. Tous les ticks suivants sortent en
-- busy_or_capped, et le salon devient muet sans que rien ne le signale.
--
-- Observe en production : un salon a cesse de repondre pendant qu'un
-- deploiement passait, et n'est jamais reparti tout seul.
--
-- Un verrou qui ne peut pas expirer n'est pas un verrou, c'est une panne en
-- attente. On lui donne donc une date de prise, et on considere qu'un verrou
-- plus vieux que le temps d'execution maximal d'une requete est abandonne.

alter table public.collab_sessions
  add column if not exists orchestrating_since timestamptz;

-- Les verrous deja pris avant cette migration n'ont pas de date. On leur en
-- donne une DANS LE PASSE : ils sont, par construction, abandonnes — aucune
-- requete ne survit a une migration.
update public.collab_sessions
   set orchestrating_since = now() - interval '1 hour'
 where orchestrating = true
   and orchestrating_since is null;

-- 3 minutes : confortablement au-dela du maxDuration de 120 s des routes du
-- salon. Un tick vivant ne peut pas etre pris pour un tick abandonne, et un
-- tick abandonne ne bloque pas le salon plus de trois minutes.
create or replace function public.collab_orchestration_begin(p_session text, p_max integer)
returns integer language plpgsql as $$
declare
  n integer;
begin
  update public.collab_sessions
     set orchestrating = true,
         orchestrating_since = now(),
         orchestration_count = orchestration_count + 1
   where id = p_session
     and orchestration_count < coalesce(p_max, max_orchestrations)
     and (
       orchestrating = false
       -- Verrou perime : le tick qui l'a pris n'existe plus.
       or orchestrating_since is null
       or orchestrating_since < now() - interval '3 minutes'
     )
  returning orchestration_count into n;
  return coalesce(n, -1);
end $$;

create or replace function public.collab_orchestration_end(p_session text)
returns void language plpgsql as $$
begin
  update public.collab_sessions
     set orchestrating = false,
         orchestrating_since = null
   where id = p_session;
end $$;

revoke all on function public.collab_orchestration_begin(text, integer) from public, anon, authenticated;
revoke all on function public.collab_orchestration_end(text) from public, anon, authenticated;
