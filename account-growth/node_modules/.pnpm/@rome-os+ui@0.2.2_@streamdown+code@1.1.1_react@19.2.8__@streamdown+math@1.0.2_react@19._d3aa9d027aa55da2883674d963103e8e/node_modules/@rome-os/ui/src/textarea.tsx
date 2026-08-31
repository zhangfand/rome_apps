import * as React from "react";

import { cn } from "./cn.js";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Multi-line, so no explicit height — this is the one control that pads
        // vertically, and it takes the spacing step directly since no other
        // control has a vertical inset to agree with. Horizontal padding comes
        // from the field scale so a Textarea and an Input align on their edges.
        // Body remains 16px at every breakpoint and avoids iOS focus zoom.
        "flex field-sizing-content min-h-16 w-full rounded-[var(--control-r-md)] border border-input bg-transparent px-[var(--control-px-start-md)] py-2 text-body transition-colors outline-none placeholder:text-muted-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:outline-solid aria-invalid:outline-2 aria-invalid:outline-offset-0 aria-invalid:outline-destructive dark:bg-input/30 dark:disabled:bg-input/80",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
