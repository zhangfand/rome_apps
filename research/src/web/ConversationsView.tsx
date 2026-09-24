import { useState } from "react";
import { navigateRome } from "@rome-os/app-web-sdk";
import { ChevronLeft, ExternalLink, MessagesSquare } from "lucide-react";
import { Button } from "@rome-os/ui/button";
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
import { api, enc, type ConversationDetail, type ConversationSummary } from "./api";
import { AppLink, Empty, ErrorNote, Loading, Prose, shortDate, useLoad } from "./common";
import { continueResearch } from "./TopicPage";

export function ConversationsView({ slug, id }: { slug: string; id?: string }) {
  return id ? <ConversationDetailView slug={slug} id={id} /> : <ConversationList slug={slug} />;
}

function ConversationList({ slug }: { slug: string }) {
  const list = useLoad(
    () => api<{ conversations: ConversationSummary[] }>(`topics/${enc(slug)}/conversations`).then((r) => r.conversations),
    [slug],
  );
  return (
    <Section>
      {list.error ? <ErrorNote message={list.error} /> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data?.length === 0 ? (
        <>
          <Empty
            icon={<MessagesSquare />}
            title="还没有对话"
            description="点“继续研究”开始一次对话，每轮结束后会自动归档摘要和完整记录。"
          />
          <div className="flex justify-center">
            <Button onClick={() => continueResearch(slug)}>开始第一次对话</Button>
          </div>
        </>
      ) : null}
      {list.data && list.data.length > 0 ? (
        <List>
          {list.data.map((c) => (
            <ListRow key={c.id} asChild interactive>
              <AppLink to={[slug, "conversations", c.id]}>
                <ListRowContent>
                  <ListRowTitle>{c.title}</ListRowTitle>
                  <ListRowDescription>
                    {shortDate(c.started)}
                    {c.turns ? ` · ${c.turns} 轮` : ""}
                    {c.updated ? ` · 最近 ${shortDate(c.updated)}` : ""}
                  </ListRowDescription>
                  {c.excerpt ? <ListRowDescription className="line-clamp-2">{c.excerpt}</ListRowDescription> : null}
                </ListRowContent>
              </AppLink>
            </ListRow>
          ))}
        </List>
      ) : null}
    </Section>
  );
}

function ConversationDetailView({ slug, id }: { slug: string; id: string }) {
  const [view, setView] = useState<"summary" | "transcript">("summary");
  const conv = useLoad(
    () =>
      api<{ conversation: ConversationDetail }>(`topics/${enc(slug)}/conversations/${enc(id)}`).then(
        (r) => r.conversation,
      ),
    [slug, id],
  );
  const c = conv.data;
  return (
    <Section>
      <AppLink
        to={[slug, "conversations"]}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        全部对话
      </AppLink>
      {conv.error ? <ErrorNote message={conv.error} /> : null}
      {conv.loading && !c ? <Loading /> : null}
      {c ? (
        <>
          <SectionHeader>
            <SectionHeading>
              <SectionTitle>{c.title}</SectionTitle>
              <SectionDescription>
                {shortDate(c.started)}
                {c.turns ? ` · ${c.turns} 轮` : ""} · conversations/{c.id}
              </SectionDescription>
            </SectionHeading>
            <SectionActions>
              <SegmentedControl
                aria-label="显示内容"
                size="sm"
                value={view}
                onValueChange={setView}
                options={[
                  { value: "summary", label: "摘要" },
                  { value: "transcript", label: "完整记录" },
                ]}
              />
              {c.sessionId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateRome({ path: "chat", sessionId: c.sessionId! })}
                >
                  <ExternalLink />
                  打开对话
                </Button>
              ) : null}
            </SectionActions>
          </SectionHeader>
          <Prose>{view === "summary" ? c.summary : c.transcript || "（还没有记录）"}</Prose>
        </>
      ) : null}
    </Section>
  );
}
