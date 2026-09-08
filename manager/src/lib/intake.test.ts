import { describe, expect, it } from "@rstest/core";
import { DEFAULT_INTAKE_LABEL, DEFAULT_WORKER_AGENT, type ManagerConfig, parseConfig, parseRepoList } from "./config.js";
import { GITHUB, RUNTIME } from "./facts.js";
import { fold } from "./fold.js";
import {
  briefFromIssue,
  intakeApiPath,
  intakeFacts,
  type IntakeIssue,
  MAX_BODY_CHARS,
  toIntakeIssue,
  trackedIssueUrls,
} from "./intake.js";
import { issuesToWatch } from "./observe.js";
import { reconcile } from "./reconcile.js";
import { judge } from "./judge.js";
import { LedgerBuilder } from "./test-facts.js";

const LABEL = "ready-for-agent";
const REPO = "acme/rome";

function issue(number: number, extra: Partial<IntakeIssue> = {}): IntakeIssue {
  return {
    url: `https://github.com/${REPO}/issues/${number}`,
    repo: REPO,
    number,
    title: `Issue ${number}`,
    body: `Body of ${number}`,
    author: "octocat",
    state: "open",
    isPullRequest: false,
    ...extra,
  };
}

const CONFIG: ManagerConfig = {
  workingDir: "/srv/project",
  workerAgent: DEFAULT_WORKER_AGENT,
  startCap: 2,
  maxWorkers: 3,
  ageCapHours: 3,
  intervalMinutes: 5,
  reuseSessions: true,
  closeOnIssueClosed: true,
  intakeRepos: [REPO],
  intakeLabel: LABEL,
};

function ids() {
  let n = 0;
  return () => `t-${++n}`;
}

describe("intakeFacts", () => {
  it("opens one Created per labeled open issue, by its author, citing the issue", () => {
    const snapshot = fold(new Date(), []);
    const facts = intakeFacts({ snapshot, issues: [issue(1), issue(2)], label: LABEL, newTaskId: ids() });
    expect(facts.map((f) => f.taskId)).toEqual(["t-1", "t-2"]);
    expect(facts[0]).toMatchObject({
      kind: "Created",
      by: "github:octocat",
      source: `issue labeled "${LABEL}" on GitHub: https://github.com/acme/rome/issues/1`,
      payload: {
        issue: { url: "https://github.com/acme/rome/issues/1", repo: REPO, number: 1, author: "octocat", label: LABEL },
      },
    });
    expect((facts[0].payload as { brief: string }).brief).toContain("Issue 1");
  });

  it("skips pull requests and closed issues", () => {
    const snapshot = fold(new Date(), []);
    const facts = intakeFacts({
      snapshot,
      issues: [issue(1, { isPullRequest: true }), issue(2, { state: "closed" }), issue(3)],
      label: LABEL,
      newTaskId: ids(),
    });
    expect(facts.map((f) => (f.payload as { issue: { number: number } }).issue.number)).toEqual([3]);
  });

  it("never opens a second task on an issue that already has one, even a closed task", () => {
    const first = intakeFacts({ snapshot: fold(new Date(), []), issues: [issue(1)], label: LABEL, newTaskId: ids() })[0];
    const ledger = new LedgerBuilder()
      .add(first)
      .add({ taskId: "t-1", kind: "Completed", by: "ann", source: "done", payload: {} });
    const snapshot = fold(ledger.now(), ledger.facts);
    const again = intakeFacts({ snapshot, issues: [issue(1), issue(2)], label: LABEL, newTaskId: () => "t-9" });
    expect(again.map((f) => f.taskId)).toEqual(["t-9"]);
    expect((again[0].payload as { issue: { number: number } }).issue.number).toBe(2);
  });

  it("treats an issue a person named in a chat brief as already tracked", () => {
    const ledger = new LedgerBuilder().add({
      taskId: "t-chat",
      kind: "Created",
      by: "ann",
      source: "please fix acme/rome#1",
      payload: { brief: "fix acme/rome#1" },
    });
    const snapshot = fold(ledger.now(), ledger.facts);
    expect(trackedIssueUrls(snapshot)).toEqual(new Set(["https://github.com/acme/rome/issues/1"]));
    expect(intakeFacts({ snapshot, issues: [issue(1)], label: LABEL, newTaskId: ids() })).toEqual([]);
  });

  it("de-duplicates within one poll", () => {
    const facts = intakeFacts({ snapshot: fold(new Date(), []), issues: [issue(1), issue(1)], label: LABEL, newTaskId: ids() });
    expect(facts).toHaveLength(1);
  });

  it("hands the new task to reconcile and to the close watch on the same brief", () => {
    const [created] = intakeFacts({ snapshot: fold(new Date(), []), issues: [issue(7)], label: LABEL, newTaskId: ids() });
    const ledger = new LedgerBuilder().add(created);
    const snapshot = fold(ledger.now(), ledger.facts);

    const actions = reconcile({ snapshot, config: CONFIG, judge, newWorkerId: () => "w-1" });
    expect(actions.map((a) => a.type)).toEqual(["append", "append", "launch"]);
    expect(actions[0]).toMatchObject({ fact: { kind: "Taken", by: RUNTIME } });

    const [watch] = issuesToWatch(snapshot);
    expect(watch.refs.map((r) => r.url)).toEqual(["https://github.com/acme/rome/issues/7"]);
    expect(GITHUB).not.toBe(created.by);
  });
});

