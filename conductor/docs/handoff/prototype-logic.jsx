
const T = {
  person: ["var(--accent-wash)", "var(--info-fg)"],
  orch: ["var(--surface-muted)", "var(--muted-foreground)"],
  ask: ["var(--warning-bg)", "var(--warning-fg)"],
  report: ["color-mix(in srgb, var(--primary) 14%, transparent)", "var(--primary-hover)"],
  ok: ["var(--success-bg)", "var(--success-fg)"],
  bad: ["var(--destructive-bg)", "var(--destructive-fg)"],
  world: ["var(--info-bg)", "var(--info-fg)"],
  quiet: ["var(--surface-muted)", "var(--subtle-foreground)"],
};
const LABEL = {
  Created: "request", Reply: "reply", Dispatched: "started work", Opened: "session",
  Returned: "came back", Waited: "waiting", Asked: "question", Reported: "report",
  Completed: "done", Cancelled: "cancelled", Failed: "failed", Lost: "lost", Event: "github",
};
const KIND = {
  Created: T.person, Reply: T.person, Completed: T.ok, Cancelled: T.quiet,
  Dispatched: T.orch, Waited: T.orch, Noted: T.quiet, Asked: T.ask, Reported: T.report,
  Opened: T.quiet, Returned: T.orch, Failed: T.bad, Lost: T.bad, Event: T.world,
};

const SOP = `# SOP: software development

## Goal

Turn the person's request into a change that is **delivered as a pull request
and independently verified to satisfy the request** — then see the task
through until it is genuinely finished. A PR that exists is not the goal; a
PR that a second pair of eyes has checked against what was asked, with the
project's tests and checks passing, is.

## What "done" means

The task is complete when the request has been fulfilled in the world, not
when a worker says it has: the GitHub issue the task came from is closed as
completed, or the person says the result is accepted. An issue closed as not
planned means the work was dropped.

## Quality bar for the delivery

- The change does what was asked — as written in the request and any
  replies, not as a worker reinterpreted it.
- It lives on a pushed branch with an open PR against the default branch;
  if the task came from an issue, the PR closes it (\`Closes #N\`).
- The project's own tests / typecheck / build pass on the PR's head.
- Someone other than the author has read the diff against the request.
- Review feedback people leave on the PR is part of the request.

## Hard lines

- Never merge a PR or close an issue on the person's behalf.
- Never widen scope beyond the request.
- Never claim a result the ledger cannot back.`;

