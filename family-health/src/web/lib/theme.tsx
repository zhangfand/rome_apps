/**
 * Chart colors resolved from Rome's live theme tokens.
 *
 * SVG attributes cannot rely on CSS custom properties everywhere, so we read
 * the computed token values from an element inside the app's shadow root and
 * re-read them whenever the host toggles the theme (the host flips a `dark`
 * class on the shadow root's <body>; themes can also change on :root).
 */
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export interface ThemeColors {
  foreground: string;
  muted: string;
  border: string;
  surface: string;
  primary: string;
  destructive: string;
  success: string;
  warning: string;
  info: string;
  infoBg: string;
  successBg: string;
  warningBg: string;
  destructiveBg: string;
  dark: boolean;
}

const TOKENS: Record<keyof Omit<ThemeColors, "dark">, string[]> = {
  foreground: ["--foreground"],
  muted: ["--muted-foreground"],
  border: ["--border"],
  surface: ["--surface-elevated", "--surface", "--background"],
  primary: ["--primary", "--brand"],
  destructive: ["--destructive"],
  success: ["--success"],
  warning: ["--warning"],
  info: ["--info"],
  infoBg: ["--info-bg"],
  successBg: ["--success-bg"],
  warningBg: ["--warning-bg"],
  destructiveBg: ["--destructive-bg"],
};

const FALLBACK: ThemeColors = {
  foreground: "currentColor",
  muted: "currentColor",
  border: "currentColor",
  surface: "Canvas",
  primary: "currentColor",
  destructive: "currentColor",
  success: "currentColor",
  warning: "currentColor",
  info: "currentColor",
  infoBg: "transparent",
  successBg: "transparent",
  warningBg: "transparent",
  destructiveBg: "transparent",
  dark: false,
};

function read(el: HTMLElement): ThemeColors {
  const cs = getComputedStyle(el);
  const out = { ...FALLBACK };
  for (const [key, names] of Object.entries(TOKENS) as Array<[keyof typeof TOKENS, string[]]>) {
    for (const n of names) {
      const v = cs.getPropertyValue(n).trim();
      if (v) {
        out[key] = v;
        break;
      }
    }
  }
  out.dark = !!el.closest(".dark") || document.documentElement.classList.contains("dark");
  return out;
}

const Ctx = createContext<ThemeColors>(FALLBACK);

export function ThemeColorsProvider({ children }: { children: ReactNode }) {
  const probe = useRef<HTMLSpanElement>(null);
  const [colors, setColors] = useState<ThemeColors>(FALLBACK);

  useLayoutEffect(() => {
    if (probe.current) setColors(read(probe.current));
  }, []);

  useEffect(() => {
    const el = probe.current;
    if (!el) return;
    const refresh = () => {
      // Let the class change apply before reading computed values.
      requestAnimationFrame(() => setColors(read(el)));
    };
    const observer = new MutationObserver(refresh);
    const targets = new Set<Element>([document.documentElement]);
    let node: Node | null = el;
    while (node) {
      if (node instanceof Element) targets.add(node);
      const parent: Node | null = node.parentNode;
      node = parent instanceof ShadowRoot ? parent.host : parent;
    }
    for (const t of targets) observer.observe(t, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener?.("change", refresh);
    return () => {
      observer.disconnect();
      mq?.removeEventListener?.("change", refresh);
    };
  }, []);

  return (
    <Ctx.Provider value={colors}>
      <span ref={probe} aria-hidden="true" className="hidden" />
      {children}
    </Ctx.Provider>
  );
}

export function useThemeColors(): ThemeColors {
  return useContext(Ctx);
}
