import { useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@rome-os/ui/alert";
import { Badge } from "@rome-os/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@rome-os/ui/breadcrumb";
import { Button } from "@rome-os/ui/button";
import { Field, FieldLabel } from "@rome-os/ui/field";
import { IconButton } from "@rome-os/ui/icon-button";
import { Input } from "@rome-os/ui/input";
import { PageActions, PageDescription, PageHeader, PageHeading, PageTitle, Section, SectionActions, SectionDescription, SectionHeader, SectionHeading, SectionTitle } from "@rome-os/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rome-os/ui/select";
import { Spinner } from "@rome-os/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rome-os/ui/table";
import { Timestamp } from "@rome-os/ui/timestamp";
import { ConfirmDialog, DemoBadge, ErrorState, FlagBadge, LoadingRows, RedFlagBanner, StatusBadge } from "../components/common";
import { ReportInsightView } from "../components/insight";
import { EditableCell, IndicatorPicker, PageViewer } from "../components/review";
import { apiSend, errorMessage } from "../lib/api";
import { formatDateLong, formatNumber, formatUnit } from "../lib/format";
import { useApi, usePolling } from "../lib/hooks";
import { useMeta } from "../lib/meta";
import { Link, go, paths } from "../lib/router";
import type { FindingRow, Meta, ReportDetail, ReportInsightContent, ResultRow } from "../lib/types";

type Mutate = (method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown, ok?: string) => Promise<void>;

// ------------------------------------------------------------------ progress / status

function ExtractionProgress({ detail, onRetry }: { detail: ReportDetail; onRetry: () => void }) {
  const r = detail.report;
  const pct = r.pagesTotal ? Math.round((r.pagesDone / r.pagesTotal) * 100) : 0;
  if (r.stale) {
    return (
      <Alert variant="warning">
        <AlertTitle>识别似乎中断了</AlertTitle>
        <AlertDescription>
          <p>超过 15 分钟没有进展（可能是服务重启）。可以重新识别。</p>
          <Button size="sm" className="mt-2" onClick={onRetry}>
            <RefreshCw /> 重新识别
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-4" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-foreground">
        <Spinner size="sm" /> AI 正在识别报告… 第 {r.pagesDone} / {r.pagesTotal} 页
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full bg-primary transition-all" style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
      <p className="text-sm text-muted-foreground">每 5 页为一批，通常每批需要 1–2 分钟。可以离开这个页面，识别会在后台继续。</p>
    </div>
  );
}

// ------------------------------------------------------------------ review: results

function ResultsEditor({ detail, mutate, onJump, activePage }: { detail: ReportDetail; mutate: Mutate; onJump: (p: number) => void; activePage: number }) {
  const [draft, setDraft] = useState({ rawName: "", rawValue: "", rawUnit: "", refText: "" });
  const rows = detail.results;
  const unmapped = rows.filter((r) => !r.indicatorCode).length;

  async function add() {
    if (!draft.rawName.trim() || !draft.rawValue.trim()) {
      toast.error("请填写项目名称和结果");
      return;
    }
    await mutate("POST", `reports/${detail.report.id}/results`, { ...draft, page: activePage }, "已添加");
    setDraft({ rawName: "", rawValue: "", rawUnit: "", refText: "" });
  }

  return (
    <div className="flex flex-col gap-3">
      {unmapped ? (
        <Alert variant="warning">
          <AlertDescription>有 {unmapped} 行没有匹配到标准指标（高亮显示）。请在“标准指标”列选择，或删除无关的行；未匹配的行不会计入趋势。</AlertDescription>
        </Alert>
      ) : null}
      {/* Desktop: compact table */}
      <div className="hidden rounded-lg border border-border md:block">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-[25%]" />
            <col className="w-[20%]" />
            <col className="w-[13%]" />
            <col className="w-[14%]" />
            <col className="w-[22%]" />
            <col className="w-12" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>报告原文</TableHead>
              <TableHead>结果</TableHead>
              <TableHead>单位</TableHead>
              <TableHead>参考范围</TableHead>
              <TableHead>标准指标</TableHead>
              <TableHead>
                <span className="sr-only">操作</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <ResultEditRow key={r.id} row={r} mutate={mutate} onJump={onJump} />
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  没有识别到检验结果，可以在下方手动添加。
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      {/* Mobile: one card per row */}
      <ul className="flex flex-col gap-2 md:hidden" aria-label="识别结果">
        {rows.map((r) => (
          <ResultEditCard key={r.id} row={r} mutate={mutate} onJump={onJump} />
        ))}
        {rows.length === 0 ? <li className="text-sm text-muted-foreground">没有识别到检验结果，可以在下方手动添加。</li> : null}
      </ul>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.4fr_1fr_0.8fr_1fr_auto]" aria-label="添加一行结果">
        <Input size="sm" placeholder="项目名称" aria-label="项目名称" value={draft.rawName} onChange={(e) => setDraft({ ...draft, rawName: e.target.value })} />
        <Input size="sm" placeholder="结果" aria-label="结果" value={draft.rawValue} onChange={(e) => setDraft({ ...draft, rawValue: e.target.value })} />
        <Input size="sm" placeholder="单位" aria-label="单位" value={draft.rawUnit} onChange={(e) => setDraft({ ...draft, rawUnit: e.target.value })} />
        <Input size="sm" placeholder="参考范围" aria-label="参考范围" value={draft.refText} onChange={(e) => setDraft({ ...draft, refText: e.target.value })} />
        <Button size="sm" variant="outline" onClick={() => void add()}>
          <Plus /> 添加
        </Button>
      </div>
    </div>
  );
}

function rowTone(row: ResultRow) {
  const lowConfidence = !!row.indicatorCode && row.confidence != null && row.confidence < 0.8;
  return { lowConfidence, tone: !row.indicatorCode ? "bg-warning-bg" : lowConfidence ? "bg-info-bg" : "" };
}

function MappingCell({ row, patch }: { row: ResultRow; patch: (b: Record<string, unknown>) => Promise<void> }) {
  const { lowConfidence } = rowTone(row);
  return (
    <div className="flex flex-col gap-1">
      <IndicatorPicker value={row.indicatorCode} label={row.name} onSelect={(code) => void patch({ indicatorCode: code })} />
      {lowConfidence ? <span className="text-xs text-info-fg">自动匹配，请核对</span> : null}
      {row.indicatorCode && row.unit && row.unit !== row.rawUnit && row.valueNum != null ? (
        <span className="text-xs text-muted-foreground">
          换算：{formatNumber(row.valueNum)} {formatUnit(row.unit)}
        </span>
      ) : null}
    </div>
  );
}

function ResultEditRow({ row, mutate, onJump }: { row: ResultRow; mutate: Mutate; onJump: (p: number) => void }) {
  const { tone } = rowTone(row);
  const patch = (body: Record<string, unknown>) => mutate("PATCH", `results/${row.id}`, body);
  return (
    <TableRow className={tone} onClick={() => row.page && onJump(row.page)}>
      <TableCell className="align-top">
        <div className="break-words text-sm text-foreground">{row.rawName}</div>
        <div className="text-xs text-muted-foreground">
          {row.page ? `第 ${row.page} 页` : "手动添加"}
          {row.section ? ` · ${row.section}` : ""}
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex items-center gap-1.5">
          <EditableCell value={row.rawValue} label={`${row.rawName} 结果`} onSave={(v) => patch({ rawValue: v })} />
          <FlagBadge flag={row.flag} direction={row.direction} className="shrink-0" />
        </div>
      </TableCell>
      <TableCell className="align-top">
        <EditableCell value={row.rawUnit} label={`${row.rawName} 单位`} onSave={(v) => patch({ rawUnit: v })} />
      </TableCell>
      <TableCell className="align-top">
        <EditableCell value={row.refText ?? ""} label={`${row.rawName} 参考范围`} onSave={(v) => patch({ refText: v })} />
      </TableCell>
      <TableCell className="align-top">
        <MappingCell row={row} patch={patch} />
      </TableCell>
      <TableCell className="align-top">
        <IconButton label={`删除 ${row.rawName}`} icon={<Trash2 />} size="sm" onClick={(e) => (e.stopPropagation(), void mutate("DELETE", `results/${row.id}`, undefined, "已删除"))} />
      </TableCell>
    </TableRow>
  );
}

function ResultEditCard({ row, mutate, onJump }: { row: ResultRow; mutate: Mutate; onJump: (p: number) => void }) {
  const { tone } = rowTone(row);
  const patch = (body: Record<string, unknown>) => mutate("PATCH", `results/${row.id}`, body);
  return (
    <li className={`flex flex-col gap-2 rounded-lg border border-border p-3 ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" className="min-w-0 text-left" onClick={() => row.page && onJump(row.page)}>
          <div className="break-words text-sm font-medium text-foreground">{row.rawName}</div>
          <div className="text-xs text-muted-foreground">
            {row.page ? `第 ${row.page} 页（点击查看）` : "手动添加"}
            {row.section ? ` · ${row.section}` : ""}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <FlagBadge flag={row.flag} direction={row.direction} />
          <IconButton label={`删除 ${row.rawName}`} icon={<Trash2 />} size="sm" onClick={() => void mutate("DELETE", `results/${row.id}`, undefined, "已删除")} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <EditableCell value={row.rawValue} label={`${row.rawName} 结果`} onSave={(v) => patch({ rawValue: v })} />
        <EditableCell value={row.rawUnit} label={`${row.rawName} 单位`} onSave={(v) => patch({ rawUnit: v })} />
        <EditableCell value={row.refText ?? ""} label={`${row.rawName} 参考范围`} onSave={(v) => patch({ refText: v })} />
      </div>
      <MappingCell row={row} patch={patch} />
    </li>
  );
}

// ------------------------------------------------------------------ review: findings

function FindingsEditor({ detail, mutate, meta, activePage }: { detail: ReportDetail; mutate: Mutate; meta: Meta | null; activePage: number }) {
  const [draft, setDraft] = useState({ rawText: "", findingKey: "none", severity: "", organ: "" });
  const options = meta?.findings ?? [];
  async function add() {
    if (!draft.rawText.trim()) {
      toast.error("请填写结论原文");
      return;
    }
    await mutate(
      "POST",
      `reports/${detail.report.id}/findings`,
      { rawText: draft.rawText, findingKey: draft.findingKey === "none" ? null : draft.findingKey, severity: draft.severity || null, organ: draft.organ || null, page: activePage },
      "已添加结论",
    );
    setDraft({ rawText: "", findingKey: "none", severity: "", organ: "" });
  }
  return (
    <div className="flex flex-col gap-3">
      {detail.findings.length === 0 ? <p className="text-sm text-muted-foreground">没有识别到超声、影像等结论。</p> : null}
      <ul className="flex flex-col gap-2">
        {detail.findings.map((f) => (
          <FindingEditRow key={f.id} f={f} mutate={mutate} options={options} />
        ))}
      </ul>
      <div className="grid grid-cols-1 gap-2 rounded-lg border border-dashed border-border p-3 sm:grid-cols-[1fr_12rem_8rem_8rem_auto]" aria-label="添加检查结论">
        <Input size="sm" placeholder="结论原文，如 脂肪肝（轻度）" aria-label="结论原文" value={draft.rawText} onChange={(e) => setDraft({ ...draft, rawText: e.target.value })} />
        <FindingKeySelect value={draft.findingKey} options={options} onChange={(v) => setDraft({ ...draft, findingKey: v })} />
        <Input size="sm" placeholder="程度/分级" aria-label="程度或分级" value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value })} />
        <Input size="sm" placeholder="器官" aria-label="器官" value={draft.organ} onChange={(e) => setDraft({ ...draft, organ: e.target.value })} />
        <Button size="sm" variant="outline" onClick={() => void add()}>
          <Plus /> 添加
        </Button>
      </div>
    </div>
  );
}

function FindingKeySelect({ value, options, onChange }: { value: string; options: Meta["findings"]; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label="结论类型">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">其他（不归类）</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.key} value={o.key}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FindingEditRow({ f, mutate, options }: { f: FindingRow; mutate: Mutate; options: Meta["findings"] }) {
  const patch = (body: Record<string, unknown>) => mutate("PATCH", `findings/${f.id}`, body);
  return (
    <li className="grid grid-cols-1 items-center gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_12rem_8rem_8rem_auto]">
      <EditableCell value={f.rawText} label="结论原文" onSave={(v) => patch({ rawText: v })} />
      <FindingKeySelect value={f.findingKey ?? "none"} options={options} onChange={(v) => void patch({ findingKey: v === "none" ? null : v })} />
      <EditableCell value={f.severity ?? ""} label="程度或分级" onSave={(v) => patch({ severity: v })} />
      <EditableCell value={f.organ} label="器官" onSave={(v) => patch({ organ: v })} />
      <IconButton label="删除结论" icon={<Trash2 />} size="sm" onClick={() => void mutate("DELETE", `findings/${f.id}`, undefined, "已删除")} />
    </li>
  );
}

// ------------------------------------------------------------------ confirmed view

function ResultsByCategory({ detail, meta }: { detail: ReportDetail; meta: Meta | null }) {
  const groups = useMemo(() => {
    const order = new Map((meta?.categories ?? []).map((c) => [c.key, c]));
    const map = new Map<string, ResultRow[]>();
    for (const r of detail.results) {
      const key = r.category ?? "__unmapped";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()]
      .map(([key, rows]) => ({ key, name: key === "__unmapped" ? "未匹配" : order.get(key)?.zh ?? key, order: key === "__unmapped" ? 99 : order.get(key)?.order ?? 50, rows }))
      .sort((a, b) => a.order - b.order);
  }, [detail.results, meta]);
  if (!groups.length) return <p className="text-sm text-muted-foreground">没有检验结果。</p>;
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.key}>
          <h4 className="mb-2 font-medium text-foreground">
            {g.name} <span className="text-sm font-normal text-muted-foreground">{g.rows.length} 项</span>
          </h4>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table className="min-w-[32rem] table-fixed">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[20%]" />
                <col className="w-[14%]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead>项目</TableHead>
                  <TableHead className="text-right">结果</TableHead>
                  <TableHead>单位</TableHead>
                  <TableHead>参考范围</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.indicatorCode && detail.member ? (
                        <Link to={paths.indicator(detail.member.id, r.indicatorCode)} className="underline-offset-2 hover:underline">
                          {r.name ?? r.rawName}
                        </Link>
                      ) : (
                        r.rawName
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.valueNum != null ? formatNumber(r.valueNum) : r.valueText ?? r.rawValue}</TableCell>
                    <TableCell>{formatUnit(r.unit || r.rawUnit)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.refText ?? "—"}</TableCell>
                    <TableCell>
                      <FlagBadge flag={r.flag} direction={r.direction} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightSection({ detail, mutate }: { detail: ReportDetail; mutate: Mutate }) {
  const ins = detail.insight;
  const content = ins?.content as ReportInsightContent | null | undefined;
  const regenerate = (force: boolean) => mutate("POST", "insights", { scope: "report", reportId: detail.report.id, force });
  return (
    <Section>
      <SectionHeader>
        <SectionHeading>
          <SectionTitle>AI 报告解读</SectionTitle>
          {ins?.updatedAt && ins.status === "ready" ? (
            <SectionDescription>
              生成于 <Timestamp value={ins.updatedAt} format="datetime" />
            </SectionDescription>
          ) : null}
        </SectionHeading>
        <SectionActions>
          {ins?.status === "ready" || ins?.status === "failed" ? (
            <Button variant="outline" size="sm" onClick={() => void regenerate(true)}>
              <RefreshCw /> 重新生成
            </Button>
          ) : !ins ? (
            <Button size="sm" onClick={() => void regenerate(false)}>
              <Sparkles /> 生成 AI 解读
            </Button>
          ) : null}
        </SectionActions>
      </SectionHeader>
      {ins?.status === "pending" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Spinner size="sm" /> 正在生成解读，通常需要 30–60 秒…
        </p>
      ) : null}
      {ins?.status === "failed" ? (
        <Alert variant="destructive">
          <AlertDescription>{ins.error ?? "生成失败"}</AlertDescription>
        </Alert>
      ) : null}
      {content && ins?.status !== "pending" ? <ReportInsightView content={content} /> : null}
      {!ins ? <p className="text-sm text-muted-foreground">确认报告后会自动生成通俗解读，也可以手动生成。</p> : null}
    </Section>
  );
}

// ------------------------------------------------------------------ main view

export function ReportDetailView({ reportId }: { reportId: string }) {
  const meta = useMeta();
  const { data, error, loading, reload, setData } = useApi<ReportDetail>(`reports/${encodeURIComponent(reportId)}`);
  const [page, setPage] = useState(1);
  const [showPages, setShowPages] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReextract, setConfirmReextract] = useState(false);
  const [busy, setBusy] = useState(false);

  const status = data?.report.status;
  usePolling(status === "extracting" && !data?.report.stale, 3000, () => void reload());
  usePolling(data?.insight?.status === "pending", 4000, () => void reload());

  const mutate: Mutate = async (method, path, body, ok) => {
    try {
      const d = await apiSend<ReportDetail | { insight: unknown }>(method, path, body);
      if (d && "report" in d) setData(d as ReportDetail);
      else await reload();
      if (ok) toast.success(ok);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  async function extract() {
    setBusy(true);
    try {
      await apiSend("POST", `reports/${reportId}/extract`);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    await mutate("POST", `reports/${reportId}/confirm`, undefined, "报告已确认，AI 解读生成中");
    setBusy(false);
  }

  async function remove() {
    try {
      await apiSend("DELETE", `reports/${reportId}`);
      toast.success("已删除报告");
      go(paths.reports(data?.member?.id ?? null));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (loading && !data) return <LoadingRows rows={6} />;
  if (!data) return null;
  const r = data.report;
  const m = data.member;
  const reviewing = r.status === "needs_review";
  const confirmed = r.status === "confirmed";
  const confirmBlocked = !r.examDate ? "请先填写体检日期" : null;

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={paths.reports()}>体检报告</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {m ? (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={paths.member(m.id)}>{m.name}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          ) : null}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{r.examDate ?? "日期待定"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle className="flex flex-wrap items-center gap-2">
            {m?.name ?? "体检报告"} · {r.examDate ? formatDateLong(r.examDate) : "日期待定"}
            <StatusBadge status={r.status} pagesDone={r.pagesDone} pagesTotal={r.pagesTotal} />
            {r.isDemo ? <DemoBadge /> : null}
          </PageTitle>
          <PageDescription>
            {[r.provider || null, r.pagesTotal ? `${r.pagesTotal} 页` : null, r.files.length ? `${r.files.length} 个文件` : null].filter(Boolean).join(" · ") || "—"}
          </PageDescription>
        </PageHeading>
        <PageActions>
          {confirmed ? (
            <Button variant="outline" onClick={() => void mutate("POST", `reports/${reportId}/reopen`, undefined, "已重新打开，可以继续编辑")}>
              <Pencil /> 重新编辑
            </Button>
          ) : null}
          {reviewing && r.pagesTotal ? (
            <Button variant="ghost" onClick={() => setConfirmReextract(true)}>
              <RefreshCw /> 重新识别
            </Button>
          ) : null}
          <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 /> 删除
          </Button>
        </PageActions>
      </PageHeader>

      <RedFlagBanner alerts={data.alerts} findingAlerts={data.findingAlerts} />

      {r.status === "extracting" ? <ExtractionProgress detail={data} onRetry={() => void extract()} /> : null}

      {r.status === "failed" ? (
        <Alert variant="destructive">
          <AlertTitle>识别失败</AlertTitle>
          <AlertDescription>
            <p>{r.error ?? "未知错误"}</p>
            <Button size="sm" className="mt-2" onClick={() => void extract()} disabled={busy || !r.pagesTotal}>
              <RefreshCw /> 重试
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {r.status === "uploaded" ? (
        <Alert variant="info">
          <AlertTitle>文件已上传，尚未识别</AlertTitle>
          <AlertDescription>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void extract()} disabled={busy || !r.pagesTotal}>
                {busy ? <Spinner size="sm" /> : null} 开始识别
              </Button>
              {m ? (
                <Button size="sm" variant="outline" asChild>
                  <Link to={paths.upload(m.id)}>上传其他报告</Link>
                </Button>
              ) : null}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {reviewing && r.error ? (
        <Alert variant="warning">
          <AlertTitle>部分内容可能需要补充</AlertTitle>
          <AlertDescription>{r.error}</AlertDescription>
        </Alert>
      ) : null}

      {(reviewing || r.status === "uploaded" || r.status === "failed") && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-2xl">
          <Field>
            <FieldLabel htmlFor="rep-date">体检日期{reviewing && !r.examDate ? "（必填）" : ""}</FieldLabel>
            <Input
              id="rep-date"
              type="date"
              value={r.examDate ?? ""}
              onChange={(e) => void mutate("PATCH", `reports/${reportId}`, { examDate: e.target.value || null })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="rep-provider">体检机构</FieldLabel>
            <EditableCell value={r.provider} label="体检机构" onSave={(v) => mutate("PATCH", `reports/${reportId}`, { provider: v })} />
          </Field>
        </div>
      )}

      {reviewing ? (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
            {r.pagesTotal ? (
              <Section className="xl:sticky xl:top-2 xl:self-start">
                <SectionHeader>
                  <SectionHeading>
                    <SectionTitle>报告原件</SectionTitle>
                  </SectionHeading>
                </SectionHeader>
                <PageViewer report={r} page={Math.min(page, r.pagesTotal)} onPageChange={setPage} />
              </Section>
            ) : null}
            <Section>
              <SectionHeader>
                <SectionHeading>
                  <SectionTitle>识别结果（{data.results.length}）</SectionTitle>
                  <SectionDescription>逐行核对数值和单位；点击一行可跳到对应页面。修改后自动保存。</SectionDescription>
                </SectionHeading>
              </SectionHeader>
              <ResultsEditor detail={data} mutate={mutate} onJump={setPage} activePage={page} />
            </Section>
          </div>
          <Section>
            <SectionHeader>
              <SectionHeading>
                <SectionTitle>检查结论（{data.findings.length}）</SectionTitle>
                <SectionDescription>超声、影像、心电图、总检等文字结论。</SectionDescription>
              </SectionHeading>
            </SectionHeader>
            <FindingsEditor detail={data} mutate={mutate} meta={meta} activePage={page} />
          </Section>
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-[var(--app-canvas)] py-3 pr-16 sm:pr-0">
            {confirmBlocked ? <span className="text-sm text-warning-fg">{confirmBlocked}</span> : <span className="text-sm text-muted-foreground">确认后数据会计入趋势，并自动生成 AI 解读。</span>}
            <Button onClick={() => void confirm()} disabled={!!confirmBlocked || busy}>
              {busy ? <Spinner size="sm" /> : <CheckCircle2 />} 确认报告
            </Button>
          </div>
        </>
      ) : null}

      {confirmed ? (
        <>
          <InsightSection detail={data} mutate={mutate} />
          <Section>
            <SectionHeader>
              <SectionHeading>
                <SectionTitle>检验结果</SectionTitle>
              </SectionHeading>
              {r.pagesTotal ? (
                <SectionActions>
                  <Button variant="ghost" size="sm" onClick={() => setShowPages((s) => !s)}>
                    {showPages ? <EyeOff /> : <Eye />} {showPages ? "隐藏原件" : "查看原件"}
                  </Button>
                </SectionActions>
              ) : null}
            </SectionHeader>
            {showPages ? (
              <div className="mb-4 max-w-2xl">
                <PageViewer report={r} page={Math.min(page, r.pagesTotal)} onPageChange={setPage} />
              </div>
            ) : null}
            <ResultsByCategory detail={data} meta={meta} />
          </Section>
          <Section>
            <SectionHeader>
              <SectionHeading>
                <SectionTitle>检查结论</SectionTitle>
              </SectionHeading>
            </SectionHeader>
            {data.findings.length ? (
              <ul className="flex flex-col gap-2">
                {data.findings.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm">
                    <span className="font-medium text-foreground">{f.name ?? f.organ ?? "其他"}</span>
                    {f.severity ? <Badge variant="muted">{f.severity}</Badge> : null}
                    <span className="text-muted-foreground">{f.rawText}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">没有检查结论。</p>
            )}
          </Section>
        </>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title="删除这份报告？"
        description="报告的上传文件、识别结果和 AI 解读都会被永久删除；已确认的数据会从趋势中移除。"
        confirmLabel="删除"
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        open={confirmReextract}
        title="重新识别？"
        description="会清除当前的识别结果和你做过的修改，重新让 AI 识别所有页面。"
        confirmLabel="重新识别"
        onConfirm={extract}
        onClose={() => setConfirmReextract(false)}
      />
    </>
  );
}
