-- Séparation version de travail / version diffusée.
--
-- Jusqu'ici published_gents.espace servait deux usages contradictoires : il
-- était à la fois ce que le créateur ouvre en Preview et ce que voient les
-- utilisateurs d'un lien de partage. Conséquence : tester une modification en
-- Preview la poussait instantanément en production chez les destinataires,
-- prompt à moitié réécrit compris.
--
-- Désormais :
--   espace   = version de TRAVAIL, réécrite à chaque Preview du créateur.
--   diffused = version DIFFUSÉE, figée, écrite uniquement au clic sur
--              « Diffuser le gent ». C'est elle que servent les liens de
--              partage, l'iframe, WhatsApp et les routines planifiées.
--
-- Nullable, et les lectures retombent sur `espace` quand elle est absente :
-- les gents déjà en ligne continuent de fonctionner sans reprise de données,
-- et adoptent la nouvelle sémantique à leur prochaine diffusion.
alter table public.published_gents
  add column if not exists diffused jsonb;

alter table public.published_gents
  add column if not exists diffused_at timestamptz;
