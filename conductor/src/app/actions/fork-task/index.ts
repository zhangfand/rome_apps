import type { Action, ActionConfig, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { createAction as createCoreAction } from "../../../core/actions/fork-task/index.js";

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  return createCoreAction(config, deps);
}
