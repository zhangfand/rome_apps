import { describe, expect, it } from "@rstest/core";
import { DEFAULT_WORKER_AGENT, type ManagerConfig } from "./config.js";
import { GITHUB, RUNTIME } from "./facts.js";
import { fold } from "./fold.js";
import { issueApiPath, issueRefsIn } from "./github-refs.js";
import { endedByIssues, type IssueStatus, issuesToWatch } from "./observe.js";
import { LOST_STOPPED, reconcile } from "./reconcile.js";
import { LedgerBuilder } from "./test-facts.js";

const ANN = "ann";
const ISSUE = "https://github.com/acme/rome/issues/180";
const OTHER = "https://github.com/acme/rome/issues/181";

const CONFIG: ManagerConfig = {
  workingDir: "/srv/project",
  workerAgent: DEFAULT_WORKER_AGENT,
  startCap: 2,
  maxWorkers: 3,
  ageCapHours: 3,
  intervalMinutes: 5,
  reuseSessions: true,
  closeOnIssueClosed: true,
  intakeRepos: [],
  intakeLabel: "ready-for-agent",
};

const DONE: IssueStatus = { state: "closed", closedAt: "2026-09-08T10:00:00Z", stateReason: "completed" };
const NOT_PLANNED: IssueStatus = { state: "closed", closedAt: "2026-09-08T10:00:00Z", stateReason: "not_planned" };
const DUPLICATE: IssueStatus = { state: "closed", closedAt: "2026-09-08T10:00:00Z", stateReason: "duplicate" };
const LEGACY_CLOSED: IssueStatus = { state: "closed", closedAt: "2024-01-01T00:00:00Z" };
const OPEN: IssueStatus = { state: "open" };

function created(brief: string, taskId = "t1") {
  return new LedgerBuilder().add({ taskId, kind: "Created", by: ANN, source: brief, payload: { brief } });
}

function working(brief = `fix ${ISSUE}`, taskId = "t1", workerId = "w1") {
  return created(brief, taskId)
    .add({ taskId, kind: "Taken", by: RUNTIME, payload: {} })
    .add({ taskId, kind: "Started", by: RUNTIME, payload: { workerId, prompt: "go" } });
}

function reported(brief = `fix ${ISSUE}`, taskId = "t1") {
  return working(brief, taskId)
    .add({ taskId, kind: "Returned", by: "w1", payload: { workerId: "w1", reply: "opened PR #12" } })
    .add({ taskId, kind: "Report", by: RUNTIME, payload: { what: "opened PR #12", evidence: "" } });
}

function watch(ledger: LedgerBuilder) {
  const snapshot = fold(ledger.now(), ledger.facts);
  const [first] = issuesToWatch(snapshot);
  return { view: snapshot.tasks[0], refs: first?.refs ?? [] };
}

describe("issueRefsIn", () => {
  it("reads full issue URLs and owner/repo#N, de-duplicated", () => {
    const refs = issueRefsIn(`fix ${ISSUE} and acme/rome#180, also acme/rome#181`);
    expect(refs.map((r) => r.url)).toEqual([ISSUE, OTHER]);
    expect(refs[0]).toMatchObject({ owner: "acme", repo: "rome", number: 180 });
  });

  it("ignores pull request URLs", () => {
    expect(issueRefsIn("merge https://github.com/acme/rome/pull/12")).toEqual([]);
  });

  it("encodes path segments for the API", () => {
    expect(issueApiPath(issueRefsIn("acme/ro.me#7")[0])).toBe("/repos/acme/ro.me/issues/7");
  });
});

describe("issuesToWatch", () => {
  it("names every open task whose brief cites an issue, whatever its position", () => {
    for (const ledger of [created(`fix ${ISSUE}`), working(), reported()]) {
      expect(issuesToWatch(fold(ledger.now(), ledger.facts))).toEqual([
        { taskId: "t1", refs: [expect.objectContaining({ url: ISSUE })] },
      ]);
    }
  });

  it("skips a task that already ended", () => {
    const ledger = reported().add({ taskId: "t1", kind: "Completed", by: ANN, source: "done", payload: {} });
    expect(issuesToWatch(fold(ledger.now(), ledger.facts))).toEqual([]);
  });

  it("skips a task with no issue in its brief", () => {
    const ledger = reported("add rate limiting; see PR https://github.com/acme/rome/pull/12");
    expect(issuesToWatch(fold(ledger.now(), ledger.facts))).toEqual([]);
  });

  it("does not read issues a worker mentioned", () => {
    const ledger = working("add rate limiting")
      .add({ taskId: "t1", kind: "Returned", by: "w1", payload: { workerId: "w1", reply: `done, closes ${ISSUE}` } })
      .add({ taskId: "t1", kind: "Report", by: RUNTIME, payload: { what: `closes ${ISSUE}`, evidence: "" } });
    expect(issuesToWatch(fold(ledger.now(), ledger.facts))).toEqual([]);
  });
});

