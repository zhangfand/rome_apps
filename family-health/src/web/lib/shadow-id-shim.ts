/**
 * Radix Dialog verifies its title/description with `document.getElementById`,
 * which can never see elements inside the app's Shadow DOM — so every kit
 * dialog logs "DialogContent requires a DialogTitle" even though the title is
 * rendered. While the app is mounted, fall back to the app's shadow root for
 * Radix-generated ids only (`radix-*`); everything else is untouched, and the
 * original is restored on unmount.
 */
import { useEffect, type RefObject } from "react";

export function useRadixShadowIdShim(anchor: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = anchor.current?.getRootNode();
    if (!(root instanceof ShadowRoot)) return;
    const original = Document.prototype.getElementById;
    const current = document.getElementById;
    const patched = function (this: Document, id: string) {
      const hit = current.call(this, id);
      if (hit || !id.startsWith("radix-")) return hit;
      return root.getElementById(id);
    };
    document.getElementById = patched;
    return () => {
      if (document.getElementById === patched) document.getElementById = current === original ? original : current;
    };
  }, [anchor]);
}
