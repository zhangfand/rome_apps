import { Badge } from "@rome-os/ui/badge";
import { List, ListRow } from "@rome-os/ui/list-row";
import { formatNumber, formatRange, formatUnit } from "../lib/format";
import { Link, paths } from "../lib/router";
import type { FindingTimeline, IndicatorSummary } from "../lib/types";
import { Delta, FlagBadge } from "./common";
import { Sparkline } from "./charts";

export function IndicatorRow({ item, memberId }: { item: IndicatorSummary; memberId: string }) {
  const latest = item.latest;
  const value = latest ? (latest.value != null ? formatNumber(latest.value) : latest.valueText ?? "—") : "—";
  return (
    <ListRow asChild interactive size="md">
      <Link to={paths.indicator(memberId, item.code)} aria-label={`${item.name} 详情`}>
        <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium text-foreground">{item.name}</span>
              {item.derived ? <Badge variant="outline">计算值</Badge> : null}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {item.ref ? `参考 ${formatRange(item.ref)}${item.unit ? ` ${formatUnit(item.unit)}` : ""}` : formatUnit(item.unit) || " "}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 sm:justify-start">
            <span className="tabular-nums text-foreground">
              {value}
              {latest?.value != null && item.unit ? <span className="ml-1 text-xs text-muted-foreground">{formatUnit(item.unit)}</span> : null}
            </span>
            {latest?.source === "measurement" ? (
              <Badge variant="muted" title="最新值来自聊天/自测记录">自测</Badge>
            ) : (
              <FlagBadge flag={latest?.flag} direction={item.direction} />
            )}
          </div>
          <div className="col-start-1 row-start-2 sm:col-start-auto sm:row-start-auto">
            <Sparkline series={item.series} direction={item.direction} />
          </div>
          <div className="col-start-2 row-start-2 min-w-[4.5rem] text-right sm:col-start-auto sm:row-start-auto">
            <Delta delta={item.delta} trend={item.trend} />
          </div>
        </div>
      </Link>
    </ListRow>
  );
}

export function IndicatorList({ items, memberId, empty = "暂无数据" }: { items: IndicatorSummary[]; memberId: string; empty?: string }) {
  if (!items.length) return <p className="py-4 text-sm text-muted-foreground">{empty}</p>;
  return (
    <List className="divide-y divide-border rounded-lg border border-border">
      {items.map((it) => (
        <IndicatorRow key={it.code} item={it} memberId={memberId} />
      ))}
    </List>
  );
}

export function FindingsTimelineList({ findings, empty = "暂无超声、影像等检查结论。" }: { findings: FindingTimeline[]; empty?: string }) {
  if (!findings.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {findings.map((f) => (
        <li key={f.key ?? f.name} className="rounded-lg border border-border p-3">
          <div className="mb-2 flex flex-wrap items-baseline gap-2">
            <span className="font-medium text-foreground">{f.name}</span>
            {f.organ ? <span className="text-xs text-muted-foreground">{f.organ}</span> : null}
          </div>
          <ol className="flex flex-wrap items-center gap-1.5 text-sm" aria-label={`${f.name} 历次结果`}>
            {f.entries.map((e, i) => (
              <li key={e.findingId} className="flex items-center gap-1.5">
                {i > 0 ? <span className="text-muted-foreground" aria-hidden="true">→</span> : null}
                <Link to={paths.report(e.reportId)} className="rounded-md border border-border px-2 py-1 hover:bg-accent" title={e.rawText}>
                  <span className="tabular-nums text-muted-foreground">{e.examDate?.slice(0, 7) ?? "?"}</span>{" "}
                  <span className="text-foreground">{e.severity || "有"}</span>
                </Link>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ul>
  );
}
