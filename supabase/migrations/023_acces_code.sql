-- Pages (GetSite) : accès protégé par code envoyé par e-mail.
--
-- Une page protégée ne s'ouvre qu'après un code à 6 chiffres envoyé à
-- l'adresse du destinataire du lien : un lien transféré à quelqu'un d'autre
-- ne s'ouvre plus. Réglage PAR PAGE, désactivé par défaut.
--
-- Tout vit dans de NOUVELLES tables : déployé AVANT cette migration, le code
-- lit « table absente » comme « aucune page protégée » (le comportement
-- d'avant), et refuse d'activer la protection. Aucune lecture existante ne
-- dépend de ces tables.

create table if not exists public.pages_protection (
  page_id     uuid primary key references public.pages(id) on delete cascade,
  actif       boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- Un code en cours et la validation, par LIEN (jeton de partage).
create table if not exists public.acces_partages (
  jeton          text primary key references public.artefacts_partages(jeton) on delete cascade,
  code_hash      text,            -- empreinte du code (jamais le code en clair)
  code_expire    timestamptz,
  essais         integer not null default 0,
  dernier_envoi  timestamptz,
  envois         integer not null default 0,
  valide_le      timestamptz
);

alter table public.pages_protection enable row level security;
alter table public.acces_partages enable row level security;
