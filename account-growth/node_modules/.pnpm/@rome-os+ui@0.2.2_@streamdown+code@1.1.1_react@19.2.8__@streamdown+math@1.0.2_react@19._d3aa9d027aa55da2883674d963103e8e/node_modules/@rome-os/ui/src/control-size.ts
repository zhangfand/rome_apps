/**
 * The size names that predate the shared control vocabulary, each mapped to the
 * canonical name for its step.
 *
 * Internal — no subpath export, so this is not published API. The vocabulary
 * itself is documented in `docs/ui/component-roles.md`.
 */
const CANONICAL_CONTROL_SIZE: Record<string, string> = {
  default: "md",
  icon: "icon-md",
};

/**
 * The canonical name for a size, whichever spelling the caller wrote.
 *
 * `data-size` is a styling and test hook — `Select` selects its whole geometry
 * through it — so it has to carry one name per step. Otherwise a selector for
 * the 36px control matches two values, and which one it gets depends on the
 * call site.
 *
 * One owner because the mapping has four readers (`Button`, `Input`, `Select`,
 * `Toggle`). A fifth alias added to three of them is a split that nothing
 * fails on: the odd component keeps emitting the old spelling and only the
 * selector written against it stops matching.
 *
 * Takes and returns a bare string rather than each component's size union: the
 * unions differ (only the Button family has `lg` or the `icon-*` names) and the
 * result is bound for a DOM attribute, so a union here would buy a cast at
 * every call site and no safety.
 */
export function canonicalControlSize(size: string | null | undefined): string | undefined {
  if (size == null) return undefined;
  return CANONICAL_CONTROL_SIZE[size] ?? size;
}
