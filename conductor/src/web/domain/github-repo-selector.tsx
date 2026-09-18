import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { ButtonGroup } from "@rome-os/ui/button-group";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@rome-os/ui/command";
import { Input } from "@rome-os/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@rome-os/ui/popover";
import { Spinner } from "@rome-os/ui/spinner";
import { Archive, BookOpen, ChevronsUpDown, LockKeyhole } from "lucide-react";
import { responseError } from "../core/lib/config-api";
import { safeText } from "../core/lib/facts";

interface RepositorySummary {
  nameWithOwner: string;
  description?: string;
  private: boolean;
  archived: boolean;
}

interface RepositoryResponse {
  repositories: RepositorySummary[];
  truncated: boolean;
}

export function GitHubRepoSelector({ id, value, onValueChange, onBlur, placeholder = "owner/name", disabled = false }: {
  id: string;
  value: string;
  onValueChange: (value: string, source: "input" | "picker") => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const requestNumber = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestNumber.current;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAppApi("config/github/repositories");
      if (!response.ok) throw new Error(await responseError(response));
      if (request !== requestNumber.current) return;
      const body = await response.json() as RepositoryResponse;
      setRepositories(body.repositories);
      setTruncated(body.truncated);
    } catch (caught) {
      if (request !== requestNumber.current) return;
      setError(caught instanceof Error ? caught.message : "GitHub repositories could not be loaded.");
      setRepositories([]);
    } finally {
      if (request === requestNumber.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    void load();
  }, [open, load]);

  const choose = (repo: string) => {
    onValueChange(repo, "picker");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ButtonGroup className="w-44 sm:w-80">
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
          <Button variant="outline" size="icon-md" aria-label="Choose a GitHub repository" title="Choose repository" aria-expanded={open} disabled={disabled}>
            <ChevronsUpDown />
          </Button>
        </PopoverTrigger>
      </ButtonGroup>

      <PopoverContent align="end" sideOffset={6} className="w-[min(34rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0" onOpenAutoFocus={(event) => event.preventDefault()}>
        <Command shouldFilter>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Find a repository…" />
          <CommandList className="max-h-80">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-ui text-muted-foreground"><Spinner />Loading repositories…</div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-ui">
                <span className="text-destructive">{safeText(error)}</span>
                <Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button>
              </div>
            ) : (
              <>
                <CommandEmpty>No matching repositories.</CommandEmpty>
                {repositories.map((repo) => (
                  <CommandItem
                    key={repo.nameWithOwner}
                    value={`${repo.nameWithOwner} ${repo.description ?? ""}`}
                    onSelect={() => choose(repo.nameWithOwner)}
                    className="items-start"
                  >
                    {repo.archived ? <Archive className="mt-0.5 text-muted-foreground" /> : repo.private ? <LockKeyhole className="mt-0.5 text-muted-foreground" /> : <BookOpen className="mt-0.5 text-muted-foreground" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono">{safeText(repo.nameWithOwner)}</span>
                      {repo.description && <span className="block truncate text-aux text-muted-foreground">{safeText(repo.description)}</span>}
                    </span>
                    {repo.archived && <span className="text-aux text-muted-foreground">archived</span>}
                  </CommandItem>
                ))}
              </>
            )}
          </CommandList>
        </Command>
        {truncated && !loading && !error && <div className="border-t border-border px-3 py-2 text-aux text-muted-foreground">Showing the 100 most recently updated repositories.</div>}
      </PopoverContent>
    </Popover>
  );
}
