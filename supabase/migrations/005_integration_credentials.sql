-- Jetons OAuth par gent (Gmail, futurs connecteurs utilisateur).
-- Accès serveur uniquement (service_role) — jamais exposés au navigateur.
create table if not exists public.integration_credentials (
  gent_id text not null,
  provider text not null,
  email text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scopes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (gent_id, provider)
);

drop trigger if exists integration_credentials_updated_at on public.integration_credentials;
create trigger integration_credentials_updated_at
  before update on public.integration_credentials
  for each row execute function public.set_updated_at();

alter table public.integration_credentials enable row level security;
