import { useEffect, useState } from "react";
import { ChevronLeft, NotebookPen, Pencil, Plus } from "lucide-react";
import { Button } from "@rome-os/ui/button";
import { Input } from "@rome-os/ui/input";
import { Textarea } from "@rome-os/ui/textarea";
import { List, ListRow, ListRowContent, ListRowDescription, ListRowTitle } from "@rome-os/ui/list-row";
import {
  Section,
  SectionActions,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@rome-os/ui/page";
import { api, enc, sendJson, type NoteDetail, type NoteSummary } from "./api";
import { AppLink, Empty, ErrorNote, go, Loading, Prose, shortDate, useLoad } from "./common";

export function NotesView({ slug, id, onChanged }: { slug: string; id?: string; onChanged: () => void }) {
  if (id === "new") return <NoteEditor slug={slug} onChanged={onChanged} />;
  return id ? <NoteDetailView slug={slug} id={id} onChanged={onChanged} /> : <NoteList slug={slug} />;
}

function NoteList({ slug }: { slug: string }) {
  const list = useLoad(() => api<{ notes: NoteSummary[] }>(`topics/${enc(slug)}/notes`).then((r) => r.notes), [slug]);
  return (
    <Section>
      <SectionHeader>
        <SectionHeading>
          <SectionTitle>笔记</SectionTitle>
          <SectionDescription>想法、洞见、对比和草稿。agent 在对话中也会把值得保留的结论写成笔记。</SectionDescription>
        </SectionHeading>
        <SectionActions>
          <Button size="sm" onClick={() => go(slug, "notes", "new")}>
            <Plus />
            新笔记
          </Button>
        </SectionActions>
      </SectionHeader>
      {list.error ? <ErrorNote message={list.error} /> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data?.length === 0 ? <Empty icon={<NotebookPen />} title="还没有笔记" /> : null}
      {list.data && list.data.length > 0 ? (
        <List>
          {list.data.map((n) => (
            <ListRow key={n.id} asChild interactive>
              <AppLink to={[slug, "notes", n.id]}>
                <ListRowContent>
                  <ListRowTitle>{n.title}</ListRowTitle>
                  <ListRowDescription className="line-clamp-1">
                    {shortDate(n.updated)}
                    {n.excerpt ? ` · ${n.excerpt}` : ""}
                  </ListRowDescription>
                </ListRowContent>
              </AppLink>
            </ListRow>
          ))}
        </List>
      ) : null}
    </Section>
  );
}

function NoteDetailView({ slug, id, onChanged }: { slug: string; id: string; onChanged: () => void }) {
  const note = useLoad(
    () => api<{ note: NoteDetail }>(`topics/${enc(slug)}/notes/${enc(id)}`).then((r) => r.note),
    [slug, id],
  );
  const [editing, setEditing] = useState(false);
  const n = note.data;
  if (editing && n) {
    return (
      <NoteEditor
        slug={slug}
        note={n}
        onChanged={onChanged}
        onDone={() => {
          setEditing(false);
          note.reload();
        }}
      />
    );
  }
  return (
    <Section>
      <AppLink
        to={[slug, "notes"]}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        全部笔记
      </AppLink>
      {note.error ? <ErrorNote message={note.error} /> : null}
      {note.loading && !n ? <Loading /> : null}
      {n ? (
        <>
          <SectionHeader>
            <SectionHeading>
              <SectionTitle>{n.title}</SectionTitle>
              <SectionDescription>
                更新于 {shortDate(n.updated)} · notes/{n.id}.md
              </SectionDescription>
            </SectionHeading>
            <SectionActions>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Pencil />
                编辑
              </Button>
            </SectionActions>
          </SectionHeader>
          <Prose>{n.body}</Prose>
        </>
      ) : null}
    </Section>
  );
}

function NoteEditor({
  slug,
  note,
  onChanged,
  onDone,
}: {
  slug: string;
  note?: NoteDetail;
  onChanged: () => void;
  onDone?: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
  }, [note]);

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      if (note) {
        await sendJson(`topics/${enc(slug)}/notes/${enc(note.id)}`, "PUT", { title, body });
        onChanged();
        onDone?.();
      } else {
        const r = await sendJson<{ note: NoteDetail }>(`topics/${enc(slug)}/notes`, "POST", { title, body });
        onChanged();
        go(slug, "notes", r.note.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section>
      <SectionHeader>
        <SectionHeading>
          <SectionTitle>{note ? "编辑笔记" : "新笔记"}</SectionTitle>
        </SectionHeading>
        <SectionActions>
          <Button variant="outline" size="sm" onClick={() => (note ? onDone?.() : go(slug, "notes"))}>
            取消
          </Button>
          <Button size="sm" disabled={busy || !title.trim()} onClick={() => void save()}>
            {busy ? "保存中…" : "保存"}
          </Button>
        </SectionActions>
      </SectionHeader>
      {error ? <ErrorNote message={error} /> : null}
      <Input value={title} placeholder="标题" onChange={(e) => setTitle(e.target.value)} />
      <Textarea
        className="min-h-[420px] font-mono text-sm"
        value={body}
        placeholder="Markdown"
        onChange={(e) => setBody(e.target.value)}
      />
    </Section>
  );
}
