-- Gent « Le Publiciste » (27/11) : un PROJET par gent et par auteur, conforme
-- à la maquette (mockups/recit/publiciste/) — entretien, fiche, pistes de
-- chaque étape, choix, storyboard — et les FICHIERS générés pour lui
-- (planches, extraits de musique, voix, croquis, enregistrement « Ma voix »).
-- Un projet coûte plusieurs dollars de générations : il ne doit pas vivre
-- dans le seul cache du navigateur.
-- À passer AVANT le déploiement du lot 1 : sans elle, le Publiciste dit que
-- l'enregistrement du projet n'est pas installé, et rien d'autre ne change.

-- Seau PRIVÉ : rien n'y est lisible sans adresse signée. 20 Mo par fichier
-- (un extrait de musique fait ~0,5 Mo, un enregistrement de voix ~1 Mo).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'publiciste', 'publiciste', false, 20971520,
  array[
    'image/png','image/jpeg','image/webp',
    'audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/aac',
    'audio/wav','audio/x-wav','audio/wave','audio/webm','audio/ogg'
  ]
)
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.publiciste_projets (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  gent_id     text not null,
  -- État du projet (étapes, pistes, choix, storyboard), écrit par l'application.
  etat        jsonb not null default '{}'::jsonb,
  -- Écriture conditionnelle : deux onglets ne s'écrasent pas en silence.
  version     integer not null default 1,
  cree_le     timestamptz not null default now(),
  modifie_le  timestamptz not null default now(),
  unique (owner_id, gent_id)
);

create table if not exists public.publiciste_fichiers (
  projet_id  uuid not null references public.publiciste_projets(id) on delete cascade,
  nom        text not null,
  type       text not null,
  taille     integer not null,
  chemin     text not null,
  -- Coût mesuré de la génération (dollars), pour l'écran « Valider ».
  cout       numeric(10, 4),
  cree_le    timestamptz not null default now(),
  primary key (projet_id, nom)
);

-- Lues et écrites par le serveur seul (clé de service) : aucune politique,
-- donc aucun accès direct depuis le navigateur.
alter table public.publiciste_projets enable row level security;
alter table public.publiciste_fichiers enable row level security;
