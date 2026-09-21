import { useEffect, useRef, useState, type ReactNode } from "react";
import { Badge } from "@rome-os/ui/badge";
import { Dialog, DialogBody, DialogTitle } from "@rome-os/ui/dialog";
import { IconButton } from "@rome-os/ui/icon-button";
import { ChevronLeft, X } from "lucide-react";
import { safeText } from "../lib/facts";
import { AddProjectBody, ProjectsOverview } from "./configuration";
import { ProjectSettingsBody } from "./project-detail";

export type SettingsView =
  | { view: "overview" }
  | { view: "project"; id: string }
  | { view: "add" };

export function SettingsDialog({ open, initialView, onClose }: {
  open: boolean;
  initialView: SettingsView;
  onClose: () => void;
}) {
  const [stack, setStack] = useState<SettingsView[]>([initialView]);
  const [projectStatus, setProjectStatus] = useState("");
  const [projectHeading, setProjectHeading] = useState<{ isDefault: boolean } | null>(null);
  const wasOpen = useRef(open);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setStack([initialView]);
      setProjectStatus("");
    }
    wasOpen.current = open;
  }, [open, initialView]);

  const active = stack[stack.length - 1];
  const push = (view: SettingsView) => setStack((s) => [...s, view]);
  const pop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  const replaceTop = (view: SettingsView) => setStack((s) => [...s.slice(0, -1), view]);
  const openProject = (id: string) => { setProjectStatus(""); setProjectHeading(null); push({ view: "project", id }); };


  return (
    <Dialog open={open} onClose={onClose} size="lg">
      {active.view === "overview" && (
        <>
          <SettingsDialogHeader onClose={onClose}>
            <DialogTitle>Settings</DialogTitle>
          </SettingsDialogHeader>
          <DialogBody className="min-h-[60vh]">
            <ProjectsOverview
              onOpenProject={openProject}
              onAddProject={() => push({ view: "add" })}
            />
          </DialogBody>
        </>
      )}

      {active.view === "project" && (
        <>
          <SettingsDialogHeader onBack={pop} status={projectStatus} onClose={onClose}>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {safeText(active.id)}
              {projectHeading?.isDefault && <Badge variant="info">default</Badge>}
            </DialogTitle>
          </SettingsDialogHeader>
          <DialogBody className="min-h-[60vh]">
            <ProjectSettingsBody key={active.id} projectId={active.id} onBack={pop} reportStatus={setProjectStatus} reportHeading={setProjectHeading} />
          </DialogBody>
        </>
      )}

      {active.view === "add" && (
        <>
          <SettingsDialogHeader onBack={pop} onClose={onClose}>
            <DialogTitle>Add project</DialogTitle>
          </SettingsDialogHeader>
          <AddProjectBody onBack={pop} onCreated={(id) => { setProjectStatus(""); replaceTop({ view: "project", id }); }} />
        </>
      )}

    </Dialog>
  );
}

function SettingsDialogHeader({ onBack, status, onClose, children }: {
  onBack?: () => void;
  status?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div data-slot="dialog-header" className="flex items-center gap-3 px-6 pt-6 pb-4">
      {onBack && <IconButton label="Back" size="sm" icon={<ChevronLeft />} onClick={onBack} />}
      <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
      {status && <span className="text-aux text-muted-foreground" aria-live="polite">{status}</span>}
      <IconButton label="Close" size="sm" icon={<X />} onClick={onClose} />
    </div>
  );
}
