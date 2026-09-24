import { useState, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Siren } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@rome-os/ui/alert";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@rome-os/ui/dialog";
import { EmptyState, EmptyStateAction, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "@rome-os/ui/empty-state";
import { Skeleton } from "@rome-os/ui/skeleton";
import { Spinner } from "@rome-os/ui/spinner";
import { FLAG_LABEL, STATUS_LABEL, flagVariant, formatDelta, statusVariant, trendClass } from "../lib/format";
import type { CriticalAlert, Flag, FindingAlert, ReportStatus, Trend } from "../lib/types";

export function FlagBadge({ flag, direction, className }: { flag: Flag | null | undefined; direction?: string | null; className?: string }) {
  if (!flag) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <Badge variant={flagVariant(flag, direction)} className={className}>
      {FLAG_LABEL[flag]}
    </Badge>
  );
}

export function StatusBadge({ status, pagesDone, pagesTotal }: { status: ReportStatus; pagesDone?: number; pagesTotal?: number }) {
  const label = status === "extracting" && pagesTotal ? `${STATUS_LABEL[status]} ${pagesDone ?? 0}/${pagesTotal}` : STATUS_LABEL[status];
  return <Badge variant={statusVariant(status)}>{label}</Badge>;
}

export function DemoBadge() {
  return <Badge variant="outline">演示</Badge>;
}

export function Delta({ delta, trend, unit }: { delta: number | null | undefined; trend: Trend | null | undefined; unit?: string }) {
  if (delta == null) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <span className={`text-sm tabular-nums ${trendClass(trend)}`} title={trend === "better" ? "好转" : trend === "worse" ? "变差" : undefined}>
      {formatDelta(delta)}
      {unit ? <span className="ml-0.5 text-xs">{unit}</span> : null}
    </span>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertTitle>加载失败</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {onRetry ? (
          <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>
            <RefreshCw /> 重试
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="加载中">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function Empty({ icon, title, description, children }: { icon?: ReactNode; title: string; description?: string; children?: ReactNode }) {
  return (
    <EmptyState>
      {icon ? <EmptyStateIcon>{icon}</EmptyStateIcon> : null}
      <EmptyStateTitle>{title}</EmptyStateTitle>
      {description ? <EmptyStateDescription>{description}</EmptyStateDescription> : null}
      {children ? <EmptyStateAction>{children}</EmptyStateAction> : null}
    </EmptyState>
  );
}

/** Confirmation dialog for destructive actions. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认",
  destructive = true,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onClose={onClose} size="sm" ariaLabel={title}>
      <DialogHeader onClose={onClose} closeLabel="关闭">
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <DialogDescription>{description}</DialogDescription>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          取消
        </Button>
        <Button variant={destructive ? "destructive" : "default"} onClick={() => void run()} disabled={busy}>
          {busy ? <Spinner size="sm" /> : null}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

/** Deterministic red flags: urgent → destructive alert, soon → warning alert. */
export function RedFlagBanner({ alerts, findingAlerts = [], compact = false }: { alerts: CriticalAlert[]; findingAlerts?: FindingAlert[]; compact?: boolean }) {
  const urgent = [...alerts.filter((a) => a.level === "urgent").map((a) => a.message), ...findingAlerts.filter((a) => a.level === "urgent").map((a) => a.message)];
  const soon = [...alerts.filter((a) => a.level === "soon").map((a) => a.message), ...findingAlerts.filter((a) => a.level === "soon").map((a) => a.message)];
  if (!urgent.length && !soon.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {urgent.length ? (
        <Alert variant="destructive">
          <Siren />
          <AlertTitle>建议尽快就医</AlertTitle>
          <AlertDescription>
            {compact ? (
              <p>{urgent[0]}{urgent.length > 1 ? ` 等 ${urgent.length} 项` : ""}</p>
            ) : (
              <ul className="list-disc pl-4">
                {urgent.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      ) : null}
      {soon.length && !compact ? (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>建议近期专科就诊</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {soon.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : soon.length && compact ? (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertDescription>建议近期专科就诊：{soon[0]}{soon.length > 1 ? ` 等 ${soon.length} 项` : ""}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function Disclaimer({ className = "" }: { className?: string }) {
  return <p className={`text-sm text-muted-foreground ${className}`}>仅供参考，不能替代医生诊断</p>;
}
