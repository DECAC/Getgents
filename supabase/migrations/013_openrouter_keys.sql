-- Cle OpenRouter personnelle, et suppression de compte.
--
-- Jusqu'ici la plateforme payait toutes les generations de tout le monde. Au
-- moment d'ouvrir les inscriptions, c'est un robinet ouvert. Un builder peut
-- desormais brancher sa propre cle : il paie ses appels, et le quota commun
-- ne le concerne plus.
--
-- La cle est CHIFFREE avant d'arriver ici (lib/server/secretBox.ts,
-- AES-256-GCM). La base ne voit jamais la valeur en clair : une fuite de
-- sauvegarde ne livre alors rien d'exploitable sans SECRET_BOX_KEY, qui vit
-- ailleurs, dans l'environnement.

create table if not exists public.user_api_keys (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  provider    text not null default 'openrouter' check (provider = 'openrouter'),
  ciphertext  text not null,
  -- Les quatre derniers caracteres, pour que le builder reconnaisse SA cle
  -- sans qu'on la lui reaffiche. La valeur en clair ne ressort jamais.
  hint        text not null,
  -- Permettra une rotation de SECRET_BOX_KEY sans perte : les lignes de
  -- l'ancienne version restent dechiffrables le temps du rechiffrement.
  key_version smallint not null default 1,
  -- Derniere fois qu'OpenRouter a accepte la cle, et derniere erreur connue.
  -- On n'efface JAMAIS une cle automatiquement sur un 401 : la panne peut
  -- venir d'OpenRouter, et effacer serait irreversible pour l'utilisateur.
  last_ok_at  timestamptz,
  last_error  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists user_api_keys_updated_at on public.user_api_keys;
create trigger user_api_keys_updated_at
  before update on public.user_api_keys
  for each row execute function public.set_updated_at();

-- RLS active SANS aucune policy : la table devient invisible a `anon` comme a
-- `authenticated`, y compris a son proprietaire. Seul le serveur, avec la cle
-- `service_role`, la lit — et il ne renvoie jamais le chiffre au navigateur.
alter table public.user_api_keys enable row level security;

/*
 * Suppression d'un compte.
 *
 * La cascade de la migration 006 passe par `owner_id`, qui est NULLABLE : les
 * lignes anterieures a la reprise (owner_id nul) ne seraient donc PAS
 * emportees par `auth.users`. Des jetons OAuth Gmail resteraient en base sans
 * proprietaire — des identifiants d'acces a la boite mail de quelqu'un qui a
 * demande son effacement. Le menage est donc explicite.
 *
 * Renvoie le nombre de gents publies supprimes, pour que l'ecran puisse
 * annoncer un decompte reel plutot qu'une promesse vague.
 */
create or replace function public.delete_account(p_user uuid)
returns integer language plpgsql security definer as $$
declare
  gents   integer := 0;
  ids     text[];
  adresse text;
begin
  if p_user is null then
    return 0;
  end if;

  select lower(email) into adresse from auth.users where id = p_user;

  -- Les identifiants des gents du compte : les tables filles sont liees au
  -- gent (gent_id text), pas au compte, et ne cascadent donc pas.
  select coalesce(array_agg(id::text), '{}') into ids
  from (
    select id::text as id from public.published_gents where owner_id = p_user
    union
    select id::text as id from public.gent_drafts where owner_id = p_user
  ) tous;

  delete from public.integration_credentials
    where owner_id = p_user or (owner_id is null and gent_id = any(ids));

  delete from public.share_links
    where owner_id = p_user or (owner_id is null and gent_id = any(ids));

  -- Trois cas, et le troisieme est le moins evident : les partages RECUS, les
  -- partages ACCORDES, et les invitations en attente qui NOMMENT l'adresse
  -- supprimee. Cette derniere est une donnee personnelle de quelqu'un qui
  -- demande son effacement ; la laisser en base la rendrait aussi reclamable
  -- par qui reprendrait l'adresse plus tard.
  delete from public.gent_grants
    where grantee_id = p_user
       or gent_id = any(ids)
       or (adresse is not null and grantee_id is null and invited_email = adresse);

  delete from public.gent_drafts where owner_id = p_user;

  delete from public.published_gents where owner_id = p_user;
  get diagnostics gents = row_count;

  delete from public.usage_counters where user_id = p_user;
  delete from public.user_api_keys  where user_id = p_user;

  return gents;
end $$;

revoke all on function public.delete_account(uuid) from public, anon, authenticated;
