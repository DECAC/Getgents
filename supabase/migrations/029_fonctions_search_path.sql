-- Security Advisor de Supabase (18/11), avertissements restants.
--
-- 1. « Function Search Path Mutable » : huit fonctions sans `search_path`
--    fixé. Une fonction (surtout SECURITY DEFINER) qui résout ses noms
--    selon le chemin de l'APPELANT peut être détournée par un objet homonyme
--    placé plus tôt dans ce chemin. On le fige à `public, pg_temp`.
--    Appliqué par NOM, à toutes les signatures : une signature recopiée à la
--    main qui différerait de la base ferait échouer la migration.
--
-- 2. `purge_usage_counters` (SECURITY DEFINER) était exécutable par `anon`
--    et `authenticated` via /rest/v1/rpc. Elle n'efface que des compteurs
--    de plus de 48 h — sans effet sur les quotas en cours — et rien dans
--    l'application ne l'appelle. Fermée quand même : une fonction appelable
--    par n'importe qui n'a pas à l'être.
--    `increment_share_refresh` n'avait pas non plus de `revoke` ; le serveur
--    l'appelle avec la clé de service, qui garde son accès.
--
-- Sans effet sur le code : peut se passer à tout moment.

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'set_updated_at', 'purge_usage_counters', 'increment_share_refresh',
        'claim_orphan_gents', 'bump_usage', 'delete_account',
        'collab_orchestration_begin', 'collab_orchestration_end'
      )
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.signature);
  end loop;
end $$;

revoke all on function public.purge_usage_counters() from public, anon, authenticated;
revoke all on function public.increment_share_refresh(text) from public, anon, authenticated;
