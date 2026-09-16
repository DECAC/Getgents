/**
 * Réponse HTTP du moteur « Élysée 2027 » : le texte déterministe est émis en
 * fragments SSE au format OpenAI (`choices[0].delta.content`), celui que le
 * client `streamChatCompletion` sait déjà lire. Aucun appel réseau, aucune
 * clé OpenRouter, aucun quota LLM : ce chemin ne facture rien à personne.
 */
import { reponseJeuElysee } from "./moteur";

interface Message {
  role: string;
  content: string;
}

export function reponseSseElysee(messages: Message[]): Response {
  const texte = reponseJeuElysee(messages);
  const flux = new ReadableStream<Uint8Array>({
    start(controller) {
      const encodeur = new TextEncoder();
      // Fragments courts : l'affichage progressif (effet « frappe ») est le
      // même que pour une réponse de modèle, sans la latence ni le coût.
      const pas = 24;
      for (let i = 0; i < texte.length; i += pas) {
        const morceau = texte.slice(i, i + pas);
        controller.enqueue(
          encodeur.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: morceau } }] })}\n\n`)
        );
      }
      controller.enqueue(encodeur.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(flux, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
