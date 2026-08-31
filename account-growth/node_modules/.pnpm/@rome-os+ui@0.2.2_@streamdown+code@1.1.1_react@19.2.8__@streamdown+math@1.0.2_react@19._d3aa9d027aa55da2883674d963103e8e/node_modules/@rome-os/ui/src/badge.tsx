import { forwardRef, type HTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "./cn.js";

type BadgeVariant =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "brand"
  | "destructive"
  | "muted"
  | "outline";

type BadgeShape = "pill" | "square";

// `HTMLElement` rather than `HTMLSpanElement`: under `asChild` the rendered
// node is whatever the caller passes (an `<a>` for a badge that navigates), so
// a span-typed ref would be a lie at every such call site.
export interface BadgeProps extends HTMLAttributes<HTMLElement> {
  variant?: BadgeVariant;
  shape?: BadgeShape;
  asChild?: boolean;
}

// Paint only — the box belongs to the base class string, so a variant can never
// move the badge relative to its neighbours. `outline` gets its border from the
// base's border slot by naming a color; it declares no background, so the
// surface behind it shows through.
const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-muted text-foreground",
  info: "bg-info-bg text-info-fg",
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  brand: "bg-brand/15 text-brand",
  destructive: "bg-destructive-bg text-destructive-fg",
  muted: "bg-surface-muted text-muted-foreground",
  outline: "border-border text-foreground",
};

const shapeClasses: Record<BadgeShape, string> = {
  pill: "rounded-full",
  square: "rounded-8",
};

export const Badge = forwardRef<HTMLElement, BadgeProps>(function Badge(
  { variant = "default", shape = "pill", asChild = false, className, ...rest },
  ref,
) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      ref={ref}
      className={cn(
        // Chips sit below the control scale — they label, they don't take input
        // — but they still size from tokens so a badge next to a small Button
        // doesn't drift. Explicit height, horizontal padding only.
        //
        // Every badge carries the border, transparent unless a variant paints
        // it: the box has to be the same width whether or not the border is
        // visible, and `border-box` sizing keeps the height at `--badge-h`
        // either way. A filled variant's background still paints under the
        // transparent border (default `border-box` clip), so it looks exactly
        // as it did before the slot existed.
        //
        // A glyph inside a badge takes the size below unless the caller writes
        // a `size-*` of their own. That opt-out sits in the selector rather
        // than in `cn` because it has to: the caller's class lands on the
        // `<svg>` while this rule lives on the badge, and tailwind-merge
        // reconciles one element at a time, so it never sees the collision.
        // Only that spelling opts out — `h-4 w-4` leaves the rule matching,
        // and the rule wins on specificity.
        //
        // 12px because a glyph tracks the box rather than the label: Button
        // holds a half-box glyph at its small steps (24→12, 28→14) while its
        // text stays 14px throughout. Half of 22px is not a step, so the badge
        // takes the next one up.
        "inline-flex h-[var(--badge-h)] items-center gap-[var(--badge-gap)] border border-transparent px-[var(--badge-px)] text-badge [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
        shapeClasses[shape],
        variantClasses[variant],
        className,
      )}
      {...rest}
    />
  );
});
