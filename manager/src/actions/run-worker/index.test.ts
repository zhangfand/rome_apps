import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prepareWorkspace } from "../../lib/worktree.js";
import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import type { ActionConfig, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import * as ledgerModule from "../../db/repositories/ledger.js";
import * as healthModule from "../../db/repositories/worker-health.js";
import { HEARTBEAT_INTERVAL_MS } from "../../lib/worker-health.js";
import * as settingsModule from "../../db/repositories/settings.js";
import { createAction } from "./index.js";
import { foldTask } from "../../lib/fold.js";
import { type Fact, isWorkerTerminalKind } from "../../lib/facts.js";
import { parseConfig } from "../../lib/config.js";
import { LedgerBuilder } from "../../lib/test-facts.js";

const WAIT = { outcome: "waiting", reason: "Check job /jobs/7 again", revisitAfterSeconds: 300 };
let b: LedgerBuilder;

let parent: string;
afterEach(async () => {
  rs.useRealTimers();
  if (parent) await rm(parent, { recursive: true, force: true });
});
beforeEach(async () => {
  parent = await mkdtemp(path.join(tmpdir(), "manager-protocol-test-"));
  const source = path.join(parent, "repo");
  await mkdir(source);
  const git = (...args: string[]) => execFileSync("git", ["-C", source, ...args], { stdio: "pipe" });
  git("init", "-b", "main");
  await writeFile(path.join(source, "code.txt"), "fixture");
  git("add", "code.txt");
  git(
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-m",
    "fixture",
  );
  const workspace = await prepareWorkspace({ workingDir: source, taskId: "t1", workerId: "w0" });
  const config = parseConfig({ workingDir: source });
  if (!config.ok) throw new Error(config.error);
  rs.restoreAllMocks();
  rs.spyOn(settingsModule.SettingsRepository.prototype, "get").mockReturnValue(config.config);
  b = new LedgerBuilder()
    .add({ taskId: "t1", kind: "Created", by: "ann", payload: { brief: "task brief" } })
    .add({ taskId: "t1", kind: "Taken", by: "runtime", payload: {} })
    .add({
      taskId: "t1",
      kind: "Started",
      by: "runtime",
      payload: { workerId: "w0", prompt: "go", replyProtocol: 1, workspace },
    });
  rs.spyOn(ledgerModule.LedgerRepository.prototype, "factsFor").mockImplementation((id) =>
    b.facts.filter((f) => f.taskId === id),
  );
  rs.spyOn(ledgerModule.LedgerRepository.prototype, "append").mockImplementation((fact) => {
    b.add(fact, 0);
    return b.facts.at(-1)!;
  });
  rs.spyOn(ledgerModule.LedgerRepository.prototype, "appendWorkerOutcome").mockImplementation((fact) => {
    if (
      b.facts.some(
        (f) =>
          isWorkerTerminalKind(f.kind) &&
          (f.payload as { workerId?: string }).workerId === fact.payload.workerId,
      )
    )
      return undefined;
    b.add(fact, 0);
    return b.facts.at(-1)!;
  });
});

type Response = { reply?: string; error?: string; beforeReturn?: () => void | Promise<void> };
async function execute(responses: Response[]) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const reconciles: string[] = [];
  const ctx = {
    db: {},
    invokeAction: (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      const response = responses.shift();
      if (!response) throw new Error("Unexpected summon");
      return {
        events: (async function* () {
          if (!response.error)
            yield {
              type: "rome_session_started",
              agentName: "coding:coding",
              romeSession: { _romeSessionId: "rome-s1", _type: "coding" },
            };
        })(),
        result: Promise.resolve().then(async () => {
          await response.beforeReturn?.();
          return response.error
            ? { status: "error", error: response.error }
            : { status: "ok", data: { result: response.reply, sessionId: "s1" } };
        }),
      };
    },
    runAction: async (name: string) => {
      reconciles.push(name);
      return { status: "ok" };
    },
  };
  const action = createAction({} as ActionConfig, { appContext: ctx } as unknown as AppActionRuntimeDeps);
  const result = await action.execute({ taskId: "t1", workerId: "w0" });
  return { calls, reconciles, result };
}
function terminal(): Fact | undefined {
  return b.facts.find((f) => f.kind === "Returned" || f.kind === "Failed");
}

