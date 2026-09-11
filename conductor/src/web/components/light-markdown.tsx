import type { ReactNode } from "react";

// A small, dependency-free markdown renderer for fact bodies (replies, reports, briefs). We deliberately
// avoid `@rome-os/ui/markdown` here: it pulls in heavy peer dependencies
// (streamdown + mermaid + katex) that this app does not otherwise need. This
// covers what worker replies and runtime reports use: ATX headings, bullet and
// ordered lists, GFM task-list checkboxes (`- [ ]` / `- [x]`), fenced code, and
// paragraphs, with inline bold / inline code / links.

const HEADING = /^(#{1,6})\s+(.*)$/;
const FENCE = /^```/;
const TASK_ITEM = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;
const BULLET_ITEM = /^\s*[-*+]\s+(.*)$/;
const ORDERED_ITEM = /^\s*(\d+)\.\s+(.*)$/;
const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;

/** Render inline spans: `code`, **bold**, and [text](url). Everything else is plain text. */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code key={key++} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={key++} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      const link = LINK.exec(token);
      if (link) {
        nodes.push(
          <a
            key={key++}
            href={link[2]}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function LightMarkdown({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  const lines = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    if (FENCE.test(line)) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1; // consume closing fence
      blocks.push(
        <pre key={key++} className="my-2 overflow-x-auto rounded bg-muted p-2 text-xs">
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push(
        <p key={key++} className="mt-3 text-sm font-semibold first:mt-0">
          {renderInline(heading[2].trim())}
        </p>,
      );
      index += 1;
      continue;
    }

    const task = TASK_ITEM.exec(line);
    if (task) {
      const items: { checked: boolean; text: string }[] = [];
      let current: RegExpExecArray | null = task;
      while (current) {
        items.push({ checked: current[1].toLowerCase() === "x", text: current[2] });
        index += 1;
        current = index < lines.length ? TASK_ITEM.exec(lines[index]) : null;
      }
      blocks.push(
        <ul key={key++} className="my-2 flex flex-col gap-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <input type="checkbox" checked={item.checked} readOnly disabled className="mt-1 shrink-0" />
              <span>{renderInline(item.text)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    const bullet = BULLET_ITEM.exec(line);
    if (bullet) {
      const items: string[] = [];
      let current: RegExpExecArray | null = bullet;
      while (current && !TASK_ITEM.test(lines[index])) {
        items.push(current[1]);
        index += 1;
        current = index < lines.length ? BULLET_ITEM.exec(lines[index]) : null;
      }
      blocks.push(
        <ul key={key++} className="my-2 list-disc pl-5">
          {items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const ordered = ORDERED_ITEM.exec(line);
    if (ordered) {
      const items: string[] = [];
      let current: RegExpExecArray | null = ordered;
      while (current) {
        items.push(current[2]);
        index += 1;
        current = index < lines.length ? ORDERED_ITEM.exec(lines[index]) : null;
      }
      blocks.push(
        <ol key={key++} className="my-2 list-decimal pl-5">
          {items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !HEADING.test(lines[index]) &&
      !BULLET_ITEM.test(lines[index]) &&
      !ORDERED_ITEM.test(lines[index]) &&
      !FENCE.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(
      <p key={key++} className="my-2 whitespace-pre-wrap leading-relaxed">
        {renderInline(paragraph.join("\n"))}
      </p>,
    );
  }

  return <div className={className}>{blocks}</div>;
}
