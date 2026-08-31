import { forwardRef, type SVGAttributes } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "./cn.js";

type SpinnerSize = "xs" | "sm" | "md";

/**
 * The glyph box, not the control box. A spinner sits *inside* a control rather
 * than being one, so the steps match Button's icon slot at the same size —
 * 12px on an `xs` row, 14px on a `--control-h-sm` row, and 16px on a
 * `--control-h-md` row — and a spinner swapped in for a leading icon leaves the
 * button exactly as wide as it was.
 */
const sizeClasses: Record<SpinnerSize, string> = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
};

// `size` shadows lucide's own numeric `size` prop, which this component owns
// instead: the step is the kit's vocabulary, not a pixel count.
export interface SpinnerProps extends Omit<SVGAttributes<SVGSVGElement>, "size" | "children"> {
  size?: SpinnerSize;
  /** The accessible name announced in place of the glyph. */
  label?: string;
}

/**
 * The one loading indicator. No color prop: the glyph strokes in `currentColor`,
 * so it takes the tone of whatever it sits in — a destructive button, a muted
 * empty state — without the caller choosing one.
 *
 * The name is an `aria-label` rather than visually-hidden text, because
 * `role="status"` takes no name from its contents (ARIA forbids it for live
 * regions): a hidden "Loading" span would leave the spinner with no accessible
 * name at all, which is the bug this component exists to fix.
 *
 * There is deliberately no `loading` prop on `Button`. Composition already
 * covers both halves of the affordance: `disabled={busy}` is one attribute the
 * caller was passing anyway, and width stays stable because an `xs`/`sm`/`md`
 * Spinner is exactly as wide as the icon it replaces (`{busy ? <Spinner
 * size="sm" /> : <Check />}`). A prop would buy nothing the caller doesn't
 * already have.
 */
export const Spinner = forwardRef<SVGSVGElement, SpinnerProps>(function Spinner(
  { size = "md", label = "Loading", className, ...rest },
  ref,
) {
  return (
    <LoaderCircle
      ref={ref}
      role="status"
      aria-label={label}
      data-slot="spinner"
      data-size={size}
      className={cn(
        // The spin survives `prefers-reduced-motion`, slowed: a frozen glyph
        // reads as a static icon, and the affordance is the whole point.
        "shrink-0 animate-spin motion-reduce:[animation-duration:2s]",
        sizeClasses[size],
        className,
      )}
      {...rest}
    />
  );
});
