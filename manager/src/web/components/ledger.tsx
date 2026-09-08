import { useMemo, useState } from "react";
import { navigateToApp } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "@rome-os/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rome-os/ui/select";
import { ChevronDown, ChevronRight } from "lucide-react";
import { KindBadge } from "./badges";
import { formatStamp, shortId, truncate } from "../lib/format";
import { FACT_KINDS, type FactSummary } from "../lib/types";

const ALL = "__all__";

/**
 * The ledger as a timeline of facts. Newest first by default because the
 * question a person brings here is "what just happened"; a task page shows
 * the same rows oldest first because there the question is "how did we get here".
 */
export function Ledger({
  facts,
  showTask = true,
  oldestFirst = false,
  filterable = true,
}: {
  facts: FactSummary[];
  showTask?: boolean;
  oldestFirst?: boolean;
  filterable?: boolean;
}) {
  const [kind, setKind] = useState<string>(ALL);
  const [by, setBy] = useState<string>(ALL);

  const authors = useMemo(() => {
    const set = new Set<string>();
    for (const fact of facts) set.add(fact.by);
    return [...set].sort();
  }, [facts]);

  const visible = useMemo(() => {
    const filtered = facts.filter(
      (fact) => (kind === ALL || fact.kind === kind) && (by === ALL || fact.by === by),
    );
    return oldestFirst ? [...filtered].sort((a, b) => a.seq - b.seq) : filtered;
  }, [facts, kind, by, oldestFirst]);

  return (
    <div className="flex flex-col gap-3">
      {filterable ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger size="sm" className="w-[150px]" aria-label="Filter by kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All kinds</SelectItem>
              {FACT_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={by} onValueChange={setBy}>
            <SelectTrigger size="sm" className="w-[180px]" aria-label="Filter by author">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Anyone</SelectItem>
              {authors.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {visible.length} of {facts.length}
          </span>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState className="py-10">
          <EmptyStateTitle>No facts</EmptyStateTitle>
          <EmptyStateDescription>
            {facts.length === 0 ? "The ledger is empty." : "Nothing matches these filters."}
          </EmptyStateDescription>
        </EmptyState>
      ) : (
        <ol className="divide-y divide-border rounded-md border border-border">
          {visible.map((fact) => (
            <FactRow key={fact.id} fact={fact} showTask={showTask} />
          ))}
        </ol>
      )}
    </div>
  );
}

/** The payload field that carries a fact's substance, for the one-line view. */
function bodyOf(fact: FactSummary): string {
  const p = fact.payload;
  switch (fact.kind) {
    case "Created":
      return String(p.brief ?? "");
    case "Completed":
    case "Cancelled":
      return String(p.reason ?? "");
    case "Started":
      return `worker ${String(p.workerId ?? "")}`;
    case "Returned":
      return String(p.reply ?? "");
    case "Failed":
      return String(p.error ?? "");
    case "Lost":
      return String(p.why ?? "");
    case "Question":
      return String(p.why ?? "");
    case "Report":
      return String(p.what ?? "");
    case "Reply":
      return String(p.text ?? "");
    default:
      return "";
  }
}

function FactRow({ fact, showTask }: { fact: FactSummary; showTask: boolean }) {
  const [open, setOpen] = useState(false);
  const body = bodyOf(fact);
  const expandable = body.length > 140 || fact.source !== undefined || fact.kind === "Started" || fact.kind === "Report";

  return (
    <li className="px-3 py-2">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={!expandable}
          aria-expanded={open}
          aria-label={open ? "Collapse fact" : "Expand fact"}
          className="mt-0.5 shrink-0 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">#{fact.seq}</span>
            <KindBadge kind={fact.kind} />
            <span>
              by <span className="font-mono">{fact.by}</span>
            </span>
            {showTask ? (
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0 font-mono text-xs"
                onClick={() => navigateToApp(fact.taskId)}
                title={fact.taskId}
              >
                task {shortId(fact.taskId)}
              </Button>
            ) : null}
            <span className="ml-auto tabular-nums">{formatStamp(fact.createdAt)}</span>
          </div>
          {body ? (
            <p className={`mt-1 text-sm ${open ? "whitespace-pre-wrap break-words" : ""}`}>
              {open ? body : truncate(body, 140)}
            </p>
          ) : null}
          {open ? (
            <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
              {fact.source ? (
                <div>
                  <span className="font-medium">source:</span>{" "}
                  <span className="whitespace-pre-wrap break-words">{fact.source}</span>
                </div>
              ) : null}
              {fact.kind === "Report" && fact.payload.evidence ? (
                <div>
                  <span className="font-medium">evidence:</span>{" "}
                  <span className="whitespace-pre-wrap break-words">{String(fact.payload.evidence)}</span>
                </div>
              ) : null}
              {fact.kind === "Started" && fact.payload.prompt ? (
                <details className="mt-1">
                  <summary className="cursor-pointer select-none">worker brief</summary>
                  <pre className="mt-1 max-h-72 overflow-auto rounded-md bg-muted p-2 text-[11px] leading-relaxed whitespace-pre-wrap">
                    {String(fact.payload.prompt)}
                  </pre>
                </details>
              ) : null}
              <div className="font-mono">id {fact.id}</div>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
