import { useMemo, useRef, useState, type IframeHTMLAttributes } from "react";
import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";

interface MailAttachment {
  type: string;
  url?: string;
  mimeType?: string;
  fileName?: string;
  caption?: string;
}

interface EmailBodyRendererProps {
  body: string;
  subject?: string;
  attachments?: MailAttachment[];
}

const HTMLISH_RE = /<\s*(?:!doctype|html|body|head|table|div|span|p|br|a|img|style|meta|blockquote|font|strong|em|ul|ol|li|h[1-6])\b/i;
const MARKDOWNISH_RE = /(^|\n)\s{0,3}(?:#{1,6}\s|[-*+]\s+|\d+\.\s+|>\s+|```|\|.+\|)|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__/;

const HTML_ALLOWED_ATTR = [
  "abbr",
  "align",
  "alt",
  "axis",
  "bgcolor",
  "border",
  "cellpadding",
  "cellspacing",
  "char",
  "charoff",
  "cite",
  "class",
  "clear",
  "color",
  "cols",
  "colspan",
  "compact",
  "coords",
  "datetime",
  "dir",
  "face",
  "headers",
  "height",
  "href",
  "hspace",
  "lang",
  "name",
  "nowrap",
  "rel",
  "rev",
  "rows",
  "rowspan",
  "scope",
  "shape",
  "size",
  "span",
  "start",
  "style",
  "summary",
  "target",
  "title",
  "type",
  "valign",
  "value",
  "vspace",
  "width",
];

function looksLikeHtml(body: string): boolean {
  return HTMLISH_RE.test(body.trim());
}

function looksLikeMarkdown(body: string): boolean {
  return MARKDOWNISH_RE.test(body);
}

function isSafeLink(href: string): boolean {
  const value = href.trim();
  return /^(https?:|mailto:)/i.test(value) || value.startsWith("#");
}

function rewriteRemoteResources(html: string, allowRemoteImages: boolean): string {
  const doc = document.implementation.createHTMLDocument("email");
  doc.body.innerHTML = html;

  for (const a of Array.from(doc.querySelectorAll("a[href]"))) {
    const href = a.getAttribute("href") ?? "";
    if (!isSafeLink(href)) {
      a.removeAttribute("href");
      a.setAttribute("title", "Unsafe link removed");
      continue;
    }
    if (!href.trim().startsWith("#")) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer nofollow");
    }
  }

  for (const img of Array.from(doc.querySelectorAll("img[src]"))) {
    const src = img.getAttribute("src") ?? "";
    const isRemote = /^https?:\/\//i.test(src);
    const isInline = /^cid:/i.test(src) || /^data:image\//i.test(src);
    if (isRemote && !allowRemoteImages) {
      img.setAttribute("data-blocked-src", src);
      img.removeAttribute("src");
      img.setAttribute("alt", img.getAttribute("alt") || "Remote image blocked");
      img.setAttribute("title", "Remote image blocked for privacy");
    } else if (!isRemote && !isInline && !src.startsWith("/")) {
      img.removeAttribute("src");
      img.setAttribute("alt", img.getAttribute("alt") || "Image blocked");
    }
  }

  // Forms in emails are phishing-prone and do not work well in a read-only mail viewer.
  for (const form of Array.from(doc.querySelectorAll("form"))) {
    const replacement = doc.createElement("div");
    replacement.textContent = form.textContent || "[form removed]";
    form.replaceWith(replacement);
  }

  return doc.body.innerHTML;
}

