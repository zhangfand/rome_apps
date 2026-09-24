import { defineAction, z, type Action, type ActionConfig, type AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { sanitizeGoals } from "../../domain/panels.js";
import { run, storeFrom } from "../../lib/action-helpers.js";
import { resolveDate } from "../../lib/dates.js";
import { UserFacingError, normalizeRelation, normalizeSex, publicMember } from "../../lib/service.js";

const schema = z.object({
  name: z.string().describe("成员姓名"),
  relation: z.string().optional().describe("本人/配偶/父亲/母亲/子女/其他"),
  sex: z.string().optional().describe("male/female 或 男/女"),
  birth_date: z.string().optional().describe("出生日期 YYYY-MM-DD"),
  height_cm: z.number().optional().describe("身高（厘米）"),
  goals: z.array(z.string()).optional().describe("weight_metabolic / lipid_cardio / liver / senior"),
});

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  return defineAction({
    config,
    schema,
    execute: async (input) =>
      run(() => {
        const store = storeFrom(deps);
        const name = input.name.trim();
        if (!name) throw new UserFacingError("请提供成员姓名。", "missing_name");
        if (store.listMembers().some((m) => m.name === name)) throw new UserFacingError(`已经有名为“${name}”的成员。`, "duplicate_member");
        const birthDate = input.birth_date ? resolveDate(input.birth_date) : null;
        if (input.birth_date && !birthDate) throw new UserFacingError(`无法理解出生日期“${input.birth_date}”。`, "invalid_date");
        const member = store.createMember({
          name,
          relation: normalizeRelation(input.relation),
          sex: normalizeSex(input.sex),
          birthDate,
          heightCm: input.height_cm ?? null,
          goals: sanitizeGoals(input.goals ?? []),
        });
        return { member: publicMember(member) };
      }),
  });
}
