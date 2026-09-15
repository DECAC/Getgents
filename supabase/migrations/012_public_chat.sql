-- Conversation sur un gent public.
--
-- Un gent publie a l'adresse getgents.ai/<slug> est lisible par tous. Qu'il
-- REPONDE a un visiteur anonyme est un autre geste : chaque tour est un appel
-- facture. La decision revient donc au proprietaire, gent par gent, et le
-- defaut est fermé — publier ne doit jamais ouvrir un robinet a son insu.
--
-- Le cout est impute au proprietaire (ses plafonds d'usage), puisque c'est lui
-- qui diffuse. Le lot suivant fera porter l'appel par sa propre cle OpenRouter.

alter table public.published_gents
  add column if not exists public_chat boolean not null default false;
