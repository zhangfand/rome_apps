import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@rome-os/ui/alert";
import { Badge } from "@rome-os/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@rome-os/ui/breadcrumb";
import { Button } from "@rome-os/ui/button";
import { PageDescription, PageHeader, PageHeading, PageTitle, Section, SectionActions, SectionHeader, SectionHeading, SectionTitle } from "@rome-os/ui/page";
import { Spinner } from "@rome-os/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rome-os/ui/table";
import { Timestamp } from "@rome-os/ui/timestamp";
import { Disclaimer, ErrorState, FlagBadge, LoadingRows } from "../components/common";
import { TrendChart } from "../components/charts";
import { apiGet, apiSend, errorMessage } from "../lib/api";
import { formatNumber, formatRange, formatUnit } from "../lib/format";
import { useApi, usePolling } from "../lib/hooks";
import { Link, paths } from "../lib/router";
import type { IndicatorDetail, Insight, Member, TrendInsightContent } from "../lib/types";

function TrendInsightView({ memberId, code, initial }: { memberId: string; code: string; initial: Insight | null }) {
  const [insight, setInsight] = useState<Insight | null>(initial);
  const [starting, setStarting] = useState(false);
  useEffect(() => setInsight(initial), [initial]);
  const pending = insight?.status === "pending";

  usePolling(pending, 3000, () => {
    void apiGet<{ insight: Insight | null }>(`insights?scope=indicator&id=${encodeURIComponent(`${memberId}:${code}`)}`).then((r) => {
      setInsight(r.insight);
      if (r.insight?.status === "failed") toast.error(r.insight.error ?? "生成解读失败");
    });
  });

  async function generate(force: boolean) {
    setStarting(true);
    try {
      const r = await apiSend<{ insight: Insight }>("POST", "insights", { scope: "indicator", memberId, code, force });
      setInsight(r.insight);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setStarting(false);
    }
  }

  const content = insight?.status !== "pending" || insight?.content ? (insight?.content as TrendInsightContent | null) : null;
  return (
    <Section>
      <SectionHeader>
        <SectionHeading>
          <SectionTitle>AI 趋势解读</SectionTitle>
        </SectionHeading>
        <SectionActions>
          {content && insight?.status === "ready" ? (
            <Button variant="outline" size="sm" onClick={() => void generate(true)} disabled={starting || pending}>
              <RefreshCw /> 重新生成
            </Button>
          ) : !pending ? (
            <Button size="sm" onClick={() => void generate(false)} disabled={starting}>
              {starting ? <Spinner size="sm" /> : <Sparkles />} AI 解读此趋势
            </Button>
          ) : null}
        </SectionActions>
      </SectionHeader>
      {pending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Spinner size="sm" /> 正在生成解读，通常需要 20–40 秒…
        </p>
      ) : null}
      {insight?.status === "failed" ? (
        <Alert variant="destructive">
          <AlertDescription>{insight.error ?? "生成失败"}</AlertDescription>
        </Alert>
      ) : null}
      {content?.summary ? (
        <div className="flex flex-col gap-4 text-sm leading-relaxed text-foreground">
          <p>{content.summary}</p>
          {content.observations.length ? (
            <ul className="list-disc pl-5">
              {content.observations.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          ) : null}
          {content.intervention_timing ? (
            <div>
              <h4 className="mb-1 font-medium">生活方式调整（时间上同时发生）</h4>
              <p>{content.intervention_timing}</p>
            </div>
          ) : null}
          {content.confounders.length ? (
            <div>
              <h4 className="mb-1 font-medium">可能的其他影响因素</h4>
              <ul className="list-disc pl-5">
                {content.confounders.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {content.data_note ? (
            <div>
              <h4 className="mb-1 font-medium">数据说明</h4>
              <p>{content.data_note}</p>
            </div>
          ) : null}
          {content.suggestions.length ? (
            <div>
              <h4 className="mb-1 font-medium">建议</h4>
              <ul className="list-disc pl-5">
                {content.suggestions.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <Disclaimer />
            {insight?.updatedAt ? (
              <span className="text-xs text-muted-foreground">
                生成于 <Timestamp value={insight.updatedAt} format="datetime" />
              </span>
            ) : null}
          </div>
        </div>
      ) : !pending && insight?.status !== "failed" ? (
        <p className="text-sm text-muted-foreground">让 AI 结合历次数值和同期的生活方式调整，解读这个指标的变化。只描述时间上的同时发生，不做因果判断。</p>
      ) : null}
    </Section>
  );
}

export function IndicatorDetailView({ memberId, code }: { memberId: string; code: string }) {
  const { data, error, loading, reload } = useApi<{ indicator: IndicatorDetail }>(`members/${memberId}/indicators/${encodeURIComponent(code)}`);
  const member = useApi<{ member: Member }>(`members/${memberId}`);
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (loading && !data) return <LoadingRows rows={6} />;
  if (!data) return null;
  const d = data.indicator;
  const latest = [...d.points].reverse().find((p) => p.value != null || p.valueText);
  const rows = [...d.points].reverse();
  const memberName = member.data?.member.name ?? "成员";

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={paths.overview()}>家庭总览</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={paths.member(memberId)}>{memberName}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{d.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle className="flex flex-wrap items-center gap-2">
            {d.name}
            {d.derived ? <Badge variant="outline">计算值</Badge> : null}
          </PageTitle>
          <PageDescription>
            {latest ? (
              <>
                最新 {latest.value != null ? formatNumber(latest.value) : latest.valueText} {formatUnit(d.unit)}（{latest.date}）
              </>
            ) : (
              "暂无数据"
            )}
            {d.band ? ` · 参考范围 ${d.bandSource === "report" && d.bandText ? d.bandText : formatRange(d.band)} ${formatUnit(d.unit)}${d.bandSource === "report" ? "（报告标注）" : ""}` : ""}
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <p className="max-w-3xl text-sm leading-relaxed text-foreground">{d.explain}</p>

      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>变化趋势</SectionTitle>
          </SectionHeading>
        </SectionHeader>
        <TrendChart points={d.points} band={d.band} interventions={d.interventions} unit={formatUnit(d.unit)} direction={d.direction} />
      </Section>

      <TrendInsightView memberId={memberId} code={d.code} initial={d.insight} />

      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>原始数据</SectionTitle>
          </SectionHeading>
        </SectionHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead className="text-right">数值</TableHead>
                <TableHead>单位</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>来源</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={`${p.source}-${p.resultId ?? p.measurementId ?? p.date}`}>
                  <TableCell className="tabular-nums">{p.date}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.value != null ? formatNumber(p.value) : p.valueText ?? "—"}</TableCell>
                  <TableCell>{formatUnit(p.unit)}</TableCell>
                  <TableCell>
                    <FlagBadge flag={p.flag} direction={d.direction} />
                  </TableCell>
                  <TableCell>
                    {p.source === "measurement" ? (
                      <span className="text-muted-foreground">聊天记录{p.note ? ` · ${p.note}` : ""}</span>
                    ) : p.reportId ? (
                      <Link to={paths.report(p.reportId)} className="underline underline-offset-2">
                        {p.source === "derived" ? "计算值 · " : ""}
                        {p.provider || "体检报告"}
                        {p.page ? ` · 第 ${p.page} 页` : ""}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>
    </>
  );
}
