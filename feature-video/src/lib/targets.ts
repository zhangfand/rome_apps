// Named targets, from the playscript's JSON to a Playwright locator.
//
// A playscript names the things on the page in plain English and a
// `TargetSpec` says how to find each one, so the script reads as prose and
// this module is the one place that prose meets the DOM. The checker calls
// {@link validateTargetSpec} without a browser; the recorder calls
// {@link resolveTarget} with one.

import type { Locator, Page } from "playwright-core";
import type { TargetSpec } from "./types.js";

/** A page or an already-resolved locator to search inside. */
type Scope = Pick<
  Page,
  "getByRole" | "getByLabel" | "getByText" | "getByPlaceholder" | "getByTestId" | "locator"
>;

/** The keys that pick an element, in the order the interpreter tries them. */
const SELECTORS = ["role", "label", "text", "placeholder", "testId", "css", "xpath"] as const;

/**
 * The locator for the target named `name`. Throws when the playscript has no
 * such target, or when its spec is malformed — run {@link validateTargetSpec}
 * over the whole document first to report every problem at once.
 */
export function resolveTarget(
  page: Page,
  targets: Record<string, TargetSpec>,
  name: string,
): Locator {
  const spec = targets[name];
  if (!spec) {
    const known = Object.keys(targets).sort().join(", ");
    throw new Error(`no target named "${name}"; the playscript defines: ${known || "none"}`);
  }
  return resolveSpec(page, targets, spec, new Set([name]));
}

/**
 * The locator for a spec written inline rather than named, such as a project's
 * `readyTarget`. `seen` carries the target names already being resolved, so a
 * `within` chain that loops throws instead of recursing forever.
 */
export function resolveSpec(
  page: Page,
  targets: Record<string, TargetSpec>,
  spec: TargetSpec,
  seen: Set<string> = new Set(),
): Locator {
  const scope = spec.within ? scopeFor(page, targets, spec.within, seen) : page;
  let locator = base(scope, spec);
  if (spec.has) locator = locator.filter({ has: resolveSpec(page, targets, spec.has, seen) });
  if (spec.hasText != null) locator = locator.filter({ hasText: spec.hasText });
  if (spec.last) return locator.last();
  if (spec.nth != null) return locator.nth(spec.nth);
  return locator;
}

function scopeFor(
  page: Page,
  targets: Record<string, TargetSpec>,
  within: string,
  seen: Set<string>,
): Scope {
  if (seen.has(within)) {
    throw new Error(`target "${within}" is inside itself`);
  }
  const parent = targets[within];
  if (!parent) throw new Error(`no target named "${within}"`);
  return resolveSpec(page, targets, parent, new Set([...seen, within]));
}

function base(scope: Scope, spec: TargetSpec): Locator {
  if ("role" in spec) {
    // Playwright's role union is a closed list; a playscript carries a string,
    // and an unknown role fails at query time with the role in the message.
    return scope.getByRole(spec.role as Parameters<Page["getByRole"]>[0], {
      ...(spec.name != null ? { name: spec.name } : {}),
      ...(spec.exact != null ? { exact: spec.exact } : {}),
    });
  }
  if ("label" in spec) return scope.getByLabel(spec.label, exactOption(spec.exact));
  if ("text" in spec) return scope.getByText(spec.text, exactOption(spec.exact));
  if ("placeholder" in spec)
    return scope.getByPlaceholder(spec.placeholder, exactOption(spec.exact));
  if ("testId" in spec) return scope.getByTestId(spec.testId);
  if ("css" in spec) return scope.locator(spec.css);
  if ("xpath" in spec) return scope.locator(`xpath=${spec.xpath}`);
  throw new Error(`target spec picks no element: ${JSON.stringify(spec)}`);
}

function exactOption(exact: boolean | undefined): { exact?: boolean } | undefined {
  return exact == null ? undefined : { exact };
}

/**
 * Problems with one target spec, as sentences prefixed by `where`; empty when
 * the spec is sound. `targets` is the whole document's targets, so a `within`
 * that names nothing, or a chain of them that loops, is reported here rather
 * than thrown mid-recording.
 */
export function validateTargetSpec(
  spec: unknown,
  where: string,
  targets: Record<string, TargetSpec>,
  seen: Set<string> = new Set(),
): string[] {
  if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
    return [`${where}: expected a target spec object, got ${JSON.stringify(spec)}`];
  }
  const problems: string[] = [];
  const record = spec as Record<string, unknown>;
  const picks = SELECTORS.filter((key) => key in record);
  if (picks.length === 0) {
    problems.push(`${where}: needs one of ${SELECTORS.join(", ")} to pick an element`);
  } else if (picks.length > 1) {
    problems.push(`${where}: picks an element ${picks.length} ways (${picks.join(", ")})`);
  }
  for (const key of picks) {
    if (typeof record[key] !== "string") {
      problems.push(`${where}: ${key} needs text, got ${JSON.stringify(record[key])}`);
    }
  }
  if ("name" in record && typeof record.name !== "string") {
    problems.push(`${where}: name needs text, got ${JSON.stringify(record.name)}`);
  }
  if ("exact" in record && typeof record.exact !== "boolean") {
    problems.push(`${where}: exact needs true or false, got ${JSON.stringify(record.exact)}`);
  }
  if ("hasText" in record && typeof record.hasText !== "string") {
    problems.push(`${where}: hasText needs text, got ${JSON.stringify(record.hasText)}`);
  }
  if ("nth" in record && !Number.isInteger(record.nth)) {
    problems.push(`${where}: nth needs a whole number, got ${JSON.stringify(record.nth)}`);
  }
  if ("last" in record && typeof record.last !== "boolean") {
    problems.push(`${where}: last needs true or false, got ${JSON.stringify(record.last)}`);
  }
  if ("nth" in record && record.last === true) {
    problems.push(`${where}: nth and last both narrow the match; keep one`);
  }
  if ("has" in record) {
    problems.push(...validateTargetSpec(record.has, `${where} has`, targets, seen));
  }
  if ("within" in record) {
    const within = record.within;
    if (typeof within !== "string") {
      problems.push(`${where}: within needs the name of another target`);
    } else if (seen.has(within)) {
      problems.push(`${where}: within "${within}" is inside itself`);
    } else if (!(within in targets)) {
      problems.push(`${where}: within names no target "${within}"`);
    } else {
      problems.push(
        ...validateTargetSpec(
          targets[within],
          `target "${within}"`,
          targets,
          new Set([...seen, within]),
        ),
      );
    }
  }
  return problems;
}
