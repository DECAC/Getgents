"use client";

import { useEffect, useState } from "react";

interface SafeHTMLProps {
  html: string;
  className?: string;
}

export function SafeHTML({ html, className }: SafeHTMLProps) {
  const [safeHtml, setSafeHtml] = useState("");

  useEffect(() => {
    if (!html) {
      setSafeHtml("");
      return;
    }
    import("dompurify").then((mod) => {
      const DOMPurify = mod.default;
      const clean = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          "p", "b", "strong", "i", "em", "ul", "ol", "li", "h4", "span", "div", "br",
          "code", "pre", "a", "blockquote", "table", "thead", "tbody", "tr", "td", "th", "hr",
        ],
        ALLOWED_ATTR: ["class", "style", "href", "target", "rel", "data-address"],
        // Autorise les liens geo:lat,lon émis par les gents « guidage » —
        // interceptés côté chat pour ouvrir le choix d'application carto.
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|geo):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
      });
      setSafeHtml(clean);
    });
  }, [html]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}

export function SafeHTMLDoc({ html, className }: SafeHTMLProps) {
  const [safeHtml, setSafeHtml] = useState("");

  useEffect(() => {
    if (!html) {
      setSafeHtml("");
      return;
    }
    import("dompurify").then((mod) => {
      const DOMPurify = mod.default;
      const clean = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          "p", "b", "strong", "i", "em", "ul", "ol", "li", "h1", "h2", "h3", "h4", "span", "div", "br",
          "code", "pre", "a", "blockquote", "table", "thead", "tbody", "tr", "td", "th", "hr",
        ],
        ALLOWED_ATTR: ["class", "style", "href", "target", "rel"],
      });
      setSafeHtml(clean);
    });
  }, [html]);

  return (
    <div
      className={["gendoc", className].filter(Boolean).join(" ")}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
