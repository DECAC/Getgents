# Casting Mistral Voxtral TTS du Publiciste (27/11). Usage : MISTRAL_API_KEY=… GEMINI_API_KEY=… python3 casting-mistral.py Marie Manon Lea Camille
# Une phrase par appel (voxtral-mini-tts-3-0, voix françaises toutes prêtes), mêmes contrôles que casting-gemini.py :
# durée ≤ place, silence interne, transcription (par Gemini), début de prise (rien d'ajouté avant le texte).
# Voxtral n'a pas de consigne de style : le texte est envoyé seul. Produit medias/essai-<voix>.mp3 et voix-<voix>.mp3.
# Niveau : aligné ensuite sur les voix Gemini (-18,3 LUFS, ebur128 + volume + alimiter), hors de ce script.
import base64, json, subprocess, sys, os, re, difflib, unicodedata, time
MEDIAS = "/home/user/Getgents/mockups/recit/publiciste/medias"
LIGNES = [(1.8, "J'avais huit ans. C'était l'été, dans l'atelier."), (7.8, "Mon oncle m'a tendu mon premier couteau."),
  (18.5, "Avec, j'ai construit une cabane."), (24.0, "Et une petite voiture en bois, qui roulait… à peu près."),
  (34.5, "Il y a des objets qu'on n'oublie pas."), (38.5, "Ils sont faits par des mains patientes, ici, en France."),
  (48.3, "Cette année, mon entreprise m'en a offert un."), (56.5, "Je crois que je sais à qui je vais le donner."), (62.0, "Offrez un cadeau qui a une histoire.")]
FIN = 66.4
CONSIGNE = "Dis en français de France, accent parisien neutre, d'une voix basse et chaude, comme une confidence, sans traîner : {}"
MODELES = ["voxtral-mini-tts-3-0"]
VOIX_MISTRAL = {"Marie": "01a1536e-a46c-7101-b6e9-1ebda46309fd", "Manon": "01a151d2-8c33-7781-a14d-bd91dd8426cc",
  "Lea": "01a151d2-8c29-766d-9ca2-30f33707cef6", "Camille": "01a151d2-8c1f-75cf-8cdf-20f328c00764"}
CLE_MISTRAL = os.environ["MISTRAL_API_KEY"]
KEY = os.environ["GEMINI_API_KEY"]

def post(modele, corps):
    REQ = f"req-{os.getpid()}.json"; open(REQ, "w").write(json.dumps(corps))
    out = subprocess.run(["curl", "-sS", "--max-time", "120", "-X", "POST", f"https://generativelanguage.googleapis.com/v1beta/models/{modele}:generateContent",
        "-H", f"x-goog-api-key: {KEY}", "-H", "Content-Type: application/json", "-d", "@" + REQ], capture_output=True, text=True)
    try: return json.loads(out.stdout)
    except Exception: return {"error": out.stderr[:200]}

def tts(voix, texte, f):
    for modele in MODELES:
        for essai in range(8):
            REQ = f"req-m-{os.getpid()}.json"
            open(REQ, "w").write(json.dumps({"model": modele, "input": texte, "voice_id": VOIX_MISTRAL[voix], "response_format": "wav"}))
            out = subprocess.run(["curl", "-sS", "--max-time", "120", "-X", "POST", "https://api.mistral.ai/v1/audio/speech",
                "-H", f"Authorization: Bearer {CLE_MISTRAL}", "-H", "Content-Type: application/json", "-d", "@" + REQ], capture_output=True, text=True)
            try:
                open(f, "wb").write(base64.b64decode(json.loads(out.stdout)["audio_data"])); return modele
            except Exception:
                print("   erreur", modele, (out.stdout or out.stderr)[:150], file=sys.stderr); time.sleep(20 if "429" in out.stdout or "rate" in out.stdout.lower() else 4)
    raise RuntimeError("TTS impossible")

def transcrire(f, debut=None):
    if debut:
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-t", str(debut), "-i", f, f + ".debut.wav"], check=True); f = f + ".debut.wav"
    b = base64.b64encode(open(f, "rb").read()).decode()
    for m in ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-flash-lite-latest"]:
        r = post(m, {"contents": [{"parts": [{"inlineData": {"mimeType": "audio/wav", "data": b}},
            {"text": "Transcris mot pour mot ce qui est dit dans cet audio, en français, sans rien ajouter. Réponds par la transcription seule."}]}]})
        try: return r["candidates"][0]["content"]["parts"][-1]["text"].strip()
        except Exception: time.sleep(3)
    return ""

