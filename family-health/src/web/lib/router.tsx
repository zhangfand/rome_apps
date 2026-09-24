/**
 * Minimal router over the Rome SDK path helpers: every view has a stable URL
 * under /apps/family-health/…, browser back/forward works, and links are real
 * anchors (open in new tab, copy link).
 */
import { buildAppUrl, getCurrentAppPath, navigateToApp, subscribeToAppPath } from "@rome-os/app-web-sdk";
import { forwardRef, useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from "react";

export { parseRoute, paths, type Route } from "./router-parse";
import type { Route } from "./router-parse";
import { parseRoute } from "./router-parse";

export function useRoute(): Route {
  const [path, setPath] = useState(() => getCurrentAppPath());
  useEffect(() => subscribeToAppPath((p) => setPath(p)), []);
  return parseRoute(path);
}

export function go(path: string, opts?: { replace?: boolean }) {
  navigateToApp(path, opts);
  window.scrollTo?.({ top: 0 });
}

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
}

/** In-app link: real href for new-tab/copy, soft navigation on plain click. */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ to, onClick, ...rest }, ref) {
  function handle(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(to);
  }
  return <a ref={ref} href={buildAppUrl(to)} onClick={handle} {...rest} />;
});
