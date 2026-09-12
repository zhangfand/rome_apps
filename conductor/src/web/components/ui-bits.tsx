import type { ComponentProps } from "react";
import { Button } from "@rome-os/ui/button";
import { cn } from "@rome-os/ui/cn";

// The design's action-button metrics, pinned in one place. The kit `Button`
// defaults to the `md` control step (height 36, text 14/400, padding 12,
// radius 10); the redesign wants 34 / 13 / 600 / 14 / 8. `cn` (tailwind-merge)
// drops the kit's `--control-*` classes in favour of these, so routing every
// action button through `ActionButton` — or applying `actionButtonClass` to a
// kit `Button` — yields the exact prototype control without repeating the
// numbers at each call site. Variant and colour classes still ride on top.
export const actionButtonClass = "h-[34px] rounded-8 px-[14px] text-[13px] font-semibold";

export function ActionButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button className={cn(actionButtonClass, className)} {...props} />;
}

// The segmented control (Tasks filter, detail history switch) is a kit
// component whose segment classes are internal — only the track takes a
// `className`. These constants reach the segments through a descendant-variant
// so the whole switcher matches the prototype: a `--surface-muted` track with a
// 9px radius and 2px padding, and segments at 7px radius, 0/10 padding, 600
// weight. The two views differ only in segment size (26px/13px filter vs
// 24px/11.5px switch), so each keeps its own literal (Tailwind's JIT needs the
// arbitrary values spelled out, not composed).
const segmentedTrack =
  "h-auto rounded-[9px] border border-border bg-surface-muted p-0.5 " +
  "[&_[data-slot=segmented-control-item]]:rounded-[7px] " +
  "[&_[data-slot=segmented-control-item]]:px-[10px] " +
  "[&_[data-slot=segmented-control-item]]:font-semibold";

export const filterSegmentClass = cn(
  segmentedTrack,
  "[&_[data-slot=segmented-control-item]]:h-[26px] [&_[data-slot=segmented-control-item]]:text-[13px]",
);

export const viewSegmentClass = cn(
  segmentedTrack,
  "[&_[data-slot=segmented-control-item]]:h-[24px] [&_[data-slot=segmented-control-item]]:text-[11.5px]",
);