function sanitizeHtml(rawHtml: string, allowRemoteImages: boolean): string {
  const sanitized = DOMPurify.sanitize(rawHtml, {
    WHOLE_DOCUMENT: false,
    ADD_TAGS: ["style"],
    ADD_ATTR: HTML_ALLOWED_ATTR,
    FORBID_TAGS: ["script", "iframe", "object", "embed", "base", "link", "form", "input", "button", "textarea", "select", "option"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onmouseenter", "srcset"],
    ALLOW_DATA_ATTR: false,
  });
  return rewriteRemoteResources(sanitized, allowRemoteImages);
}

function iframeDocument(body: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: light dark; }
  html, body { margin: 0; padding: 0; background: transparent; }
  body {
    box-sizing: border-box;
    color: CanvasText;
    font: 14px/1.55 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    overflow-wrap: anywhere;
  }
  * { box-sizing: border-box; max-width: 100%; }
  img { height: auto; }
  table { border-collapse: collapse; max-width: 100%; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; }
  blockquote { margin: 0.75rem 0; padding-left: 0.75rem; border-left: 3px solid color-mix(in srgb, CanvasText 25%, transparent); }
  a { color: LinkText; }
  [data-blocked-src] {
    display: inline-block;
    min-width: 120px;
    min-height: 32px;
    border: 1px dashed color-mix(in srgb, CanvasText 30%, transparent);
    border-radius: 6px;
    padding: 6px 8px;
    color: color-mix(in srgb, CanvasText 65%, transparent);
    font-size: 12px;
  }
  [data-blocked-src]::after { content: attr(alt); }
</style>
</head>
<body>${body}</body>
</html>`;
}

export function EmailBodyRenderer({ body, subject, attachments = [] }: EmailBodyRendererProps) {
  const [allowRemoteImages, setAllowRemoteImages] = useState(false);
  const [height, setHeight] = useState(220);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const trimmed = body.trim();

  const mode = useMemo(() => {
    if (!trimmed) return "empty" as const;
    if (looksLikeHtml(trimmed)) return "html" as const;
    if (looksLikeMarkdown(trimmed)) return "markdown" as const;
    return "text" as const;
  }, [trimmed]);

  const sanitizedHtml = useMemo(() => {
    if (mode !== "html") return "";
    return sanitizeHtml(trimmed, allowRemoteImages);
  }, [allowRemoteImages, mode, trimmed]);

  const blockedImageCount = useMemo(() => {
    if (mode !== "html" || allowRemoteImages) return 0;
    const doc = document.implementation.createHTMLDocument("email-check");
    doc.body.innerHTML = sanitizedHtml;
    return doc.querySelectorAll("[data-blocked-src]").length;
  }, [allowRemoteImages, mode, sanitizedHtml]);

  const onIframeLoad: IframeHTMLAttributes<HTMLIFrameElement>["onLoad"] = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const next = Math.max(120, Math.min(2400, doc.documentElement.scrollHeight, doc.body.scrollHeight));
    setHeight(next + 8);
  };

  if (mode === "empty") {
    return <span className="text-sm text-muted-foreground">(no content)</span>;
  }

  if (mode === "html") {
    return (
      <div className="email-renderer">
        {blockedImageCount > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            <span>
              Blocked {blockedImageCount} remote image{blockedImageCount === 1 ? "" : "s"} for privacy.
            </span>
            <Button size="sm" variant="outline" onClick={() => setAllowRemoteImages(true)}>
              Show images
            </Button>
          </div>
        )}
        <iframe
          ref={iframeRef}
          title={subject ? `Email body: ${subject}` : "Email body"}
          className="email-renderer__iframe"
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          srcDoc={iframeDocument(sanitizedHtml)}
          style={{ height }}
          onLoad={onIframeLoad}
        />
        {attachments.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Attachments are shown below this message. Inline cid images are not resolved yet.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={mode === "markdown" ? "email-renderer__markdown" : "email-renderer__text"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeSanitize]}
        skipHtml
        components={{
          a: ({ href, children }) => {
            const safeHref = href && isSafeLink(href) ? href : undefined;
            return (
              <a href={safeHref} target="_blank" rel="noopener noreferrer nofollow">
                {children}
              </a>
            );
          },
        }}
      >
        {trimmed}
      </ReactMarkdown>
    </div>
  );
}
