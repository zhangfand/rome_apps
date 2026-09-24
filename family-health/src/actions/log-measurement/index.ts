import { defineAction, z, type Action, type ActionConfig, type AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { getIndicator } from "../../domain/indicators.js";
import { run, storeFrom } from "../../lib/action-helpers.js";
import { logMeasurement } from "../../lib/service.js";

const schema = z.object({
  member: z.string().describe("成员姓名、id 或称呼"),
  indicator: z.string().describe("指标名称或别名，如 体重、血压、空腹血糖"),
  value: z.union([z.string(), z.number()]).describe('数值；血压用 "128/82"'),
  unit: z.string().optional().describe("单位，如 kg、斤、mmHg、mmol/L、mg/dL"),
  date: z.string().optional().describe("YYYY-MM-DD，省略为今天"),
  note: z.string().optional(),
});

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  return defineAction({
    config,
    schema,
    execute: async (input) =>
      run(() => {
        const { member, measurements } = logMeasurement(storeFrom(deps), { ...input, createdVia: "chat" });
        return {
          member: { id: member.id, name: member.name, relation: member.relation },
          logged: measurements.map((m) => ({ id: m.id, indicator: getIndicator(m.indicatorCode)?.zh ?? m.indicatorCode, value: m.value, unit: m.unit, date: m.measuredAt })),
        };
      }),
  });
}
