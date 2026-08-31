// Rome apps mount inside a Shadow DOM, and their compiled CSS lives in that
// shadow root. Radix floating UI (dialog, popover, select, …) portals to
// document.body by default, which escapes the shadow root and renders
// half-styled. This resolver gives the kit's floating-family components the
// right portal container automatically: portal within the anchor's shadow
// root when there is one, fall back to Radix's document.body default when the
// anchor lives in the plain document.
//
// Internal to the kit — deliberately absent from `src/index.ts` and the
// package `exports` map. App-authored components keep using the SDK's
// `getPortalContainer()`; the kit must not depend on `@rome-os/app-web-sdk`
// (dependency direction is SDK → kit, never the reverse).

const PORTAL_ATTRIBUTE = "data-rome-ui-portal";

/**
 * Resolve the portal container for a floating layer anchored at `anchor`.
 * Call at open time with a live trigger/content ref — not at module load,
 * when the anchor isn't in the DOM yet.
 *
 * Returns a kit-managed div (lazily created, then reused) inside the anchor's
 * shadow root, or `undefined` when the anchor is in the plain document,
 * detached, or absent — the cases where the portal library's document.body
 * default is correct.
 *
 * The div is appended inside the anchor's top-level ancestor within the
 * shadow root, not the shadow root itself: Rome's app host builds a <body>
 * element as that top-level ancestor and toggles theme classes (`.dark`) on
 * it, and class selectors don't pierce the shadow boundary — a container
 * appended as a *sibling* of that body would sit outside the theme scope and
 * render every `dark:` variant in its light styling. Anchoring to the
 * top-level ancestor keeps the portal inside the theme scope while still
 * escaping any intermediate clipping/stacking contexts, mirroring what the
 * document.body default gives light-DOM content.
 */
export function resolvePortalContainer(
  anchor: Element | null | undefined,
): HTMLElement | undefined {
  if (!anchor) return undefined;
  const root = anchor.getRootNode();
  if (typeof ShadowRoot === "undefined" || !(root instanceof ShadowRoot)) return undefined;

  // Degenerate case — the anchor is itself a direct child of the shadow root:
  // `scope` stays the root. No theme-carrying ancestor exists above the anchor
  // inside the root, so root-level attachment loses no theme scoping, while
  // returning undefined here would portal to document.body and lose the
  // shadow root's styles entirely.
  let scope: Element | ShadowRoot = root;
  for (let el = anchor.parentElement; el; el = el.parentElement) {
    if (el.parentNode === root) {
      scope = el;
      break;
    }
  }

  // Direct-child scan, not querySelector: a descendant match could belong to a
  // nested shadow-DOM'd widget's own markup rather than this scope's container.
  for (const child of scope.children) {
    if (child instanceof HTMLElement && child.hasAttribute(PORTAL_ATTRIBUTE)) return child;
  }

  const container = anchor.ownerDocument.createElement("div");
  container.setAttribute(PORTAL_ATTRIBUTE, "");
  scope.appendChild(container);
  return container;
}
