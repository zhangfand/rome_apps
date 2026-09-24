import "./styles.css";
import { useCallback, useEffect, useState } from "react";
import { fetchAppApi, type RomeAppBootstrap } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription } from "@rome-os/ui/alert";
import { Button } from "@rome-os/ui/button";
import { Page, PageActions, PageDescription, PageHeader, PageHeading, PageTitle } from "@rome-os/ui/page";
import { Spinner } from "@rome-os/ui/spinner";

interface Card {
  member: { id: string; name: string; relation: string; age: number | null; isDemo: boolean };
  overview: { latestExamDate: string | null; abnormalCount: number };
  activeInterventions: Array<{ id: string; title: string }>;
}

/** Placeholder page until the full UI lands: family overview + demo data controls. */
export default function App({ bootstrap: _bootstrap }: { bootstrap: RomeAppBootstrap }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [hasDemo, setHasDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchAppApi("overview");
      const data = (await res.json()) as { members?: Card[]; hasDemo?: boolean; message?: string };
      if (!res.ok) throw new Error(data.message ?? `加载失败（${res.status}）`);
      setCards(data.members ?? []);
      setHasDemo(Boolean(data.hasDemo));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function demo(action: "seed" | "clear") {
    setBusy(true);
    try {
      const res = await fetchAppApi(`demo/${action}`, { method: "POST" });
      if (!res.ok) throw new Error(`操作失败（${res.status}）`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page className="min-h-full bg-[var(--app-canvas)]">
      <PageHeader>
        <PageHeading>
          <PageTitle>家庭体检助手</PageTitle>
          <PageDescription>全家体检报告自动整理，指标趋势一目了然。完整界面即将上线。</PageDescription>
        </PageHeading>
        <PageActions>
          {hasDemo ? (
            <Button variant="outline" disabled={busy} onClick={() => void demo("clear")}>
              清空演示数据
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => void demo("seed")}>
              生成演示数据
            </Button>
          )}
        </PageActions>
      </PageHeader>
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {cards === null ? (
        <Spinner />
      ) : cards.length === 0 ? (
        <p className="text-muted-foreground">还没有家庭成员。可以先生成演示数据看看效果。</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {cards.map((c) => (
            <li key={c.member.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="font-medium text-foreground">{c.member.name}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {c.member.relation}
                  {c.member.age != null ? ` · ${c.member.age} 岁` : ""}
                  {c.member.isDemo ? " · 演示" : ""}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                最近体检 {c.overview.latestExamDate ?? "—"} · 异常 {c.overview.abnormalCount} 项
                {c.activeInterventions.length ? ` · 进行中：${c.activeInterventions.map((i) => i.title).join("、")}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-sm text-muted-foreground">仅供参考，不能替代医生诊断</p>
    </Page>
  );
}
