-- Gent « Le Publiciste » : PLUSIEURS projets par auteur et par gent (27/11,
-- option choisie par l'éditeur ; maquette de l'écran « Vos projets » :
-- mockups/recit/publiciste/projets.html). La 040 en permettait un seul.
-- À passer AVANT le déploiement : le code lit la colonne `nom` et crée
-- plusieurs lignes pour un même gent.

-- Un projet n'est plus unique par (auteur, gent).
alter table public.publiciste_projets
  drop constraint if exists publiciste_projets_owner_id_gent_id_key;

-- Le nom donné par l'auteur (« Renommer ») ; vide = celui de la fiche.
alter table public.publiciste_projets
  add column if not exists nom text not null default '';

-- La liste « Vos projets » : les projets d'un auteur pour un gent, du plus récent au plus ancien.
create index if not exists publiciste_projets_liste
  on public.publiciste_projets (owner_id, gent_id, modifie_le desc);
