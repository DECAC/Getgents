-- Signalements d'incident laisses par les utilisateurs d'un gent diffuse.
--
-- Pourquoi une table, alors qu'un e-mail suffirait en apparence : un envoi qui
-- echoue ne doit pas effacer un retour. Brevo peut etre en panne, la cle
-- absente, l'adresse rejetee — et le signalement serait perdu sans que
-- personne ne le sache, y compris celui qui a pris la peine de l'ecrire. La
-- base est la source, l'e-mail n'est qu'une notification.
--
-- Aucune donnee identifiante : l'auteur n'a pas de compte, on ne lui en
-- demande pas, et on n'enregistre ni son adresse IP ni son navigateur. Un
-- signalement est un retour sur un gent, pas un profil d'utilisateur.

create table if not exists public.gent_reports (
  id          bigserial primary key,
  gent_id     text not null references public.published_gents(id) on delete cascade,
  -- Le lien de partage d'ou vient le signalement, quand il y en a un. Permet
  -- au createur de savoir QUEL partage pose probleme, sans identifier qui.
  token       text,
  -- 'oui' | 'non' | null : la question sur l'appreciation du service.
  appreciation text check (appreciation in ('oui', 'non')),
  -- 'resultat' | 'conversation' | 'anomalie' | null.
  motif       text,
  precision   text,
  -- Trace de l'envoi : distinguer « jamais notifie » de « notifie » evite de
  -- renvoyer deux fois, et de croire qu'un retour a ete vu alors qu'il dort.
  notifie_le  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists gent_reports_gent_idx on public.gent_reports (gent_id, created_at desc);

-- RLS active sans policy : la table n'est jamais lue depuis le navigateur.
-- Les ecritures passent par la route serveur avec la cle de service, apres
-- verification du jeton de partage.
alter table public.gent_reports enable row level security;

-- Notifications d'usage par un invite.
--
-- Le besoin : etre prevenu quand quelqu'un se sert d'un gent partage. La
-- tentation etait de notifier a chaque message — recordShareEvent se declenche
-- a chaque tour de conversation. Vingt echanges donneraient vingt e-mails, dix
-- invites actifs plusieurs centaines par jour : le fournisseur d'envoi
-- limiterait, et le destinataire cesserait de les lire. Ce qui annule
-- exactement l'objectif.
--
-- On notifie donc a la PREMIERE utilisation d'un lien dans une journee. Cette
-- table retient la derniere notification envoyee par lien.

create table if not exists public.share_usage_notices (
  token       text primary key,
  gent_id     text not null,
  notifie_le  timestamptz not null default now()
);

alter table public.share_usage_notices enable row level security;