describe("run_worker protocol wiring", () => {
  it("receives the reply from summon, validates it, records the session, then reconciles", async () => {
    const { calls, reconciles } = await execute([{ reply: JSON.stringify(WAIT) }]);
    expect(calls).toEqual([{ name: "system:summon", args: { agentName: "coding:coding", prompt: "go" } }]);
    expect(terminal()).toMatchObject({
      kind: "Returned",
      payload: { reply: JSON.stringify(WAIT), result: WAIT, sessionId: "s1" },
    });
    expect(reconciles).toEqual(["manager:reconcile"]);
    expect(foldTask(b.facts).liveWorker).toBeUndefined();
  });
  it("uses the returned session for one format-only repair", async () => {
    const { calls } = await execute([{ reply: "Pending" }, { reply: JSON.stringify(WAIT) }]);
    expect(calls).toHaveLength(2);
    expect(calls[1].args.sessionId).toBe("s1");
    expect(calls[1].args.prompt).toContain("single format-repair attempt");
    expect(terminal()).toMatchObject({
      kind: "Returned",
      payload: { result: WAIT, repair: { originalReply: "Pending" } },
    });
  });
  it("records a protocol failure after the one repair fails", async () => {
    const { calls } = await execute([{ reply: "Pending" }, { reply: "Not JSON" }]);
    expect(calls).toHaveLength(2);
    expect(terminal()).toMatchObject({
      kind: "Failed",
      payload: { failureKind: "reply_protocol", reply: "Not JSON", repair: { originalReply: "Pending" } },
    });
  });
  it("does not require the new contract from an old in-flight worker", async () => {
    const start = b.facts.at(-1)!;
    if (start.kind === "Started") delete start.payload.replyProtocol;
    const { calls } = await execute([{ reply: "Old prose summary" }]);
    expect(calls).toHaveLength(1);
    expect(terminal()).toMatchObject({ kind: "Returned", payload: { reply: "Old prose summary" } });
    expect((terminal()?.payload as { result?: unknown }).result).toBeUndefined();
  });
  it("resumes using the recorded session and falls back fresh if the runner rejects it", async () => {
    const start = b.facts.at(-1)!;
    if (start.kind === "Started") start.payload.resumeSessionId = "previous-session";
    const { calls } = await execute([
      { error: "Session was not found or cannot be resumed" },
      { reply: JSON.stringify(WAIT) },
    ]);
    expect(calls[0].args.sessionId).toBe("previous-session");
    expect(calls[1].args.sessionId).toBeUndefined();
    expect(calls[1].args.prompt).toContain("task brief");
    expect(calls[1].args.prompt).toContain("Worker reply protocol v1");
    expect(b.facts.some((f) => f.kind === "Restarted")).toBe(true);
    expect(terminal()).toMatchObject({ kind: "Returned", payload: { result: WAIT } });
  });
  it("does not repair or append a late outcome after the worker was stopped", async () => {
    const { calls } = await execute([
      {
        reply: "Pending",
        beforeReturn: () => {
          b.add(
            {
              taskId: "t1",
              kind: "Lost",
              by: "runtime",
              payload: { workerId: "w0", why: "stopped by runtime" },
            },
            0,
          );
        },
      },
    ]);
    expect(calls).toHaveLength(1);
    expect(terminal()).toBeUndefined();
  });
});


describe("run_worker heartbeat wiring", () => {
  function monitored() {
    const start = b.facts.at(-1)!;
    if (start.kind === "Started") start.payload.heartbeatProtocol = 1;
    const claim = rs.spyOn(healthModule.WorkerHealthRepository.prototype, "claim").mockReturnValue(true);
    const renew = rs.spyOn(healthModule.WorkerHealthRepository.prototype, "renew").mockReturnValue(true);
    rs.useFakeTimers();
    return { claim, renew };
  }
  it("keeps beating while summon is quiet and stops before reconciliation", async () => {
    const { claim, renew } = monitored();
    const { result } = await execute([{ reply: JSON.stringify(WAIT), beforeReturn: () => {
      expect(claim).toHaveBeenCalledTimes(1);
      rs.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 2);
      expect(renew).toHaveBeenCalledTimes(2);
    } }]);
    expect(result.status).toBe("ok");
    rs.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 10);
    expect(renew).toHaveBeenCalledTimes(2);
    expect(renew.mock.calls[0].slice(0, 2)).toEqual(["t1", "w0"]);
  });
  it("cleans up the timer on failure", async () => {
    const { renew } = monitored();
    await execute([{ error: "provider died", beforeReturn: () => { rs.advanceTimersByTime(HEARTBEAT_INTERVAL_MS); } }]);
    expect(terminal()?.kind).toBe("Failed");
    rs.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 5);
    expect(renew).toHaveBeenCalledTimes(1);
  });
  it("covers resumed execution, fresh fallback, and reply repair with one lease", async () => {
    const { claim, renew } = monitored();
    const start = b.facts.at(-1)!;
    if (start.kind === "Started") start.payload.resumeSessionId = "old-session";
    const beforeReturn = () => { rs.advanceTimersByTime(HEARTBEAT_INTERVAL_MS); };
    const { calls } = await execute([
      { error: "Session was not found or cannot be resumed", beforeReturn },
      { reply: "bad protocol", beforeReturn },
      { reply: JSON.stringify(WAIT), beforeReturn },
    ]);
    expect(calls).toHaveLength(3);
    expect(claim).toHaveBeenCalledTimes(1);
    expect(renew).toHaveBeenCalledTimes(3);
    rs.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 5);
    expect(renew).toHaveBeenCalledTimes(3);
  });
  it("does not invoke an agent for a duplicate, closed, or late lease claim", async () => {
    const { claim, renew } = monitored();
    claim.mockReturnValue(false);
    const { calls, result } = await execute([]);
    expect(calls).toEqual([]);
    expect(result).toMatchObject({ status: "ok", data: { outcome: "skipped (heartbeat lease unavailable)" } });
    rs.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 5);
    expect(renew).not.toHaveBeenCalled();
  });
  it("does not launch a fresh fallback after heartbeat observation closed the worker", async () => {
    monitored();
    const start = b.facts.at(-1)!;
    if (start.kind === "Started") start.payload.resumeSessionId = "old-session";
    const { calls } = await execute([{ error: "Session was not found or cannot be resumed", beforeReturn: () => {
      b.add({ taskId: "t1", kind: "Lost", by: "runtime", payload: { workerId: "w0", why: "heartbeat expired" } }, 0);
    } }]);
    expect(calls).toHaveLength(1);
    expect(terminal()).toBeUndefined();
    expect(b.facts.some((fact) => fact.kind === "Restarted")).toBe(false);
  });
  it("does not retrofit historical Started facts with fictitious heartbeats", async () => {
    const claim = rs.spyOn(healthModule.WorkerHealthRepository.prototype, "claim");
    await execute([{ reply: JSON.stringify(WAIT) }]);
    expect(claim).not.toHaveBeenCalled();
  });
});
