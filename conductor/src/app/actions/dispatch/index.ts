import type { Action, ActionConfig, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { createAction as createCoreAction } from "../../../core/actions/dispatch/index.js";
import { APP_COMPOSITION } from "../../composition.js";

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  return createCoreAction(config, deps, APP_COMPOSITION);
}
