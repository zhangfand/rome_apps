# Fixes after independent verification (2026-09-23)

- **Home-measurement red flags.** `measurementAlerts` runs the same deterministic
  critical rules on the latest home measurement per indicator (≤30 days old, not
  superseded by a checkup on the same day or later). Alerts appear in the member
  overview / member page banner and `query.alerts`; `log_measurement` returns
  `alerts` plus a ready-to-relay `relay` sentence. The `log-from-chat` skill tells
  the agent to relay them first and verbatim, without diagnosing.
- **Plausibility bounds** (`domain/plausibility.ts`): hard physiological limits in
  canonical units (e.g. 体重 1–400 kg, 收缩压 50–300 mmHg, 空腹血糖 0.5–60 mmol/L;
  every other numeric indicator ≥ 0 except BMD T/Z scores). Violations are rejected
  with `value_out_of_range` + the accepted range for chat/UI measurements and for
  reviewer edits / manual rows; extracted values outside the bounds get low
  confidence so review flags them.
- **Causal guard.** The regex now also catches 起了作用 / 发挥作用 / 奏效 / 说明…作用;
  stored interpretations are passed through the guard when served; demo data was
  re-seeded and its interpretations regenerated. A test scans all seeded text.
- **Review provenance.** Migration `0001` adds `results.edited` and
  `results.original_raw_value`. The value field shows the printed value without
  ↑/↓/H/L (`displayValue`); an edit marks the row 已修改 and keeps the first
  extracted value (识别原文).
- **Mobile.** Insight 重新生成 buttons sit on their own left-aligned row on phones;
  pages end with room for the host chat bubble; the confirm bar keeps right padding.
- **Access.** The API gate is fail-closed: anything but `request.caller.kind ===
  "guardian"` (dashboard cookie session, or trusted in-container loopback caller,
  as resolved by the Rome host) gets `401 guardian_only`. `GET status` reports the
  resolved caller. A plain `curl` on the machine resolves as guardian via
  `loopback` by the runtime's design; the daemon listens on 127.0.0.1 only.
