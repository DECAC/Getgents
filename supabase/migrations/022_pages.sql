-- Rubrique « Pages » (GetSite), lot A : une page et ses partages.
--
-- Jusqu'ici, une ligne de `artefacts_partages` = une COPIE du document + un
-- destinataire : partager la même page à trois personnes faisait trois
-- copies que rien ne reliait. Désormais la page (le document, sa version
-- courante, son assistant) vit dans `pages`, et chaque partage la désigne
-- par `page_id`. Les liens affichent toujours la DERNIÈRE version ; les
-- précédentes sont rangées dans `pages_versions`.
--
-- À passer AVANT le déploiement : la lecture d'un lien joint `pages`.
-- Idempotente : on peut la relancer sans rien dupliquer.

create table if not exists public.pages (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  titre       text not null,
  format      text not null check (format in ('html', 'markdown', 'svg', 'react', 'texte')),
  contenu     text not null,
  empreinte   text not null,           -- md5(contenu) : retrouver une page re-partagée à l'identique
  origine     text,                    -- plateforme d'origine (nom du client MCP : « Claude »…)
  assistant   boolean not null default false,
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  supprimee_at timestamptz
);
create index if not exists pages_owner on public.pages (owner_id, updated_at desc);
create index if not exists pages_empreinte on public.pages (owner_id, empreinte);

create table if not exists public.pages_versions (
  page_id     uuid not null references public.pages(id) on delete cascade,
  version     integer not null,
  titre       text not null,
  format      text not null,
  contenu     text not null,
  created_at  timestamptz not null default now(),
  primary key (page_id, version)
);

alter table public.artefacts_partages
  add column if not exists page_id uuid references public.pages(id) on delete cascade;
create index if not exists artefacts_partages_page on public.artefacts_partages (page_id);

-- Reprise : les partages d'un même compte au contenu IDENTIQUE forment une
-- page ; les autres, chacun la sienne. Deviner mieux (même titre, contenu
-- proche) risquerait de fusionner deux documents différents. Les partages
-- sans propriétaire (ancienne clé d'essai) restent tels quels.
with groupes as (
  select
    a.owner_id,
    md5(a.contenu) as empreinte,
    (array_agg(a.titre order by a.created_at desc))[1] as titre,
    (array_agg(a.format order by a.created_at desc))[1] as format,
    (array_agg(a.contenu order by a.created_at desc))[1] as contenu,
    (array_agg(c.nom order by a.created_at desc))[1] as origine,
    bool_or(a.assistant) as assistant,
    min(a.created_at) as cree,
    max(a.created_at) as maj
  from public.artefacts_partages a
  left join public.mcp_clients c on c.client_id = a.mcp_client_id
  where a.owner_id is not null and a.page_id is null and a.contenu <> ''
  group by a.owner_id, md5(a.contenu)
)
insert into public.pages (owner_id, titre, format, contenu, empreinte, origine, assistant, created_at, updated_at)
select g.owner_id, g.titre, g.format, g.contenu, g.empreinte, g.origine, g.assistant, g.cree, g.maj
from groupes g
where not exists (select 1 from public.pages p where p.owner_id = g.owner_id and p.empreinte = g.empreinte);

update public.artefacts_partages a
set page_id = p.id
from public.pages p
where a.page_id is null
  and a.owner_id = p.owner_id
  and a.contenu <> ''
  and md5(a.contenu) = p.empreinte;

-- Même convention que les autres tables : RLS sans policy, service_role seul.
alter table public.pages enable row level security;
alter table public.pages_versions enable row level security;
