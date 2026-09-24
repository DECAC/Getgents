"use client";

import { useEffect, useMemo, useState } from "react";
import type { Artefact } from "@/lib/types";
import {
  ACCENTS,
  estAccent,
  type AccentArtefact,
  type CalloutTone,
  type DashboardBlock,
  type DashboardSpec,
} from "@/lib/dashboardArtefact";
import { artefactDepuisBlocs, nomDuBloc, versBlocs } from "@/lib/operationsBlocs";
import styles from "./OutilsArtefact.module.css";

/**
 * OUTILS : modifier un artefact À LA MAIN — textes, éléments de liste, lignes
 * et colonnes de tableau, ordre des blocs, couleur d'accent.
 *
 * On travaille sur un BROUILLON : l'aperçu principal le montre en direct
 * (`onApercu`), mais rien n'est écrit avant « Enregistrer », qui crée une
 * version — une retouche manuelle se défait comme une retouche du gent.
 *
 * Le panneau ne connaît pas l'espace : il reçoit un artefact et rend un
 * artefact. C'est ce qui lui permet de servir aussi dans un autre onglet.
 */

type Bloc = DashboardBlock;

const TONS: CalloutTone[] = ["info", "success", "warning", "critical", "neutral"];
const NOM_TON: Record<CalloutTone, string> = {
  info: "Information",
  success: "Réussite",
  warning: "Attention",
  critical: "Critique",
  neutral: "Neutre",
};

const NOUVEAUX: { libelle: string; bloc: Bloc }[] = [
  { libelle: "Titre", bloc: { type: "heading", text: "Nouvelle section" } },
  { libelle: "Texte", bloc: { type: "text", body: "Votre texte." } },
  { libelle: "Encadré", bloc: { type: "callout", tone: "info", body: "À retenir." } },
  { libelle: "Checklist", bloc: { type: "checklist", items: [{ label: "Premier élément", checked: false }] } },
  { libelle: "Tableau", bloc: { type: "table", columns: ["Colonne 1", "Colonne 2"], rows: [["", ""]] } },
];

