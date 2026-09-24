import { useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@rome-os/ui/button";
import { FilterChipGroup } from "@rome-os/ui/filter-chip-group";
import { IconButton } from "@rome-os/ui/icon-button";
import { PageActions, PageDescription, PageHeader, PageHeading, PageTitle } from "@rome-os/ui/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rome-os/ui/table";
import { ConfirmDialog, DemoBadge, Empty, ErrorState, LoadingRows, StatusBadge } from "../components/common";
import { apiSend, errorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import { useApi, usePolling } from "../lib/hooks";
import { Link, go, paths } from "../lib/router";
import type { Member, Report } from "../lib/types";

export function ReportsView({ memberId }: { memberId: string | null }) {
  const members = useApi<{ members: Member[] }>("members");
  const reports = useApi<{ reports: Report[] }>(memberId ? `reports?memberId=${encodeURIComponent(memberId)}` : "reports");
  const [toDelete, setToDelete] = useState<Report | null>(null);
  const list = reports.data?.reports ?? [];
  const byId = new Map((members.data?.members ?? []).map((m) => [m.id, m]));
  usePolling(list.some((r) => r.status === "extracting"), 4000, () => void reports.reload());

  async function remove(r: Report) {
    try {
      await apiSend("DELETE", `reports/${r.id}`);
      toast.success("已删除报告");
      await reports.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const options = [{ value: "all", label: "全部" }, ...(members.data?.members ?? []).map((m) => ({ value: m.id, label: m.name }))];
  return (
    <>
      <PageHeader>
        <PageHeading>
          <PageTitle>体检报告</PageTitle>
          <PageDescription>上传的报告会先由 AI 识别，审核确认后才会计入趋势。</PageDescription>
        </PageHeading>
        <PageActions>
          <Button asChild>
            <Link to={paths.upload(memberId)}>
              <Upload /> 上传报告
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      {members.data && members.data.members.length > 1 ? (
        <div className="overflow-x-auto">
          <FilterChipGroup aria-label="按成员筛选" options={options} value={memberId ?? "all"} onValueChange={(v) => go(paths.reports(v === "all" ? null : v), { replace: true })} />
        </div>
      ) : null}

      {reports.error ? <ErrorState message={reports.error} onRetry={() => void reports.reload()} /> : null}
      {reports.loading && !reports.data ? <LoadingRows rows={4} /> : null}
      {reports.data && list.length === 0 ? (
        <Empty icon={<FileText />} title="还没有体检报告" description="支持 PDF 和手机拍照（JPG、PNG、HEIC），可以一次选择多个文件。">
          <Button asChild>
            <Link to={paths.upload(memberId)}>上传报告</Link>
          </Button>
        </Empty>
      ) : null}

      {list.length ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>体检日期</TableHead>
                <TableHead>成员</TableHead>
                <TableHead>机构</TableHead>
                <TableHead className="text-right">页数</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    <Link to={paths.report(r.id)} className="underline underline-offset-2">
                      {r.examDate ? formatDate(r.examDate) : "日期待定"}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {byId.get(r.memberId)?.name ?? "—"} {r.isDemo ? <DemoBadge /> : null}
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate">{r.provider || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.pagesTotal || "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} pagesDone={r.pagesDone} pagesTotal={r.pagesTotal} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={paths.report(r.id)}>{r.status === "needs_review" ? "审核" : "查看"}</Link>
                      </Button>
                      <IconButton label="删除报告" icon={<Trash2 />} size="sm" onClick={() => setToDelete(r)} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!toDelete}
        title="删除这份报告？"
        description="报告的上传文件、识别结果和 AI 解读都会被永久删除；已确认的数据会从趋势中移除。"
        confirmLabel="删除"
        onConfirm={() => (toDelete ? remove(toDelete) : undefined)}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
