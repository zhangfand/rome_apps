/**
 * “这个数字从哪来” — provenance popover for values, reference ranges and
 * flags. Opens on hover (mouse), tap (touch) and keyboard (Tab to the value,
 * Enter/Space; Esc closes). Plain Chinese for a reader without a medical
 * background.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@rome-os/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@rome-os/ui/popover";
import { formatNumber, formatUnit } from "../lib/format";
import { Link, paths } from "../lib/router";
import type { Flag, PopulationInfo, Provenance, ResolvedRange, SourceInfo, SourceLevel, ThresholdHit, ThresholdScaleItem } from "../lib/types";

// ------------------------------------------------------------------ small pieces

const LEVEL_LABEL: Record<SourceLevel, string> = {
  national_cn: "国家标准",
  international: "国际标准",
  cn_guideline: "中国指南",
  cn_consensus: "中国共识",
  intl_guideline: "国际指南",
  report: "报告单",
  unverified: "未核实",
};

const LEVEL_VARIANT: Record<SourceLevel, "success" | "info" | "brand" | "outline" | "muted" | "default" | "warning"> = {
  national_cn: "success",
  international: "info",
  cn_guideline: "brand",
  cn_consensus: "outline",
  intl_guideline: "muted",
  report: "default",
  unverified: "warning",
};

export function LevelBadge({ level, className }: { level: SourceLevel; className?: string }) {
  return (
    <Badge variant={LEVEL_VARIANT[level]} className={className}>
      {LEVEL_LABEL[level]}
    </Badge>
  );
}

const VERDICT_ZH: Record<string, string> = { H: "偏高", L: "偏低", normal: "正常", abnormal: "异常" };

type Bounds = { low?: number | null; high?: number | null; lowInclusive?: boolean; highInclusive?: boolean };

/** `3.9–6.1`, `<1.7`, `≤5.2`, `>1.04`, `≥60` */
export function formatBounds(r: Bounds, unit?: string | null): string {
  const u = unit ? ` ${formatUnit(unit)}` : "";
  const lo = r.low ?? null;
  const hi = r.high ?? null;
  if (lo != null && hi != null) return `${formatNumber(lo)}–${formatNumber(hi)}${u}`;
  if (hi != null) return `${r.highInclusive === false ? "<" : "≤"}${formatNumber(hi)}${u}`;
  if (lo != null) return `${r.lowInclusive === false ? ">" : "≥"}${formatNumber(lo)}${u}`;
  return "—";
}

export function rangeText(r: ResolvedRange): string {
  if (r.level === "report" && r.text) {
    // The printed range is in the printed unit; when the value was converted, also show the converted bounds.
    const printedUnit = r.textUnit ?? r.unit;
    const printed = `${r.text}${printedUnit ? ` ${formatUnit(printedUnit)}` : ""}`;
    // `textUnit` is only set by the server when the value was converted to the standard unit.
    return r.textUnit && (r.low != null || r.high != null) ? `${printed}（换算后 ${formatBounds(r, r.unit)}）` : printed;
  }
  return formatBounds(r, r.unit);
}

/** Threshold category bounds, e.g. `≥28` or `24–<28` (inclusivity "[)" → low ≤ v < high). */
export function scaleText(c: ThresholdScaleItem, unit: string): string {
  const inc = c.inclusivity || "[)";
  const lo = c.low;
  const hi = c.high;
  const u = unit ? ` ${formatUnit(unit)}` : "";
  if (c.bounds) {
    return Object.entries(c.bounds)
      .map(([code, b]) => `${code === "SBP" ? "收缩压" : code === "DBP" ? "舒张压" : code} ${scaleText({ ...c, bounds: undefined, low: b.low ?? null, high: b.high ?? null, inclusivity: b.inclusivity ?? "[)" }, "")}`)
      .join(" 或 ") + u;
  }
  if (lo != null && hi != null) return `${formatNumber(lo)}${inc[0] === "(" ? "（不含）" : ""}–${formatNumber(hi)}${inc[1] === ")" ? "（不含）" : ""}${u}`;
  if (hi != null) return `${inc[1] === "]" ? "≤" : "<"}${formatNumber(hi)}${u}`;
  if (lo != null) return `${inc[0] === "[" ? "≥" : ">"}${formatNumber(lo)}${u}`;
  return "—";
}

export function populationText(p: PopulationInfo | null | undefined): string | null {
  if (!p) return null;
  const parts: string[] = [];
  if (p.sex) parts.push(p.sex === "male" ? "男性" : "女性");
  if (p.age) {
    const { min, max } = p.age;
    if (min != null && max != null) parts.push(`${min}–${max} 岁`);
    else if (min != null) parts.push(`${min} 岁及以上`);
    else if (max != null) parts.push(`${max} 岁及以下`);
  }
  if (p.pregnancy) parts.push("孕期");
  if (p.condition) parts.push(`仅限${p.condition}`);
  if (p.note) parts.push(p.note);
  return parts.length ? parts.join("，") : null;
}

