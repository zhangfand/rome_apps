import { useEffect, useState } from "react";
import { MessageSquareText, Pencil, Plus, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@rome-os/ui/alert";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { FilterChipGroup } from "@rome-os/ui/filter-chip-group";
import { IconButton } from "@rome-os/ui/icon-button";
import { List, ListRow, ListRowContent, ListRowDescription, ListRowTitle } from "@rome-os/ui/list-row";
import { PageActions, PageDescription, PageHeader, PageHeading, PageTitle, Section, SectionHeader, SectionHeading, SectionTitle } from "@rome-os/ui/page";
import { ConfirmDialog, Empty, ErrorState, LoadingRows } from "../components/common";
import { InterventionDialog } from "../components/dialogs";
import { apiSend, errorMessage } from "../lib/api";
import { CREATED_VIA_LABEL, todayIso } from "../lib/format";
import { useApi } from "../lib/hooks";
import { useMeta } from "../lib/meta";
import { Link, go, paths } from "../lib/router";
import type { Intervention, Member } from "../lib/types";

function Row({ iv, onEdit, onEnd, onDelete }: { iv: Intervention; onEdit: () => void; onEnd?: () => void; onDelete: () => void }) {
  return (
    <ListRow size="md">
      <ListRowContent>
        <ListRowTitle className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{iv.category}</Badge>
          <span className="text-foreground">{iv.title}</span>
          <Badge variant="outline">{CREATED_VIA_LABEL[iv.createdVia] ?? iv.createdVia}</Badge>
        </ListRowTitle>
        <ListRowDescription>
          {iv.startDate} ~ {iv.endDate ?? "至今"}
          {iv.description ? ` · ${iv.description}` : ""}
        </ListRowDescription>
      </ListRowContent>
      <div className="flex shrink-0 items-center gap-1">
        {onEnd ? (
          <Button variant="outline" size="sm" onClick={onEnd}>
            <Square /> 结束
          </Button>
        ) : null}
        <IconButton label={`编辑 ${iv.title}`} icon={<Pencil />} size="sm" onClick={onEdit} />
        <IconButton label={`删除 ${iv.title}`} icon={<Trash2 />} size="sm" onClick={onDelete} />
      </div>
    </ListRow>
  );
}

export function InterventionsView({ memberId }: { memberId: string | null }) {
  const meta = useMeta();
  const members = useApi<{ members: Member[] }>("members");
  const selected = memberId ?? members.data?.members[0]?.id ?? null;
  const list = useApi<{ interventions: Intervention[] }>(selected ? `members/${selected}/interventions` : null);
  const [editing, setEditing] = useState<Intervention | null>(null);
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<Intervention | null>(null);

  useEffect(() => {
    if (!memberId && selected) go(paths.interventions(selected), { replace: true });
  }, [memberId, selected]);

  if (members.error) return <ErrorState message={members.error} onRetry={() => void members.reload()} />;
  if (members.loading && !members.data) return <LoadingRows rows={3} />;
  if (members.data && members.data.members.length === 0) {
    return (
      <Empty title="还没有家庭成员" description="先添加成员，再记录饮食、运动、用药等调整。">
        <Button asChild>
          <Link to={paths.overview()}>去添加成员</Link>
        </Button>
      </Empty>
    );
  }
  const member = members.data?.members.find((m) => m.id === selected);
  const today = todayIso();
  const all = list.data?.interventions ?? [];
  const ongoing = all.filter((iv) => !iv.endDate || iv.endDate >= today);
  const ended = all.filter((iv) => iv.endDate && iv.endDate < today);

  async function end(iv: Intervention) {
    try {
      await apiSend("PATCH", `interventions/${iv.id}`, { endDate: today });
      toast.success(`已结束：${iv.title}`);
      await list.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function remove(iv: Intervention) {
    try {
      await apiSend("DELETE", `interventions/${iv.id}`);
      toast.success("已删除");
      await list.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader>
        <PageHeading>
          <PageTitle>干预记录</PageTitle>
          <PageDescription>饮食、运动、用药、睡眠等调整会以时间段显示在指标趋势图上。</PageDescription>
        </PageHeading>
        <PageActions>
          <Button onClick={() => setAdding(true)} disabled={!selected}>
            <Plus /> 添加记录
          </Button>
        </PageActions>
      </PageHeader>

      <Alert variant="info">
        <MessageSquareText />
        <AlertDescription>
          最简单的方式是直接在聊天里告诉助手，例如：“我从上周一开始每天快走 40 分钟”“我爸开始吃阿托伐他汀了”，会自动记到这里。
        </AlertDescription>
      </Alert>

      {members.data && members.data.members.length > 1 ? (
        <div className="overflow-x-auto">
          <FilterChipGroup
            aria-label="选择成员"
            options={members.data.members.map((m) => ({ value: m.id, label: m.name }))}
            value={selected ?? ""}
            onValueChange={(v) => go(paths.interventions(v), { replace: true })}
          />
        </div>
      ) : null}

      {list.error ? <ErrorState message={list.error} onRetry={() => void list.reload()} /> : null}
      {list.loading && !list.data ? <LoadingRows rows={3} /> : null}

      {list.data ? (
        <>
          <Section>
            <SectionHeader>
              <SectionHeading>
                <SectionTitle>进行中（{ongoing.length}）</SectionTitle>
              </SectionHeading>
            </SectionHeader>
            {ongoing.length ? (
              <List className="divide-y divide-border rounded-lg border border-border">
                {ongoing.map((iv) => (
                  <Row key={iv.id} iv={iv} onEdit={() => setEditing(iv)} onEnd={() => void end(iv)} onDelete={() => setToDelete(iv)} />
                ))}
              </List>
            ) : (
              <p className="text-sm text-muted-foreground">{member ? `${member.name}目前没有进行中的调整。` : ""}</p>
            )}
          </Section>
          {ended.length ? (
            <Section>
              <SectionHeader>
                <SectionHeading>
                  <SectionTitle>已结束（{ended.length}）</SectionTitle>
                </SectionHeading>
              </SectionHeader>
              <List className="divide-y divide-border rounded-lg border border-border">
                {ended.map((iv) => (
                  <Row key={iv.id} iv={iv} onEdit={() => setEditing(iv)} onDelete={() => setToDelete(iv)} />
                ))}
              </List>
            </Section>
          ) : null}
        </>
      ) : null}

      {selected ? (
        <InterventionDialog
          open={adding || !!editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          memberId={selected}
          intervention={editing}
          categories={meta?.interventionCategories ?? ["饮食", "运动", "药物", "睡眠", "体重管理", "其他"]}
          onSaved={() => void list.reload()}
        />
      ) : null}
      <ConfirmDialog
        open={!!toDelete}
        title="删除这条干预记录？"
        description={toDelete ? `“${toDelete.title}”将从记录和趋势图中移除。` : ""}
        confirmLabel="删除"
        onConfirm={() => (toDelete ? remove(toDelete) : undefined)}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
