import { describe, expect, it } from "@rstest/core";
import { intakeIssues } from "./index.js";
import { parseConfig } from "../../lib/config.js";
import { LedgerBuilder } from "../../lib/test-facts.js";
import type { NewFact } from "../../lib/facts.js";

const row = (repo: string, labels = ["ready-for-agent"]) => ({ number: 7, title: "Implement", body: "Details",
  html_url: `https://github.com/${repo}/issues/7`, labels: labels.map((name) => ({ name })), user: { login: "ann" } });

describe("multi-project GitHub poll boundary", () => {
  it("polls two repos, persists distinct bindings, and deduplicates on the next tick", async () => {
    const parsed = parseConfig({ projects: { rome: { workingDir: "/rome", repo: "acme/rome" }, manager: { workingDir: "/apps/manager", repo: "acme/apps" } } });
    if (!parsed.ok) throw new Error(parsed.error);
    const b = new LedgerBuilder();
    const ledger = { all: () => b.facts, append: (f: NewFact) => { b.add(f); return b.facts.at(-1)!; } };
    const calls: string[] = [];
    const ctx = { runAction: async (_name: string, args: { path: string }) => {
      calls.push(args.path);
      const repo = args.path.includes("/acme/rome/") ? "acme/rome" : "acme/apps";
      return { status: "ok", data: { data: [row(repo)] } };
    } } as never;
    await intakeIssues(ledger, parsed.config, ctx);
    expect(b.facts.map((f) => (f.payload as { projectId: string }).projectId)).toEqual(["rome", "manager"]);
    expect(calls.every((url) => url.includes("labels=ready-for-agent") && url.includes("page=1"))).toBe(true);
    await intakeIssues(ledger, parsed.config, ctx);
    expect(b.facts).toHaveLength(2);
  });
  it("a provider exception in one repository does not stop intake in the other", async () => {
    const parsed = parseConfig({ projects: { rome: { workingDir: "/rome", repo: "acme/rome" }, manager: { workingDir: "/apps/manager", repo: "acme/apps" } } });
    if (!parsed.ok) throw new Error(parsed.error);
    const b = new LedgerBuilder();
    await intakeIssues({ all: () => b.facts, append: (f) => { b.add(f); return b.facts.at(-1)!; } }, parsed.config, {
      runAction: async (_name: string, args: { path: string }) => {
        if (args.path.includes("/acme/rome/")) throw new Error("offline");
        return { status: "ok", data: { data: [row("acme/apps")] } };
      },
    } as never);
    expect(b.facts).toHaveLength(1);
    expect(b.facts[0]).toMatchObject({ payload: { projectId: "manager" } });
  });
  it("queries shared-repo label conjunctions but refuses multiply labeled issues", async () => {
    const parsed = parseConfig({ projects: { a: { workingDir: "/a", repo: "acme/apps", projectLabel: "project:a" }, b: { workingDir: "/b", repo: "acme/apps", projectLabel: "project:b" } } });
    if (!parsed.ok) throw new Error(parsed.error);
    const b = new LedgerBuilder(); const calls: string[] = [];
    await intakeIssues({ all: () => b.facts, append: (f) => { b.add(f); return b.facts.at(-1)!; } }, parsed.config, {
      runAction: async (_name: string, args: { path: string }) => {
        calls.push(args.path);
        return { status: "ok", data: { data: [row("acme/apps", ["ready-for-agent", "project:a", "project:b"])] } };
      },
    } as never);
    expect(calls.map((url) => new URL(url, "https://api.github.com").searchParams.get("labels")))
      .toEqual(["ready-for-agent,project:a", "ready-for-agent,project:b"]);
    expect(b.facts).toEqual([]);
  });
});
