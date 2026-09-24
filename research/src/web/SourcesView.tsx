import { useRef, useState } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { ChevronLeft, Download, ExternalLink, FileText, Library, Pencil, Plus } from "lucide-react";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@rome-os/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@rome-os/ui/field";
import { Input } from "@rome-os/ui/input";
import { Textarea } from "@rome-os/ui/textarea";
import { SegmentedControl } from "@rome-os/ui/segmented-control";
import { List, ListRow, ListRowContent, ListRowDescription, ListRowTitle } from "@rome-os/ui/list-row";
import {
  Section,
  SectionActions,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@rome-os/ui/page";
import {
  api,
  enc,
  fileUrl,
  formatSize,
  sendJson,
  type SourceDetail,
  type SourceKind,
  type SourceSummary,
} from "./api";
import { AppLink, Empty, ErrorNote, go, Loading, Prose, shortDate, useLoad } from "./common";

const KIND_LABEL: Record<SourceKind, string> = {
  pdf: "PDF",
  url: "网页",
  code: "代码",
  image: "图片",
  text: "文本",
  file: "文件",
};

export function SourcesView({ slug, id, onChanged }: { slug: string; id?: string; onChanged: () => void }) {
  return id ? <SourceDetailView slug={slug} id={id} /> : <SourceList slug={slug} onChanged={onChanged} />;
}

function SourceList({ slug, onChanged }: { slug: string; onChanged: () => void }) {
  const list = useLoad(
    () => api<{ sources: SourceSummary[] }>(`topics/${enc(slug)}/sources`).then((r) => r.sources),
    [slug],
  );
  const [adding, setAdding] = useState(false);
  return (
    <Section>
      <SectionHeader>
        <SectionHeading>
          <SectionTitle>资料</SectionTitle>
          <SectionDescription>任何类型都可以：网页、PDF、代码仓库、图片、文本。也可以在对话里让 agent 保存。</SectionDescription>
        </SectionHeading>
        <SectionActions>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus />
            添加资料
          </Button>
        </SectionActions>
      </SectionHeader>
      {list.error ? <ErrorNote message={list.error} /> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data?.length === 0 ? (
        <Empty icon={<Library />} title="还没有资料" description="添加链接或上传文件，或在对话里说“存一下”。" />
      ) : null}
      {list.data && list.data.length > 0 ? (
        <List>
          {list.data.map((s) => (
            <ListRow key={s.id} asChild interactive>
              <AppLink to={[slug, "sources", s.id]}>
                <ListRowContent>
                  <ListRowTitle className="flex items-center gap-2">
                    <Badge variant="muted" className="shrink-0">{KIND_LABEL[s.kind] ?? s.kind}</Badge>
                    <span className="truncate">{s.title}</span>
                  </ListRowTitle>
                  <ListRowDescription className="line-clamp-1">
                    {shortDate(s.savedAt)}
                    {s.excerpt ? ` · ${s.excerpt}` : ""}
                  </ListRowDescription>
                </ListRowContent>
              </AppLink>
            </ListRow>
          ))}
        </List>
      ) : null}
      <AddSourceDialog
        slug={slug}
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={(sourceId) => {
          setAdding(false);
          onChanged();
          go(slug, "sources", sourceId);
        }}
      />
    </Section>
  );
}

type AddMode = "link" | "file" | "text";

function AddSourceDialog({
  slug,
  open,
  onClose,
  onSaved,
}: {
  slug: string;
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [mode, setMode] = useState<AddMode>("link");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset(): void {
    setUrl("");
    setTitle("");
    setWhy("");
    setContent("");
    setFile(null);
    setError(null);
  }

  const ready = mode === "link" ? Boolean(url.trim()) : mode === "file" ? Boolean(file) : Boolean(content.trim());

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      let saved: { source: SourceSummary };
      if (mode === "file" && file) {
        const qs = new URLSearchParams();
        if (title.trim()) qs.set("title", title.trim());
        if (why.trim()) qs.set("why", why.trim());
        const res = await fetchAppApi(`topics/${enc(slug)}/sources${qs.size ? `?${qs.toString()}` : ""}`, {
          method: "POST",
          headers: {
            "content-type": file.type || "application/octet-stream",
            "x-file-name": encodeURIComponent(file.name),
          },
          body: await file.arrayBuffer(),
        });
        const data = (await res.json()) as { source: SourceSummary; error?: string };
        if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`);
        saved = data;
      } else {
        saved = await sendJson<{ source: SourceSummary }>(`topics/${enc(slug)}/sources`, "POST", {
          url: mode === "link" ? url : undefined,
          title,
          why,
          content: mode === "text" ? content : undefined,
        });
      }
      reset();
      onSaved(saved.source.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogHeader onClose={onClose}>
        <DialogTitle>添加资料</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <SegmentedControl
          aria-label="资料来源"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "link", label: "链接" },
            { value: "file", label: "上传文件" },
            { value: "text", label: "粘贴文本" },
          ]}
        />
        <FieldGroup>
          {mode === "link" ? (
            <Field>
              <FieldLabel htmlFor="src-url">URL</FieldLabel>
              <Input id="src-url" value={url} placeholder="https://…" onChange={(e) => setUrl(e.target.value)} />
              <FieldDescription>网页和 PDF 会下载保存并提取文字；GitHub 仓库只保存链接。</FieldDescription>
            </Field>
          ) : null}
          {mode === "file" ? (
            <Field>
              <FieldLabel htmlFor="src-file">文件</FieldLabel>
              <input
                id="src-file"
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  选择文件
                </Button>
                <span className="truncate text-sm text-muted-foreground">
                  {file ? `${file.name} · ${formatSize(file.size)}` : "任何类型"}
                </span>
              </div>
            </Field>
          ) : null}
          {mode === "text" ? (
            <Field>
              <FieldLabel htmlFor="src-content">内容</FieldLabel>
              <Textarea id="src-content" rows={8} value={content} onChange={(e) => setContent(e.target.value)} />
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor="src-title">标题</FieldLabel>
            <Input
              id="src-title"
              value={title}
              placeholder={mode === "text" ? "必填" : "可选，默认用页面标题或文件名"}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="src-why">为什么保存</FieldLabel>
            <Textarea id="src-why" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} />
          </Field>
        </FieldGroup>
        {error ? <ErrorNote message={error} /> : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button
          disabled={busy || !ready || (mode === "text" && !title.trim())}
          onClick={() => void submit()}
        >
          {busy ? "保存中…" : "保存"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function SourceDetailView({ slug, id }: { slug: string; id: string }) {
  const src = useLoad(
    () => api<{ source: SourceDetail }>(`topics/${enc(slug)}/sources/${enc(id)}`).then((r) => r.source),
    [slug, id],
  );
  const [editing, setEditing] = useState(false);
  const s = src.data;
  const images = s?.fileInfo.filter((f) => /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name)) ?? [];
  const pdf = s?.fileInfo.find((f) => /\.pdf$/i.test(f.name));

  return (
    <Section>
      <AppLink
        to={[slug, "sources"]}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        全部资料
      </AppLink>
      {src.error ? <ErrorNote message={src.error} /> : null}
      {src.loading && !s ? <Loading /> : null}
      {s ? (
        <>
          <SectionHeader>
            <SectionHeading>
              <SectionTitle className="flex items-center gap-2">
                <Badge variant="muted" className="shrink-0">{KIND_LABEL[s.kind] ?? s.kind}</Badge>
                {s.title}
              </SectionTitle>
              <SectionDescription>
                保存于 {shortDate(s.savedAt)} · sources/{s.id}
              </SectionDescription>
            </SectionHeading>
            <SectionActions>
              {s.url ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    <ExternalLink />
                    原链接
                  </a>
                </Button>
              ) : null}
              {pdf ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={fileUrl(slug, s.id, pdf.name)} target="_blank" rel="noreferrer">
                    <FileText />
                    打开 PDF
                  </a>
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Pencil />
                编辑
              </Button>
            </SectionActions>
          </SectionHeader>

          <Prose>{s.body}</Prose>

          {images.map((img) => (
            <img
              key={img.name}
              src={fileUrl(slug, s.id, img.name)}
              alt={img.name}
              className="max-h-[480px] max-w-full rounded-md border border-border object-contain"
            />
          ))}

          {s.fileInfo.length > 0 ? (
            <List>
              {s.fileInfo.map((f) => (
                <ListRow key={f.name} size="sm">
                  <ListRowContent>
                    <ListRowTitle>{f.name}</ListRowTitle>
                    <ListRowDescription>{formatSize(f.size)}</ListRowDescription>
                  </ListRowContent>
                  <Button variant="ghost" size="icon-sm" asChild aria-label={`下载 ${f.name}`}>
                    <a href={fileUrl(slug, s.id, f.name, true)}>
                      <Download />
                    </a>
                  </Button>
                </ListRow>
              ))}
            </List>
          ) : null}

          {s.content ? (
            <details className="rounded-md border border-border">
              <summary className="cursor-pointer px-3 py-2 text-sm text-muted-foreground">
                提取的文字{s.contentTruncated ? "（仅显示前 6 万字）" : ""}
              </summary>
              <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap px-3 pb-3 text-sm text-foreground">
                {s.content}
              </pre>
            </details>
          ) : null}

          <EditSourceDialog
            slug={slug}
            source={s}
            open={editing}
            onClose={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              src.reload();
            }}
          />
        </>
      ) : null}
    </Section>
  );
}

function sectionOf(body: string, heading: string): string {
  const re = new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, "m");
  const value = re.exec(body)?.[1]?.trim() ?? "";
  return value === "（未填写）" ? "" : value;
}

function EditSourceDialog({
  slug,
  source,
  open,
  onClose,
  onSaved,
}: {
  slug: string;
  source: SourceDetail;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(source.title);
  const [why, setWhy] = useState(() => sectionOf(source.body, "为什么保存"));
  const [summary, setSummary] = useState(() => sectionOf(source.body, "摘要"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await sendJson(`topics/${enc(slug)}/sources/${enc(source.id)}`, "PATCH", { title, why, summary });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogHeader onClose={onClose}>
        <DialogTitle>编辑资料</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="edit-title">标题</FieldLabel>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-why">为什么保存</FieldLabel>
            <Textarea id="edit-why" rows={3} value={why} onChange={(e) => setWhy(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-summary">摘要</FieldLabel>
            <Textarea id="edit-summary" rows={6} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </Field>
        </FieldGroup>
        {error ? <ErrorNote message={error} /> : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button disabled={busy} onClick={() => void save()}>
          {busy ? "保存中…" : "保存"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
