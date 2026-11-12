-- Artefacts partagés par le connecteur MCP (phase 0, essai de fidélité).
--
-- Un artefact généré dans Claude, ChatGPT… est recopié par le modèle dans
-- l'appel au connecteur, puis affiché en pleine page à /partage/<jeton>.
-- Le contenu est du code ARBITRAIRE : il n'est jamais rendu dans le document
-- de Getgents, seulement dans un cadre isolé (CSP `sandbox`, origine opaque).

create table if not exists public.artefacts_partages (
  jeton         text primary key,        -- 24 octets aléatoires, base64url
  titre         text not null,
  contenu       text not null,
  format        text not null check (format in ('html', 'markdown', 'svg', 'react', 'texte')),
  destinataire  text not null,           -- adresse e-mail ou nom du client
  message       text,
  caracteres    integer not null,        -- longueur reçue : le témoin de l'essai
  client        text,                    -- User-Agent de l'appel (Claude, ChatGPT…)
  created_at    timestamptz not null default now(),
  expires_at    timestamptz,
  revoked_at    timestamptz
);

-- Même convention que les autres tables : RLS activé sans aucune policy, donc
-- seule la clé service_role (côté serveur) y accède.
alter table public.artefacts_partages enable row level security;
