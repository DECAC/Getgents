-- Connecteur MCP, phase 1 lot 1 : autorisation OAuth 2.1 liée au compte.
--
-- Claude (ou un autre client MCP) s'inscrit seul (enregistrement dynamique,
-- RFC 7591), le commercial consent sur /oauth/autoriser, et chaque partage
-- est rattaché à SON compte. Remplace la clé d'essai dans l'adresse.
--
-- Aucun code ni jeton n'est stocké en clair : seule son empreinte SHA-256
-- (les jetons sont 32 octets aléatoires, une empreinte simple suffit).
-- À passer AVANT le déploiement : /api/mcp en dépend.

create table if not exists public.mcp_clients (
  client_id      text primary key,
  nom            text not null,
  redirect_uris  text[] not null,
  created_at     timestamptz not null default now()
);

create table if not exists public.mcp_codes (
  code_hash       text primary key,
  client_id       text not null references public.mcp_clients(client_id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  redirect_uri    text not null,
  code_challenge  text not null,
  scope           text not null,
  expires_at      timestamptz not null,
  used_at         timestamptz
);

create table if not exists public.mcp_jetons (
  hash        text primary key,
  type        text not null check (type in ('acces', 'renouvellement')),
  client_id   text not null references public.mcp_clients(client_id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  scope       text not null,
  -- Toutes les générations issues d'un même consentement : un jeton de
  -- renouvellement REJOUÉ (donc volé) révoque la famille entière.
  famille     text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz
);
create index if not exists mcp_jetons_famille on public.mcp_jetons (famille);
create index if not exists mcp_jetons_user on public.mcp_jetons (user_id);

alter table public.artefacts_partages
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists mcp_client_id text;
create index if not exists artefacts_partages_owner on public.artefacts_partages (owner_id, created_at desc);

-- Même convention que les autres tables : RLS sans policy, service_role seul.
alter table public.mcp_clients enable row level security;
alter table public.mcp_codes enable row level security;
alter table public.mcp_jetons enable row level security;
