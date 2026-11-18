-- Retire la vue `public_gents_directory` (migration 009).
--
-- Signalée par le Security Advisor de Supabase (18/11) : « Security Definer
-- View », niveau ERROR. Elle s'exécutait avec les droits de son
-- propriétaire, sans repasser par le RLS, et restait lisible par la clé
-- PUBLIQUE (anon) — n'importe qui pouvait lister les gents publics par
-- l'API REST de Supabase.
--
-- Elle ne servait plus : l'annuaire (`lib/server/publicGent.ts`) lit
-- `published_gents` côté serveur, avec la clé de service. La retirer ne
-- change rien à l'application, et peut se passer à tout moment.

drop view if exists public.public_gents_directory;
