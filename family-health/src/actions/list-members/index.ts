import { defineAction, z, type Action, type ActionConfig, type AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { run, storeFrom } from "../../lib/action-helpers.js";
import { memberCard } from "../../lib/service.js";

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  return defineAction({
    config,
    schema: z.object({}),
    execute: async () =>
      run(() => {
        const store = storeFrom(deps);
        return {
          members: store.listMembers().map((m) => {
            const card = memberCard(store, m);
            return {
              id: m.id,
              name: m.name,
              relation: m.relation,
              sex: m.sex === "male" ? "男" : m.sex === "female" ? "女" : null,
              age: card.member.age,
              goals: m.goals,
              is_demo: m.isDemo,
              latest_exam_date: card.overview.latestExamDate,
              abnormal_count: card.overview.abnormalCount,
              active_interventions: card.activeInterventions.map((i) => i.title),
            };
          }),
        };
      }),
  });
}
