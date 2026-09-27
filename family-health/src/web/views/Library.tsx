/**
 * 指标库 — audit view of the knowledge base: every indicator with aliases,
 * unit, LOINC, all candidate reference ranges and thresholds with their
 * sources and evidence levels, conflict notes, and the unverified legacy
 * numbers still in use.
 */
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@rome-os/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@rome-os/ui/breadcrumb";
import { FilterChipGroup } from "@rome-os/ui/filter-chip-group";
import { Input } from "@rome-os/ui/input";
import { List, ListRow } from "@rome-os/ui/list-row";
import { PageDescription, PageHeader, PageHeading, PageTitle, Section, SectionDescription, SectionHeader, SectionHeading, SectionTitle } from "@rome-os/ui/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rome-os/ui/table";
import { Empty, ErrorState, LoadingRows } from "../components/common";
import { Citation, EvidenceQuote, LevelBadge, formatBounds, populationText } from "../components/provenance";
import { formatUnit } from "../lib/format";
import { useApi, useDebounced } from "../lib/hooks";
import { Link, paths } from "../lib/router";
import type { LibraryEntry, LibraryIndex, SourceInfo, ThresholdScaleItem } from "../lib/types";

const DIRECTION_ZH: Record<string, string> = {
  higher_worse: "偏高需要关注",
  lower_worse: "偏低需要关注",
  both: "偏高偏低都需要关注",
  qualitative: "阴性/阳性",
  info: "只作参考，不判断高低",
};

type Filter = "all" | "unverified" | "verified";

export function LibraryView({ code }: { code: string | null }) {
  return code ? <LibraryDetail code={code} /> : <LibraryList />;
}

// ------------------------------------------------------------------ list

function LibraryList() {
  const lib = useApi<LibraryIndex>("library");
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim().toLowerCase(), 150);
  const [filter, setFilter] = useState<Filter>("all");

  const groups = useMemo(() => {
    if (!lib.data) return [];
    const match = (e: LibraryEntry) =>
      !q || [e.code, e.zh, e.en, ...e.aliases].some((x) => x.toLowerCase().includes(q));
    const pass = (e: LibraryEntry) => (filter === "all" ? true : filter === "verified" ? e.verified : !e.verified);
    return [...lib.data.categories]
      .sort((a, b) => a.order - b.order)
      .map((c) => ({ ...c, items: lib.data!.indicators.filter((e) => e.category === c.key && match(e) && pass(e)) }))
      .filter((g) => g.items.length);
  }, [lib.data, q, filter]);

  if (lib.error) return <ErrorState message={lib.error} onRetry={() => void lib.reload()} />;
  if (!lib.data) return <LoadingRows rows={6} />;
  const all = lib.data.indicators;
  const verifiedCount = all.filter((e) => e.verified).length;

  return (
    <>
      <PageHeader>
        <PageHeading>
          <PageTitle>指标库</PageTitle>
          <PageDescription>
            应用用来判断“偏高 / 偏低”的全部指标、参考范围和判定标准，以及每个数字的出处。原则：报告单印有参考范围时以报告单为准；没有时用国家标准，国家标准与国际标准不同时以国家标准为准。标“未核实”的是应用内置数值，尚未与标准核对。
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <div className="flex flex-col gap-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索名称、缩写或别名，如 尿酸、TG、P电轴" aria-label="搜索指标" className="pl-8" />
        </div>
        <FilterChipGroup<Filter>
          aria-label="按核实情况筛选"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "all", label: "全部", count: all.length },
            { value: "unverified", label: "只看未核实", count: all.length - verifiedCount },
            { value: "verified", label: "已核实", count: verifiedCount },
          ]}
        />
      </div>

      {groups.length === 0 ? <Empty icon={<Search />} title="没有找到匹配的指标" description="换个关键词试试，或切换上面的筛选。" /> : null}

      {groups.map((g) => (
        <Section key={g.key}>
          <SectionHeader>
            <SectionHeading>
              <SectionTitle>
                {g.zh}
                <span className="ml-2 text-sm font-normal text-muted-foreground">{g.items.length} 项</span>
              </SectionTitle>
            </SectionHeading>
          </SectionHeader>
          <List className="rounded-lg border border-border">
            {g.items.map((e) => (
              <ListRow asChild interactive key={e.code}>
                <Link to={paths.library(e.code)} aria-label={`${e.zh} 详情`}>
                  <div className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{e.zh}</span>
                    <span className="text-xs text-muted-foreground">{e.code}</span>
                    {e.unit ? <span className="text-xs text-muted-foreground">{formatUnit(e.unit)}</span> : null}
                    <LevelSummary e={e} />
                  </div>
                </Link>
              </ListRow>
            ))}
          </List>
        </Section>
      ))}

      <SourcesSection sources={lib.data.sources} />
      {lib.data.loincAttribution ? <p className="text-xs text-muted-foreground">{lib.data.loincAttribution}</p> : null}
    </>
  );
}

