import { createAppLogger } from "@rome-os/app-runtime";
import type {
  Action,
  ActionConfig,
  ActionResult,
  AppActionRuntimeDeps,
} from "@rome-os/app-runtime";

const log = createAppLogger("button-demo:hello");

interface HelloInput {
  message?: string;
}

type HelloRuntimeDeps = AppActionRuntimeDeps;

export function createAction(config: ActionConfig, _runtime: HelloRuntimeDeps): Action {
  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Optional note to record" },
      },
      additionalProperties: false,
    },
    execute: async (input: Record<string, unknown>): Promise<ActionResult> => {
      const { message } = input as HelloInput;
      const greeting = message ?? "hello, world";
      log.info("hello action invoked", { greeting });
      // To persist greetings, enable the `db` section in app.yaml and use
      // createHelloRepository(runtime.appContext.db) — see src/db/README.md.
      return { status: "ok", data: { message: greeting } };
    },
  };
}