function Champ({
  libelle,
  valeur,
  onChange,
  long = false,
}: {
  libelle: string;
  valeur: string;
  onChange: (v: string) => void;
  long?: boolean;
}) {
  return (
    <label className={styles.champ}>
      <span className={styles.libelle}>{libelle}</span>
      {long ? (
        <textarea className={styles.saisie} rows={4} value={valeur} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={styles.saisie} value={valeur} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function BoutonMini({ onClick, titre, children }: { onClick: () => void; titre: string; children: React.ReactNode }) {
  return (
    <button type="button" className={styles.mini} onClick={onClick} title={titre} aria-label={titre}>
      {children}
    </button>
  );
}

/** Déplace l'élément `i` d'un cran dans une liste. */
function bouger<T>(liste: T[], i: number, sens: -1 | 1): T[] {
  const j = i + sens;
  if (j < 0 || j >= liste.length) return liste;
  const copie = liste.slice();
  [copie[i], copie[j]] = [copie[j], copie[i]];
  return copie;
}

function EditeurBloc({ bloc, onChange }: { bloc: Bloc; onChange: (b: Bloc) => void }) {
  const titre =
    "title" in bloc ? (
      <Champ libelle="Titre du bloc" valeur={bloc.title ?? ""} onChange={(v) => onChange({ ...bloc, title: v || undefined } as Bloc)} />
    ) : null;

  switch (bloc.type) {
    case "heading":
      return <Champ libelle="Texte" valeur={bloc.text} onChange={(v) => onChange({ ...bloc, text: v })} />;
    case "text":
      return <Champ libelle="Texte" long valeur={bloc.body} onChange={(v) => onChange({ ...bloc, body: v })} />;
    case "callout":
      return (
        <>
          {titre}
          <Champ libelle="Contenu" long valeur={bloc.body} onChange={(v) => onChange({ ...bloc, body: v })} />
          <label className={styles.champ}>
            <span className={styles.libelle}>Ton</span>
            <select
              className={styles.saisie}
              value={bloc.tone}
              onChange={(e) => onChange({ ...bloc, tone: e.target.value as CalloutTone })}
            >
              {TONS.map((t) => (
                <option key={t} value={t}>
                  {NOM_TON[t]}
                </option>
              ))}
            </select>
          </label>
        </>
      );
    case "checklist":
      return (
        <>
          {titre}
          {bloc.items.map((it, i) => (
            <div key={i} className={styles.ligne}>
              <input
                type="checkbox"
                checked={it.checked}
                onChange={() =>
                  onChange({ ...bloc, items: bloc.items.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)) })
                }
                aria-label="Coché"
              />
              <input
                className={styles.saisie}
                value={it.label}
                onChange={(e) =>
                  onChange({ ...bloc, items: bloc.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })
                }
              />
              <BoutonMini titre="Monter" onClick={() => onChange({ ...bloc, items: bouger(bloc.items, i, -1) })}>↑</BoutonMini>
              <BoutonMini titre="Retirer" onClick={() => onChange({ ...bloc, items: bloc.items.filter((_, j) => j !== i) })}>✕</BoutonMini>
            </div>
          ))}
          <button
            type="button"
            className={styles.ajout}
            onClick={() => onChange({ ...bloc, items: [...bloc.items, { label: "Nouvel élément", checked: false }] })}
          >
            + Élément
          </button>
        </>
      );
    case "timeline":
      return (
        <>
          {titre}
          {bloc.items.map((it, i) => (
            <div key={i} className={styles.sousBloc}>
              <div className={styles.ligne}>
                <input
                  className={[styles.saisie, styles.court].join(" ")}
                  placeholder="Date"
                  value={it.date ?? ""}
                  onChange={(e) =>
                    onChange({ ...bloc, items: bloc.items.map((x, j) => (j === i ? { ...x, date: e.target.value || undefined } : x)) })
                  }
                />
                <input
                  className={styles.saisie}
                  placeholder="Étape"
                  value={it.label}
                  onChange={(e) =>
                    onChange({ ...bloc, items: bloc.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })
                  }
                />
                <BoutonMini titre="Monter" onClick={() => onChange({ ...bloc, items: bouger(bloc.items, i, -1) })}>↑</BoutonMini>
                <BoutonMini titre="Retirer" onClick={() => onChange({ ...bloc, items: bloc.items.filter((_, j) => j !== i) })}>✕</BoutonMini>
              </div>
              <textarea
                className={styles.saisie}
                rows={2}
                placeholder="Description (facultative)"
                value={it.body ?? ""}
                onChange={(e) =>
                  onChange({ ...bloc, items: bloc.items.map((x, j) => (j === i ? { ...x, body: e.target.value || undefined } : x)) })
                }
              />
            </div>
          ))}
          <button
            type="button"
            className={styles.ajout}
            onClick={() => onChange({ ...bloc, items: [...bloc.items, { label: "Nouvelle étape", state: "done" }] })}
          >
            + Étape
          </button>
        </>
      );
    case "table":
      return (
        <>
          {titre}
          <div className={styles.grilleDefil}>
            <table className={styles.grille}>
              <thead>
                <tr>
                  {bloc.columns.map((c, ci) => (
                    <th key={ci}>
                      <input
                        className={styles.saisie}
                        value={c}
                        onChange={(e) =>
                          onChange({ ...bloc, columns: bloc.columns.map((x, j) => (j === ci ? e.target.value : x)) })
                        }
                      />
                      {bloc.columns.length > 1 && (
                        <BoutonMini
                          titre="Retirer la colonne"
                          onClick={() =>
                            onChange({
                              ...bloc,
                              columns: bloc.columns.filter((_, j) => j !== ci),
                              rows: bloc.rows.map((r) => r.filter((_, j) => j !== ci)),
                            })
                          }
                        >
                          ✕
                        </BoutonMini>
                      )}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {bloc.rows.map((r, ri) => (
                  <tr key={ri}>
                    {bloc.columns.map((_, ci) => (
                      <td key={ci}>
                        <input
                          className={styles.saisie}
                          value={r[ci] ?? ""}
                          onChange={(e) =>
                            onChange({
                              ...bloc,
                              rows: bloc.rows.map((x, j) =>
                                j === ri ? bloc.columns.map((__, k) => (k === ci ? e.target.value : x[k] ?? "")) : x
                              ),
                            })
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <BoutonMini titre="Retirer la ligne" onClick={() => onChange({ ...bloc, rows: bloc.rows.filter((_, j) => j !== ri) })}>
                        ✕
                      </BoutonMini>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.ligne}>
            <button
              type="button"
              className={styles.ajout}
              onClick={() => onChange({ ...bloc, rows: [...bloc.rows, bloc.columns.map(() => "")] })}
            >
              + Ligne
            </button>
            {bloc.columns.length < 8 && (
              <button
                type="button"
                className={styles.ajout}
                onClick={() =>
                  onChange({
                    ...bloc,
                    columns: [...bloc.columns, `Colonne ${bloc.columns.length + 1}`],
                    rows: bloc.rows.map((r) => [...r, ""]),
                  })
                }
              >
                + Colonne
              </button>
            )}
          </div>
        </>
      );
    case "kv":
      return (
        <>
          {titre}
          {bloc.items.map((it, i) => (
            <div key={i} className={styles.ligne}>
              <input
                className={[styles.saisie, styles.court].join(" ")}
                value={it.label}
                onChange={(e) =>
                  onChange({ ...bloc, items: bloc.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })
                }
              />
              <input
                className={styles.saisie}
                value={it.value}
                onChange={(e) =>
                  onChange({ ...bloc, items: bloc.items.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })
                }
              />
              <BoutonMini titre="Retirer" onClick={() => onChange({ ...bloc, items: bloc.items.filter((_, j) => j !== i) })}>✕</BoutonMini>
            </div>
          ))}
          <button
            type="button"
            className={styles.ajout}
            onClick={() => onChange({ ...bloc, items: [...bloc.items, { label: "Libellé", value: "Valeur" }] })}
          >
            + Ligne
          </button>
        </>
      );
    case "stats":
      return (
        <>
          {bloc.items.map((it, i) => (
            <div key={i} className={styles.ligne}>
              <input
                className={[styles.saisie, styles.court].join(" ")}
                value={it.value}
                onChange={(e) =>
                  onChange({ ...bloc, items: bloc.items.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })
                }
              />
              <input
                className={styles.saisie}
                value={it.label}
                onChange={(e) =>
                  onChange({ ...bloc, items: bloc.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })
                }
              />
              <BoutonMini titre="Retirer" onClick={() => onChange({ ...bloc, items: bloc.items.filter((_, j) => j !== i) })}>✕</BoutonMini>
            </div>
          ))}
          {bloc.items.length < 4 && (
            <button
              type="button"
              className={styles.ajout}
              onClick={() => onChange({ ...bloc, items: [...bloc.items, { label: "Indicateur", value: "0" }] })}
            >
              + Indicateur
            </button>
          )}
        </>
      );
    case "map":
      return (
        <>
          {titre}
          {bloc.points.map((p, i) => (
            <div key={i} className={styles.ligne}>
              <input
                className={[styles.saisie, styles.court].join(" ")}
                value={p.label}
                onChange={(e) =>
                  onChange({ ...bloc, points: bloc.points.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })
                }
              />
              <input
                className={styles.saisie}
                placeholder="Description"
                value={p.description ?? ""}
                onChange={(e) =>
                  onChange({
                    ...bloc,
                    points: bloc.points.map((x, j) => (j === i ? { ...x, description: e.target.value || undefined } : x)),
                  })
                }
              />
              <BoutonMini titre="Retirer" onClick={() => onChange({ ...bloc, points: bloc.points.filter((_, j) => j !== i) })}>✕</BoutonMini>
            </div>
          ))}
          <p className={styles.note}>Pour ajouter un lieu, demandez-le au gent : il en fournit les coordonnées.</p>
        </>
      );
    case "chart": {
      const cle = bloc.xKey ?? "label";
      return (
        <>
          {titre}
          <div className={styles.grilleDefil}>
            <table className={styles.grille}>
              <thead>
                <tr>
                  <th>Libellé</th>
                  {bloc.series.map((s) => (
                    <th key={s.key}>{s.label}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {bloc.data.map((row, ri) => (
                  <tr key={ri}>
                    <td>
                      <input
                        className={styles.saisie}
                        value={String(row[cle] ?? "")}
                        onChange={(e) =>
                          onChange({ ...bloc, data: bloc.data.map((x, j) => (j === ri ? { ...x, [cle]: e.target.value } : x)) })
                        }
                      />
                    </td>
                    {bloc.series.map((s) => (
                      <td key={s.key}>
                        <input
                          className={styles.saisie}
                          inputMode="decimal"
                          value={String(row[s.key] ?? "")}
                          onChange={(e) => {
                            const n = Number(e.target.value.replace(",", "."));
                            onChange({
                              ...bloc,
                              data: bloc.data.map((x, j) =>
                                j === ri ? { ...x, [s.key]: Number.isFinite(n) ? n : e.target.value } : x
                              ),
                            });
                          }}
                        />
                      </td>
                    ))}
                    <td>
                      <BoutonMini titre="Retirer la ligne" onClick={() => onChange({ ...bloc, data: bloc.data.filter((_, j) => j !== ri) })}>
                        ✕
                      </BoutonMini>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className={styles.ajout}
            onClick={() =>
              onChange({
                ...bloc,
                data: [...bloc.data, { [cle]: "Nouveau", ...Object.fromEntries(bloc.series.map((s) => [s.key, 0])) }],
              })
            }
          >
            + Valeur
          </button>
        </>
      );
    }
    default:
      return null;
  }
}

export function OutilsArtefact({
  artefact,
  onApercu,
  onEnregistrer,
  onFermer,
}: {
  artefact: Artefact;
  /** Brouillon courant, à montrer dans l'aperçu — `null` à la fermeture. */
  onApercu: (brouillon: Artefact | null) => void;
  onEnregistrer: (apres: Artefact, resume: string) => void;
  onFermer: () => void;
}) {
  const depart = useMemo(() => versBlocs(artefact), [artefact]);
  const [titre, setTitre] = useState(artefact.title);
  const [spec, setSpec] = useState<DashboardSpec | null>(depart);
  const [ouvert, setOuvert] = useState<string | null>(null);

  const brouillon = useMemo(() => (spec ? artefactDepuisBlocs(artefact, spec, titre) : null), [artefact, spec, titre]);
  useEffect(() => {
    onApercu(brouillon);
  }, [brouillon, onApercu]);
  useEffect(() => () => onApercu(null), [onApercu]);

  if (!spec) {
    return (
      <aside className={styles.panneau} aria-label="Outils">
        <div className={styles.entete}>
          <span className={styles.titrePanneau}>Outils</span>
          <BoutonMini titre="Fermer les outils" onClick={onFermer}>✕</BoutonMini>
        </div>
        <p className={styles.note}>
          Ce type d&apos;artefact (résumé de profil, image) ne se modifie pas encore à la main. Demandez la modification au
          gent dans la conversation.
        </p>
      </aside>
    );
  }

  const majBloc = (i: number, b: Bloc) => setSpec({ ...spec, blocks: spec.blocks.map((x, j) => (j === i ? { ...b, id: x.id } : x)) });

  return (
    <aside className={styles.panneau} aria-label="Outils">
      <div className={styles.entete}>
        <span className={styles.titrePanneau}>Outils</span>
        <BoutonMini titre="Fermer les outils sans enregistrer" onClick={onFermer}>✕</BoutonMini>
      </div>

      <div className={styles.defil}>
        <Champ libelle="Titre de l'artefact" valeur={titre} onChange={setTitre} />

        <div className={styles.champ}>
          <span className={styles.libelle}>Couleur</span>
          <div className={styles.nuancier} role="radiogroup" aria-label="Couleur d'accent">
            {(Object.keys(ACCENTS) as AccentArtefact[]).map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={(spec.accent ?? "sauge") === a}
                title={ACCENTS[a].nom}
                aria-label={ACCENTS[a].nom}
                className={[styles.pastille, (spec.accent ?? "sauge") === a ? styles.pastilleOn : ""].filter(Boolean).join(" ")}
                style={{ background: ACCENTS[a].couleur }}
                onClick={() => setSpec({ ...spec, accent: estAccent(a) && a !== "sauge" ? a : undefined })}
              />
            ))}
          </div>
        </div>

        <div className={styles.libelle}>Blocs</div>
        {spec.blocks.map((b, i) => {
          const cle = b.id ?? String(i);
          const deplie = ouvert === cle;
          return (
            <div key={cle} className={styles.bloc}>
              <div className={styles.blocTete}>
                <button type="button" className={styles.blocNom} onClick={() => setOuvert(deplie ? null : cle)} aria-expanded={deplie}>
                  {deplie ? "▾" : "▸"} {nomDuBloc(b).replace(/^le bloc /, "")}
                </button>
                <BoutonMini titre="Monter le bloc" onClick={() => setSpec({ ...spec, blocks: bouger(spec.blocks, i, -1) })}>↑</BoutonMini>
                <BoutonMini titre="Descendre le bloc" onClick={() => setSpec({ ...spec, blocks: bouger(spec.blocks, i, 1) })}>↓</BoutonMini>
                {spec.blocks.length > 1 && (
                  <BoutonMini titre="Supprimer le bloc" onClick={() => setSpec({ ...spec, blocks: spec.blocks.filter((_, j) => j !== i) })}>
                    ✕
                  </BoutonMini>
                )}
              </div>
              {deplie && (
                <div className={styles.blocCorps}>
                  <EditeurBloc bloc={b} onChange={(nb) => majBloc(i, nb)} />
                </div>
              )}
            </div>
          );
        })}

        <div className={styles.libelle}>Ajouter un bloc</div>
        <div className={styles.ligne}>
          {NOUVEAUX.map((n) => (
            <button
              key={n.libelle}
              type="button"
              className={styles.ajout}
              onClick={() => {
                const pris = new Set(spec.blocks.map((b) => b.id));
                let id = "";
                for (let k = 1; !id; k += 1) if (!pris.has(`b${k}`)) id = `b${k}`;
                setSpec({ ...spec, blocks: [...spec.blocks, { ...n.bloc, id }] });
                setOuvert(id);
              }}
            >
              + {n.libelle}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.pied}>
        <button type="button" className={styles.secondaire} onClick={onFermer}>
          Annuler
        </button>
        <button
          type="button"
          className={styles.principal}
          disabled={!brouillon}
          title={brouillon ? "Crée une nouvelle version — l'ancienne reste dans l'historique" : "Un bloc est vide ou invalide"}
          onClick={() => brouillon && onEnregistrer(brouillon, "modification manuelle")}
        >
          Enregistrer
        </button>
      </div>
    </aside>
  );
}