describe("briefFromIssue", () => {
  it("puts the title first and the issue URL on its own last line", () => {
    const brief = briefFromIssue(issue(4, { title: "Add rate limiting", body: "On /upload." }));
    expect(brief).toBe("Add rate limiting\n\nOn /upload.\n\nGitHub issue: https://github.com/acme/rome/issues/4");
  });

  it("omits an empty body and falls back to repo#N for an empty title", () => {
    expect(briefFromIssue(issue(4, { title: "  ", body: "" }))).toBe(
      "acme/rome#4\n\nGitHub issue: https://github.com/acme/rome/issues/4",
    );
  });

  it("cuts a very long body and says so", () => {
    const brief = briefFromIssue(issue(4, { body: "x".repeat(MAX_BODY_CHARS + 50) }));
    expect(brief).toContain(`cut at ${MAX_BODY_CHARS}`);
    expect(brief.endsWith("GitHub issue: https://github.com/acme/rome/issues/4")).toBe(true);
  });
});

describe("toIntakeIssue", () => {
  it("reads the fields GitHub's list returns", () => {
    const got = toIntakeIssue(REPO, {
      number: 12,
      html_url: "https://github.com/acme/rome/issues/12",
      title: "T",
      body: null,
      user: { login: "ann" },
      state: "open",
      pull_request: { url: "…" },
    });
    expect(got).toEqual({
      url: "https://github.com/acme/rome/issues/12",
      repo: REPO,
      number: 12,
      title: "T",
      body: "",
      author: "ann",
      state: "open",
      isPullRequest: true,
    });
  });

  it("drops a row with no number or URL", () => {
    expect(toIntakeIssue(REPO, { title: "?" })).toBeUndefined();
  });
});

describe("intakeApiPath", () => {
  it("lists open issues with the label, oldest first, one page at a time", () => {
    expect(intakeApiPath("acme/rome", "ready-for-agent", 2)).toBe(
      "/repos/acme/rome/issues?labels=ready-for-agent&state=open&sort=created&direction=asc&per_page=100&page=2",
    );
  });

  it("encodes a label with spaces", () => {
    expect(intakeApiPath("acme/rome", "needs agent", 1)).toContain("labels=needs+agent");
  });
});

describe("config: intake", () => {
  it("defaults to no repos and the ready-for-agent label", () => {
    const parsed = parseConfig({ workingDir: "/srv/project" });
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.config.intakeRepos).toEqual([]);
    expect(parsed.config.intakeLabel).toBe(DEFAULT_INTAKE_LABEL);
  });

  it("accepts repos as an array or a comma-separated string, and full URLs", () => {
    expect(parseRepoList(["acme/rome", "https://github.com/acme/other/"])).toEqual({
      repos: ["acme/rome", "acme/other"],
      invalid: [],
    });
    expect(parseRepoList("acme/rome, acme/rome acme/two")).toEqual({
      repos: ["acme/rome", "acme/two"],
      invalid: [],
    });
  });

  it("reports an entry that is not owner/name", () => {
    expect(parseRepoList(["acme", "acme/rome/extra", "ok/fine"])).toEqual({
      repos: ["ok/fine"],
      invalid: ["acme", "acme/rome/extra"],
    });
  });
});