def norm(s):
    s = s.lower().replace("8", "huit").replace("’", "'")
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z' ]+", " ", s).split()

def duree(f): return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True).stdout)

def silences(f):
    e = subprocess.run(["ffmpeg", "-hide_banner", "-i", f, "-af", "silencedetect=n=-40dB:d=0.25", "-f", "null", "-"], capture_output=True, text=True).stderr
    return [float(x) for x in re.findall(r"silence_duration: ([0-9.]+)", e)]

def rogner(src, dst):  # retire le silence de début et de fin, 44,1 kHz
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-af",
        "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse",
        "-ar", "44100", "-ac", "1", dst], check=True)

def phrase(voix, i):
    t, texte = LIGNES[i]
    place = (LIGNES[i + 1][0] if i + 1 < len(LIGNES) else FIN) - t - 0.35
    meilleur = None
    for k in range(5):
        brut, f = f"{voix}-{i}-{k}-brut.wav", f"{voix}-{i}-{k}.wav"
        modele = tts(voix, texte, brut); rogner(brut, f)
        d, sil, tr = duree(f), max(silences(f) or [0]), transcrire(f)
        sim = difflib.SequenceMatcher(None, norm(texte), norm(tr)).ratio()
        deb = norm(transcrire(f, 1.3)); premier = norm(texte)[0]
        consigne_lue = not any(m in deb[:3] for m in norm(texte)[:2])  # rien ne doit précéder le texte (un « Et » initial peut manquer à l’extrait)
        if consigne_lue: sim = 0
        ok = sim >= 0.9 and sil <= 1.1 and d <= place
        print(f"  {voix} {i} prise {k}: {d:.2f}s/{place:.2f} silence max {sil:.2f} sim {sim:.2f} [{modele}] « {tr} » début « {' '.join(deb)} »", file=sys.stderr)
        if sim >= 0.9 and sil <= 1.6 and (meilleur is None or d < meilleur[1]): meilleur = (f, d)
        if ok: return f, d
    if meilleur:  # trop long : on accélère légèrement, sans changer la hauteur
        f, d = meilleur
        if d > place:
            ratio = d / place
            if ratio > 1.2: raise RuntimeError(f"{voix} {i} trop long ({d:.2f}s pour {place:.2f})")
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", f, "-af", f"atempo={ratio:.3f}", f + ".rapide.wav"], check=True)
            print(f"  {voix} {i}: accéléré ×{ratio:.2f}", file=sys.stderr); return f + ".rapide.wav", duree(f + ".rapide.wav")
        return f, d
    raise RuntimeError(f"{voix} {i}: aucune prise conforme")

def assembler(voix):
    prises = [phrase(voix, i) for i in range(len(LIGNES))]
    entrees, filtres = [], []
    for n, ((f, d), (t, _)) in enumerate(zip(prises, LIGNES)):
        entrees += ["-i", f]; ms = int(t * 1000); filtres.append(f"[{n}]adelay={ms}|{ms}[a{n}]")
    mix = ";".join(filtres) + ";" + "".join(f"[a{n}]" for n in range(len(prises))) + f"amix=inputs={len(prises)}:normalize=0,apad,atrim=0:{FIN}[o]"
    subprocess.run(["ffmpeg", "-y", "-v", "error", *entrees, "-filter_complex", mix, "-map", "[o]", "-ar", "44100", "-ac", "1", "-b:a", "64k", f"{MEDIAS}/voix-{voix.lower()}.mp3"], check=True)
    (f1, _), (f2, _) = prises[0], prises[1]
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", f1, "-f", "lavfi", "-t", "0.7", "-i", "anullsrc=r=44100:cl=mono", "-i", f2,
        "-filter_complex", "[0][1][2]concat=n=3:v=0:a=1[o]", "-map", "[o]", "-ar", "44100", "-ac", "1", "-b:a", "64k", f"{MEDIAS}/essai-{voix.lower()}.mp3"], check=True)
    durees = [round(d, 2) for _, d in prises]
    json.dump(durees, open(f"durees-{voix}.json", "w")); print(voix, durees)

for v in sys.argv[1:]: assembler(v)