const FACTS = [
  { seq: "#1", kind: "Created", by: "github:zhangfand", byShort: "github", lane: 1, wake: 1, time: "09:02:14",
    title: "Request", body: "Issue #14: the public API has no rate limiting. Add a per-key limit with a sensible default and document it.",
    short: "issue #14 taken in" },
  { seq: "#2", kind: "Dispatched", by: "orchestrator", byShort: "conductor", lane: 2, wake: 1, time: "09:02:31",
    title: "w-4f81ac20 as coding:coding", body: "Implement the limit on a branch and open a PR that closes #14.",
    short: "implementer dispatched",
    extra: "Read the request and the repo's conventions first. Add a per-API-key token bucket in the request pipeline, defaults configurable, with tests. Push to conductor/t-9c41a7d2/rate-limit and open a PR against main with `Closes #14`. Do not merge." },
  { seq: "#3", kind: "Opened", by: "w-4f81ac20", byShort: "worker", lane: 3, wake: 1, time: "09:02:33", noise: true,
    title: "session s-7712ab", body: "Worktree .rome/worktrees/t-9c41a7d2/w-4f81ac20 on conductor/t-9c41a7d2/rate-limit.", short: "session opened" },
  { seq: "#4", kind: "Returned", by: "w-4f81ac20", byShort: "worker", lane: 3, wake: 2, time: "09:19:48", status: "succeeded",
    title: "succeeded · PR #21 at fc621e0", body: "Token bucket per API key, 600 req/min default, configurable via env; 9 tests added; typecheck and test suite pass locally.",
    short: "PR #21 opened",
    extra: "Files changed: src/middleware/rate-limit.ts (new), src/middleware/index.ts, src/config.ts, docs/api.md, test/rate-limit.test.ts.\n\nLocal run: pnpm typecheck ✓ · pnpm test ✓ (223 passed)" },
  { seq: "#5", kind: "Dispatched", by: "orchestrator", byShort: "conductor", lane: 2, wake: 2, time: "09:20:02",
    title: "w-9e22c1f4 as assistant:assistant", body: "Read-only verification of PR #21 against the request.",
    short: "verifier dispatched",
    extra: "You may not write code. Read PR #21's diff against issue #14 and the replies on this task. Report anything missing, wrong, or out of scope, and whether the checks on the head are green." },
  { seq: "#6", kind: "Opened", by: "w-9e22c1f4", byShort: "worker", lane: 3, wake: 2, time: "09:20:04", noise: true,
    title: "session s-7713f0", body: "Read-only worktree at fc621e0.", short: "session opened" },
  { seq: "#7", kind: "Returned", by: "w-9e22c1f4", byShort: "worker", lane: 3, wake: 3, time: "09:26:11", status: "waiting",
    title: "waiting · no checks on fc621e0", body: "The diff matches the request and docs are updated. No checks recorded on head fc621e0 — CI may not be configured in this repository.",
    short: "verified, CI unknown",
    extra: "Checked: limit is per API key (not per IP), default documented in docs/api.md, 429 includes Retry-After. Nothing out of scope." },
  { seq: "#8", kind: "Event", by: "runtime", byShort: "github", lane: 4, wake: 3, time: "09:26:18",
    title: "A second PR appeared", body: "PR #22 was opened from the same branch as PR #21 — nothing on this task had mentioned it yet.",
    short: "a second PR appeared" },
  { seq: "#9", kind: "Waited", by: "orchestrator", byShort: "conductor", lane: 2, wake: 3, time: "09:26:25",
    title: "Waiting until 09:41:25", body: "Give CI 15 minutes to report on fc621e0, and see whether the duplicate PR #22 closes itself.", short: "waiting 15m" },
  { seq: "#10", kind: "Reply", by: "zhangfan", byShort: "you", lane: 1, wake: 4, time: "09:31:02",
    title: "Reply", body: "No CI on this repo yet — proceed. I closed #22.", short: "no CI, proceed" },
  { seq: "#11", kind: "Reported", by: "orchestrator", byShort: "conductor", lane: 2, wake: 4, time: "09:31:19",
    title: "Report", body: "PR #21 is ready: per-key token bucket, 600 req/min by default, documented in docs/api.md, 9 new tests. Verified read-only against issue #14 by a second worker; no CI on this repo. The duplicate PR #22 you closed came from the same branch. Please review and merge — I will not merge for you.",
    short: "reported to you" },
  { seq: "#12", kind: "Event", by: "runtime", byShort: "github", lane: 4, wake: 4, time: "09:34:07",
    title: "You commented on PR #21", body: "zhangfand commented on PR #21: \"reads right — merging after standup\".",
    short: "you commented on the PR" },
];

const WAKES = [
  { n: 1, label: "09:02" }, { n: 2, label: "09:20" }, { n: 3, label: "09:26" }, { n: 4, label: "09:31" },
];

const LONG_REPORT = "PR #34 is ready, and it turned into a bigger change than the issue implied. The settings table had three columns that no longer matched the parsed config shape, so migrating the sop field alone would have left the projects map unreadable on the next boot. I had the implementer write the migration for all three, kept the old columns readable for one release, and added a backfill that runs once on startup. Verification: a second worker read the diff against issue #31 and against the two replies you left on the PR, ran the suite on the head (223 passed), and checked that a database written by the previous release still opens. Two things need your judgement. First, the backfill logs a warning for rows it cannot parse and skips them rather than failing the boot — I chose the conservative option, but it means a malformed row stays malformed until someone looks. Second, the issue asked for the change to be invisible to existing installs, and it is, except that the first boot after upgrade takes about four seconds longer on a large ledger. Please review and merge — I will not merge for you.";

