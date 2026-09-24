/**
 * Text normalization shared by alias matching, unit parsing, value parsing and
 * reference-range parsing. Pure functions, no I/O.
 *
 * Chinese checkup reports mix full-width and half-width characters freely
 * (`（ＴＧ）`, `＜５.２`, `３.９～６.１`), use several dash/tilde glyphs as range
 * separators, and sprinkle decoration (`★`, `*`, `▲`) around names. Everything
 * funnels through `normalizeWidth` first so downstream code only deals with
 * ASCII punctuation and digits.
 */

/** Characters that NFKC leaves alone but which we want to treat as ASCII. */
const EXTRA_MAP: Record<string, string> = {
  "−": "-", // − minus sign
  "‐": "-", // ‐ hyphen
  "‑": "-", // ‑ non-breaking hyphen
  "‒": "-", // ‒ figure dash
  "–": "-", // – en dash
  "—": "-", // — em dash
  "―": "-", // ― horizontal bar
  "ー": "-", // ー katakana long vowel (OCR artefact)
  "〜": "~", // 〜 wave dash
  "∼": "~", // ∼ tilde operator
  "　": " ", // ideographic space
  " ": " ", // nbsp
  "≤": "<=", // ≤
  "≥": ">=", // ≥
  "≦": "<=", // ≦
  "≧": ">=", // ≧
  "、": ",", // 、
  "。": ".", // 。 (OCR sometimes uses it as a decimal point)
};

/**
 * Unicode NFKC (full-width → half-width, `µ` → `μ`, `㎎` → `mg`, `（` → `(`)
 * plus a few extra dash / comparison glyph folds. Does not change case.
 */
export function normalizeWidth(input: string): string {
  // NFKC already maps ～ (U+FF5E) → "~", ＜ → "<", （ → "(", ０ → "0".
  let out = "";
  for (const ch of input.normalize("NFKC")) out += EXTRA_MAP[ch] ?? ch;
  return out;
}

/** Collapse whitespace and trim. */
export function squish(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/** Decorations that carry no meaning for matching (report markers, bullets). */
const DECORATION_RE = /[★☆*※▲△▼▽●○◆◇■□]/g;

/**
 * Canonical key for alias lookups: width-normalized, lowercased, with all
 * whitespace, decoration and punctuation removed. `%` and `#` are kept because
 * they distinguish percentage from absolute counts (`NEUT%` vs `NEUT#`). `甘油三酯（TG）` →
 * `甘油三酯(tg)` → `甘油三酯tg`; `CA19-9` → `ca199`; `HDL-C` → `hdlc`.
 *
 * Greek letters are kept (`γ-GT` → `γgt`), as are CJK characters.
 */
export function normalizeKey(input: string): string {
  return normalizeWidth(input)
    .toLowerCase()
    .replace(DECORATION_RE, "")
    .replace(/[\s()[\]{}<>【】《》「」『』"'`,.;:!?/\\|_\-+=~^&$@·,，:;]/g, "");
}

/**
 * Split a raw indicator name into lookup candidates, most specific first.
 *
 * `甘油三酯(TG)` → [`甘油三酯(TG)`, `甘油三酯`, `TG`]
 * `TG/甘油三酯`   → [`TG/甘油三酯`, `TG`, `甘油三酯`]
 * `血清总胆固醇测定` → [..., `总胆固醇`]
 */
export function nameCandidates(raw: string): string[] {
  const base = squish(normalizeWidth(raw).replace(DECORATION_RE, "").replace(/[↑↓]/g, ""));
  const out: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (t && !out.includes(t)) out.push(t);
  };
  push(base);

  // Parenthesised pieces: outside text and each inside token.
  const inside: string[] = [];
  const outside = base.replace(/[([【]([^)\]】]*)[)\]】]/g, (_m, inner: string) => {
    inside.push(inner);
    return " ";
  });
  push(outside);
  for (const piece of inside) push(piece);

  // Slash / space separated bilingual names: `TG/甘油三酯`, `ALT 谷丙转氨酶`.
  for (const piece of [base, outside]) {
    for (const part of piece.split(/[/|]/)) push(part);
    const cjk = piece.match(/[一-鿿][一-鿿0-9a-zA-Zα-ωΑ-Ω\-]*/g);
    const latin = piece.match(/[A-Za-zα-ωΑ-Ω][A-Za-z0-9α-ωΑ-Ω\-]*(?:\([a-z]\))?/g);
    if (cjk && latin) {
      for (const c of cjk) push(c);
      for (const l of latin) push(l);
    }
  }

  // Strip common specimen prefixes and method suffixes.
  const stripped: string[] = [];
  for (const c of out) {
    const s = c
      .replace(/^(血清|血浆|全血|静脉血|末梢血|空腹|尿液?)(?=[一-鿿A-Za-z])/, (m) =>
        // Keep 空腹 / 尿 when they are the discriminating part of the name.
        m === "空腹" || m.startsWith("尿") ? m : "",
      )
      .replace(/(测定|检测|定量|浓度|含量|水平|值)$/, "");
    if (s !== c) stripped.push(s);
  }
  for (const s of stripped) push(s);
  return out;
}

/** True when the string contains at least one CJK ideograph. */
export function hasCjk(input: string): boolean {
  return /[一-鿿]/.test(input);
}
