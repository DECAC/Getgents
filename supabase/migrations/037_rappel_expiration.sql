-- Getgents Pages : rappel d'expiration des liens (lot « Partager », étape 2, 23/11).
--
-- Une colonne : à quelle heure l'e-mail de rappel a été envoyé pour CE lien.
-- Elle évite qu'une tâche horaire renvoie le même rappel ; prolonger un lien
-- la remet à null (nouvelle échéance, nouveau rappel possible).
--
-- Déployé AVANT cette migration, le code lit « colonne absente » comme « rien
-- à rappeler » et n'envoie rien — aucune lecture existante n'en dépend.

alter table public.artefacts_partages
  add column if not exists rappel_expiration_le timestamptz;

-- La tâche cherche les liens actifs proches de l'échéance, sans rappel.
create index if not exists artefacts_partages_rappel_idx
  on public.artefacts_partages (expires_at)
  where revoked_at is null and rappel_expiration_le is null and owner_id is not null;
