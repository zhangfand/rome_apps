import type { RomeAppApiHandler, RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import { createBoardRepository } from "../db/repositories/board.js";
import { createLedgerRepository } from "../db/repositories/ledger.js";
import { createLockRepository, RECONCILE_LOCK } from "../db/repositories/lock.js";
import { createSettingsRepository } from "../db/repositories/settings.js";
import { buildView, summarizeFact, workersOf } from "../lib/view.js";
import { fold, foldTask } from "../lib/fold.js";
import { readProjectBinding, resolveBoardProject } from "../lib/projects.js";
import { buildBoardState, openTaskForIssue } from "../lib/board.js";
import { GithubError, listRepositories, syncRepository, type SyncDeps } from "../lib/board-sync.js";
import { briefFromIssue, type IntakeIssue } from "../lib/intake.js";

/**
 * The task dashboard is a fold over the ledger. Board routes additionally
 * maintain a disposable GitHub read model and selection; Implement goes
 * through manager:create rather than writing the ledger here.
 *
 *   GET state            the whole dashboard: counts, tasks, workers, ledger
 *   GET tasks/:id        one task with every fact and worker on it
 *   * board/*             GitHub snapshot, selection, and Implement routes
 */
class ManagerApiHandler implements RomeAppApiHandler {
  private readonly syncDeps: SyncDeps;

  constructor(private readonly ctx: RomeAppContext) {
    this.syncDeps = {
      runAction: ctx.runAction.bind(ctx),
      db: ctx.db,
      log: ctx.log,
    };
  }

  async handle(request: RomeAppApiRequest): Promise<Response> {
    const route = request.path.join("/");
    const ledger = createLedgerRepository(this.ctx.db);
    const board = createBoardRepository(this.ctx.db);
    const settings = createSettingsRepository(this.ctx.db);
    const locks = createLockRepository(this.ctx.db);

    try {
      if (request.path[0] === "board" && request.caller.kind !== "guardian") {
        return json({ error: "forbidden" }, 403);
      }

      if (request.method === "GET" && route === "board/repositories") {
        return json({ repositories: await listRepositories(this.syncDeps) });
      }

      if (request.method === "GET" && route === "board/state") {
        const requested = request.query.get("repo");
        if (requested !== null && !isRepo(requested)) return json({ error: "invalid_repo" }, 400);
        const selectedRepo = requested ?? board.getSelectedRepo();
        const graph = selectedRepo ? board.getSnapshot(selectedRepo) : null;
        if (!ledger.reachable()) return json({ error: "the ledger is unreachable" }, 503);
        const facts = ledger.all();
        const ledgerSnapshot = fold(new Date(), facts);
        const managerView = buildView({
          now: ledgerSnapshot.now,
          facts,
          config: settings.get(),
          lock: locks.peek(RECONCILE_LOCK),
        });
        return json({
          selectedRepo,
          snapshot: graph ? buildBoardState(graph, ledgerSnapshot) : null,
          // Supplies worker session pointers for the existing WorkerLink component.
          managerTasks: managerView.tasks.filter((task) => task.state === "created" || task.state === "taken"),
        });
      }

      if (request.method === "POST" && route === "board/selection") {
        const body = readJsonBody<{ repo?: string }>(request);
        if (body === undefined) return json({ error: "invalid_json" }, 400);
        if (!body?.repo || !isRepo(body.repo)) return json({ error: "invalid_repo" }, 400);
        board.setSelectedRepo(body.repo);
        return json({ selectedRepo: body.repo, snapshot: board.getSnapshot(body.repo) });
      }

      if (request.method === "POST" && route === "board/sync") {
        const body = readJsonBody<{ repo?: string }>(request);
        if (body === undefined) return json({ error: "invalid_json" }, 400);
        if (!body?.repo || !isRepo(body.repo)) return json({ error: "invalid_repo" }, 400);
        return json({ snapshot: await syncRepository(this.syncDeps, body.repo) });
      }

      if (request.method === "POST" && route === "board/implement") {
        const body = readJsonBody<{ issueId?: string }>(request);
        if (body === undefined) return json({ error: "invalid_json" }, 400);
        if (!body?.issueId || typeof body.issueId !== "string" || body.issueId.length > 512) {
          return json({ error: "invalid_issue_id" }, 400);
        }
        const selectedRepo = board.getSelectedRepo();
        if (!selectedRepo) return json({ error: "repository_not_selected" }, 409);
        const graph = board.getSnapshot(selectedRepo);
        if (!graph) return json({ error: "snapshot_missing" }, 404);
        const issue = graph.nodes.find((candidate) => candidate.id === body.issueId);
        if (!issue || !graph.epics.some((epic) => epic.issueIds.includes(issue.id))) {
          return json({ error: "issue_not_found" }, 404);
        }
        if (!ledger.reachable()) return json({ error: "the ledger is unreachable" }, 503);
        const ledgerSnapshot = fold(new Date(), ledger.all());
        const existing = openTaskForIssue(ledgerSnapshot, issue);
        if (existing) {
          return json(
            {
              error: "issue_already_in_progress",
              message: `An open Manager task already names ${issue.url}.`,
              taskId: existing.id,
            },
            409,
          );
        }
        const joined = buildBoardState(graph, ledgerSnapshot).nodes.find((candidate) => candidate.id === issue.id);
        if (joined?.boardStatus !== "ready") {
          return json(
            { error: "issue_not_ready", message: "This issue is closed or still blocked. Refresh the board and try again." },
            409,
          );
        }

        const intakeIssue: IntakeIssue = {
          url: issue.url,
          repo: issue.repo,
          number: issue.number,
          title: issue.title,
          body: issue.body,
          author: issue.author,
          state: "open",
          isPullRequest: false,
        };
        const config = settings.get();
        if (!config) return json({ error: "manager_not_configured" }, 409);
        let projectId: string;
        try { projectId = resolveBoardProject(config, issue.repo, issue.labels.map((l) => l.name)).projectId; }
        catch (error) { return json({ error: "project_routing_required", message: error instanceof Error ? error.message : String(error) }, 409); }
        const result = await this.ctx.runAction("manager:create", {
          projectId,
          brief: briefFromIssue(intakeIssue),
          source: `Implement pressed on the board: ${issue.url}`,
        });
        if (result.status !== "ok") {
          const error = result.status === "error" ? result.error : `manager:create returned ${result.status}`;
          return json({ error: "manager_create_failed", message: error }, 502);
        }
        const taskId = (result.data as { taskId?: string } | undefined)?.taskId;
        return json({ taskId, issueId: issue.id }, 201);
      }

      if (request.method === "GET" && route === "state") {
        if (!ledger.reachable()) return json({ error: "the ledger is unreachable" }, 503);
        const limit = clampInt(request.query.get("ledgerLimit"), 200, 1, 2000);
        const view = buildView({
          projectId: request.query.get("projectId") || undefined,
          now: new Date(),
          facts: ledger.all(),
          config: settings.get(),
          lock: locks.peek(RECONCILE_LOCK),
        });
        return json({ ...view, ledger: view.ledger.slice(0, limit) });
      }

      if (request.method === "GET" && request.path[0] === "tasks" && request.path.length === 2) {
        const taskId = request.path[1];
        const facts = ledger.factsFor(taskId);
        if (facts.length === 0) return json({ error: "task not found" }, 404);
        const now = new Date();
        const task = foldTask(facts);
        const binding = readProjectBinding(task, settings.get());
        return json({
          id: task.id,
          ...binding,
          brief: task.brief,
          state: task.state,
          position: task.position,
          waiting: task.waiting,
          liveWorkerId: task.liveWorker?.workerId,
          startsSinceLastPersonFact: task.startsSinceLastPersonFact,
          facts: task.facts.map(summarizeFact),
          workers: workersOf(task.id, task.brief, task.facts, now).map((w) => ({ ...w, projectId: binding.projectId })),
        });
      }

      return json({ error: "not_found" }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ctx.log.error("manager api failed", { route, error: message });
      if (error instanceof GithubError) {
        return json(
          {
            error: error.connectionRequired ? "github_connection_required" : "github_request_failed",
            message,
          },
          error.connectionRequired ? 503 : 502,
        );
      }
      return json({ error: message }, 500);
    }
  }
}

const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function isRepo(value: string): boolean {
  return REPO.test(value);
}

function readJsonBody<T>(request: RomeAppApiRequest): T | null | undefined {
  if (!request.body || request.body.byteLength === 0) return null;
  try {
    return JSON.parse(new TextDecoder().decode(request.body)) as T;
  } catch {
    return undefined;
  }
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function createApiHandler(ctx: RomeAppContext): RomeAppApiHandler {
  return new ManagerApiHandler(ctx);
}
