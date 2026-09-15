import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

/**
 * Chiffrement des secrets stockés en base — d'abord la clé OpenRouter de
 * chaque builder, demain les jetons OAuth Gmail.
 *
 * Ce que cela protège, précisément : une fuite de sauvegarde, un accès en
 * lecture à la base, une capture de logs PostgREST. Cela ne protège pas d'un
 * serveur compromis, qui a l'environnement sous la main — mais ce n'est pas
 * la même faute, ni la même probabilité.
 *
 * AES-256-GCM : chiffrement ET authentification. Sans le tag, une valeur
 * altérée en base se déchiffrerait en octets aléatoires qu'on enverrait
 * ensuite à OpenRouter comme si de rien n'était.
 *
 * Format de sortie : base64(iv‖tag‖chiffré). Une seule chaîne, une seule
 * colonne, aucun champ à garder synchronisé.
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96 bits — la taille recommandée pour GCM.
const TAG_LEN = 16;

export class SecretBoxIndisponible extends Error {
  constructor() {
    super(
      "SECRET_BOX_KEY n'est pas configurée : impossible d'enregistrer une clé chiffrée. " +
        "Définissez-la dans l'environnement (32 octets aléatoires)."
    );
    this.name = "SecretBoxIndisponible";
  }
}

/**
 * Clé de 32 octets dérivée de la variable d'environnement.
 *
 * Le SHA-256 n'est pas là pour renforcer un secret faible — il ne le peut
 * pas — mais pour accepter indifféremment une valeur hexadécimale, base64 ou
 * une phrase, sans imposer un format à la configuration. Le secret doit être
 * ALÉATOIRE : c'est la seule exigence, et elle est dans `.env.example`.
 */
function cleMaitresse(): Buffer | null {
  const brut = process.env.SECRET_BOX_KEY?.trim();
  if (!brut || brut.length < 16) return null;
  return createHash("sha256").update(brut, "utf8").digest();
}

export function secretBoxConfigure(): boolean {
  return cleMaitresse() !== null;
}

/** Lève si la variable manque : mieux vaut refuser que stocker en clair. */
export function chiffrer(valeur: string): string {
  const cle = cleMaitresse();
  if (!cle) throw new SecretBoxIndisponible();

  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, cle, iv);
  const chiffre = Buffer.concat([cipher.update(valeur, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), chiffre]).toString("base64");
}

/**
 * Renvoie `null` plutôt que de lever — délibérément.
 *
 * Une clé devenue illisible (rotation de `SECRET_BOX_KEY`, ligne tronquée,
 * tag altéré) doit faire retomber l'appel sur la clé plateforme, pas casser
 * une génération. L'appelant traite le `null` comme « pas de clé
 * personnelle », ce qu'il sait déjà faire.
 */
export function dechiffrer(paquet: string | null | undefined): string | null {
  const cle = cleMaitresse();
  if (!cle || !paquet) return null;

  try {
    const brut = Buffer.from(paquet, "base64");
    if (brut.length <= IV_LEN + TAG_LEN) return null;

    const iv = brut.subarray(0, IV_LEN);
    const tag = brut.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, cle, iv);
    decipher.setAuthTag(tag);
    const clair = Buffer.concat([
      decipher.update(brut.subarray(IV_LEN + TAG_LEN)),
      decipher.final(),
    ]);
    return clair.toString("utf8");
  } catch {
    // Volontairement muet : ce chemin est atteint à chaque lecture d'une clé
    // devenue illisible, et journaliser à chaque tour de conversation
    // noierait les journaux sans rien apprendre de plus.
    return null;
  }
}
