import { describe, expect, it } from "@rstest/core";
import { createSaveQueue, deriveProjectStatus, saveStatusText, type SaveQueue } from "./configuration.js";

/** A promise whose resolution the test controls. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("createSaveQueue", () => {
  it("runs a single enqueued value once", async () => {
    const saved: string[] = [];
    const gate = deferred();
    const queue = createSaveQueue<string>({
      save: (value) => {
        saved.push(value);
        return gate.promise;
      },
    });

    queue.enqueue("a");
    expect(queue.status).toEqual({ state: "saving" });
    gate.resolve();
    await flush();

    expect(saved).toEqual(["a"]);
    expect(queue.status).toEqual({ state: "idle" });
  });

  it("coalesces rapid changes into one trailing save", async () => {
    const saved: string[] = [];
    const gates = [deferred(), deferred()];
    let call = 0;
    const queue = createSaveQueue<string>({
      save: (value) => {
        saved.push(value);
        return gates[call++]!.promise;
      },
    });

    queue.enqueue("a"); // starts immediately
    queue.enqueue("b"); // coalesced away
    queue.enqueue("c"); // becomes the pending value
    expect(saved).toEqual(["a"]);

    gates[0]!.resolve();
    await flush();

    expect(saved).toEqual(["a", "c"]);
    expect(queue.status).toEqual({ state: "saving" });

    gates[1]!.resolve();
    await flush();
    expect(queue.status).toEqual({ state: "idle" });
  });

  it("preserves ordering: a slow save is never overwritten by an older value", async () => {
    const saved: string[] = [];
    const gates = [deferred(), deferred()];
    let call = 0;
    const queue = createSaveQueue<string>({
      save: (value) => {
        saved.push(value);
        return gates[call++]!.promise;
      },
    });

    queue.enqueue("first"); // slow, in flight
    queue.enqueue("second"); // waits for the first
    // The second save must not start until the first resolves.
    await flush();
    expect(saved).toEqual(["first"]);

    gates[0]!.resolve();
    await flush();
    expect(saved).toEqual(["first", "second"]);
  });

  it("surfaces a save error with a composed reason", async () => {
    const gate = deferred();
    const queue = createSaveQueue<string>({
      save: () => gate.promise,
      errorReason: () => "the server refused",
    });

    queue.enqueue("a");
    gate.reject(new Error("boom"));
    await flush();

    expect(queue.status).toEqual({ state: "error", reason: "the server refused" });
  });

  it("notifies subscribers on status changes", async () => {
    const gate = deferred();
    const queue: SaveQueue<string> = createSaveQueue<string>({ save: () => gate.promise });
    let ticks = 0;
    const unsubscribe = queue.subscribe(() => {
      ticks += 1;
    });

    queue.enqueue("a"); // -> saving
    gate.resolve();
    await flush(); // -> idle

    expect(ticks).toBe(2);
    unsubscribe();
  });
});

describe("saveStatusText", () => {
  it("maps the three UI strings exactly", () => {
    expect(saveStatusText({ state: "saving" })).toBe("Saving…");
    expect(saveStatusText({ state: "idle" })).toBe("All changes saved");
    expect(saveStatusText({ state: "error", reason: "the server refused" }))
      .toBe("Couldn't save — the server refused");
  });
});

describe("deriveProjectStatus", () => {
  it("is ready when the workspace inspects clean", () => {
    expect(deriveProjectStatus({ exists: true, isRepository: true }, null, false, false))
      .toEqual({ tone: "ready", label: "Ready" });
  });

  it("is an error with a reason when the directory is missing", () => {
    expect(deriveProjectStatus({ exists: false, isRepository: false }, null, false, false))
      .toEqual({ tone: "error", label: "Error", reason: "Working directory does not exist." });
  });

  it("carries the problem text as the error reason", () => {
    expect(deriveProjectStatus({ exists: true, isRepository: false, problem: "Directory is empty." }, null, false, false))
      .toEqual({ tone: "error", label: "Error", reason: "Directory is empty." });
  });

  it("is an error when nothing is known yet", () => {
    expect(deriveProjectStatus(null, null, false, false))
      .toEqual({ tone: "error", label: "Error", reason: "Workspace has not been checked yet." });
  });

  it("carries an inspection error as the reason", () => {
    expect(deriveProjectStatus(null, "Working directory must be absolute.", false, false))
      .toEqual({ tone: "error", label: "Error", reason: "Working directory must be absolute." });
  });

  it("is cloning while a clone is in flight, over any other signal", () => {
    expect(deriveProjectStatus(null, "some error", true, false))
      .toEqual({ tone: "cloning", label: "Cloning" });
  });

  it("is ready when the workspace needs no directory", () => {
    expect(deriveProjectStatus(null, null, false, true))
      .toEqual({ tone: "ready", label: "Ready" });
  });
});
