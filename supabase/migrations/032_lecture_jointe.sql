-- LECTURE JOINTE à une réponse (19/11, décision de l'éditeur) : la fenêtre
-- « Partager vos données ? » disparaît ; la lecture est anonyme par défaut.
-- Le détail de la visite EN COURS (début, durée onglet visible, partie lue,
-- appareil) ne part que si le lecteur coche « Joindre ma lecture de la page »
-- au bouton d'engagement — il voyage AVEC sa réponse, pour ce lien seulement.
--
-- À passer AVANT le déploiement : sans elle, une réponse avec lecture jointe
-- serait refusée par la base (colonne inconnue).

alter table public.pages_reponses add column if not exists lecture jsonb;
