-- Pages (GetSite) : « ce qu'a lu le client ».
--
-- Deux flux SÉPARÉS, sans clé commune :
--   - pages_lectures : une ligne par VISITE. Anonyme par défaut (jeton,
--     début, durée, profondeur et appareil NULS : seul le jour est gardé) ;
--     nominative seulement si le destinataire l'a accepté dans le widget.
--   - pages_questions : les questions posées à l'assistant, TOUJOURS sans
--     lien ni heure — le jour seulement —, pour qu'on ne puisse pas les
--     rattacher à une lecture.
--
-- Effacées 120 jours après leur création (lien de 30 jours + 90 jours
-- promis au visiteur), par le code (`purgerActivite`).
--
-- Tables NOUVELLES : déployé avant cette migration, le code ne mesure rien
-- et l'onglet Activité le dit. À passer AVANT le déploiement quand même.

create table if not exists public.pages_lectures (
  id           text primary key,              -- identifiant de visite tiré par le navigateur
  page_id      uuid not null references public.pages(id) on delete cascade,
  jeton        text references public.artefacts_partages(jeton) on delete set null,
  jour         date not null,
  debut        timestamptz,
  duree_s      integer not null default 0,
  profondeur   smallint,
  appareil     text check (appareil in ('ordinateur', 'telephone')),
  version      integer,
  maj          timestamptz not null default now()
);
create index if not exists pages_lectures_page on public.pages_lectures (page_id, jour);
create index if not exists pages_lectures_jeton on public.pages_lectures (jeton) where jeton is not null;

create table if not exists public.pages_questions (
  id         uuid primary key default gen_random_uuid(),
  page_id    uuid not null references public.pages(id) on delete cascade,
  jour       date not null,
  question   text not null,
  hors_page  boolean
);
create index if not exists pages_questions_page on public.pages_questions (page_id, jour);

alter table public.pages_lectures enable row level security;
alter table public.pages_questions enable row level security;
