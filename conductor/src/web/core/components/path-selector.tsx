import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { ButtonGroup } from "@rome-os/ui/button-group";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@rome-os/ui/command";
import { Input } from "@rome-os/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@rome-os/ui/popover";
import { Spinner } from "@rome-os/ui/spinner";
import { ChevronRight, Folder, FolderOpen, MoveUp } from "lucide-react";
import { responseError } from "../lib/config-api";
import { safeText } from "../lib/facts";
import type { DirectoryBrowserListing } from "../lib/types";

export function PathSelector({ id, value, onValueChange, onBlur, placeholder = "/absolute/path", disabled = false }: {
  id: string;
  value: string;
  onValueChange: (value: string, source: "input" | "picker") => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [listing, setListing] = useState<DirectoryBrowserListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const requestNumber = useRef(0);

  const load = useCallback(async (path?: string, fallback = true) => {
    const request = ++requestNumber.current;
    setLoading(true);
    setError(null);
    setQuery("");
    try {
      const suffix = path ? `?path=${encodeURIComponent(path)}` : "";
      const response = await fetchAppApi(`config/directories${suffix}`);
      if (!response.ok) throw new Error(await responseError(response));
      if (request !== requestNumber.current) return;
      setListing(await response.json() as DirectoryBrowserListing);
    } catch (caught) {
      if (request !== requestNumber.current) return;
      const message = caught instanceof Error ? caught.message : "The directory could not be read.";
      if (path && fallback) {
        await load(undefined, false);
        // The fallback request owns the current listing. Preserve why we
        // moved instead of silently making an invalid stored path look valid.
        if (requestNumber.current === request + 1) setError(`${message} Showing the Projects folder instead.`);
        return;
      }
      setError(message);
      setListing(null);
    } finally {
      if (request === requestNumber.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load(value.startsWith("/") ? value : undefined);
  }, [open]); // Deliberately snapshot the field only when the browser opens.

  const choose = () => {
    if (!listing) return;
    onValueChange(listing.path, "picker");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ButtonGroup className="w-40 sm:w-80">
        <Input
          id={id}
          className="min-w-0 font-mono"
          value={value}
          onChange={(event) => onValueChange(event.target.value, "input")}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
        />
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon-md"
            aria-label="Browse directories on the Rome host"
            title="Browse directories"
            aria-expanded={open}
            disabled={disabled}
          >
            <FolderOpen />
          </Button>
        </PopoverTrigger>
      </ButtonGroup>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[min(36rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex flex-col gap-2 border-b border-border p-3">
          <div className="flex flex-wrap gap-1">
            {listing?.shortcuts.map((shortcut) => (
              <Button key={shortcut.path} variant="ghost" size="xs" onClick={() => void load(shortcut.path)}>
                {safeText(shortcut.label)}
              </Button>
            ))}
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Go to parent directory"
              title="Parent directory"
              disabled={!listing?.parent || loading}
              onClick={() => listing?.parent && void load(listing.parent)}
            >
              <MoveUp />
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto" aria-label="Current directory">
              {listing ? <PathBreadcrumb path={listing.path} onNavigate={(path) => void load(path)} /> : <span className="truncate font-mono text-aux text-muted-foreground">Loading…</span>}
            </div>
          </div>
          {error && <p className="text-aux text-destructive" role="alert">{safeText(error)}</p>}
        </div>

        <Command shouldFilter>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Filter folders…" />
          <CommandList className="max-h-64">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-ui text-muted-foreground"><Spinner />Reading folders…</div>
            ) : listing ? (
              <>
                <CommandEmpty>No matching folders.</CommandEmpty>
                {listing.entries.map((entry) => (
                  <CommandItem key={entry.path} value={entry.name} onSelect={() => void load(entry.path)}>
                    <Folder className="text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{safeText(entry.name)}</span>
                    <ChevronRight className="text-muted-foreground" />
                  </CommandItem>
                ))}
              </>
            ) : (
              <div className="py-8 text-center text-ui text-muted-foreground">No directory to show.</div>
            )}
          </CommandList>
        </Command>

        <div className="flex items-center gap-3 border-t border-border p-3">
          <span className="min-w-0 flex-1 truncate font-mono text-aux text-muted-foreground" title={listing?.path}>{listing ? safeText(listing.path) : "—"}</span>
          <Button size="sm" disabled={!listing || loading} onClick={choose}>Choose this folder</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PathBreadcrumb({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  const segments = path.split("/").filter(Boolean);
  let current = "";
  return (
    <>
      <Button variant="ghost" size="xs" className="font-mono" onClick={() => onNavigate("/")}>/</Button>
      {segments.map((segment) => {
        current += `/${segment}`;
        const target = current;
        return (
          <span key={target} className="flex shrink-0 items-center gap-0.5">
            <ChevronRight className="size-3 text-muted-foreground" aria-hidden="true" />
            <Button variant="ghost" size="xs" className="max-w-40 font-mono" onClick={() => onNavigate(target)}>
              <span className="truncate">{safeText(segment)}</span>
            </Button>
          </span>
        );
      })}
    </>
  );
}
