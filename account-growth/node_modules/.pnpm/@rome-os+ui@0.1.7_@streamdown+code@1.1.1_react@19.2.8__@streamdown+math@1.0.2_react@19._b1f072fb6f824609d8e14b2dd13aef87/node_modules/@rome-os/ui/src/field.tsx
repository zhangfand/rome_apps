import { type ComponentProps } from "react";
import { cn } from "./cn.js";

/**
 * Atomic, form-library-agnostic field primitives (shadcn "Field" family).
 * Compose them by hand inside a TanStack `form.Field` render-prop — they know
 * nothing about the form hook, so they work for any input type or layout.
 */

export function FieldGroup({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("space-y-4", className)} {...props} />;
}

export function Field({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("space-y-1", className)} {...props} />;
}

const FIELD_LABEL_CLASS = "block text-ui text-foreground";

export function FieldLabel({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn(FIELD_LABEL_CLASS, className)} {...props} />;
}

/**
 * Caption for a set of controls with no single labelable element — a row of
 * buttons, a tile picker. Deliberately not a `<label>`: it has nothing to point
 * `htmlFor` at, so it reads as the `aria-labelledby` target of the surrounding
 * `role="group"` instead.
 */
export function FieldGroupLabel({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(FIELD_LABEL_CLASS, className)} {...props} />;
}

export function FieldDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-aux text-muted-foreground", className)} {...props} />;
}

/**
 * TanStack validators built from a Standard Schema (Zod) surface issues as
 * `{ message }` objects; locally-defined validators may return plain strings.
 */
function errorText(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

/**
 * Renders the first error from a TanStack field's `meta.errors`. Pure — the
 * caller decides *whether* to pass errors (e.g. gate on `meta.isTouched`), so
 * this stays decoupled from validation timing.
 */
export function FieldError({
  errors,
  id,
  className,
}: {
  errors?: readonly unknown[];
  id?: string;
  className?: string;
}) {
  if (!errors || errors.length === 0) return null;
  return (
    <p id={id} role="alert" className={cn("text-aux text-destructive-fg", className)}>
      {errorText(errors[0])}
    </p>
  );
}

/**
 * Form-level message for server / network failures, which are not field
 * validation. Rendered below the fields so every form surfaces them the same way.
 */
export function FormError({ children }: { children: string }) {
  return (
    <p role="alert" className="text-aux text-destructive-fg">
      {children}
    </p>
  );
}
