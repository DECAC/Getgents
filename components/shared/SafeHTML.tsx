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
        ALLOWED_TAGS: ["p", "b", "strong", "i", "em", "ul", "ol", "li", "h4", "span", "div", "br"],
        ALLOWED_ATTR: ["class", "style"],
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
        ALLOWED_TAGS: ["p", "b", "strong", "i", "em", "ul", "ol", "li", "h4", "h3", "span", "div", "br"],
        ALLOWED_ATTR: ["class", "style"],
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
