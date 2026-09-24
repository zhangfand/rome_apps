import { useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, HeartPulse, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@rome-os/ui/card";
import { PageActions, PageDescription, PageHeader, PageHeading, PageTitle } from "@rome-os/ui/page";
import { Spinner } from "@rome-os/ui/spinner";
import { ConfirmDialog, DemoBadge, Empty, ErrorState, LoadingRows, RedFlagBanner } from "../components/common";
import { MemberDialog } from "../components/dialogs";
import { apiSend, errorMessage } from "../lib/api";
import { SEX_ZH, formatDate, formatNumber, trendClass } from "../lib/format";
import { useApi } from "../lib/hooks";
import { useMeta } from "../lib/meta";
import { Link, go, paths } from "../lib/router";
import type { MemberCard } from "../lib/types";

interface OverviewData {
  members: MemberCard[];
  hasDemo: boolean;
}

function ChangeRow({ c }: { c: MemberCard["overview"]["topChanges"][number] }) {
  const Icon = c.delta > 0 ? ArrowUpRight : c.delta < 0 ? ArrowDownRight : ArrowRight;
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="truncate text-foreground">{c.name}</span>
      <span className={`flex shrink-0 items-center gap-1 tabular-nums ${trendClass(c.trend)}`}>
        <span className="text-muted-foreground">
          {formatNumber(c.previous)} → {formatNumber(c.latest)}
        </span>
        <Icon className="size-4" aria-label={c.trend === "better" ? "好转" : c.trend === "worse" ? "变差" : "变化"} />
      </span>
    </li>
  );
}

function MemberCardView({ card }: { card: MemberCard }) {
  const { member: m, overview: o } = card;
  const sub = [m.relation, m.sex ? SEX_ZH[m.sex] : null, m.age != null ? `${m.age} 岁` : null].filter(Boolean).join(" · ");
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link to={paths.member(m.id)} className="hover:underline">
            {m.name}
          </Link>
        </CardTitle>
        <CardDescription>{sub}</CardDescription>
        {m.isDemo ? (
          <CardAction>
            <DemoBadge />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RedFlagBanner alerts={o.alerts} findingAlerts={o.findingAlerts} compact />
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">最近体检</dt>
            <dd className="tabular-nums text-foreground">{formatDate(o.latestExamDate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">异常项</dt>
            <dd className={o.abnormalCount ? "text-destructive" : "text-foreground"}>{o.latestExamDate ? `${o.abnormalCount} 项` : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">体检次数</dt>
            <dd className="text-foreground">{o.examCount}</dd>
          </div>
        </dl>
        {o.topChanges.length ? (
          <div>
            <p className="mb-1 text-sm text-muted-foreground">与上次体检相比</p>
            <ul className="flex flex-col gap-1">
              {o.topChanges.map((c) => (
                <ChangeRow key={c.code} c={c} />
              ))}
            </ul>
          </div>
        ) : o.latestExamDate ? (
          <p className="text-sm text-muted-foreground">只有一次体检，暂无对比。</p>
        ) : (
          <p className="text-sm text-muted-foreground">还没有已确认的体检报告。</p>
        )}
        {card.activeInterventions.length ? (
          <div className="flex flex-wrap gap-1.5" aria-label="进行中的干预">
            {card.activeInterventions.map((iv) => (
              <Badge key={iv.id} variant="info">
                {iv.category} · {iv.title}
              </Badge>
            ))}
          </div>
        ) : null}
        {card.pendingReports ? (
          <p className="text-sm">
            <Link to={paths.reports(m.id)} className="text-foreground underline underline-offset-2">
              {card.pendingReports} 份报告待处理
            </Link>
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to={paths.member(m.id)}>查看详情</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link to={paths.upload(m.id)}>
            <Upload /> 上传报告
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export function OverviewView() {
  const { data, error, loading, reload } = useApi<OverviewData>("overview");
  const meta = useMeta();
  const [adding, setAdding] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function seed() {
    setSeeding(true);
    try {
      await apiSend("POST", "demo/seed");
      toast.success("已加载演示数据");
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSeeding(false);
    }
  }

  async function clearDemo() {
    try {
      const res = await apiSend<{ cleared: { members: number; reports: number } }>("POST", "demo/clear");
      toast.success(`已清空演示数据（${res.cleared.members} 位成员）`);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const members = data?.members ?? [];
  return (
    <>
      <PageHeader>
        <PageHeading>
          <PageTitle>家庭总览</PageTitle>
          <PageDescription>全家的体检结果、变化趋势和需要关注的指标。</PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus /> 添加成员
          </Button>
          <Button asChild>
            <Link to={paths.upload()}>
              <Upload /> 上传报告
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      {error ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? <LoadingRows rows={3} /> : null}

      {data && members.length === 0 ? (
        <Empty
          icon={<HeartPulse />}
          title="还没有家庭成员"
          description="添加家人后上传体检报告（PDF 或手机照片），AI 会自动识别指标，整理成每个人的历年趋势。也可以先加载演示数据看看效果。"
        >
          <Button onClick={() => void seed()} disabled={seeding}>
            {seeding ? <Spinner size="sm" /> : null}
            加载演示数据
          </Button>
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus /> 添加成员
          </Button>
        </Empty>
      ) : null}

      {members.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {members.map((c) => (
            <MemberCardView key={c.member.id} card={c} />
          ))}
        </div>
      ) : null}

      {data?.hasDemo ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>当前显示的“演示”成员是示例数据。</span>
          <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
            清空演示数据
          </Button>
        </div>
      ) : null}

      <MemberDialog open={adding} onClose={() => setAdding(false)} meta={meta} onSaved={(m) => go(paths.member(m.id))} />
      <ConfirmDialog
        open={confirmClear}
        title="清空演示数据？"
        description="只会删除带“演示”标记的成员及其报告、干预和自测记录，你自己添加的数据不会受影响。"
        confirmLabel="清空演示数据"
        onConfirm={clearDemo}
        onClose={() => setConfirmClear(false)}
      />
    </>
  );
}
