-- Diffusion par lien personnalisé : un lien tokenisé par cible, et la trace
-- de ce que la cible en fait (ouverture, conversation, régénération).
--
-- Tables dédiées, et non des champs de published_gents.espace : ce document
-- JSONB est réécrit ENTIER par PUT /api/gents/[id], débouncé depuis le
-- navigateur du créateur. Un compteur incrémenté côté serveur y serait écrasé
-- au prochain push (lost update).
create table if not exists public.share_links (
  token         text primary key,       -- 32 octets aléatoires, base64url
  gent_id       text not null,
  target_label  text not null,          -- « Marie Dupont — Doctolib »
  created_at    timestamptz not null default now(),
  expires_at    timestamptz,            -- null = pas d'expiration
  revoked_at    timestamptz,
  allow_chat    boolean not null default true,
  allow_refresh boolean not null default true,
  refresh_count integer not null default 0,
  max_refresh   integer not null default 20  -- garde-fou : chaque Update = un appel LLM facturé
);
create index if not exists share_links_gent_id_idx on public.share_links (gent_id);

-- Journal append-only. Volontairement sans IP ni user-agent : on enregistre
-- qu'un événement a eu lieu, pas l'empreinte technique du visiteur.
create table if not exists public.share_events (
  id     bigserial primary key,
  token  text not null references public.share_links(token) on delete cascade,
  kind   text not null check (kind in ('open', 'chat', 'refresh')),
  at     timestamptz not null default now(),
  detail text
);
create index if not exists share_events_token_at_idx on public.share_events (token, at desc);

-- Même convention que published_gents : RLS activé sans aucune policy, donc
-- seule la clé service_role (côté serveur Next.js) accède à ces tables.
alter table public.share_links  enable row level security;
alter table public.share_events enable row level security;

-- Incrément atomique du compteur de régénérations : évite la lecture-écriture
-- concurrente si la cible clique Update plusieurs fois de suite.
create or replace function public.increment_share_refresh(p_token text)
returns integer language plpgsql as $$
declare
  new_count integer;
begin
  update public.share_links
     set refresh_count = refresh_count + 1
   where token = p_token
  returning refresh_count into new_count;
  return new_count;
end $$;
