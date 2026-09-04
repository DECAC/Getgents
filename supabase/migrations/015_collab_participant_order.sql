-- Ordre d'affichage des participants d'un salon.
--
-- La liste de gauche changeait d'ordre toute seule, sous les yeux des
-- participants. Ce n'etait pas un caprice du rendu : la requete triait sur
-- `last_seen_at`, et cette colonne est reecrite a CHAQUE sondage du client,
-- soit toutes les 2,5 secondes. Trois participants actifs produisaient donc
-- six ordres possibles, en rotation permanente.
--
-- `last_seen_at` reste utile — c'est elle qui dit qui est en ligne — mais elle
-- ne peut pas servir d'ordre stable. On ajoute donc la date d'arrivee, qui ne
-- bouge jamais et porte en plus un sens : l'ordre dans lequel les gens ont
-- rejoint la mission.

alter table public.collab_participants
  add column if not exists joined_at timestamptz not null default now();

-- Les salons deja ouverts n'ont pas de date d'arrivee. `last_seen_at` en est
-- la meilleure approximation disponible : pour un participant inactif, elle
-- vaut encore sa date d'arrivee ; pour les autres, l'ordre obtenu est
-- arbitraire mais il sera desormais FIXE, ce qui est tout ce qu'on demande.
update public.collab_participants
   set joined_at = last_seen_at
 where joined_at > last_seen_at;

-- L'index sert le tri de la liste, toujours filtree par session.
create index if not exists collab_participants_ordre_idx
  on public.collab_participants (session_id, joined_at, id);
