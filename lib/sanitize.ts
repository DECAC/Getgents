"use client";

// Sanitize HTML content produced by LLMs or external data via DOMPurify.
// This utility is intentionally client-side only (DOMPurify requires DOM).
// Import lazily to avoid SSR issues.

export async function sanitizeHTML(dirty: string): Promise<string> {
  if (typeof window === "undefined" || !dirty) return "";
  const mod = await import("dompurify");
  const DOMPurify = mod.default;
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["p", "b", "strong", "i", "em", "ul", "ol", "li", "h4", "span", "div", "br"],
    ALLOWED_ATTR: ["class", "style"],
  });
}