describe("endedByIssues", () => {
  it("writes a Completed by github when the issue closed as completed", () => {
    const { view, refs } = watch(reported());
    expect(endedByIssues(view, refs, new Map([[ISSUE, DONE]]))).toMatchObject({
      taskId: "t1",
      kind: "Completed",
      by: GITHUB,
      source: `issue closed on GitHub: ${ISSUE}`,
      payload: { issues: [{ url: ISSUE, closedAt: DONE.closedAt, stateReason: "completed" }] },
    });
  });

  it("treats a close with no reason as completed", () => {
    const { view, refs } = watch(reported());
    expect(endedByIssues(view, refs, new Map([[ISSUE, LEGACY_CLOSED]]))?.kind).toBe("Completed");
  });

  it("writes a Cancelled by github when the issue closed as not planned", () => {
    const { view, refs } = watch(working());
    expect(endedByIssues(view, refs, new Map([[ISSUE, NOT_PLANNED]]))).toMatchObject({
      kind: "Cancelled",
      by: GITHUB,
      source: `issue closed as not planned on GitHub: ${ISSUE}`,
      payload: { issues: [{ url: ISSUE, stateReason: "not_planned" }] },
    });
  });

  it("treats a duplicate close as dropped", () => {
    const { view, refs } = watch(working());
    expect(endedByIssues(view, refs, new Map([[ISSUE, DUPLICATE]]))?.kind).toBe("Cancelled");
  });

  it("writes nothing while the issue is open or unknown", () => {
    const { view, refs } = watch(reported());
    expect(endedByIssues(view, refs, new Map([[ISSUE, OPEN]]))).toBeUndefined();
    expect(endedByIssues(view, refs, new Map())).toBeUndefined();
  });

  it("needs every issue in the brief closed", () => {
    const { view, refs } = watch(reported(`fix ${ISSUE} and ${OTHER}`));
    expect(endedByIssues(view, refs, new Map([[ISSUE, DONE], [OTHER, OPEN]]))).toBeUndefined();
    const both = endedByIssues(view, refs, new Map([[ISSUE, DONE], [OTHER, DONE]]));
    expect(both).toMatchObject({ kind: "Completed", payload: { issues: [{ url: ISSUE }, { url: OTHER }] } });
  });

  it("is Cancelled only when every issue was dropped", () => {
    const { view, refs } = watch(reported(`fix ${ISSUE} and ${OTHER}`));
    expect(endedByIssues(view, refs, new Map([[ISSUE, DONE], [OTHER, NOT_PLANNED]]))?.kind).toBe("Completed");
    expect(endedByIssues(view, refs, new Map([[ISSUE, DUPLICATE], [OTHER, NOT_PLANNED]]))?.kind).toBe("Cancelled");
  });
});

describe("an ending from github, folded and reconciled", () => {
  it("completes a reported task and the runtime does no more work on it", () => {
    const ledger = reported();
    const { view, refs } = watch(ledger);
    const fact = endedByIssues(view, refs, new Map([[ISSUE, DONE]]));
    if (!fact) throw new Error("expected a fact");
    ledger.add(fact);

    const after = fold(ledger.now(), ledger.facts);
    expect(after.tasks[0].state).toBe("completed");
    expect(after.tasks[0].position).toBeUndefined();
    expect(reconcile({ snapshot: after, config: CONFIG, judge: () => ({ done: true }), newWorkerId: () => "w9" })).toEqual([]);
  });

  it("cancels a working task and stops its worker", () => {
    const ledger = working();
    const { view, refs } = watch(ledger);
    const fact = endedByIssues(view, refs, new Map([[ISSUE, NOT_PLANNED]]));
    if (!fact) throw new Error("expected a fact");
    ledger.add(fact);

    const after = fold(ledger.now(), ledger.facts);
    expect(after.tasks[0].state).toBe("cancelled");
    expect(after.tasks[0].liveWorker?.workerId).toBe("w1");
    expect(reconcile({ snapshot: after, config: CONFIG, judge: () => ({ done: true }), newWorkerId: () => "w9" })).toEqual([
      { type: "stop", taskId: "t1", workerId: "w1", why: LOST_STOPPED },
    ]);
  });
});
