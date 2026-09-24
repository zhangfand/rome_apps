import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dateToTs, flagVariant, formatNumber, formatRange, todayIso, tsToIso } from "../lib/format";
import { useThemeColors, type ThemeColors } from "../lib/theme";
import type { Flag, NumericRange, SeriesPoint } from "../lib/types";

function isConcerningFlag(flag: Flag | null | undefined, direction?: string | null) {
  return flagVariant(flag, direction) === "destructive";
}

// ------------------------------------------------------------------ sparkline

export function Sparkline({
  series,
  direction,
  width = 104,
  height = 30,
}: {
  series: Array<{ date: string; value: number; flag: Flag | null; source: string }>;
  direction?: string | null;
  width?: number;
  height?: number;
}) {
  const c = useThemeColors();
  const data = useMemo(() => series.map((p) => ({ t: dateToTs(p.date), v: p.value, flag: p.flag })), [series]);
  if (data.length < 2) return <span className="inline-block text-xs text-muted-foreground" style={{ width }}>{data.length === 1 ? "仅 1 次" : ""}</span>;
  return (
    <LineChart width={width} height={height} data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }} aria-hidden="true">
      <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} hide />
      <YAxis type="number" domain={["dataMin", "dataMax"]} hide />
      <Line
        type="monotone"
        dataKey="v"
        stroke={c.muted}
        strokeWidth={1.5}
        isAnimationActive={false}
        dot={(props: { cx?: number; cy?: number; index?: number; payload?: { flag: Flag | null } }) => {
          const bad = isConcerningFlag(props.payload?.flag, direction);
          const last = props.index === data.length - 1;
          if (!bad && !last) return <g key={props.index} />;
          return <circle key={props.index} cx={props.cx} cy={props.cy} r={2.5} fill={bad ? c.destructive : c.primary} stroke="none" />;
        }}
      />
    </LineChart>
  );
}

// ------------------------------------------------------------------ trend chart

interface Span {
  id: string;
  title: string;
  category: string;
  x1: number;
  x2: number;
  lane: number;
  ongoing: boolean;
}

function assignLanes(spans: Omit<Span, "lane">[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.x1 - b.x1);
  const laneEnds: number[] = [];
  return sorted.map((s) => {
    let lane = laneEnds.findIndex((end) => end < s.x1);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(s.x2);
    } else laneEnds[lane] = s.x2;
    return { ...s, lane };
  });
}

function formatAxisDate(ts: number): string {
  const iso = tsToIso(ts);
  return iso.slice(0, 7);
}

interface ChartPoint {
  t: number;
  value: number;
  point: SeriesPoint;
}

function TooltipBox({ active, payload, unit, colors }: { active?: boolean; payload?: Array<{ payload: ChartPoint }>; unit: string; colors: ThemeColors }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload.point;
  const source = p.source === "measurement" ? "聊天/自测记录" : p.source === "derived" ? "计算值" : `体检报告${p.provider ? ` · ${p.provider}` : ""}${p.page ? ` · 第 ${p.page} 页` : ""}`;
  return (
    <div className="rounded-md border px-3 py-2 text-sm shadow-sm" style={{ background: colors.surface, borderColor: colors.border, color: colors.foreground }}>
      <div className="font-medium">{p.date}</div>
      <div className="tabular-nums">
        {formatNumber(p.value)} {unit}
      </div>
      <div style={{ color: colors.muted }}>{source}</div>
      {p.note ? <div style={{ color: colors.muted }}>{p.note}</div> : null}
    </div>
  );
}

