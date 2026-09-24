/** Best-effort PDF text extraction; returns "" when the PDF has no text layer or fails to parse. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text, totalPages } = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(text) ? text : [text];
    const body = pages
      .map((t, i) => `<!-- page ${i + 1} -->\n${String(t).trim()}`)
      .join("\n\n");
    return body.trim() ? `<!-- extracted from PDF, ${totalPages} pages -->\n\n${body}\n` : "";
  } catch {
    return "";
  }
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Rough readable text from HTML, good enough for search and a quick read. */
export function htmlToText(html: string): string {
  const main =
    /<article[\s\S]*?<\/article>/i.exec(html)?.[0] ??
    /<main[\s\S]*?<\/main>/i.exec(html)?.[0] ??
    /<body[\s\S]*?<\/body>/i.exec(html)?.[0] ??
    html;
  return main
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<h([1-6])[^>]*>/gi, (_m, n: string) => `\n\n${"#".repeat(Number(n))} `)
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr|\/pre)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) => {
      if (e.startsWith("#x")) return String.fromCodePoint(Number.parseInt(e.slice(2), 16));
      if (e.startsWith("#")) return String.fromCodePoint(Number.parseInt(e.slice(1), 10));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}