function LevelSummary({ e }: { e: LibraryEntry }) {
  const levels = [...new Set([...e.ranges.filter((r) => r.resolved).map((r) => r.candidate.level), ...e.thresholds.map((t) => t.level)])];
  if (!levels.length) return <LevelBadge level="unverified" />;
  return (
    <span className="flex flex-wrap gap-1">
      {levels.map((l) => (
        <LevelBadge key={l} level={l} />
      ))}
    </span>
  );
}

function SourcesSection({ sources }: { sources: SourceInfo[] }) {
  return (
    <Section>
      <SectionHeader>
        <SectionHeading>
          <SectionTitle>数据来源（{sources.length}）</SectionTitle>
          <SectionDescription>每个参考范围、判定标准和编码都引用下面的来源之一。</SectionDescription>
        </SectionHeading>
      </SectionHeader>
      <ul className="flex flex-col gap-2">
        {sources.map((s) => (
          <li key={s.id} className="flex flex-col gap-1 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <LevelBadge level={s.level} />
              <span className="text-xs text-muted-foreground">被引用 {s.usedBy ?? 0} 次 · 核对于 {s.retrieved}</span>
            </div>
            <Citation source={s} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ------------------------------------------------------------------ detail

function scaleLine(c: ThresholdScaleItem, unit: string) {
  if (c.bounds) {
    return Object.entries(c.bounds)
      .map(([code, b]) => `${code} ${formatBounds({ low: b.low, high: b.high, lowInclusive: (b.inclusivity ?? "[)")[0] === "[", highInclusive: (b.inclusivity ?? "[)")[1] === "]" })}`)
      .join(" 或 ");
  }
  const inc = c.inclusivity || "[)";
  return formatBounds({ low: c.low, high: c.high, lowInclusive: inc[0] === "[", highInclusive: inc[1] === "]" }, unit);
}

function LibraryDetail({ code }: { code: string }) {
  const d = useApi<LibraryEntry>(`library/${encodeURIComponent(code)}`);
  if (d.error) return <ErrorState message={d.error} onRetry={() => void d.reload()} />;
  if (!d.data) return <LoadingRows rows={6} />;
  const e = d.data;
  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={paths.library()}>指标库</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{e.zh}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader>
        <PageHeading>
          <PageTitle>{e.zh}</PageTitle>
          <PageDescription>
            {e.en} · {e.code} · {e.categoryZh}
            {e.unit ? ` · 标准单位 ${formatUnit(e.unit)}` : ""} · {DIRECTION_ZH[e.direction] ?? e.direction}
            {e.sex ? ` · 仅${e.sex === "male" ? "男性" : "女性"}` : ""}
            {e.derived ? " · 由其他指标计算" : ""}
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>这是什么</SectionTitle>
          </SectionHeading>
        </SectionHeader>
        <p className="text-sm leading-relaxed text-foreground">{e.explain.text}</p>
        <div className="flex flex-wrap items-center gap-2">
          {e.explain.source ? <LevelBadge level={e.explain.source.level} /> : null}
          <Citation source={e.explain.source} />
        </div>
      </Section>

      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>参考范围（候选）</SectionTitle>
            <SectionDescription>按“国家标准 → 国际标准 → 国际指南 → 中国指南 → 中国共识”的顺序选用，并匹配性别、年龄。报告单印有范围时以报告单为准。</SectionDescription>
          </SectionHeading>
        </SectionHeader>
        {e.ranges.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>级别</TableHead>
                  <TableHead>范围</TableHead>
                  <TableHead>适用人群</TableHead>
                  <TableHead>出处</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {e.ranges.map((r) => (
                  <TableRow key={r.candidate.id}>
                    <TableCell>
                      <LevelBadge level={r.candidate.level} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {r.resolved ? formatBounds(r.resolved, r.resolved.unit) : "（待核实，暂无数值）"}
                      {r.candidate.conditions ? <div className="text-xs text-muted-foreground">{r.candidate.conditions}</div> : null}
                    </TableCell>
                    <TableCell>{populationText(r.candidate.population) ?? "所有成人"}</TableCell>
                    <TableCell className="whitespace-normal">
                      <Citation source={r.source} locator={r.candidate.locator} />
                      <EvidenceQuote text={r.candidate.evidenceQuote} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无已核实的国家标准或国际标准参考范围。</p>
        )}
        {e.conflict ? <p className="rounded-md bg-warning-bg px-3 py-2 text-sm text-warning-fg">{e.conflict.note_zh}（处理：{e.conflict.resolution}）</p> : null}
      </Section>

      {e.legacy ? (
        <Section>
          <SectionHeader>
            <SectionHeading>
              <SectionTitle>内置范围（未核实）</SectionTitle>
              <SectionDescription>应用初版自带的数值，尚未与标准核对。只在报告单没有印参考范围、也没有已核实标准时使用。</SectionDescription>
            </SectionHeading>
          </SectionHeader>
          <ul className="flex flex-col gap-1 text-sm">
            {e.legacy.ranges.map((r) => (
              <li key={r.sex ?? "all"} className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">{r.sex ? (r.sex === "male" ? "男性" : "女性") : "所有人"}</span>
                <span className="tabular-nums text-foreground">{formatBounds(r.range, e.unit)}</span>
                <LevelBadge level="unverified" />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>判定标准</SectionTitle>
            <SectionDescription>如肥胖、高血压分级等。与参考范围分开显示，不改变“偏高/偏低”的判断。国家标准和中国指南优先，国际标准作为补充。</SectionDescription>
          </SectionHeading>
        </SectionHeader>
        {e.thresholds.length ? (
          <ul className="flex flex-col gap-3">
            {e.thresholds.map((t) => (
              <li key={t.id} className="flex flex-col gap-1 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{t.name_zh}</span>
                  <LevelBadge level={t.level} />
                  {t.alternativeOf ? <Badge variant="outline">备选标准</Badge> : null}
                  {t.kind === "target" ? <Badge variant="outline">目标值</Badge> : null}
                  {populationText(t.population) ? <span className="text-xs text-muted-foreground">{populationText(t.population)}</span> : null}
                </div>
                <ul className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                  {t.categories.map((c) => (
                    <li key={c.label_zh}>
                      <span className="text-foreground">{c.label_zh}</span> <span className="tabular-nums text-muted-foreground">{scaleLine(c, t.unit)}</span>
                    </li>
                  ))}
                </ul>
                {t.categories.some((c) => c.note_zh) ? (
                  <ul className="text-xs text-muted-foreground">
                    {t.categories.filter((c) => c.note_zh).map((c) => (
                      <li key={c.label_zh}>{c.label_zh}：{c.note_zh}</li>
                    ))}
                  </ul>
                ) : null}
                <Citation source={t.source} locator={t.locator} />
                <EvidenceQuote text={t.evidenceQuote} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">暂无已核实的判定标准。</p>
        )}
      </Section>

      {e.critical.length ? (
        <Section>
          <SectionHeader>
            <SectionHeading>
              <SectionTitle>“建议就医”提示规则</SectionTitle>
            </SectionHeading>
          </SectionHeader>
          <ul className="flex flex-col gap-1 text-sm">
            {e.critical.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <Badge variant={c.level === "urgent" ? "destructive" : "warning"}>{c.level === "urgent" ? "尽快就医" : "近期就诊"}</Badge>
                <span className="tabular-nums text-foreground">
                  {c.op} {c.threshold} {formatUnit(e.unit)}
                  {c.sex ? `（${c.sex === "male" ? "男" : "女"}）` : ""}
                </span>
                {c.source ? <LevelBadge level={c.source.level} /> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>名称与编码</SectionTitle>
          </SectionHeading>
        </SectionHeader>
        <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-muted-foreground">LOINC</dt>
          <dd className="text-foreground">
            {e.loinc ? (
              <span className="flex flex-col gap-1">
                <span>
                  {e.loinc.code} · {e.loinc.longName}
                  {e.loinc.zhName ? `（${e.loinc.zhName}）` : ""}
                </span>
                <Citation source={e.loinc.source} />
                {e.loincAttribution ? <span className="text-xs text-muted-foreground">{e.loincAttribution}</span> : null}
              </span>
            ) : (
              <span className="text-muted-foreground">暂无（待核实）</span>
            )}
          </dd>
          <dt className="text-muted-foreground">报告上的写法</dt>
          <dd className="flex flex-wrap gap-1">
            {e.aliases.map((a) => (
              <Badge key={a} variant="muted">
                {a}
              </Badge>
            ))}
          </dd>
          {e.conversions.length ? (
            <>
              <dt className="text-muted-foreground">单位换算</dt>
              <dd className="text-foreground">
                {e.conversions.map((c) => `1 ${formatUnit(c.unit)} = ${c.factor}${c.offset ? ` + ${c.offset}` : ""} ${formatUnit(e.unit)}`).join("；")}
              </dd>
            </>
          ) : null}
        </dl>
      </Section>
    </>
  );
}