export function TrendChart({
  points,
  band,
  interventions,
  unit,
  direction,
  height = 320,
}: {
  points: SeriesPoint[];
  band: NumericRange | null;
  interventions: Array<{ id: string; title: string; category: string; startDate: string; endDate: string | null }>;
  unit: string;
  direction?: string | null;
  height?: number;
}) {
  const c = useThemeColors();
  const model = useMemo(() => {
    const numeric = points.filter((p): p is SeriesPoint & { value: number } => p.value != null);
    const reports: ChartPoint[] = numeric.filter((p) => p.source !== "measurement").map((p) => ({ t: dateToTs(p.date), value: p.value, point: p }));
    const measures: ChartPoint[] = numeric.filter((p) => p.source === "measurement").map((p) => ({ t: dateToTs(p.date), value: p.value, point: p }));
    const all = [...reports, ...measures];
    if (all.length === 0) return null;
    const today = dateToTs(todayIso());
    const ts = all.map((p) => p.t);
    const firstT = Math.min(...ts);
    const hasOngoing = interventions.some((iv) => !iv.endDate);
    const lastT = Math.max(...ts, hasOngoing ? today : 0);
    const spanMs = Math.max(lastT - firstT, 30 * 86_400_000);
    const pad = spanMs * 0.04;
    const xMin = firstT - pad;
    const xMax = lastT + pad;

    const values = all.map((p) => p.value);
    let yMin = Math.min(...values, band?.low ?? Infinity);
    let yMax = Math.max(...values, band?.high ?? -Infinity);
    const ypad = Math.max((yMax - yMin) * 0.15, Math.abs(yMax) * 0.05, 0.1);
    yMin = yMin - ypad;
    yMax = yMax + ypad;
    if (Math.min(...values) >= 0 && yMin < 0) yMin = 0;

    const spans = assignLanes(
      interventions
        .map((iv) => {
          const x1 = Math.max(dateToTs(iv.startDate), xMin);
          const x2 = Math.min(iv.endDate ? dateToTs(iv.endDate) : today, xMax);
          return { id: iv.id, title: iv.title, category: iv.category, x1, x2, ongoing: !iv.endDate };
        })
        .filter((s) => s.x2 > s.x1),
    );
    return { reports, measures, xMin, xMax, yMin, yMax, spans };
  }, [points, band, interventions]);

  if (!model) return <p className="py-10 text-center text-sm text-muted-foreground">还没有可以绘制的数值数据。</p>;

  const lanes = Math.max(0, ...model.spans.map((s) => s.lane + 1));
  const bandY1 = band?.low ?? model.yMin;
  const bandY2 = band?.high ?? model.yMax;

  return (
    <div className="w-full">
      <div style={{ height: height + lanes * 14 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 8 + lanes * 14, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[model.xMin, model.xMax]}
              tickFormatter={formatAxisDate}
              stroke={c.border}
              tick={{ fill: c.muted, fontSize: 12 }}
              tickMargin={6}
              minTickGap={24}
            />
            <YAxis
              type="number"
              domain={[model.yMin, model.yMax]}
              tickFormatter={(v: number) => formatNumber(v, 2)}
              stroke={c.border}
              tick={{ fill: c.muted, fontSize: 12 }}
              width={48}
              allowDataOverflow
            />
            {band && (band.low != null || band.high != null) ? (
              <ReferenceArea y1={bandY1} y2={bandY2} fill={c.success} fillOpacity={0.1} stroke="none" ifOverflow="hidden" />
            ) : null}
            {model.spans.map((s) => (
              <ReferenceArea
                key={s.id}
                x1={s.x1}
                x2={s.x2}
                fill={c.info}
                fillOpacity={0.1}
                stroke={c.info}
                strokeOpacity={0.35}
                ifOverflow="hidden"
                label={(props: { viewBox?: { x?: number; y?: number; width?: number } }) => {
                  const vb = props.viewBox ?? {};
                  const x = (vb.x ?? 0) + 4;
                  const y = (vb.y ?? 0) - lanes * 14 + s.lane * 14 + 2;
                  const maxChars = Math.max(2, Math.floor(((vb.width ?? 60) + 120) / 12));
                  const text = s.title.length > maxChars ? `${s.title.slice(0, maxChars - 1)}…` : s.title;
                  return (
                    <text x={x} y={y} dy={10} fontSize={11} fill={c.muted}>
                      {s.ongoing ? `${text}（进行中）` : text}
                    </text>
                  );
                }}
              />
            ))}
            <Tooltip content={<TooltipBox unit={unit} colors={c} />} cursor={{ stroke: c.border }} />
            <Line
              data={model.reports}
              dataKey="value"
              type="linear"
              stroke={c.primary}
              strokeWidth={2}
              isAnimationActive={false}
              name="体检结果"
              dot={(props: { cx?: number; cy?: number; index?: number; payload?: ChartPoint }) => {
                const bad = isConcerningFlag(props.payload?.point.flag, direction);
                return (
                  <circle
                    key={`r-${props.index}`}
                    cx={props.cx}
                    cy={props.cy}
                    r={bad ? 5 : 4}
                    fill={bad ? c.destructive : c.surface}
                    stroke={bad ? c.destructive : c.primary}
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 6, fill: c.primary, stroke: c.surface }}
            />
            {model.measures.length ? (
              <Scatter
                data={model.measures}
                dataKey="value"
                name="自测记录"
                isAnimationActive={false}
                shape={(props: { cx?: number; cy?: number; payload?: ChartPoint }) => {
                  const cx = props.cx ?? 0;
                  const cy = props.cy ?? 0;
                  const bad = isConcerningFlag(props.payload?.point.flag, direction);
                  const r = 5;
                  return (
                    <path
                      d={`M${cx},${cy - r} L${cx + r},${cy} L${cx},${cy + r} L${cx - r},${cy} Z`}
                      fill={bad ? c.destructive : c.warning}
                      fillOpacity={0.85}
                      stroke={c.surface}
                      strokeWidth={1}
                    />
                  );
                }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend colors={c} hasMeasures={model.measures.length > 0} hasBand={!!band && (band.low != null || band.high != null)} band={band} hasSpans={model.spans.length > 0} unit={unit} />
    </div>
  );
}

function ChartLegend({ colors: c, hasMeasures, hasBand, band, hasSpans, unit }: { colors: ThemeColors; hasMeasures: boolean; hasBand: boolean; band: NumericRange | null; hasSpans: boolean; unit: string }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="图例">
      <li className="flex items-center gap-1.5">
        <svg width="14" height="10" aria-hidden="true">
          <line x1="0" y1="5" x2="14" y2="5" stroke={c.primary} strokeWidth="2" />
          <circle cx="7" cy="5" r="3" fill={c.surface} stroke={c.primary} strokeWidth="2" />
        </svg>
        体检结果
      </li>
      <li className="flex items-center gap-1.5">
        <svg width="10" height="10" aria-hidden="true">
          <circle cx="5" cy="5" r="4" fill={c.destructive} />
        </svg>
        异常值
      </li>
      {hasMeasures ? (
        <li className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden="true">
            <path d="M5,0 L10,5 L5,10 L0,5 Z" fill={c.warning} />
          </svg>
          聊天/自测记录
        </li>
      ) : null}
      {hasBand ? (
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-3.5 rounded-sm" style={{ background: c.success, opacity: 0.25 }} />
          参考范围 {formatRange(band)} {unit}
        </li>
      ) : null}
      {hasSpans ? (
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-3.5 rounded-sm" style={{ background: c.info, opacity: 0.3 }} />
          干预时段
        </li>
      ) : null}
    </ul>
  );
}