const STRESS_ATTENTION = [
  { id: "t-44c1a0e9", title: "Migrate settings to the new schema", project: "playground", bucket: "attention",
    chip: "halted", tone: T.bad, age: "3m", latestKind: "Event",
    latest: "circuit_breaker — 25 decisions since a person last spoke.",
    text: "I stopped waking this task: 25 decisions have gone by since you last said anything, and the last four were the same two workers disagreeing about whether the backfill should fail the boot. Reply and I will pick it up from there.",
    secondary: "Cancel task", snippets: ["fail the boot", "skip and warn", "cancel this"] },
  { id: "t-9c41a7d2", title: "Rate-limit the public API", project: "playground", bucket: "attention",
    chip: "report", tone: T.report, age: "2m", latestKind: "Reported", latest: "PR #34 is ready — please review and merge.",
    text: LONG_REPORT, secondary: "Mark complete", snippets: ["merged, thanks", "revise: per-IP too", "hold"] },
  { id: "t-3ad81009", title: "Document the task vocabulary", project: "docs-site", bucket: "attention",
    chip: "question", tone: T.ask, age: "1h", latestKind: "Asked", latest: "Should the README cover the internal steps too?",
    text: "Should the README cover the internal steps too, or only what a reader can see happen? It changes what the table promises.",
    secondary: "Cancel task", snippets: ["yes, document it", "internal — leave it out"] },
  { id: "t-77f2ba41", title: "Two workers lost in a row on the importer", project: "ops", bucket: "attention",
    chip: "question", tone: T.ask, age: "26m", latestKind: "Asked", latest: "Two workers died mid-run. Is the box out of memory?",
    text: "Two workers in a row stopped sending heartbeats inside the same step of the CSV importer, four minutes apart. Both worktrees were left behind. I would rather ask than start a third: is the machine short on memory, or should I split the importer step?",
    secondary: "Cancel task", snippets: ["split the step", "it's memory — I'll fix the box"] },
  { id: "t-2b90c7d5", title: "Retire the legacy webhook", project: "playground", bucket: "attention",
    chip: "question", tone: T.ask, age: "2h", latestKind: "Asked", latest: "Two callers still use it. Break them or wait?",
    text: "Two integrations still call the legacy webhook — one is your own staging box, one I cannot identify. Break them, or keep the endpoint alive behind a deprecation header?",
    secondary: "Cancel task", snippets: ["keep it, add the header", "break it"] },
  { id: "t-6de4118b", title: "Weekly work digest by email", project: "ops", bucket: "attention",
    chip: "report", tone: T.report, age: "5h", latestKind: "Reported", latest: "Shipped behind a flag; needs your address.",
    text: "The digest job is merged behind ROME_DIGEST=1. It needs a recipient before it can send anything. Give me an address and I will turn it on.",
    secondary: "Mark complete", snippets: ["use my work address", "leave it off"] },
  { id: "t-15a8f302", title: "Typo sweep across docs", project: "docs-site", bucket: "attention",
    chip: "report", tone: T.report, age: "1d", latestKind: "Reported", latest: "PR #12 — 41 files, no prose rewritten.",
    text: "PR #12 fixes 41 typos across the docs. No sentence was rewritten and no code samples were touched. Verified by a second read against the original text.",
    secondary: "Mark complete", snippets: ["merged, thanks"] },
  { id: "t-c0917ee2", title: "Bump the Node version in CI", project: "playground", bucket: "attention",
    chip: "question", tone: T.ask, age: "2d", latestKind: "Asked", latest: "22 or 24? 24 drops a dependency you pin.",
    text: "Node 24 drops support for one dependency you pin at an old version. 22 is boring and works. Which do you want to live with?",
    secondary: "Cancel task", snippets: ["go to 22", "24 — I'll unpin"] },
];

