import { Badge } from "@rome-os/ui/badge";
import type { InsightItem, ReportInsightContent } from "../lib/types";
import { Disclaimer } from "./common";

const GROUPS: Array<{ key: keyof ReportInsightContent["groups"]; label: string; variant: "destructive" | "warning" | "info" | "muted" }> = [
  { key: "urgent", label: "需尽快就医", variant: "destructive" },
  { key: "recheck", label: "建议复查", variant: "warning" },
  { key: "lifestyle", label: "生活方式关注", variant: "info" },
  { key: "watch", label: "轻微可观察", variant: "muted" },
];

function Item({ item }: { item: InsightItem }) {
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h5 className="font-medium text-foreground">{item.indicator}</h5>
        {item.source === "rule" ? <Badge variant="outline">系统规则</Badge> : null}
      </div>
      <dl className="grid gap-2 text-sm leading-relaxed sm:grid-cols-[7.5rem_1fr]">
        {item.what ? (
          <>
            <dt className="text-muted-foreground">这是什么</dt>
            <dd className="text-foreground">{item.what}</dd>
          </>
        ) : null}
        {item.meaning ? (
          <>
            <dt className="text-muted-foreground">你的数值意味着什么</dt>
            <dd className="text-foreground">{item.meaning}</dd>
          </>
        ) : null}
        {item.next_step ? (
          <>
            <dt className="text-muted-foreground">下一步</dt>
            <dd className="text-foreground">{item.next_step}</dd>
          </>
        ) : null}
      </dl>
    </li>
  );
}

export function ReportInsightView({ content }: { content: ReportInsightContent }) {
  const cmp = content.comparison;
  const hasCmp = cmp.improved.length || cmp.worsened.length || cmp.new_findings.length;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h4 className="mb-1 font-medium text-foreground">总体概况</h4>
        <p className="text-sm leading-relaxed text-foreground">{content.overview || "—"}</p>
      </div>
      {GROUPS.map((g) =>
        content.groups[g.key].length ? (
          <div key={g.key}>
            <h4 className="mb-2 flex items-center gap-2 font-medium text-foreground">
              <Badge variant={g.variant}>{g.label}</Badge>
              <span className="text-sm text-muted-foreground">{content.groups[g.key].length} 项</span>
            </h4>
            <ul className="flex flex-col gap-2">
              {content.groups[g.key].map((it, i) => (
                <Item key={`${g.key}-${i}-${it.indicator}`} item={it} />
              ))}
            </ul>
          </div>
        ) : null,
      )}
      {hasCmp ? (
        <div>
          <h4 className="mb-2 font-medium text-foreground">与往年对比</h4>
          <dl className="grid gap-2 text-sm sm:grid-cols-[5rem_1fr]">
            {cmp.improved.length ? (
              <>
                <dt className="text-success">好转</dt>
                <dd className="text-foreground">{cmp.improved.join("；")}</dd>
              </>
            ) : null}
            {cmp.worsened.length ? (
              <>
                <dt className="text-destructive">变差</dt>
                <dd className="text-foreground">{cmp.worsened.join("；")}</dd>
              </>
            ) : null}
            {cmp.new_findings.length ? (
              <>
                <dt className="text-warning-fg">新出现</dt>
                <dd className="text-foreground">{cmp.new_findings.join("；")}</dd>
              </>
            ) : null}
          </dl>
        </div>
      ) : null}
      {content.lifestyle_advice.length ? (
        <div>
          <h4 className="mb-2 font-medium text-foreground">生活方式建议</h4>
          <ul className="list-disc pl-5 text-sm leading-relaxed text-foreground">
            {content.lifestyle_advice.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <Disclaimer />
    </div>
  );
}
