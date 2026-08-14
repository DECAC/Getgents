"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import Script from "next/script";
import { useEspace } from "@/lib/context/EspaceContext";
import { addDownloadLead } from "@/lib/downloadLeads";
import {
  DOWNLOAD_LEAD_FORM_MESSAGE,
  downloadableDocumentsForReader,
  newDownloadLead,
  pdfFileName,
  validateDownloadLeadForm,
  type DownloadLeadForm,
} from "@/lib/fileDownload";
import { downloadPdfBytes, textToPdfBytes } from "@/lib/textToPdf";
import { TURNSTILE_SITEKEY, TURNSTILE_VERIFY_URL } from "@/lib/turnstile";
import type { DownloadableDocument } from "@/lib/types";
import modalStyles from "./Modal.module.css";
import styles from "./FileDownloadControl.module.css";

declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void;
    onTurnstileExpire?: () => void;
    onTurnstileError?: () => void;
    turnstile?: {
      render: (el: string | HTMLElement, opts: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

type DialogKind = "form" | "pick" | "empty" | null;

const EMPTY_FORM: DownloadLeadForm = {
  firstName: "",
  lastName: "",
  email: "",
  turnstileToken: "",
  honeypot: "",
};

function triggerDownload(doc: DownloadableDocument): void {
  const name = pdfFileName(doc.name);
  downloadPdfBytes(textToPdfBytes(doc.name, doc.text), name);
}

/**
 * Bouton de téléchargement du document du gent, visible seulement si le
 * créateur a activé la capacité. Avec formulaire : on enregistre le contact
 * uniquement après un PDF réellement téléchargé.
 */
export function FileDownloadControl({ variant = "header" }: { variant?: "header" | "viewer" | "shared" }) {
  const { currentEspace, currentId } = useEspace();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [form, setForm] = useState<DownloadLeadForm>(EMPTY_FORM);
  const [selectedId, setSelectedId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [verifying, setVerifying] = useState(false);

  const enabled = !!currentEspace.fileDownloadEnabled;
  const docs = downloadableDocumentsForReader(currentEspace);
  const formOn = !!currentEspace.fileDownloadFormEnabled;

  useEffect(() => {
    if (!dialog) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDialog(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dialog]);

  useEffect(() => {
    window.onTurnstileSuccess = (t: string) => setToken(t);
    window.onTurnstileExpire = () => setToken("");
    window.onTurnstileError = () => setToken("");
    return () => {
      delete window.onTurnstileSuccess;
      delete window.onTurnstileExpire;
      delete window.onTurnstileError;
    };
  }, []);

  // Le script Turnstile se charge une fois ; le widget n'existe que quand
  // le formulaire est ouvert — on le dessine à ce moment-là.
  useEffect(() => {
    if (dialog !== "form") return;
    let cancelled = false;
    let widgetId: string | undefined;
    let timer: number | undefined;

    function mount(): boolean {
      const el = document.getElementById("download-turnstile");
      if (!el || !window.turnstile || cancelled) return false;
      widgetId = window.turnstile.render(el, {
        sitekey: TURNSTILE_SITEKEY,
        action: "turnstile-spin-v1",
        appearance: "always",
        retry: "auto",
        theme: "light",
        callback: (t: string) => setToken(t),
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
      });
      return true;
    }

    if (!mount()) {
      timer = window.setInterval(() => {
        if (mount() && timer) window.clearInterval(timer);
      }, 200);
    }

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      if (widgetId) window.turnstile?.remove(widgetId);
      setToken("");
    };
  }, [dialog]);

  if (!enabled) return null;

  function openFlow() {
    setError(null);
    setForm(EMPTY_FORM);
    setToken("");
    setSelectedId(docs[0]?.id ?? "");
    if (docs.length === 0) {
      setDialog("empty");
      return;
    }
    if (formOn) {
      setDialog("form");
      return;
    }
    if (docs.length === 1) {
      triggerDownload(docs[0]);
      return;
    }
    setDialog("pick");
  }

  function selectedDoc(): DownloadableDocument | null {
    return docs.find((d) => d.id === selectedId) ?? docs[0] ?? null;
  }

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    const issue = validateDownloadLeadForm({ ...form, turnstileToken: token });
    if (issue === "honeypot") {
      setDialog(null);
      return;
    }
    if (issue) {
      setError(DOWNLOAD_LEAD_FORM_MESSAGE[issue]);
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(TURNSTILE_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { success?: boolean };
      if (!data.success) {
        setError(DOWNLOAD_LEAD_FORM_MESSAGE.captcha);
        setToken("");
        window.turnstile?.reset();
        return;
      }
    } catch {
      setError("Le captcha n’a pas pu être vérifié. Réessayez.");
      setToken("");
      window.turnstile?.reset();
      return;
    } finally {
      setVerifying(false);
    }
    const doc = selectedDoc();
    if (!doc) {
      setError("Aucun document à télécharger.");
      return;
    }
    const name = pdfFileName(doc.name);
    triggerDownload(doc);
    addDownloadLead(
      newDownloadLead(form, {
        gentId: currentId,
        gentName: currentEspace.gent || currentEspace.name,
        fileName: name,
      })
    );
    setDialog(null);
  }

  function handlePick() {
    const doc = selectedDoc();
    if (!doc) return;
    triggerDownload(doc);
    setDialog(null);
  }

  const btnClass =
    variant === "viewer" ? styles.btnViewer : variant === "shared" ? styles.btnShared : styles.btnHeader;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <button type="button" className={btnClass} onClick={openFlow} title="Télécharger le document en PDF">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 3v12M7 10l5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        Télécharger
      </button>

      {dialog &&
        createPortal(
        <div className={modalStyles.overlay} role="presentation" onClick={() => setDialog(null)}>
          <div
            className={`${modalStyles.modal} ${styles.modalOpen}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="file-download-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={modalStyles.head}>
              <span className={modalStyles.ti} aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3v12M7 10l5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
              </span>
              <div>
                <h2 id="file-download-title" className={modalStyles.title}>
                  {dialog === "empty" ? "Aucun document" : "Télécharger le document"}
                </h2>
                <div className={modalStyles.meta}>
                  {dialog === "form"
                    ? "Renseignez vos coordonnées pour recevoir le PDF."
                    : dialog === "pick"
                      ? "Choisissez le fichier à télécharger."
                      : "Ce gent n’a pas encore de document à proposer."}
                </div>
              </div>
              <button type="button" className={modalStyles.closeBtn} onClick={() => setDialog(null)} aria-label="Fermer">
                ✕
              </button>
            </div>

            {dialog === "empty" ? (
              <>
                <div className={modalStyles.body}>
                  <p className={styles.emptyCopy}>
                    Aucun fichier n&apos;est attaché à ce gent. Le créateur doit ajouter un document
                    dans Connaissances (ou une visionneuse) pour que le téléchargement soit possible.
                  </p>
                </div>
                <div className={modalStyles.foot}>
                  <button type="button" className={modalStyles.btnGhost} onClick={() => setDialog(null)}>
                    Fermer
                  </button>
                </div>
              </>
            ) : dialog === "pick" ? (
              <>
                <div className={modalStyles.body}>
                  <FileList docs={docs} selectedId={selectedId} onSelect={setSelectedId} />
                </div>
                <div className={modalStyles.foot}>
                  <button type="button" className={modalStyles.btnGhost} onClick={() => setDialog(null)}>
                    Annuler
                  </button>
                  <button type="button" className={modalStyles.btnPrim} onClick={handlePick} disabled={!selectedDoc()}>
                    Télécharger le PDF
                  </button>
                </div>
              </>
            ) : (
              <form className={styles.downloadForm} onSubmit={handleFormSubmit}>
                <div className={modalStyles.body}>
                  {docs.length > 1 && (
                    <FileList docs={docs} selectedId={selectedId} onSelect={setSelectedId} />
                  )}
                  <div className={styles.fields}>
                    <label className={styles.field}>
                      <span className={styles.label}>
                        Nom <span className={styles.req}>*</span>
                      </span>
                      <input
                        className={styles.input}
                        autoComplete="family-name"
                        value={form.lastName}
                        onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                        required
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>
                        Prénom <span className={styles.req}>*</span>
                      </span>
                      <input
                        className={styles.input}
                        autoComplete="given-name"
                        value={form.firstName}
                        onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                        required
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>
                        E-mail <span className={styles.req}>*</span>
                      </span>
                      <input
                        className={styles.input}
                        type="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        required
                      />
                    </label>
                    <label className={styles.honeypot} aria-hidden="true">
                      Site web
                      <input
                        tabIndex={-1}
                        autoComplete="off"
                        value={form.honeypot}
                        onChange={(e) => setForm((f) => ({ ...f, honeypot: e.target.value }))}
                      />
                    </label>
                    <div className={styles.captcha}>
                      <div id="download-turnstile" className="cf-turnstile" data-action="turnstile-spin-v1" />
                    </div>
                  </div>
                  {error && <p className={styles.error}>{error}</p>}
                </div>
                <div className={modalStyles.foot}>
                  <button type="button" className={modalStyles.btnGhost} onClick={() => setDialog(null)}>
                    Annuler
                  </button>
                  <button type="submit" className={modalStyles.btnPrim} disabled={!token || verifying}>
                    {verifying ? "Vérification…" : "Télécharger le PDF"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function FileList({
  docs,
  selectedId,
  onSelect,
}: {
  docs: DownloadableDocument[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset className={styles.fileList}>
      <legend className={styles.label}>Fichier</legend>
      {docs.map((doc) => (
        <label key={doc.id} className={styles.fileChoice}>
          <input
            type="radio"
            name="download-file"
            checked={selectedId === doc.id}
            onChange={() => onSelect(doc.id)}
          />
          <span>{doc.name}</span>
        </label>
      ))}
    </fieldset>
  );
}
