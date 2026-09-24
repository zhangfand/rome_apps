import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsUpDown, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@rome-os/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@rome-os/ui/command";
import { IconButton } from "@rome-os/ui/icon-button";
import { Input } from "@rome-os/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@rome-os/ui/popover";
import { Skeleton } from "@rome-os/ui/skeleton";
import { apiBlobUrl, apiGet } from "../lib/api";
import { useDebounced } from "../lib/hooks";
import type { IndicatorOption, Report } from "../lib/types";

// ------------------------------------------------------------------ page images

const blobCache = new Map<string, Promise<string>>();

function pagePath(reportId: string, page: number) {
  return `reports/${encodeURIComponent(reportId)}/pages/${page}`;
}

/** Load an authenticated page image as an object URL (cached per page for the session). */
function usePageImage(reportId: string, page: number | null, version: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (page == null) return;
    let alive = true;
    const key = `${reportId}:${page}:${version}`;
    let p = blobCache.get(key);
    if (!p) {
      p = apiBlobUrl(pagePath(reportId, page));
      blobCache.set(key, p);
      p.catch(() => blobCache.delete(key));
    }
    setUrl(null);
    p.then((u) => alive && setUrl(u)).catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [reportId, page, version]);
  return url;
}

function Thumb({ reportId, page, active, version, onClick }: { reportId: string; page: number; active: boolean; version: string; onClick: () => void }) {
  const url = usePageImage(reportId, page, version);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`第 ${page} 页`}
      aria-current={active ? "page" : undefined}
      className={`relative shrink-0 overflow-hidden rounded-md border ${active ? "border-primary ring-2 ring-ring" : "border-border"}`}
      style={{ width: 56, height: 76 }}
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover object-top" /> : <Skeleton className="h-full w-full" />}
      <span className="absolute bottom-0 right-0 rounded-tl bg-background px-1 text-[10px] text-muted-foreground">{page}</span>
    </button>
  );
}

export function PageViewer({ report, page, onPageChange }: { report: Report; page: number; onPageChange: (p: number) => void }) {
  const total = report.pages.length;
  const version = String(report.pagesTotal);
  const url = usePageImage(report.id, total ? page : null, version);
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const thumbs = useRef<HTMLDivElement>(null);

  useEffect(() => {
    thumbs.current?.querySelector<HTMLElement>(`[aria-label="第 ${page} 页"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [page]);

  if (!total) return <p className="text-sm text-muted-foreground">没有页面图片。</p>;
  return (
    <div
      className="flex flex-col gap-2"
      tabIndex={0}
      aria-label="报告原件查看器"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" && page < total) onPageChange(page + 1);
        if (e.key === "ArrowLeft" && page > 1) onPageChange(page - 1);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <IconButton label="上一页" icon={<ChevronLeft />} size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
          <span className="text-sm tabular-nums text-muted-foreground">
            第 {page} / {total} 页
          </span>
          <IconButton label="下一页" icon={<ChevronRight />} size="sm" disabled={page >= total} onClick={() => onPageChange(page + 1)} />
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="缩小" icon={<ZoomOut />} size="sm" onClick={() => setZoom((z) => (z === "fit" ? 0.75 : Math.max(0.5, z - 0.25)))} />
          <Button variant={zoom === "fit" ? "secondary" : "ghost"} size="sm" onClick={() => setZoom("fit")}>
            <Maximize2 /> 适应宽度
          </Button>
          <IconButton label="放大" icon={<ZoomIn />} size="sm" onClick={() => setZoom((z) => (z === "fit" ? 1.25 : Math.min(3, z + 0.25)))} />
        </div>
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-md border border-border bg-muted">
        {url ? (
          <img
            src={url}
            alt={`报告第 ${page} 页`}
            className="block"
            style={zoom === "fit" ? { width: "100%" } : { width: `${zoom * 100}%`, maxWidth: "none" }}
          />
        ) : (
          <Skeleton className="aspect-[3/4] w-full" />
        )}
      </div>
      <div ref={thumbs} className="flex gap-2 overflow-x-auto pb-1" aria-label="页面缩略图">
        {report.pages.map((p) => (
          <Thumb key={p.page} reportId={report.id} page={p.page} version={version} active={p.page === page} onClick={() => onPageChange(p.page)} />
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ indicator picker

export function IndicatorPicker({
  value,
  label,
  onSelect,
  disabled,
}: {
  value: string | null;
  label: string | null;
  onSelect: (code: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = useDebounced(query, 200);
  const [results, setResults] = useState<IndicatorOption[]>([]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    apiGet<{ results: IndicatorOption[] }>(`indicators/search?q=${encodeURIComponent(q)}&limit=30`)
      .then((r) => alive && setResults(r.results))
      .catch(() => alive && setResults([]));
    return () => {
      alive = false;
    };
  }, [q, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" align="between" className="w-full min-w-[9rem] max-w-[14rem] font-normal" disabled={disabled} aria-label="匹配的标准指标">
          <span className={`truncate ${value ? "text-foreground" : "text-warning-fg"}`}>{value ? label ?? value : "未匹配"}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="搜索指标名称、缩写…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>没有找到匹配的指标</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onSelect(null);
                  setOpen(false);
                }}
              >
                <span className="text-muted-foreground">设为未匹配</span>
              </CommandItem>
              {results.map((r) => (
                <CommandItem
                  key={r.code}
                  value={r.code}
                  onSelect={() => {
                    onSelect(r.code);
                    setOpen(false);
                  }}
                >
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="text-xs text-muted-foreground">{r.unit || r.code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ------------------------------------------------------------------ inline edit

export function EditableCell({
  value,
  onSave,
  label,
  className = "",
  inputMode,
  disabled,
}: {
  value: string;
  onSave: (v: string) => Promise<void> | void;
  label: string;
  className?: string;
  inputMode?: "text" | "decimal";
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft.trim() !== value.trim()) void onSave(draft.trim());
  };
  return (
    <Input
      size="sm"
      value={draft}
      aria-label={label}
      inputMode={inputMode}
      disabled={disabled}
      className={className}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setDraft(value);
      }}
    />
  );
}
