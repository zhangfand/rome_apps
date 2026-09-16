import { describe, expect, it } from "@rstest/core";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATIC_SPECIFIER = /(?:import|export)\s+(?:type\s+)?(?:[^"'`;]*?\s+from\s*)?["']([^"']+)["']/g;

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const entry = path.join(directory, name);
    if (name === "node_modules" || name === "dist") return [];
    return statSync(entry).isDirectory() ? filesUnder(entry) : /\.[cm]?[jt]sx?$/.test(name) ? [entry] : [];
  });
}

function sourceTarget(from: string, specifier: string): string | undefined {
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return path.normalize(path.resolve(path.dirname(from), specifier.replace(/\.(?:js|mjs|cjs)$/, ".ts")));
  }
  if (specifier.startsWith("@/")) return path.join(SRC, "web/core", specifier.slice(2));
  return undefined;
}

function area(file: string): "core" | "web-core" | "domain" | "app" | "web-app" | "other" {
  const relative = path.relative(SRC, file).split(path.sep).join("/");
  if (relative.startsWith("core/")) return "core";
  if (relative.startsWith("web/core/")) return "web-core";
  if (relative.startsWith("domain/") || relative.startsWith("web/domain/")) return "domain";
  if (relative.startsWith("app/")) return "app";
  if (relative === "web/App.tsx" || relative === "web/App.ts") return "web-app";
  return "other";
}

function importsOf(file: string): Array<{ specifier: string; targetArea: ReturnType<typeof area> }> {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(STATIC_SPECIFIER)].flatMap((match) => {
    const target = sourceTarget(file, match[1]);
    return target ? [{ specifier: match[1], targetArea: area(target) }] : [];
  });
}

describe("source architecture boundaries", () => {
  it("keeps core independent and domain independent of app", () => {
    const violations: string[] = [];
    for (const file of filesUnder(SRC)) {
      const owner = area(file);
      const imports = importsOf(file);
      for (const imported of imports) {
        if ((owner === "core" || owner === "web-core") && (imported.targetArea === "domain" || imported.targetArea === "app")) {
          violations.push(`${path.relative(SRC, file)} -> ${imported.specifier}`);
        }
        if (owner === "domain" && imported.targetArea === "app") {
          violations.push(`${path.relative(SRC, file)} -> ${imported.specifier}`);
        }
      }
      const areas = new Set(imports.map((item) => item.targetArea).filter((targetArea) => targetArea !== owner));
      if (areas.has("core") && areas.has("domain") && owner !== "app" && owner !== "web-app") {
        violations.push(`${path.relative(SRC, file)} imports both core and domain`);
      }
    }
    expect(violations).toEqual([]);
  });
});
