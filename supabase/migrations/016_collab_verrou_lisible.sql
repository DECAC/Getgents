-- Distinguer « un tick est en cours » de « le plafond est atteint ».
--
-- `collab_orchestration_begin` renvoyait -1 pour les deux, et l'application
-- n'avait donc qu'une seule sortie : `busy_or_capped`. Le participant lisait
-- « Le gent est momentanement sature (trop d'actions) », alors que la plupart
-- du temps la verite etait tout autre : le gent REFLECHISSAIT. Un tick de
-- propositions dure des dizaines de secondes (gros modele + recherche web), et
-- pendant tout ce temps chaque autre tick etait refuse avec un message
-- d'incident. C'est une attente normale presentee comme une panne.
--
-- Les deux etats n'appellent ni le meme message ni la meme conduite :
--   -2  un tick est en cours  → il faut patienter, et il verra nos messages ;
--   -1  plafond atteint       → il faut agir, le salon n'avancera plus seul.
--
-- Le SELECT ne sert qu'a QUALIFIER l'echec. La prise reste l'UPDATE, seul
-- atomique : deux requetes simultanees ne peuvent pas prendre le verrou toutes
-- les deux, quelle que soit ce que le select a lu juste avant.

create or replace function public.collab_orchestration_begin(p_session text, p_max integer)
returns integer language plpgsql as $$
declare
  n integer;
  s record;
begin
  update public.collab_sessions
     set orchestrating = true,
         orchestrating_since = now(),
         orchestration_count = orchestration_count + 1
   where id = p_session
     and orchestration_count < coalesce(p_max, max_orchestrations)
     and (
       orchestrating = false
       or orchestrating_since is null
       or orchestrating_since < now() - interval '3 minutes'
     )
  returning orchestration_count into n;

  if n is not null then
    return n;
  end if;

  -- Echec : reste a dire pourquoi.
  select orchestration_count, max_orchestrations
    into s
    from public.collab_sessions
   where id = p_session;

  if not found then
    return -1;
  end if;

  if s.orchestration_count >= coalesce(p_max, s.max_orchestrations) then
    return -1;  -- plafond atteint
  end if;

  return -2;    -- un tick est en cours
end $$;

revoke all on function public.collab_orchestration_begin(text, integer) from public, anon, authenticated;
