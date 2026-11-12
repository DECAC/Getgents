-- Assistant du document sur un artefact partagé (12/11).
--
-- Le destinataire d'un lien peut poser des questions sur l'artefact ; un
-- modèle répond à partir du document SEUL. Option du partage, désactivée
-- par défaut ; c'est le PROPRIÉTAIRE qui paie (sa clé, ou son quota sur la
-- clé commune). `questions` compte les questions posées : un plafond par lien
-- protège sa clé d'un lien qui circulerait.
-- À passer AVANT le déploiement : la page et la route en dépendent.

alter table public.artefacts_partages
  add column if not exists assistant boolean not null default false,
  add column if not exists questions integer not null default 0;
