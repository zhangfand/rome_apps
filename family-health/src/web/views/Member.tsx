import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, ListChecks, Pencil, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { Input } from "@rome-os/ui/input";
import { PageActions, PageDescription, PageHeader, PageHeading, PageTitle, Section, SectionDescription, SectionHeader, SectionHeading, SectionTitle } from "@rome-os/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rome-os/ui/tabs";
import { ConfirmDialog, DemoBadge, ErrorState, LoadingRows, RedFlagBanner } from "../components/common";
import { MemberDialog } from "../components/dialogs";
import { FindingsTimelineList, IndicatorList } from "../components/indicators";
import { apiSend, errorMessage } from "../lib/api";
import { SEX_ZH, formatDate } from "../lib/format";
import { useApi } from "../lib/hooks";
import { useMeta } from "../lib/meta";
import { Link, go, paths } from "../lib/router";
import type { FindingTimeline, IndicatorSummary, MemberCard, PanelData, Report } from "../lib/types";

interface MemberResponse extends MemberCard {
  reports: Report[];
}

function PanelTab({ memberId, panelKey }: { memberId: string; panelKey: string }) {
  const { data, error, loading, reload } = useApi<{ panel: PanelData }>(`members/${memberId}/panels/${panelKey}`);
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (loading && !data) return <LoadingRows rows={6} />;
  const panel = data!.panel;
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{panel.description}</p>
      <IndicatorList items={panel.items} memberId={memberId} empty="这个目标下的指标还没有已确认的数据。" />
      {panel.findings.length ? (
        <div>
          <h3 className="mb-2 text-sm font-medium text-foreground">相关检查结论</h3>
          <FindingsTimelineList findings={panel.findings} />
        </div>
      ) : null}
    </div>
  );
}

function AllTab({ memberId }: { memberId: string }) {
  const { data, error, loading, reload } = useApi<{ categories: Array<{ key: string; name: string; items: IndicatorSummary[] }> }>(`members/${memberId}/indicators`);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.categories ?? [])
      .map((g) => ({ ...g, items: q ? g.items.filter((i) => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)) : g.items }))
      .filter((g) => g.items.length > 0);
  }, [data, query]);
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (loading && !data) return <LoadingRows rows={6} />;
  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-sm">
        <Input icon={<Search />} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索指标，如 尿酸、ALT" aria-label="搜索指标" />
      </div>
      {groups.length === 0 ? <p className="text-sm text-muted-foreground">{query ? "没有匹配的指标。" : "还没有已确认的体检数据。"}</p> : null}
      {groups.map((g) => {
        const isCollapsed = collapsed[g.key] ?? false;
        const abnormal = g.items.filter((i) => i.concerning).length;
        return (
          <section key={g.key} aria-labelledby={`cat-${g.key}`}>
            <button
              type="button"
              className="mb-2 flex w-full items-center gap-2 text-left"
              aria-expanded={!isCollapsed}
              onClick={() => setCollapsed((c) => ({ ...c, [g.key]: !isCollapsed }))}
            >
              {isCollapsed ? <ChevronRight className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
              <h3 id={`cat-${g.key}`} className="font-medium text-foreground">
                {g.name}
              </h3>
              <span className="text-sm text-muted-foreground">{g.items.length} 项</span>
              {abnormal ? <Badge variant="destructive">{abnormal} 项需关注</Badge> : null}
            </button>
            {isCollapsed ? null : <IndicatorList items={g.items} memberId={memberId} />}
          </section>
        );
      })}
    </div>
  );
}

