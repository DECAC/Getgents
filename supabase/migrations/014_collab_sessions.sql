-- Gent collaboratif orchestrateur : plusieurs participants rejoignent une
-- session via un lien de partage, echangent dans un salon commun, parlent en
-- prive avec le gent ET entre eux, pendant que le gent orchestre la mission
-- (collecte d'infos, verification web, propositions, synthese des decisions).
--
-- Tables dediees, et non des champs de published_gents.espace : ce document
-- JSONB est reecrit ENTIER par PUT /api/gents/[id], debounce depuis le
-- navigateur du createur. Un message ou un compteur ecrit cote serveur y
-- serait ecrase au prochain push (lost update) — meme raisonnement que pour
-- share_links (migration 002).
--
-- La session est liee au lien de partage (token) et non au gent directement :
-- revoquer le lien ferme la session, supprimer le lien l'emporte en cascade.
create table if not exists public.collab_sessions (
  id                   text primary key,        -- 24 octets aleatoires, base64url
  token                text not null references public.share_links(token) on delete cascade,
  gent_id              text not null,
  -- collecting : le gent rassemble les reponses de chacun ;
  -- proposing  : options verifiees sur le web, vote du groupe ;
  -- done       : decision actee, synthese figee.
  status               text not null default 'collecting'
                         check (status in ('collecting', 'proposing', 'done')),
  -- Reponses collectees, par participant puis par question :
  -- { "<participantId>": { "<questionId>": "valeur" } }. Cote serveur SEUL :
  -- les verbatim d'un participant ne sont jamais servis aux autres.
  collection           jsonb not null default '{}',
  -- Recapitulatif vivant de la mission, maintenu par l'orchestrateur et
  -- visible de tous les participants (decision, infos cles, points en suspens,
  -- fil des decisions).
  synthesis            jsonb not null default '{}',
  -- Garde-fou cout : chaque tick d'orchestration est un appel LLM facture au
  -- PROPRIETAIRE du gent. Le plafond borne la depense d'un salon tres actif.
  orchestration_count  integer not null default 0,
  max_orchestrations   integer not null default 200,
  -- Mutex applicatif anti-concurrence : un seul tick d'orchestration a la
  -- fois (voir collab_orchestration_begin/end ci-dessous).
  orchestrating        boolean not null default false,
  created_at           timestamptz not null default now()
);
-- Une session par lien de partage.
create unique index if not exists collab_sessions_token_key on public.collab_sessions (token);
create index if not exists collab_sessions_gent_id_idx on public.collab_sessions (gent_id);

-- Un participant = un prenom + un jeton non devinable. Pas de compte requis :
-- le participant_token prouve l'identite a chaque requete (le navigateur le
-- garde en localStorage ; le serveur ne le sert jamais a un tiers).
create table if not exists public.collab_participants (
  id                text primary key,         -- 12 octets aleatoires, base64url
  session_id        text not null references public.collab_sessions(id) on delete cascade,
  name              text not null,
  participant_token text not null,
  -- organizer : le createur de la mission (badge « Createur » dans le salon) ;
  -- participant : tout le monde.
  role              text not null default 'participant'
                      check (role in ('organizer', 'participant')),
  last_seen_at      timestamptz not null default now()
);
create unique index if not exists collab_participants_token_key on public.collab_participants (participant_token);
create index if not exists collab_participants_session_idx on public.collab_participants (session_id);

-- Journal des echanges, append-only (jamais reecrit, comme share_events).
-- channel :
--   'room'                 — salon commun, visible de tous, gent compris ;
--   'gent:<participantId>' — fil prive entre le gent et CE participant
--                            (collecte des reponses) ;
--   'peer:<idA>:<idB>'     — entre deux participants, ids TRIES : le fil est
--                            unique quel que soit l'initiateur, et le gent
--                            n'y a JAMAIS acces (jamais injecte dans son
--                            contexte, jamais servi a un tiers).
create table if not exists public.collab_messages (
  id          bigserial primary key,
  session_id  text not null references public.collab_sessions(id) on delete cascade,
  channel     text not null,
  -- 'gent' ou l'id d'un participant.
  author      text not null,
  author_name text not null,
  kind        text not null default 'text'
                check (kind in ('text', 'question', 'proposal', 'system', 'vote')),
  text        text not null,
  -- Contenu structure selon kind : options cliquables d'une question,
  -- cartes de proposition, bulletin de vote { proposalId, optionId }…
  payload     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists collab_messages_session_idx on public.collab_messages (session_id, id);

-- Meme convention que published_gents et share_links : RLS active SANS aucune
-- policy, donc seule la cle service_role (cote serveur Next.js) accede a ces
-- tables. Tout le filtrage de visibilite (qui voit quel canal) est fait par
-- le code serveur, jamais par le navigateur.
alter table public.collab_sessions     enable row level security;
alter table public.collab_participants enable row level security;
alter table public.collab_messages     enable row level security;

-- Tick d'orchestration : prise atomique du mutex ET du compteur de plafond.
-- Renvoie le nouveau compteur, ou -1 si le plafond est atteint ou si un tick
-- est deja en cours : l'appelant doit alors s'abstenir (il n'y a rien a
-- rattraper — le tick en cours verra les messages qui viennent d'arriver).
create or replace function public.collab_orchestration_begin(p_session text, p_max integer)
returns integer language plpgsql as $$
declare
  n integer;
begin
  update public.collab_sessions
     set orchestrating = true,
         orchestration_count = orchestration_count + 1
   where id = p_session
     and orchestrating = false
     and orchestration_count < coalesce(p_max, max_orchestrations)
  returning orchestration_count into n;
  return coalesce(n, -1);
end $$;

-- Relache le mutex, quelle que soit l'issue du tick (appele en finally).
create or replace function public.collab_orchestration_end(p_session text)
returns void language plpgsql as $$
begin
  update public.collab_sessions set orchestrating = false where id = p_session;
end $$;

-- Meme discipline que les autres fonctions : pas d'appel direct depuis les
-- roles exposes, tout passe par la cle service_role.
revoke all on function public.collab_orchestration_begin(text, integer) from public, anon, authenticated;
revoke all on function public.collab_orchestration_end(text) from public, anon, authenticated;
