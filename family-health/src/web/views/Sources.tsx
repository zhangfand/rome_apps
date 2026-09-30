/**
 * 数据来源 — the inverse view of 指标库: every standard / guideline the app
 * cites, whether it is in force, how its numbers were checked, which numbers
 * it supports, and what the research could not verify. Read-only.
 */
import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { Badge } from "@rome-os/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@rome-os/ui/breadcrumb";
import { FilterChipGroup } from "@rome-os/ui/filter-chip-group";
import { Input } from "@rome-os/ui/input";
import { List, ListRow } from "@rome-os/ui/list-row";
import { PageDescription, PageHeader, PageHeading, PageTitle, Section, SectionDescription, SectionHeader, SectionHeading, SectionTitle } from "@rome-os/ui/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rome-os/ui/table";
import { Empty, ErrorState, LoadingRows } from "../components/common";
import { EvidenceQuote, LevelBadge, formatBounds, populationText, scaleText } from "../components/provenance";
import { useApi, useDebounced } from "../lib/hooks";
import { Link, paths } from "../lib/router";
import type { GapKind, SourceDetail, SourceLevel, SourceSummary, SourcesIndex } from "../lib/types";

export function SourcesView({ id }: { id: string | null }) {
  return id ? <SourceDetailView id={id} /> : <SourcesList />;
}

const LEVEL_ORDER: SourceLevel[] = ["national_cn", "international", "cn_guideline", "intl_guideline", "cn_consensus", "unverified"];
const LEVEL_GROUP: Record<SourceLevel, string> = {
  national_cn: "国家标准与国家卫健委文件",
  international: "国际标准",
  cn_guideline: "中国指南",
  intl_guideline: "国际指南",
  cn_consensus: "中国专家共识",
  report: "报告单",
  unverified: "未核实的内置数据",
};
const GAP_ORDER: GapKind[] = ["no_standard", "needs_check", "not_imported"];

type Filter = "all" | "check" | SourceLevel;

function shortTitle(s: SourceSummary) {
  return s.level === "unverified" ? "应用内置数据（未核实）" : s.title;
}

function CheckBadge({ s }: { s: SourceSummary }) {
  if (s.level === "unverified") return null;
  return s.needsOfficialCheck ? <Badge variant="warning">待官方原文复核</Badge> : <Badge variant="outline">已对照官方原文</Badge>;
}

function usageText(s: SourceSummary) {
  const u = s.usage;
  if (s.level === "unverified") return `${u.legacyRanges} 个内置范围，${u.explanations} 条解释`;
  const parts = [u.ranges ? `${u.ranges} 条参考范围` : null, u.thresholds ? `${u.thresholds} 组判定切点` : null].filter(Boolean);
  return `${u.indicators} 个指标 · ${parts.join("，") || "暂无"}`;
}

// ------------------------------------------------------------------ list

function SourcesList() {
  const idx = useApi<SourcesIndex>("sources");
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim().toLowerCase(), 150);
  const [filter, setFilter] = useState<Filter>("all");

  const groups = useMemo(() => {
    if (!idx.data) return [];
    const match = (s: SourceSummary) => !q || [s.title, s.org, s.identifier, s.id].some((x) => x.toLowerCase().includes(q));
    const pass = (s: SourceSummary) => (filter === "all" ? true : filter === "check" ? s.needsOfficialCheck : s.level === filter);
    return LEVEL_ORDER.map((level) => ({ level, items: idx.data!.sources.filter((s) => s.level === level && match(s) && pass(s)) })).filter((g) => g.items.length);
  }, [idx.data, q, filter]);

  if (idx.error) return <ErrorState message={idx.error} onRetry={() => void idx.reload()} />;
  if (!idx.data) return <LoadingRows rows={6} />;
  const { counts } = idx.data;

  const levelOption = (l: SourceLevel, label: string) => (counts.byLevel[l] ? [{ value: l as Filter, label, count: counts.byLevel[l] }] : []);

  return (
    <>
      <PageHeader>
        <PageHeading>
          <PageTitle>数据来源</PageTitle>
          <PageDescription>
            应用里每个参考范围和判定标准，都引用了下面的某一份文件。点进去可以看到这份文件是否现行、数字是怎么核对的，以及它支撑了哪些指标、原文怎么写。
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="已核实的来源" value={counts.verified} />
        <Stat label="已对照官方原文" value={counts.primary} />
        <Stat label="待官方原文复核" value={counts.needsOfficialCheck} tone={counts.needsOfficialCheck ? "warning" : undefined} />
        <Stat label="尚未核实的缺口" value={idx.data.gaps.length} />
      </dl>

      <div className="flex flex-col gap-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索标准编号、文件名或机构，如 WS/T 404、血脂" aria-label="搜索来源" className="pl-8" />
        </div>
        <FilterChipGroup<Filter>
          aria-label="筛选来源"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "all", label: "全部", count: counts.total },
            { value: "check", label: "待官方原文复核", count: counts.needsOfficialCheck },
            ...levelOption("national_cn", "国家标准"),
            ...levelOption("cn_guideline", "中国指南"),
            ...levelOption("cn_consensus", "中国共识"),
            ...levelOption("international", "国际标准"),
            ...levelOption("unverified", "未核实"),
          ]}
        />
      </div>

      {groups.length === 0 ? <Empty icon={<Search />} title="没有找到匹配的来源" description="换个关键词试试，或切换上面的筛选。" /> : null}

      {groups.map((g) => (
        <Section key={g.level}>
          <SectionHeader>
            <SectionHeading>
              <SectionTitle>
                {LEVEL_GROUP[g.level]}
                <span className="ml-2 text-sm font-normal text-muted-foreground">{g.items.length} 份</span>
              </SectionTitle>
            </SectionHeading>
          </SectionHeader>
          <List className="rounded-lg border border-border">
            {g.items.map((s) => (
              <ListRow asChild interactive key={s.id}>
                <Link to={paths.sources(s.id)} aria-label={`${shortTitle(s)} 详情`}>
                  <div className="flex w-full min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 font-medium text-foreground">{shortTitle(s)}</span>
                      <CheckBadge s={s} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {s.level !== "unverified" ? `${s.identifier} · ` : ""}
                      {usageText(s)}
                    </span>
                  </div>
                </Link>
              </ListRow>
            ))}
          </List>
        </Section>
      ))}

      <GapsSection idx={idx.data} />
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warning" }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-xl font-semibold tabular-nums ${tone === "warning" ? "text-warning-fg" : "text-foreground"}`}>{value}</dd>
    </div>
  );
}