const TASKS = [
  { id: "t-9c41a7d2", title: "Rate-limit the public API", project: "playground", bucket: "attention",
    chip: "report", tone: T.report, age: "2m", latestKind: "Reported",
    latest: "PR #21 is ready — please review and merge; I will not merge for you.",
    text: "PR #21 is ready: per-key token bucket, 600 req/min by default, documented in docs/api.md, 9 new tests. Verified read-only against issue #14 by a second worker; no CI on this repo. Please review and merge — I will not merge for you.",
    secondary: "Mark complete", waitingFor: "waiting on you · 2m",
    snippets: ["merged, thanks", "not what I asked — revise", "hold, I'll look tomorrow"] },
  { id: "t-3ad81009", title: "Document the task vocabulary", project: "docs-site", bucket: "attention",
    chip: "question", tone: T.ask, age: "1h", latestKind: "Asked",
    latest: "Should the README cover the internal steps too, or only what a reader sees?",
    text: "Should the README cover the internal steps too, or only what a reader can see happen? It changes what the table promises, so I'd rather ask than guess.",
    secondary: "Cancel task", waitingFor: "waiting on you · 58m",
    snippets: ["yes, document it", "internal — leave it out", "ask the docs owner"] },
  { id: "t-7b02f13e", title: "Flaky auth test on CI", project: "playground", bucket: "running",
    chip: "running", tone: T.orch, age: "14m", latestKind: "Event",
    latest: "github/checks_completed — failure on head 8ad10c2 (1 failed, 214 passed)" },
  { id: "t-52e0b81a", title: "Migrate settings to the new schema", project: "playground", bucket: "running",
    chip: "running", tone: T.orch, age: "6m", latestKind: "Dispatched",
    latest: "Back at it with your review feedback" },
  { id: "t-8801fa3c", title: "Nightly snapshot to S3", project: "ops", bucket: "resting",
    chip: "waiting", tone: T.quiet, age: "22m", latestKind: "Waited",
    latest: "Waiting for the 02:00 snapshot window to confirm the upload." },
  { id: "t-1f55b8c0", title: "Make the intake label configurable", project: "playground", bucket: "closed",
    chip: "completed", tone: T.ok, age: "2d", latestKind: "Completed",
    latest: "Issue #9 closed as completed. Evidence: Event #18, PR #11 merged." },
  { id: "t-0e91d446", title: "Switch tick to a 5-minute interval", project: "playground", bucket: "closed",
    chip: "cancelled", tone: T.quiet, age: "4d", latestKind: "Cancelled",
    latest: "Superseded — configured with conductor:setup instead." },
];

