import { useState } from "react";
import { Button } from "@rome-os/ui/button";
import { List, ListRow, ListRowContent, ListRowDescription, ListRowTitle } from "@rome-os/ui/list-row";
import { ExternalLink } from "lucide-react";
import { formatStamp } from "../lib/format";
import { libraryIsEmpty, taskLibrary, type LibraryItem } from "../lib/library";
import type { FactJson } from "../lib/types";
import { workerAgentNames } from "../lib/workers";

/**
 * Everything this Task's history points at, in one place: worker reports,
 * where the Task came from, and (collapsed) the system's own records. Read
 * only from structured fields; see `taskLibrary`.
 */
export function TaskLibrary({ facts }: { facts: readonly FactJson[] }) {
  const [showRecords, setShowRecords] = useState(false);
  const library = taskLibrary(facts, workerAgentNames(facts));

  return (
    <section className="flex flex-col gap-3" aria-labelledby="task-library-title">
      <div>
        <h2 id="task-library-title" className="text-title">Library</h2>
        <p className="mt-1 text-ui text-muted-foreground">Reports and sources this task recorded, each at the exact version it was saved.</p>
      </div>
      {libraryIsEmpty(library) ? (
        <p className="text-ui text-muted-foreground">Nothing yet. Worker reports appear here as work comes back.</p>
      ) : (
        <>
          <LibraryGroup title="Worker reports" items={library.reports} />
          <LibraryGroup title="Sources" items={library.sources} />
          {library.records.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Button
                variant="link"
                size="xs"
                className="w-fit px-0 text-muted-foreground hover:text-foreground"
                aria-expanded={showRecords}
                aria-controls="task-library-records"
                onClick={() => setShowRecords((open) => !open)}
              >
                {showRecords ? "Hide" : "Show"} system records ({library.records.length})
              </Button>
              {showRecords && (
                <div id="task-library-records">
                  <LibraryGroup title="System records" items={library.records} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function LibraryGroup({ title, items }: { title: string; items: LibraryItem[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-aux font-medium text-muted-foreground">{title}</h3>
      <List asChild>
        <ul>
          {items.map((item) => <LibraryRow key={item.key} item={item} />)}
        </ul>
      </List>
    </div>
  );
}

function LibraryRow({ item }: { item: LibraryItem }) {
  const meta = [
    item.description,
    item.pinned ? `saved at ${item.pinned.commit.slice(0, 7)}` : "",
    formatStamp(item.at),
  ].filter(Boolean).join(" · ");
  const content = (
    <>
      <ListRowContent>
        <ListRowTitle>{item.title}</ListRowTitle>
        <ListRowDescription>{meta}</ListRowDescription>
        {item.reference && <ListRowDescription className="font-mono">{item.reference}</ListRowDescription>}
      </ListRowContent>
      {item.href && <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
    </>
  );

  if (!item.href) {
    return <li><ListRow>{content}</ListRow></li>;
  }
  const where = item.pinned ? `${item.pinned.repo}: ${item.pinned.path}` : item.href;
  return (
    <li>
      <ListRow asChild interactive>
        <a href={item.href} target="_blank" rel="noopener noreferrer" title={where}>
          {content}
        </a>
      </ListRow>
    </li>
  );
}