export function Citation({ source, locator, detailLink = true }: { source: SourceInfo | null | undefined; locator?: string | null; detailLink?: boolean }) {
  if (!source) return null;
  const loc = locator ?? source.locator;
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      <span className="text-foreground">{source.org}</span>
      {source.level !== "report" ? <>《{source.title}》</> : ` · ${source.title}`}
      {source.identifier ? ` · ${source.identifier}` : ""}
      {loc ? ` · ${loc}` : ""}
      {source.url ? (
        <>
          {" "}
          <a href={source.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2">
            查看原文 <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </>
      ) : null}
      {detailLink && source.level !== "report" ? (
        <>
          {" "}
          <Link to={paths.sources(source.id)} className="text-primary underline underline-offset-2">
            来源详情
          </Link>
        </>
      ) : null}
      {source.level !== "report" && source.level !== "unverified" ? (
        <span className="block">
          {source.status ? `状态：${source.status}` : null}
          {source.verifiedVia ? `${source.status ? "；" : ""}${source.verifiedVia === "primary" ? "已对照官方原文核对" : "对照转载或镜像全文核对，待官方原文复核"}` : null}
        </span>
      ) : null}
    </p>
  );
}

/** Verbatim source text behind a number (from the verified research). */
export function EvidenceQuote({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <blockquote className="border-l-2 border-border pl-2 text-xs leading-relaxed text-muted-foreground">
      <span className="text-foreground">原文：</span>
      {text}
    </blockquote>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5 border-t border-border px-3 py-2.5 first:border-t-0">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

function RangeLine({ r, label }: { r: ResolvedRange; label?: string }) {
  const pop = populationText(r.population);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        {label ? <span className="text-muted-foreground">{label}</span> : null}
        <span className="font-medium tabular-nums text-foreground">{rangeText(r)}</span>
        <LevelBadge level={r.level} />
      </div>
      {pop ? <p className="text-xs text-muted-foreground">适用人群：{pop}</p> : null}
      {r.conditions ? <p className="text-xs text-muted-foreground">条件：{r.conditions}</p> : null}
      <Citation source={r.source} locator={r.locator} />
      <EvidenceQuote text={r.evidenceQuote} />
    </div>
  );
}

function ThresholdLine({ t, secondary }: { t: ThresholdHit; secondary?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 ${secondary ? "opacity-80" : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">{secondary ? "另一标准" : "按"}{t.name_zh}：</span>
        <span className="font-medium text-foreground">{t.label_zh}</span>
        <LevelBadge level={t.level} />
      </div>
      {!secondary ? (
        <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {t.scale.map((c) => (
            <li key={c.label_zh} className={c.label_zh === t.label_zh ? "font-medium text-foreground" : undefined}>
              {c.label_zh} {scaleText(c, t.unit)}
            </li>
          ))}
        </ul>
      ) : null}
      {t.note_zh ? <p className="text-xs text-muted-foreground">{t.note_zh}</p> : null}
      <Citation source={t.source} locator={t.locator} />
      {!secondary ? <EvidenceQuote text={t.evidenceQuote} /> : null}
    </div>
  );
}

const BASIS_TITLE: Record<Provenance["basis"], string> = {
  report: "按报告单判断",
  standard: "按标准参考范围判断",
  legacy: "按内置范围判断（未核实）",
  none: "无法按范围判断",
};

// ------------------------------------------------------------------ details

export function ProvenanceDetails({ p, heading }: { p: Provenance; heading?: string }) {
  const std = p.standard;
  return (
    <div className="flex max-h-[min(70vh,32rem)] flex-col overflow-y-auto text-sm">
      <Section title={heading ?? "这个结果是怎么判断的"}>
        <p className="font-medium text-foreground">
          {BASIS_TITLE[p.basis]}
          {p.flag ? `：${VERDICT_ZH[p.flag] ?? p.flag}` : ""}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">{p.reason_zh}</p>
        {p.usedRange ? <RangeLine r={p.usedRange} label="用到的范围" /> : null}
      </Section>

      {p.disagreement ? (
        <Section title="报告单与标准判定不同">
          <p className="rounded-md bg-warning-bg px-2 py-1.5 text-xs leading-relaxed text-warning-fg">
            报告单判定为“{VERDICT_ZH[p.labVerdict ?? ""] ?? "—"}”，按标准参考范围则是“{VERDICT_ZH[p.standardVerdict ?? ""] ?? "—"}”。
            不同医院的检测方法和试剂不同，以报告单为准；如果担心，可以带着报告问医生。
          </p>
        </Section>
      ) : null}

      {p.reportRange && p.usedRange?.id !== "report" ? (
        <Section title="报告单参考范围">
          <RangeLine r={p.reportRange} />
        </Section>
      ) : null}

      <Section title="标准参考范围">
        {std?.primary ? (
          <>
            <RangeLine r={std.primary} />
            {std.conflict ? (
              <div className="flex flex-col gap-1 rounded-md bg-muted px-2 py-1.5">
                <p className="text-xs leading-relaxed text-foreground">{std.conflict.note_zh}</p>
                <RangeLine r={std.conflict.international} label="国际标准" />
              </div>
            ) : null}
            {std.alternatives
              .filter((a) => a.id !== std.conflict?.international.id)
              .map((a) => (
                <RangeLine key={a.id} r={a} label="其他来源" />
              ))}
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">暂无已核实的国家标准或国际标准范围。</p>
            {std?.legacy ? <RangeLine r={std.legacy} label="本应用内置" /> : null}
          </>
        )}
      </Section>

      {p.thresholds.primary || p.thresholds.alternatives.length || p.thresholds.targets.length ? (
        <Section title="判定标准（如肥胖、高血压分级）">
          {p.thresholds.primary ? <ThresholdLine t={p.thresholds.primary} /> : null}
          {p.thresholds.alternatives.map((t) => (
            <ThresholdLine key={t.thresholdId} t={t} secondary />
          ))}
          {p.thresholds.targets.map((t) => (
            <ThresholdLine key={t.thresholdId} t={t} secondary />
          ))}
        </Section>
      ) : null}

      {p.loinc ? (
        <Section title="国际通用编码（LOINC）">
          <p className="text-xs text-foreground">
            {p.loinc.code} · {p.loinc.zhName ?? p.loinc.longName}
          </p>
          {p.loincAttribution ? <p className="text-[11px] leading-snug text-muted-foreground">{p.loincAttribution}</p> : null}
        </Section>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ trigger

/**
 * Wraps a number (value / range / flag) in a button that shows its provenance.
 * Hover opens after a short delay (mouse only); a click pins it open; touch
 * taps toggle; Enter/Space from the keyboard open it and Esc closes.
 */
export function ProvenancePopover({
  provenance,
  children,
  label,
  heading,
  className = "",
}: {
  provenance: Provenance | null | undefined;
  children: ReactNode;
  label: string;
  heading?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const via = useRef<"hover" | "click" | null>(null);
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      window.clearTimeout(openTimer.current);
      window.clearTimeout(closeTimer.current);
    },
    [],
  );
  if (!provenance) return <>{children}</>;

  const cancel = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  };
  const scheduleClose = () => {
    if (via.current !== "hover") return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (!o) via.current = null;
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={`relative z-10 inline-flex items-center gap-1 rounded-sm text-left underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
          onPointerEnter={(e) => {
            if (e.pointerType !== "mouse") return;
            cancel();
            if (!open) {
              openTimer.current = window.setTimeout(() => {
                via.current = "hover";
                setOpen(true);
              }, 150);
            }
          }}
          onPointerLeave={(e) => {
            if (e.pointerType !== "mouse") return;
            window.clearTimeout(openTimer.current);
            scheduleClose();
          }}
          onClick={(e) => {
            // Rows around the value may navigate or jump the page viewer; keep the click here.
            e.stopPropagation();
            if (open && via.current === "hover") {
              // Hovered open, then clicked: pin it instead of toggling closed.
              e.preventDefault();
              via.current = "click";
              return;
            }
            via.current = "click";
          }}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[22rem] max-w-[calc(100vw-2rem)] gap-0 p-0"
        align="start"
        onPointerEnter={(e) => e.pointerType === "mouse" && cancel()}
        onPointerLeave={(e) => e.pointerType === "mouse" && scheduleClose()}
        // Hover-opened popovers must not steal focus; keyboard/tap ones move focus in for links.
        onOpenAutoFocus={(e) => {
          if (via.current === "hover") e.preventDefault();
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label="数值来源"
      >
        <ProvenanceDetails p={provenance} heading={heading} />
      </PopoverContent>
    </Popover>
  );
}

/** Small marker next to a flag when the lab's verdict and the standard's differ. */
export function DisagreementMark({ provenance }: { provenance: Provenance | null | undefined }) {
  if (!provenance?.disagreement) return null;
  return (
    <span role="img" aria-label="报告单与标准判定不同" title="报告单与标准判定不同" className="text-xs text-warning-fg">
      ◐
    </span>
  );
}

/** One-line summary of the basis, for chart tooltips. */
export function BasisLine({ p }: { p: Provenance | null | undefined }) {
  if (!p) return null;
  const level: SourceLevel | null = p.basis === "report" ? "report" : p.usedRange?.level ?? null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      判断依据：{level ? <LevelBadge level={level} /> : "无"}
      {p.disagreement ? <DisagreementMark provenance={p} /> : null}
    </span>
  );
}

export function flagForDisplay(flag: Flag | null | undefined): string {
  return flag ? VERDICT_ZH[flag] ?? flag : "—";
}
