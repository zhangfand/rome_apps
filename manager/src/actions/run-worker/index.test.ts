import { beforeEach, describe, expect, it, rs } from "@rstest/core";
import type { ActionConfig, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import * as ledgerModule from "../../db/repositories/ledger.js";
import * as settingsModule from "../../db/repositories/settings.js";
import { createAction } from "./index.js";
import { foldTask } from "../../lib/fold.js";
import { type Fact, isWorkerTerminalKind } from "../../lib/facts.js";
import { parseConfig } from "../../lib/config.js";
import { LedgerBuilder } from "../../lib/test-facts.js";

const WAIT = { outcome: "waiting", reason: "Check job /jobs/7 again", revisitAfterSeconds: 300 };
let b: LedgerBuilder;

beforeEach(() => {
  const config = parseConfig({ workingDir: "/srv/project" });
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
      payload: { workerId: "w0", prompt: "go", replyProtocol: 1 },
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

type Response = { reply?: string; error?: string; beforeReturn?: () => void };
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
        result: Promise.resolve().then(() => {
          response.beforeReturn?.();
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
