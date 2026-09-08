-- Chiffrement des jetons OAuth des connecteurs (Gmail aujourd'hui).
--
-- `005_integration_credentials.sql` les stockait EN CLAIR. Ce sont les
-- identifiants d'acces a la boite mail de quelqu'un : une lecture de la base —
-- sauvegarde egaree, acces console, incident chez l'hebergeur — donnait le
-- courrier de tous les utilisateurs ayant branche Gmail. C'est, de loin, la
-- donnee la plus sensible du projet.
--
-- La colonne `enc_version` dit comment lire chaque ligne, et c'est ce qui rend
-- la bascule possible sans interruption :
--   0 = clair   (les lignes ecrites avant ce chiffrement)
--   1 = AES-256-GCM via lib/server/secretBox.ts
--
-- Une migration qui aurait chiffre les lignes existantes ICI etait impossible :
-- la cle vit dans l'environnement de l'application, pas dans la base. Le code
-- lit donc les deux formats, et rechiffre chaque ligne des qu'il la touche.
--
-- ATTENTION : la perte de SECRET_BOX_KEY rend ces jetons ILLISIBLES. Les
-- utilisateurs devront rebrancher Gmail. C'est le prix du chiffrement, et il
-- est tres inferieur a celui d'une fuite.

alter table public.integration_credentials
  add column if not exists enc_version integer not null default 0;

comment on column public.integration_credentials.enc_version is
  '0 = jetons en clair (heritage), 1 = chiffres AES-256-GCM par secretBox.';