function GapsSection({ idx }: { idx: SourcesIndex }) {
  return (
    <Section>
      <SectionHeader>
        <SectionHeading>
          <SectionTitle>尚未核实的内容</SectionTitle>
          <SectionDescription>研究时查过、但没能找到可靠出处或还没接入的部分。受影响的指标会继续以报告单为准，或标“未核实”。</SectionDescription>
        </SectionHeading>
      </SectionHeader>
      <div className="flex flex-col gap-5">
        {GAP_ORDER.map((kind) => {
          const items = idx.gaps.filter((g) => g.kind === kind);
          if (!items.length) return null;
          return (
            <div key={kind} className="flex flex-col gap-2">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  {idx.gapKinds[kind].title}
                  <span className="ml-2 font-normal text-muted-foreground">{items.length} 项</span>
                </h3>
                <p className="text-xs text-muted-foreground">{idx.gapKinds[kind].description}</p>
              </div>
              <ul className="flex flex-col gap-2">
                {items.map((g) => (
                  <li key={g.id} className="flex flex-col gap-1 rounded-lg border border-border p-3">
                    <span className="text-sm font-medium text-foreground">{g.title}</span>
                    {g.detail ? <p className="text-xs leading-relaxed text-muted-foreground">{g.detail}</p> : null}
                    {g.indicators.length ? (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {g.indicators.map((i) => (
                          <Link key={i.code} to={paths.library(i.code)} className="rounded-md border border-border px-1.5 py-0.5 text-xs text-foreground hover:bg-muted">
                            {i.zh}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm text-foreground">研究原始记录（{idx.research.reduce((n, r) => n + r.gaps.length, 0)} 条，保留研究员原话，部分为英文）</summary>
          <div className="mt-3 flex flex-col gap-4">
            {idx.research.map((r) => (
              <div key={r.file} className="flex flex-col gap-1.5">
                <h4 className="text-xs font-medium text-foreground">{r.topic}</h4>
                <ul className="flex flex-col gap-1.5">
                  {r.gaps.map((g, i) => (
                    <li key={i} className="text-xs leading-relaxed text-muted-foreground">
                      <span className="text-foreground">{g.what}</span>
                      <br />
                      尝试过：{g.tried}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ detail

function SourceDetailView({ id }: { id: string }) {
  const d = useApi<SourceDetail>(`sources/${encodeURIComponent(id)}`);
  if (d.error) return <ErrorState message={d.error} onRetry={() => void d.reload()} />;
  if (!d.data) return <LoadingRows rows={6} />;
  const s = d.data;
  const legacy = s.level === "unverified";
  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={paths.sources()}>数据来源</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="line-clamp-1">{s.identifier}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader>
        <PageHeading>
          <div className="flex flex-wrap items-center gap-2">
            <LevelBadge level={s.level} />
            <CheckBadge s={s} />
          </div>
          <PageTitle>{legacy ? "应用内置数据（未核实）" : s.title}</PageTitle>
          <PageDescription>
            {s.org}
            {legacy ? "" : ` · ${s.identifier}`}
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <Section>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[8rem_1fr]">
          {!legacy ? (
            <>
              <dt className="text-muted-foreground">现行状态</dt>
              <dd className="text-foreground">{s.note?.status ?? "这次研究没有单独核对现行状态。"}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">怎么核对的</dt>
          <dd className="text-foreground">{s.note?.checkedHow ?? "—"}</dd>
          <dt className="text-muted-foreground">核对日期</dt>
          <dd className="tabular-nums text-foreground">{s.retrieved}</dd>
          {s.url ? (
            <>
              <dt className="text-muted-foreground">原文</dt>
              <dd>
                <a href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 break-all text-primary underline underline-offset-2">
                  打开原文 <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              </dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">支撑内容</dt>
          <dd className="text-foreground">{usageText(s)}</dd>
        </dl>
        {s.note?.caveats?.length ? (
          <div className="mt-4 rounded-md bg-muted px-3 py-2.5">
            <p className="text-xs font-medium text-foreground">需要注意</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-sm leading-relaxed text-foreground">
              {s.note.caveats.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {s.status || s.notes ? (
          <details className="mt-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer">研究原始记录</summary>
            <div className="mt-2 flex flex-col gap-1.5 leading-relaxed">
              {s.status ? <p>状态：{s.status}</p> : null}
              {s.notes ? <p className="break-all">{s.notes}</p> : null}
            </div>
          </details>
        ) : null}
      </Section>

      {s.ranges.length ? (
        <Section>
          <SectionHeader>
            <SectionHeading>
              <SectionTitle>参考范围（{s.ranges.length} 条）</SectionTitle>
              <SectionDescription>报告单没有印参考范围时，用这些范围判断“偏高 / 偏低”。</SectionDescription>
            </SectionHeading>
          </SectionHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>指标</TableHead>
                  <TableHead>范围</TableHead>
                  <TableHead>适用人群</TableHead>
                  <TableHead>原文位置与原文</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.ranges.map((r) => (
                  <TableRow key={`${r.code}:${r.candidate.id}`}>
                    <TableCell className="whitespace-nowrap">
                      <Link to={paths.library(r.code)} className="text-primary underline underline-offset-2">
                        {r.zh}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {r.resolved ? formatBounds(r.resolved, r.resolved.unit) : "—"}
                      {r.candidate.conditions ? <div className="text-xs text-muted-foreground">{r.candidate.conditions}</div> : null}
                    </TableCell>
                    <TableCell>{populationText(r.candidate.population) ?? "成年人"}</TableCell>
                    <TableCell className="min-w-64 whitespace-normal">
                      {r.candidate.locator ? <p className="text-xs text-muted-foreground">{r.candidate.locator}</p> : null}
                      <EvidenceQuote text={r.candidate.evidenceQuote} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      ) : null}

      {s.thresholds.length ? (
        <Section>
          <SectionHeader>
            <SectionHeading>
              <SectionTitle>判定切点（{s.thresholds.length} 组）</SectionTitle>
              <SectionDescription>如肥胖、高血压分级、血脂分层。标“仅限”的只适用于特定人群，应用不会自动套用。</SectionDescription>
            </SectionHeading>
          </SectionHeader>
          <ul className="flex flex-col gap-3">
            {s.thresholds.map((t) => (
              <li key={t.id} className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{t.name_zh}</span>
                  {t.kind === "target" ? <Badge variant="outline">目标值</Badge> : null}
                </div>
                {populationText(t.population) ? <p className="text-xs text-muted-foreground">适用人群：{populationText(t.population)}</p> : null}
                <ul className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                  {t.categories.map((c) => (
                    <li key={c.label_zh}>
                      <span className="text-foreground">{c.label_zh}</span> <span className="tabular-nums text-muted-foreground">{scaleText(c, t.unit)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-1.5">
                  {t.indicators.map((i) => (
                    <Link key={i.code} to={paths.library(i.code)} className="rounded-md border border-border px-1.5 py-0.5 text-xs text-foreground hover:bg-muted">
                      {i.zh}
                    </Link>
                  ))}
                </div>
                {t.locator ? <p className="text-xs text-muted-foreground">位置：{t.locator}</p> : null}
                <EvidenceQuote text={t.evidenceQuote} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {legacy ? (
        <Section>
          <SectionHeader>
            <SectionHeading>
              <SectionTitle>仍在使用内置范围的指标（{s.legacyInUse.length} 个）</SectionTitle>
              <SectionDescription>这些指标还没有已核实的参考范围。报告单印有范围时以报告单为准；没印时才用内置数值，并标“未核实”。</SectionDescription>
            </SectionHeading>
          </SectionHeader>
          {s.legacyInUse.length ? (
            <div className="flex flex-wrap gap-1.5">
              {s.legacyInUse.map((i) => (
                <Link key={i.code} to={paths.library(i.code)} className="rounded-md border border-border px-1.5 py-0.5 text-xs text-foreground hover:bg-muted">
                  {i.zh}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">没有了。</p>
          )}
        </Section>
      ) : null}
    </>
  );
}
