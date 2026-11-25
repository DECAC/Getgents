-- Getgents Pages : aperçu du lien par CAPTURE de la page (25/11).
--
-- Option PAR PAGE, coupée par défaut : la vignette d'un lien (WhatsApp,
-- LinkedIn, Slack…) montre le rendu figé de la page au lieu du seul titre.
-- La capture est faite une fois par VERSION et rangée dans un seau PRIVÉ ;
-- `version` dit de quelle version elle vient — une autre version de la page
-- = l'aperçu n'est plus montré tant qu'il n'est pas refait. Table et seau
-- NOUVEAUX : déployé avant cette migration, le code lit « table absente »
-- comme « option coupée » — rien ne casse, seule l'activation est refusée.

create table if not exists public.pages_apercu_lien (
  page_id     uuid primary key references public.pages(id) on delete cascade,
  actif       boolean not null default false,
  version     integer,
  capture_le  timestamptz,
  updated_at  timestamptz not null default now()
);

alter table public.pages_apercu_lien enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pages-apercus', 'pages-apercus', false, 2097152, array['image/png'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
