-- Fichiers JOINTS aux pages (23/11) : musique, photos, vidéos, PDF qu'une page
-- référence par leur nom. Le connecteur ne transporte que du texte : les
-- médias s'ajoutent depuis la fiche, envoyés DIRECTEMENT par le navigateur
-- dans Supabase Storage (une fonction Vercel plafonne le corps à 4,5 Mo), et
-- sont servis par des adresses signées d'une heure.
-- À passer AVANT le déploiement : sans elle, la fiche dit que les fichiers ne
-- sont pas installés ; les pages s'affichent comme avant.

-- Seau PRIVÉ : rien n'y est lisible sans adresse signée. Plafond et types
-- revérifiés par Storage lui-même (en plus de l'application).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pages-fichiers', 'pages-fichiers', false, 10485760,
  array[
    'image/png','image/jpeg','image/gif','image/webp','image/avif','image/svg+xml',
    'audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/aac','audio/wav','audio/x-wav','audio/wave',
    'audio/ogg','audio/webm','audio/flac',
    'video/mp4','video/webm','video/quicktime',
    'application/pdf'
  ]
)
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.pages_fichiers (
  page_id  uuid not null references public.pages(id) on delete cascade,
  nom      text not null,
  type     text not null,
  taille   integer not null,
  chemin   text not null,
  cree_le  timestamptz not null default now(),
  primary key (page_id, nom)
);

alter table public.pages_fichiers enable row level security;
