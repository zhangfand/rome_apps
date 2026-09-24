import "./styles.css";
import { useState } from "react";
import type { RomeAppBootstrap } from "@rome-os/app-web-sdk";
import { BookOpen, Plus, Search } from "lucide-react";
import { Button } from "@rome-os/ui/button";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@rome-os/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@rome-os/ui/field";
import { Input } from "@rome-os/ui/input";
import { Textarea } from "@rome-os/ui/textarea";
import { List, ListRow, ListRowContent, ListRowDescription, ListRowTitle } from "@rome-os/ui/list-row";
import {
  Page,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Section,
} from "@rome-os/ui/page";
import { api, sendJson, type TopicDetail, type TopicSummary } from "./api";
import { AppLink, Empty, ErrorNote, go, Loading, shortDate, useAppPath, useLoad } from "./common";
import { TopicPage } from "./TopicPage";
import { SearchPanel } from "./SearchPanel";

export default function App({ bootstrap: _bootstrap }: { bootstrap: RomeAppBootstrap }) {
  const path = useAppPath();
  if (path.length === 0) return <TopicList />;
  return <TopicPage slug={path[0]!} rest={path.slice(1)} />;
}

function TopicList() {
  const topics = useLoad(() => api<{ topics: TopicSummary[] }>("topics").then((r) => r.topics), []);
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);

  return (
    <Page className="min-h-full bg-[var(--app-canvas)]">
      <PageHeader>
        <PageHeading>
          <PageTitle>Research</PageTitle>
          <PageDescription>
            长期研究课题。每个课题保存对话、资料和笔记，下次继续时接着之前的上下文聊。
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" onClick={() => setSearching((v) => !v)}>
            <Search />
            搜索
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus />
            新建课题
          </Button>
        </PageActions>
      </PageHeader>

      {searching ? (
        <Section>
          <SearchPanel />
        </Section>
      ) : null}

      <Section>
        {topics.error ? <ErrorNote message={topics.error} /> : null}
        {topics.loading && !topics.data ? <Loading /> : null}
        {topics.data && topics.data.length === 0 ? (
          <Empty
            icon={<BookOpen />}
            title="还没有课题"
            description="新建一个课题，然后从课题页开始和 agent 讨论。"
          />
        ) : null}
        {topics.data && topics.data.length > 0 ? (
          <List>
            {topics.data.map((t) => (
              <ListRow key={t.slug} asChild interactive>
                <AppLink to={[t.slug]}>
                  <ListRowContent>
                    <ListRowTitle>{t.title}</ListRowTitle>
                    <ListRowDescription>
                      {t.counts.conversations} 次对话 · {t.counts.sources} 份资料 · {t.counts.notes} 条笔记
                      {t.updated ? ` · 更新于 ${shortDate(t.updated)}` : ""}
                    </ListRowDescription>
                    {t.excerpt ? <ListRowDescription className="line-clamp-1">{t.excerpt}</ListRowDescription> : null}
                  </ListRowContent>
                </AppLink>
              </ListRow>
            ))}
          </List>
        ) : null}
      </Section>

      <NewTopicDialog open={creating} onClose={() => setCreating(false)} />
    </Page>
  );
}

function NewTopicDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { topic } = await sendJson<{ topic: TopicDetail }>("topics", "POST", { title, question });
      onClose();
      setTitle("");
      setQuestion("");
      go(topic.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogHeader onClose={onClose}>
        <DialogTitle>新建课题</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="topic-title">标题</FieldLabel>
            <Input
              id="topic-title"
              value={title}
              autoFocus
              placeholder="例如：Agent 记忆系统"
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="topic-question">研究问题</FieldLabel>
            <Textarea
              id="topic-question"
              rows={4}
              value={question}
              placeholder="想搞清楚什么？可以先空着，第一次对话时再明确。"
              onChange={(e) => setQuestion(e.target.value)}
            />
            <FieldDescription>写进 TOPIC.md，每次对话开始时 agent 都会先读。</FieldDescription>
          </Field>
        </FieldGroup>
        {error ? <ErrorNote message={error} /> : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button disabled={busy || !title.trim()} onClick={() => void submit()}>
          {busy ? "创建中…" : "创建"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
