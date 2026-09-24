import { useState } from "react";
import { navigateRome } from "@rome-os/app-web-sdk";
import { ChevronLeft, MessageSquarePlus, Pencil } from "lucide-react";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { Textarea } from "@rome-os/ui/textarea";
import { List, ListRow, ListRowContent, ListRowDescription, ListRowTitle } from "@rome-os/ui/list-row";
import {
  Page,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderNav,
  PageHeading,
  PageNav,
  PageNavLink,
  PageTitle,
  Section,
  SectionActions,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@rome-os/ui/page";
import { api, enc, sendJson, type TopicDetail } from "./api";
import { AppLink, Empty, ErrorNote, go, Loading, Prose, useLoad } from "./common";
import { ConversationsView } from "./ConversationsView";
import { SourcesView } from "./SourcesView";
import { NotesView } from "./NotesView";
import { SearchPanel } from "./SearchPanel";

type Tab = "overview" | "conversations" | "sources" | "notes" | "search";

const KIND_LABEL: Record<string, string> = {
  topic: "课题",
  conversation: "对话",
  source: "资料",
  note: "笔记",
  brief: "状态",
};

/** Maps a topic-relative file path (from the log or search) to an in-app route. */
export function routeForPath(slug: string, path: string): string[] {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "conversations" && parts[1]) return [slug, "conversations", parts[1]];
  if (parts[0] === "sources" && parts[1]) return [slug, "sources", parts[1]];
  if (parts[0] === "notes" && parts[1]) return [slug, "notes", parts[1].replace(/\.md$/, "")];
  return [slug];
}

export function continueResearch(slug: string): void {
  navigateRome({
    path: "chat/new",
    draft: `【课题 ${slug}】`,
    agentName: "research:researcher",
    projectPath: `research/${slug}`,
    widgets: [{ type: "app", appId: "research", route: slug }],
  });
}

export function TopicPage({ slug, rest }: { slug: string; rest: string[] }) {
  const topic = useLoad(() => api<{ topic: TopicDetail }>(`topics/${enc(slug)}`).then((r) => r.topic), [slug]);
  const tab: Tab = (["conversations", "sources", "notes", "search"] as const).includes(rest[0] as never)
    ? (rest[0] as Tab)
    : "overview";
  const t = topic.data;

  const tabs: Array<{ id: Tab; label: string; route: string[] }> = [
    { id: "overview", label: "概览", route: [slug] },
    { id: "conversations", label: `对话${t ? ` ${t.counts.conversations}` : ""}`, route: [slug, "conversations"] },
    { id: "sources", label: `资料${t ? ` ${t.counts.sources}` : ""}`, route: [slug, "sources"] },
    { id: "notes", label: `笔记${t ? ` ${t.counts.notes}` : ""}`, route: [slug, "notes"] },
    { id: "search", label: "搜索", route: [slug, "search"] },
  ];

  return (
    <Page className="min-h-full bg-[var(--app-canvas)]">
      <PageHeader>
        <PageHeaderNav>
          <AppLink to={[]} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" />
            全部课题
          </AppLink>
        </PageHeaderNav>
        <PageHeading>
          <PageTitle>{t?.title ?? slug}</PageTitle>
          <PageDescription>
            research/{slug}
            {t ? ` · ${t.counts.conversations} 次对话 · ${t.counts.sources} 份资料 · ${t.counts.notes} 条笔记` : ""}
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button onClick={() => continueResearch(slug)} disabled={!t}>
            <MessageSquarePlus />
            继续研究
          </Button>
        </PageActions>
      </PageHeader>

      <PageNav aria-label="课题视图">
        {tabs.map((item) => (
          <PageNavLink key={item.id} active={tab === item.id} asChild>
            <AppLink to={item.route}>{item.label}</AppLink>
          </PageNavLink>
        ))}
      </PageNav>

      {topic.error ? <ErrorNote message={topic.error} /> : null}
      {topic.loading && !t ? <Loading /> : null}
      {t ? (
        <>
          {tab === "overview" ? <Overview topic={t} onChanged={topic.reload} /> : null}
          {tab === "conversations" ? <ConversationsView slug={slug} id={rest[1]} /> : null}
          {tab === "sources" ? <SourcesView slug={slug} id={rest[1]} onChanged={topic.reload} /> : null}
          {tab === "notes" ? <NotesView slug={slug} id={rest[1]} onChanged={topic.reload} /> : null}
          {tab === "search" ? (
            <Section>
              <SearchPanel slug={slug} />
            </Section>
          ) : null}
        </>
      ) : null}
    </Page>
  );
}

function Overview({ topic, onChanged }: { topic: TopicDetail; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(topic.brief);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await sendJson(`topics/${enc(topic.slug)}/brief`, "PUT", { brief: draft });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>课题状态</SectionTitle>
          </SectionHeading>
          <SectionActions>
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                  取消
                </Button>
                <Button size="sm" disabled={busy} onClick={() => void save()}>
                  {busy ? "保存中…" : "保存"}
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(topic.brief);
                  setEditing(true);
                }}
              >
                <Pencil />
                编辑
              </Button>
            )}
          </SectionActions>
        </SectionHeader>
        {error ? <ErrorNote message={error} /> : null}
        {editing ? (
          <Textarea
            className="min-h-[360px] font-mono text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        ) : (
          <Prose>{topic.brief}</Prose>
        )}
      </Section>

      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>时间线</SectionTitle>
          </SectionHeading>
        </SectionHeader>
        {topic.log.length === 0 ? (
          <Empty title="还没有记录" description="对话、保存资料和笔记都会出现在这里。" />
        ) : (
          <List>
            {topic.log.map((entry, i) => {
              const content = (
                <ListRowContent>
                  <ListRowTitle className="flex items-center gap-2">
                    <Badge variant="muted">{KIND_LABEL[entry.kind] ?? entry.kind}</Badge>
                    <span className="truncate">{entry.text}</span>
                  </ListRowTitle>
                  <ListRowDescription>{entry.at}</ListRowDescription>
                </ListRowContent>
              );
              return entry.link && entry.kind !== "brief" ? (
                <ListRow key={`${entry.at}-${i}`} asChild interactive size="sm">
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      go(...routeForPath(topic.slug, entry.link!));
                    }}
                  >
                    {content}
                  </a>
                </ListRow>
              ) : (
                <ListRow key={`${entry.at}-${i}`} size="sm">
                  {content}
                </ListRow>
              );
            })}
          </List>
        )}
      </Section>
    </>
  );
}
