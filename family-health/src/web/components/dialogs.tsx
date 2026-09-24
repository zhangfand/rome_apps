import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@rome-os/ui/button";
import { Checkbox } from "@rome-os/ui/checkbox";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@rome-os/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@rome-os/ui/field";
import { Input } from "@rome-os/ui/input";
import { SegmentedControl } from "@rome-os/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rome-os/ui/select";
import { Spinner } from "@rome-os/ui/spinner";
import { Textarea } from "@rome-os/ui/textarea";
import { apiSend, errorMessage } from "../lib/api";
import type { Intervention, Member, Meta } from "../lib/types";

const RELATIONS = ["本人", "配偶", "父亲", "母亲", "子女", "其他"];

export function MemberDialog({
  open,
  onClose,
  member,
  meta,
  onSaved,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  member?: Member | null;
  meta: Meta | null;
  onSaved: (m: Member) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("本人");
  const [sex, setSex] = useState<"male" | "female" | "none">("none");
  const [birthDate, setBirthDate] = useState("");
  const [height, setHeight] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(member?.name ?? "");
    setRelation(member?.relation ?? "本人");
    setSex(member?.sex ?? "none");
    setBirthDate(member?.birthDate ?? "");
    setHeight(member?.heightCm != null ? String(member.heightCm) : "");
    setGoals(member?.goals ?? []);
    setNotes(member?.notes ?? "");
    setError(null);
  }, [open, member]);

  async function save() {
    if (!name.trim()) {
      setError("请填写姓名");
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      name: name.trim(),
      relation,
      sex: sex === "none" ? null : sex,
      birthDate: birthDate || null,
      heightCm: height ? Number(height) : null,
      goals,
      notes,
    };
    try {
      const res = member
        ? await apiSend<{ member: Member }>("PATCH", `members/${member.id}`, body)
        : await apiSend<{ member: Member }>("POST", "members", body);
      toast.success(member ? "已保存成员信息" : `已添加成员：${res.member.name}`);
      onSaved(res.member);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const title = member ? "编辑成员" : "添加成员";
  return (
    <Dialog open={open} onClose={onClose} size="md" ariaLabel={title}>
      <DialogHeader onClose={onClose} closeLabel="关闭">
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="m-name">姓名</FieldLabel>
            <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：张伟" autoComplete="off" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="m-relation">关系</FieldLabel>
              <Select value={relation} onValueChange={setRelation}>
                <SelectTrigger id="m-relation" aria-label="关系">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>性别</FieldLabel>
              <SegmentedControl
                aria-label="性别"
                value={sex}
                onValueChange={(v) => setSex(v)}
                options={[
                  { value: "male", label: "男" },
                  { value: "female", label: "女" },
                  { value: "none", label: "未填" },
                ]}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="m-birth">出生日期</FieldLabel>
              <Input id="m-birth" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="m-height">身高（厘米）</FieldLabel>
              <Input id="m-height" type="number" inputMode="decimal" min={50} max={250} value={height} onChange={(e) => setHeight(e.target.value)} />
            </Field>
          </div>
          <FieldDescription>性别和出生日期用于选择参考范围和计算 eGFR；身高用于计算 BMI。</FieldDescription>
          <Field>
            <FieldLabel>关注目标</FieldLabel>
            <div className="flex flex-col gap-2">
              {(meta?.panels ?? []).map((p) => (
                <label key={p.key} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={goals.includes(p.key)}
                    onCheckedChange={(v) => setGoals((g) => (v ? [...g, p.key] : g.filter((x) => x !== p.key)))}
                    aria-label={p.name}
                  />
                  <span>
                    <span className="font-medium text-foreground">{p.name}</span>
                    <span className="block text-muted-foreground">{p.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="m-notes">备注（不会发送给 AI）</FieldLabel>
            <Textarea id="m-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </FieldGroup>
      </DialogBody>
      <DialogFooter className="flex-wrap">
        {member && onDelete ? (
          <Button variant="ghost" className="mr-auto text-destructive" onClick={onDelete} disabled={busy}>
            删除成员
          </Button>
        ) : null}
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          取消
        </Button>
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? <Spinner size="sm" /> : null}
          保存
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export function InterventionDialog({
  open,
  onClose,
  memberId,
  intervention,
  categories,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  intervention?: Intervention | null;
  categories: string[];
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("运动");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(intervention?.title ?? "");
    setCategory(intervention?.category ?? "运动");
    setDescription(intervention?.description ?? "");
    setStartDate(intervention?.startDate ?? new Date().toISOString().slice(0, 10));
    setEndDate(intervention?.endDate ?? "");
    setError(null);
  }, [open, intervention]);

  async function save() {
    if (!title.trim()) {
      setError("请填写名称");
      return;
    }
    setBusy(true);
    setError(null);
    const body = { title: title.trim(), category, description, startDate, endDate: endDate || null };
    try {
      if (intervention) await apiSend("PATCH", `interventions/${intervention.id}`, body);
      else await apiSend("POST", `members/${memberId}/interventions`, body);
      toast.success(intervention ? "已保存" : "已添加干预记录");
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const heading = intervention ? "编辑干预记录" : "添加干预记录";
  return (
    <Dialog open={open} onClose={onClose} size="md" ariaLabel={heading}>
      <DialogHeader onClose={onClose} closeLabel="关闭">
        <DialogTitle>{heading}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="iv-title">名称</FieldLabel>
            <Input id="iv-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：每周3次快走" autoComplete="off" />
          </Field>
          <Field>
            <FieldLabel htmlFor="iv-cat">类别</FieldLabel>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="iv-cat" aria-label="类别">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="iv-start">开始日期</FieldLabel>
              <Input id="iv-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="iv-end">结束日期（进行中留空）</FieldLabel>
              <Input id="iv-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="iv-desc">说明</FieldLabel>
            <Textarea id="iv-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </FieldGroup>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          取消
        </Button>
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? <Spinner size="sm" /> : null}
          保存
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