class Component extends DCLogic {
  state = {
    clock: 0, page: "board", filter: "All", view: null, hideNoise: null, expanded: {},
    openFacts: {}, replies: {}, drafts: {}, detailDraft: "", sop: SOP, saved: false,
  };
  componentDidMount() {
    this.t0 = Date.now();
    this.timer = setInterval(() => this.setState((s) => ({ clock: s.clock + 1 })), 1000);
  }
  componentWillUnmount() { clearInterval(this.timer); }
  set(patch) { this.setState(patch); }
  elapsed(baseSeconds) {
    const total = baseSeconds + (this.state.clock || 0);
    const m = Math.floor(total / 60);
    return m + "m " + String(total % 60).padStart(2, "0") + "s";
  }
  renderVals() {
    const s = this.state;
    const p = this.props;
    const view = s.view ?? (p.defaultLedgerView ?? "Stream");
    const hideNoise = s.hideNoise ?? (p.hideRuntimeNoise ?? true);
    const page = s.page;
    const tab = (name) => ({
      line: page === name ? "var(--primary)" : "transparent",
      fg: page === name ? "var(--foreground)" : "var(--muted-foreground)",
    });
    const chipOf = (t) => ({ chipBg: t.tone[0], chipFg: t.tone[1] });
    const mode = p.boardState ?? "Live";
    const stressed = mode === "Stressed";
    const quiet = mode === "Quiet";
    const all = stressed ? STRESS_ATTENTION.concat(TASKS) : quiet ? TASKS.filter((t) => t.bucket === "closed") : TASKS;
    const attention = all.filter((t) => t.bucket === "attention").map((t) => ({
      ...t, ...chipOf(t),
      edge: t.chip === "question" ? "var(--warning)" : "var(--primary)",
      replyOpen: !!s.replies[t.id],
      replyLabel: s.replies[t.id] ? "Close reply" : (t.chip === "question" ? "Answer" : "Reply"),
      draft: s.drafts[t.id] ?? "",
      onDraft: (e) => this.setState((st) => ({ drafts: { ...st.drafts, [t.id]: e.target.value } })),
      toggleReply: () => this.setState((st) => ({ replies: { ...st.replies, [t.id]: !st.replies[t.id] } })),
      open: () => this.set({ page: "detail" }),
      long: t.text.length > 320,
      clamp: s.expanded[t.id] ? 99 : 4,
      fullLabel: s.expanded[t.id] ? "show less" : "show all",
      toggleFull: () => this.setState((st) => ({ expanded: { ...st.expanded, [t.id]: !st.expanded[t.id] } })),
      snippets: (t.snippets || []).map((label) => ({
        label, use: () => this.setState((st) => ({ drafts: { ...st.drafts, [t.id]: label } })),
      })),
    }));
    const filters = ["All", "Needs you", "Running", "Resting", "Closed"].map((label) => {
      const on = s.filter === label;
      const count = label === "All" ? all.length
        : label === "Needs you" ? all.filter((t) => t.bucket === "attention").length
        : label === "Running" ? all.filter((t) => t.bucket === "running").length
        : label === "Resting" ? all.filter((t) => t.bucket === "resting").length
        : all.filter((t) => t.bucket === "closed").length;
      return { label, count,
        bg: on ? "var(--background)" : "transparent",
        fg: on ? "var(--foreground)" : "var(--muted-foreground)",
        shadow: on ? "var(--shadow-xs)" : "none",
        pick: () => this.set({ filter: label }) };
    });
    const bucketFor = { "Needs you": "attention", Running: "running", Resting: "resting", Closed: "closed" };
    const rows = all.filter((t) => s.filter === "All" || t.bucket === bucketFor[s.filter]).map((t) => ({
      ...t, ...chipOf(t),
      fresh: t.bucket === "attention" || t.bucket === "running",
      open: () => this.set({ page: "detail" }),
    }));
    const factView = (f) => {
      const tone = f.status === "succeeded" ? T.ok : f.status === "waiting" ? T.ask : (KIND[f.kind] || T.quiet);
      const restates = ["Request", "Reply", "Report", "Question", "Note"].includes(f.title);
      return { ...f, chipBg: tone[0], chipFg: tone[1], title: restates ? "" : f.title,
        label: LABEL[f.kind] || f.kind,
        who: f.kind === "Event" ? "github" : f.byShort,
        byShort: f.kind === "Event" ? "" : f.byShort,
        byFg: f.lane === 1 ? "var(--info-fg)" : f.lane === 2 ? "var(--foreground)" : "var(--muted-foreground)",
        cardBg: f.noise ? "var(--background)" : "var(--surface)",
        oneLine: restates ? f.body : f.title + " — " + f.body,
        lead: restates ? f.body : f.title,
        showExtra: !!s.openFacts[f.seq],
        toggleLabel: (s.openFacts[f.seq] ? "hide " : "show ") + (f.kind === "Dispatched" ? "instructions" : "detail"),
        toggle: () => this.setState((st) => ({ openFacts: { ...st.openFacts, [f.seq]: !st.openFacts[f.seq] } })) };
    };
    const visible = FACTS.filter((f) => !(hideNoise && f.noise)).map(factView);
    return {
      onBoard: page === "board", onTasks: page === "tasks", onDetail: page === "detail", onConfig: page === "config",
      goBoard: () => this.set({ page: "board" }), goTasks: () => this.set({ page: "tasks" }), goConfig: () => this.set({ page: "config" }),
      tabBoardLine: tab("board").line, tabBoardFg: tab("board").fg,
      tabTasksLine: tab("tasks").line, tabTasksFg: tab("tasks").fg,
      tabConfigLine: tab("config").line, tabConfigFg: tab("config").fg,
      attentionCount: attention.length, taskCount: all.length,
      isLoading: mode === "Loading", isError: mode === "Error", isUnconfigured: mode === "Not configured",
      boardReady: !["Loading", "Error", "Not configured"].includes(mode),
      attentionEmpty: attention.length === 0,
      tickLabel: "NEXT RUN IN 2:41",
      tickNow: () => {},
      attention, attentionSub: "",
      runningEmpty: quiet,
      running: quiet ? [] : (stressed ? [
        { title: "Two workers lost in a row on the importer", phase: "third attempt, importing 1.2M rows", elapsed: this.elapsed(1284), fresh: true, open: () => this.set({ page: "detail" }) },
        { title: "Retire the legacy webhook", phase: "mapping every caller in the logs", elapsed: this.elapsed(640), fresh: false, open: () => this.set({ page: "detail" }) },
        { title: "Bump the Node version in CI", phase: "running the suite on Node 24", elapsed: this.elapsed(95), fresh: true, open: () => this.set({ page: "detail" }) },
      ] : [
        { agent: "coding", title: "Migrate settings to the new schema", phase: "revising PR #19 after review", elapsed: this.elapsed(372), fresh: true, open: () => this.set({ page: "detail" }) },
        { agent: "assistant", title: "Flaky auth test on CI", phase: "diagnosing the failing check", elapsed: this.elapsed(228), fresh: false, open: () => this.set({ page: "detail" }) },
      ]),
      runningSub: quiet ? "" : stressed ? "3 of 3 at once" : "2 of 3 at once",
      restingEmpty: all.filter((t) => t.bucket === "resting").length === 0,
      resting: all.filter((t) => t.bucket === "resting").map((t) => ({
        ...t, ...chipOf(t), why: t.latest, when: "continues in 9m", open: () => this.set({ page: "detail" }),
      })),
      restingSub: "",
      filters, rows, tableSub: rows.length + " of " + TASKS.length + " tasks",
      views: ["Stream", "Lanes", "Table"].map((label) => ({
        label, bg: view === label ? "var(--background)" : "transparent",
        fg: view === label ? "var(--foreground)" : "var(--muted-foreground)",
        shadow: view === label ? "var(--shadow-xs)" : "none",
        pick: () => this.set({ view: label }),
      })),
      isStream: view === "Stream", isLanes: view === "Lanes", isTable: view === "Table",
      hideNoise, toggleNoise: () => this.set({ hideNoise: !hideNoise }),
      wakes: WAKES.map((w) => ({ ...w, facts: visible.filter((f) => f.wake === w.n) })),
      laneFacts: visible, tableFacts: visible,
      detailDraft: s.detailDraft,
      onDetailDraft: (e) => this.set({ detailDraft: e.target.value }),
      detailSnippets: ["merged, thanks", "revise: per-IP too", "stop and report"].map((label) => ({
        label, use: () => this.set({ detailDraft: label }),
      })),
      sopText: s.sop,
      onSop: (e) => this.set({ sop: e.target.value, saved: false }),
      saveSop: () => this.set({ saved: true }),
      resetSop: () => this.set({ sop: SOP, saved: false }),
      sopMeta: "global sop · markdown · " + s.sop.length.toLocaleString("en-US") + " chars",
      dirtyLabel: s.sop !== SOP ? "unsaved changes" : "",
      savedLabel: s.saved ? "Saved." : "",
      projects: [
        { id: "playground", workingDir: "~/code/playground", repoLine: "zhangfand/playground · label \"conductor\"", ownSop: false, intakeLabel: "intake on", intakeFg: "var(--success-fg)" },
        { id: "docs-site", workingDir: "~/code/docs-site", repoLine: "zhangfand/docs-site · labels \"conductor\" + \"docs\"", ownSop: true, intakeLabel: "intake on", intakeFg: "var(--success-fg)" },
        { id: "ops", workingDir: "~/code/ops", repoLine: "no repo · chat intake only", ownSop: false, intakeLabel: "intake off", intakeFg: "var(--subtle-foreground)" },
      ],
      runtime: [
        { k: "Orchestrator", v: "conductor:orchestrator" },
        { k: "Max workers", v: "3" },
        { k: "Tick every", v: "5 min" },
        { k: "Reuse sessions", v: "true" },
        { k: "Decisions per turn", v: "25" },
        { k: "Heartbeat lease", v: "90s" },
      ],
      agents: [
        { id: "coding:coding", what: "writes code in an isolated worktree, runs the project's tests, pushes a branch and opens the PR." },
        { id: "assistant:assistant", what: "read-only: research, and independent verification of a PR against the request." },
      ],
    };
  }
}
