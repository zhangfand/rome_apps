import { useId, useRef, useState } from "react";
import { Button } from "@rome-os/ui/button";
import { Textarea } from "@rome-os/ui/textarea";
import { Spinner } from "@rome-os/ui/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@rome-os/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@rome-os/ui/dropdown-menu";
import { ChevronDown, MessageSquare, Send } from "lucide-react";
import { composerShortcut, sendTaskMessage, type SendMode } from "../lib/task-message";

export function TaskComposer({ taskId, closed, onSent }: { taskId: string; closed: boolean; onSent: () => void }) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<SendMode>();
  const [error, setError] = useState<string>();
  const [selectedMode, setSelectedMode] = useState<SendMode>("reply");
  const mode = closed ? "chat" : selectedMode;
  const actionLabel = mode === "reply" ? "Send reply" : "Start chat";
  const shortcut = mode === "reply" ? "Enter" : "Shift+Enter";
  const inFlight = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);

  async function send(mode: SendMode) {
    if (inFlight.current || !draft.trim() || (mode === "reply" && closed)) return;
    inFlight.current = true;
    setPending(mode); setError(undefined);
    try {
      await sendTaskMessage(taskId, draft, mode);
      if (mode === "reply") {
        setDraft(""); onSent();
      }
      // Chat navigation is handled by the SDK. Keep the draft if navigation fails.
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false; setPending(undefined); input.current?.focus();
    }
  }

  return <section aria-label="Message Manager" className="flex flex-col gap-2">
    <label htmlFor={id} className="sr-only">Message Manager</label>
    <div className="relative">
    <Textarea id={id} ref={input} rows={1} value={draft} readOnly={!!pending}
      className={`min-h-0 resize-none overflow-y-auto bg-surface py-2 leading-6${draft.trim() ? " pr-20" : ""}`}
      style={{ minHeight: "calc(1lh + 1rem + 2px)", maxHeight: "calc(6lh + 1rem + 2px)" }}
      placeholder="Message Manager…"
      aria-keyshortcuts="Enter Shift+Enter Alt+Enter"
      onChange={(e) => { setDraft(e.target.value); setError(undefined); }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey
          && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
          e.preventDefault();
          if (inFlight.current) return;
          const target = e.currentTarget;
          const { selectionStart: start, selectionEnd: end } = target;
          setDraft(draft.slice(0, start) + "\n" + draft.slice(end));
          setError(undefined);
          requestAnimationFrame(() => target.setSelectionRange(start + 1, start + 1));
          return;
        }
        const mode = composerShortcut({ ...e, isComposing: e.nativeEvent.isComposing, keyCode: e.nativeEvent.keyCode });
        if (mode) { e.preventDefault(); void send(mode); }
      }} />
    {draft.trim() ? <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
      <TooltipProvider>
        <div className="inline-flex items-center" role="group" aria-label="Send options">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" className="rounded-r-none" aria-label={actionLabel} aria-keyshortcuts={shortcut}
                aria-disabled={!draft.trim() || !!pending} onClick={() => void send(mode)}>
                {pending ? <Spinner className="size-4" /> : mode === "reply" ? <Send className="size-4" aria-hidden /> : <MessageSquare className="size-4" aria-hidden />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{actionLabel}<kbd>{shortcut}</kbd></TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button size="icon-sm" className="rounded-l-none border-l border-primary-foreground/20" aria-label="Choose send mode" disabled={!!pending}>
                    <ChevronDown className="size-3.5" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">Send mode &amp; shortcuts</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="top" align="end" className="min-w-64">
              <DropdownMenuRadioGroup value={mode} onValueChange={(value) => setSelectedMode(value as SendMode)}>
                <DropdownMenuRadioItem value="reply" disabled={closed}>
                  <Send className="size-3.5" aria-hidden />Send reply<DropdownMenuShortcut>Enter</DropdownMenuShortcut>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="chat">
                  <MessageSquare className="size-3.5" aria-hidden />Start chat<DropdownMenuShortcut>Shift+Enter</DropdownMenuShortcut>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <div className="flex items-center gap-4 px-2 py-1 text-aux text-muted-foreground">New line<DropdownMenuShortcut>Alt+Enter</DropdownMenuShortcut></div>
              {closed ? <p className="px-2 py-1 text-aux text-muted-foreground">Task closed — chat only.</p> : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TooltipProvider>
    </div> : null}
    </div>
    {error ? <p role="alert" className="text-ui text-destructive">{error}</p> : null}
  </section>;
}
