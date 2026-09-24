import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@rome-os/ui/button";
import { Input } from "@rome-os/ui/input";
import { List, ListRow, ListRowContent, ListRowDescription, ListRowTitle } from "@rome-os/ui/list-row";
import { api, type SearchHit } from "./api";
import { Empty, ErrorNote, go, Loading } from "./common";
import { routeForPath } from "./TopicPage";

export function SearchPanel({ slug }: { slug?: string }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(): Promise<void> {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ q: query.trim() });
      if (slug) qs.set("topic", slug);
      const r = await api<{ hits: SearchHit[] }>(`search?${qs.toString()}`);
      setHits(r.hits);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <Input
          value={query}
          autoFocus
          placeholder={slug ? "在这个课题里搜索：状态、笔记、对话记录、资料全文" : "在所有课题里搜索"}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit" disabled={busy || !query.trim()}>
          <Search />
          搜索
        </Button>
      </form>
      {error ? <ErrorNote message={error} /> : null}
      {busy ? <Loading label="搜索中" /> : null}
      {!busy && hits?.length === 0 ? <Empty title="没有找到" description="换个关键词试试；多个词之间用空格，需同时出现。" /> : null}
      {!busy && hits && hits.length > 0 ? (
        <List>
          {hits.map((h, i) => (
            <ListRow key={`${h.slug}-${h.path}-${h.line}-${i}`} asChild interactive>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  go(...routeForPath(h.slug, h.path));
                }}
              >
                <ListRowContent>
                  <ListRowTitle className="truncate">
                    {slug ? "" : `${h.topicTitle} · `}
                    {h.path}:{h.line}
                  </ListRowTitle>
                  <ListRowDescription className="line-clamp-2">{h.snippet}</ListRowDescription>
                </ListRowContent>
              </a>
            </ListRow>
          ))}
        </List>
      ) : null}
    </div>
  );
}