export function MemberView({ memberId, tab }: { memberId: string; tab: string | null }) {
  const meta = useMeta();
  const { data, error, loading, reload } = useApi<MemberResponse>(`members/${memberId}`);
  const findings = useApi<{ findings: FindingTimeline[] }>(`members/${memberId}/findings`);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (loading && !data) return <LoadingRows rows={5} />;
  if (!data) return null;
  const m = data.member;
  const panels = (meta?.panels ?? []).filter((p) => m.goals.includes(p.key));
  const activeTab = tab && (tab === "all" || panels.some((p) => p.key === tab)) ? tab : panels[0]?.key ?? "all";
  const sub = [m.relation, m.sex ? SEX_ZH[m.sex] : null, m.age != null ? `${m.age} 岁` : null, m.heightCm ? `${m.heightCm} cm` : null].filter(Boolean).join(" · ");

  async function remove() {
    try {
      await apiSend("DELETE", `members/${memberId}`);
      toast.success(`已删除成员：${m.name}`);
      go(paths.overview());
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader>
        <PageHeading>
          <PageTitle className="flex flex-wrap items-center gap-2">
            {m.name}
            {m.isDemo ? <DemoBadge /> : null}
          </PageTitle>
          <PageDescription>{sub || "未填写基本信息"}</PageDescription>
          {m.goals.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label="关注目标">
              {m.goals.map((g) => (
                <Badge key={g} variant="brand">
                  {meta?.panels.find((p) => p.key === g)?.name ?? g}
                </Badge>
              ))}
            </div>
          ) : null}
        </PageHeading>
        <PageActions>
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil /> 编辑
          </Button>
          <Button asChild>
            <Link to={paths.upload(m.id)}>
              <Upload /> 上传报告
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <RedFlagBanner alerts={data.overview.alerts} findingAlerts={data.overview.findingAlerts} />

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">最近体检 {formatDate(data.overview.latestExamDate)}</span>
        <Link to={paths.reports(m.id)} className="inline-flex items-center gap-1 text-foreground underline underline-offset-2">
          <FileText className="size-4" /> 体检报告（{data.reports.length}）
        </Link>
        <Link to={paths.interventions(m.id)} className="inline-flex items-center gap-1 text-foreground underline underline-offset-2">
          <ListChecks className="size-4" /> 干预记录（{data.activeInterventions.length} 项进行中）
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => go(paths.member(m.id, v), { replace: true })}>
        <div className="overflow-x-auto">
          <TabsList aria-label="指标分组">
            {panels.map((p) => (
              <TabsTrigger key={p.key} value={p.key}>
                {p.name}
              </TabsTrigger>
            ))}
            <TabsTrigger value="all">全部指标</TabsTrigger>
          </TabsList>
        </div>
        {panels.map((p) => (
          <TabsContent key={p.key} value={p.key} className="pt-4">
            {activeTab === p.key ? <PanelTab memberId={m.id} panelKey={p.key} /> : null}
          </TabsContent>
        ))}
        <TabsContent value="all" className="pt-4">
          {activeTab === "all" ? <AllTab memberId={m.id} /> : null}
        </TabsContent>
      </Tabs>

      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>检查结论时间线</SectionTitle>
            <SectionDescription>超声、影像、心电图等结论在历次体检中的变化。</SectionDescription>
          </SectionHeading>
        </SectionHeader>
        {findings.error ? <ErrorState message={findings.error} onRetry={() => void findings.reload()} /> : null}
        {findings.data ? <FindingsTimelineList findings={findings.data.findings} /> : findings.loading ? <LoadingRows rows={2} /> : null}
      </Section>

      <MemberDialog
        open={editing}
        onClose={() => setEditing(false)}
        member={m}
        meta={meta}
        onSaved={() => void reload()}
        onDelete={() => {
          setEditing(false);
          setDeleting(true);
        }}
      />
      <ConfirmDialog
        open={deleting}
        title={`删除成员“${m.name}”？`}
        description="该成员的所有体检报告（包括上传的文件）、识别结果、干预和自测记录都会被永久删除，无法恢复。"
        confirmLabel="永久删除"
        onConfirm={remove}
        onClose={() => setDeleting(false)}
      />
    </>
  );
}
