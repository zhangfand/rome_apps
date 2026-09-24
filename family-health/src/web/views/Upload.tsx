import { useEffect, useRef, useState, type DragEvent } from "react";
import { CheckCircle2, FileUp, ImageIcon, FileText, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@rome-os/ui/alert";
import { Button } from "@rome-os/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@rome-os/ui/field";
import { IconButton } from "@rome-os/ui/icon-button";
import { Input } from "@rome-os/ui/input";
import { PageDescription, PageHeader, PageHeading, PageTitle } from "@rome-os/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rome-os/ui/select";
import { Spinner } from "@rome-os/ui/spinner";
import { Empty, ErrorState, LoadingRows } from "../components/common";
import { ApiError, apiSend, apiUpload, errorMessage } from "../lib/api";
import { formatBytes } from "../lib/format";
import { useApi } from "../lib/hooks";
import { useMeta } from "../lib/meta";
import { Link, go, paths } from "../lib/router";
import type { Member, Report } from "../lib/types";

type FileState = "pending" | "uploading" | "done" | "error";

interface Item {
  id: string;
  file: File;
  state: FileState;
  pages?: number;
  error?: string;
}

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp";
const OK_EXT = /\.(pdf|jpe?g|png|heic|heif|webp)$/i;

export function UploadView({ memberId }: { memberId: string | null }) {
  const meta = useMeta();
  const members = useApi<{ members: Member[] }>("members");
  const [member, setMember] = useState<string>(memberId ?? "");
  const [examDate, setExamDate] = useState("");
  const [provider, setProvider] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const maxBytes = meta?.maxUploadBytes ?? 60 * 1024 * 1024;

  useEffect(() => {
    if (!member && members.data?.members.length) setMember(memberId ?? members.data.members[0].id);
  }, [members.data, member, memberId]);

  function addFiles(list: FileList | File[]) {
    const next: Item[] = [];
    for (const file of Array.from(list)) {
      let error: string | undefined;
      if (!OK_EXT.test(file.name)) error = "不支持的文件类型，请上传 PDF、JPG、PNG 或 HEIC";
      else if (file.size > maxBytes) error = `文件过大（${formatBytes(file.size)}），单个文件请不超过 ${formatBytes(maxBytes)}，可拆分 PDF 或分批拍照上传`;
      next.push({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`, file, state: error ? "error" : "pending", error });
    }
    setItems((cur) => [...cur, ...next]);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  function patch(id: string, p: Partial<Item>) {
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }

  async function start(reportIdForExtract: string) {
    try {
      await apiSend("POST", `reports/${reportIdForExtract}/extract`);
      go(paths.report(reportIdForExtract));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function upload() {
    if (!member) {
      toast.error("请先选择成员");
      return;
    }
    const queue = items.filter((it) => it.state === "pending" || (it.state === "error" && it.error?.startsWith("上传失败")));
    if (!queue.length) {
      toast.error("请先选择要上传的文件");
      return;
    }
    setRunning(true);
    try {
      let rep: Report;
      if (report) rep = report;
      else {
        const created = await apiSend<{ report: Report }>("POST", "reports", { memberId: member, examDate: examDate || null, provider: provider || null });
        rep = created.report;
        setReport(rep);
      }
      let ok = items.filter((it) => it.state === "done").length;
      for (const it of queue) {
        patch(it.id, { state: "uploading", error: undefined });
        try {
          const res: { report: Report; added: number } = await apiUpload<{ report: Report; added: number }>(rep.id, it.file);
          patch(it.id, { state: "done", pages: res.added });
          rep = res.report;
          ok++;
        } catch (err) {
          const msg = err instanceof ApiError ? err.message : `上传失败：${errorMessage(err)}`;
          patch(it.id, { state: "error", error: msg.startsWith("上传失败") ? msg : `上传失败：${msg}` });
        }
      }
      setReport(rep);
      const failed = queue.length - (ok - items.filter((it) => it.state === "done").length);
      if (ok > 0 && failed === 0) {
        toast.success("上传完成，开始识别");
        await start(rep.id);
      } else if (ok === 0) {
        toast.error("没有文件上传成功");
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRunning(false);
    }
  }

  if (members.error) return <ErrorState message={members.error} onRetry={() => void members.reload()} />;
  if (members.loading && !members.data) return <LoadingRows rows={3} />;
  if (members.data && members.data.members.length === 0) {
    return (
      <Empty title="请先添加家庭成员" description="报告需要归属到某位家庭成员。">
        <Button asChild>
          <Link to={paths.overview()}>去添加成员</Link>
        </Button>
      </Empty>
    );
  }

  const done = items.filter((i) => i.state === "done").length;
  const hasFailed = items.some((i) => i.state === "error");
  return (
    <>
      <PageHeader>
        <PageHeading>
          <PageTitle>上传体检报告</PageTitle>
          <PageDescription>支持 PDF 和手机拍照（JPG、PNG、HEIC）。文件只保存在这台电脑上。</PageDescription>
        </PageHeading>
      </PageHeader>

      <FieldGroup className="max-w-2xl">
        <Field>
          <FieldLabel htmlFor="up-member">成员</FieldLabel>
          <Select value={member} onValueChange={setMember} disabled={!!report}>
            <SelectTrigger id="up-member" aria-label="成员">
              <SelectValue placeholder="选择成员" />
            </SelectTrigger>
            <SelectContent>
              {(members.data?.members ?? []).map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}（{m.relation}）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="up-date">体检日期（可选）</FieldLabel>
            <Input id="up-date" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} disabled={!!report} />
          </Field>
          <Field>
            <FieldLabel htmlFor="up-provider">体检机构（可选）</FieldLabel>
            <Input id="up-provider" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="如 美年大健康" disabled={!!report} />
          </Field>
        </div>
        <FieldDescription>日期和机构不填也可以，AI 会尝试从报告中识别，审核时还能修改。</FieldDescription>

        <div
          role="button"
          tabIndex={0}
          aria-label="选择或拖入报告文件"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center transition-colors ${
            dragging ? "border-primary bg-accent" : "border-border hover:bg-accent"
          }`}
        >
          <FileUp className="size-6 text-muted-foreground" />
          <p className="text-foreground">点击选择文件，或把文件拖到这里</p>
          <p className="text-sm text-muted-foreground">可多选；同一次体检的多个文件会合并为一份报告</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {items.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border" aria-label="待上传文件">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 px-3 py-2">
                {/\.pdf$/i.test(it.file.name) ? <FileText className="size-4 shrink-0 text-muted-foreground" /> : <ImageIcon className="size-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{it.file.name}</p>
                  <p className={`text-xs ${it.state === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                    {formatBytes(it.file.size)} ·{" "}
                    {it.state === "pending"
                      ? "等待上传"
                      : it.state === "uploading"
                        ? "上传并转换页面中…"
                        : it.state === "done"
                          ? `完成，${it.pages ?? 0} 页`
                          : it.error}
                  </p>
                </div>
                {it.state === "uploading" ? <Spinner size="sm" label="上传中" /> : null}
                {it.state === "done" ? <CheckCircle2 className="size-4 text-success" aria-label="完成" /> : null}
                {it.state === "error" ? <XCircle className="size-4 text-destructive" aria-label="失败" /> : null}
                {it.state === "pending" || (it.state === "error" && !running) ? (
                  <IconButton label={`移除 ${it.file.name}`} icon={<XCircle />} size="sm" onClick={() => setItems((cur) => cur.filter((x) => x.id !== it.id))} />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {report && hasFailed && done > 0 && !running ? (
          <Alert variant="warning">
            <AlertDescription>部分文件上传失败。可以移除失败的文件后直接开始识别，或重新选择文件上传。</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void upload()} disabled={running || !items.some((i) => i.state === "pending" || i.error?.startsWith("上传失败"))}>
            {running ? <Spinner size="sm" /> : null}
            {running ? `上传中（${done}/${items.filter((i) => i.state !== "error" || i.error?.startsWith("上传失败")).length}）` : "上传并开始识别"}
          </Button>
          {report && done > 0 && !running ? (
            <Button variant="outline" onClick={() => void start(report.id)}>
              开始识别（已上传 {done} 个文件）
            </Button>
          ) : null}
        </div>
      </FieldGroup>
    </>
  );
}
