---
name: log-from-chat
description: Use when the user mentions family health data in chat — a lifestyle change or medication they started/stopped (运动、饮食、用药、睡眠), a home measurement (体重、血压、血糖), or asks how a family member's checkup indicator is trending (e.g. "我爸的尿酸这两年怎么样"). Turns the utterance into 家庭体检助手 action calls.
---

# 家庭体检助手：从聊天记录数据

Actions (canonical ids):

| Intent | Action |
|---|---|
| 谁是谁 / 有哪些成员 | `family-health:family_health_list_members` |
| 新增成员 | `family-health:family_health_add_member` |
| 开始一项生活方式/用药调整 | `family-health:family_health_log_intervention` |
| 停止/结束一项调整 | `family-health:family_health_end_intervention` |
| 家庭自测数值 | `family-health:family_health_log_measurement` |
| 问某人的指标、异常、趋势 | `family-health:family_health_query` |
| 用户明确要演示数据 | `family-health:family_health_seed_demo` |

## Mapping utterances

- "我从上周开始每天跑步5公里" → `log_intervention` `{member:"我", title:"每天跑步5公里", category:"运动", start_date:<上周对应的日期>}`
- "老婆最近晚饭不吃主食了" → `log_intervention` `{member:"老婆", title:"晚饭不吃主食", category:"饮食"}`（开始日期不清楚时问一句，或用今天并告诉用户）
- "我爸开始吃阿托伐他汀了，每晚一片" → `log_intervention` `{member:"我爸", category:"药物", title:"阿托伐他汀", description:"每晚一片"}`
- "我不跑步了" → `end_intervention` `{member:"我", title:"跑步"}`
- "老婆今天称了62.5" → `log_measurement` `{member:"老婆", indicator:"体重", value:62.5, unit:"kg"}`（中文“斤”要写 unit:"斤"，会自动换算）
- "我爸早上血压135/85" → `log_measurement` `{member:"我爸", indicator:"血压", value:"135/85"}`
- "我爸的尿酸这两年怎么样" → `query` `{member:"我爸", indicator:"尿酸", from:<两年前的日期>}`
- "我上次体检有哪些异常" → `query` `{member:"我"}`

Member references: pass the user's own words (我 / 老婆 / 老公 / 爸 / 妈 / 儿子 / a name); the action resolves them.

## Dates

Convert relative dates to `YYYY-MM-DD` using today's date before calling: 今天、昨天、上周一、3月初 (→ 03-01)、两周前. If the date is vague and matters (e.g. medication start), ask. If omitted, the action uses today — say so in your reply.

## When to ask instead of calling

- The action returns `ambiguous_member` / `member_not_found` → show the `candidates` and ask who they meant (or offer to add the member).
- A measurement without a clear unit where it matters (血糖 7.8 — mmol/L or mg/dL?), or a missing value.
- Medication details that matter but are missing (drug name). Never guess a dose.
- `ambiguous_intervention` when ending → list candidates.
- `value_out_of_range` from `log_measurement` (e.g. 体重 7000 kg, 血压 400/100) → nothing was saved; tell the user the accepted range from the error and ask them to confirm the number and unit before retrying.

## Red-flag alerts (must relay)

`log_measurement` and `query` return `alerts` computed by fixed rules (the same thresholds used for checkup reports, e.g. 收缩压 ≥180 或舒张压 ≥110 mmHg → 建议尽快就医). When `alerts` is non-empty:

- Put the alert **first** in your reply, keep its level (建议尽快就医 / 建议近期就诊) and its `message` text verbatim (`log_measurement` also gives a ready-made `relay` sentence).
- Do not soften it, do not add a diagnosis or a cause, do not suggest drugs or doses; if the person has symptoms such as chest pain, severe headache or trouble breathing, tell them to seek emergency care.
- Still confirm what was recorded, then end with **仅供参考，不能替代医生诊断。**

## Answering

- After logging, confirm briefly what was recorded (who, what, date) and link the app: [家庭体检助手](/apps/family-health).
- When interpreting `query` results: describe values, reference ranges and changes over time plainly; when an intervention overlaps a change, say they happened **at the same time (时间上同时发生)** — never that one caused the other. Mention that few data points limit conclusions.
- Never diagnose or recommend specific drugs/doses. If `alerts` is non-empty, relay it first, verbatim (see above).
- End any interpretation with: **仅供参考，不能替代医生诊断。**
