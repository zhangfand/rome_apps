# Phase 4 — end-to-end extraction on synthetic reports (2026-09-23)

## Test material (not in git)

`scripts/gen-synthetic-report.mjs` renders a fictional report (测试用户 /
康瑞健康体检中心, not a real institution) to PNG through the local Chrome
DevTools endpoint and writes generated files + `ground-truth.json` outside the
repo (`../../default/family-health-verification/synthetic/`):

- cover page and ad page (both must be skipped);
- page A: dense lab page, 38 rows — two side-by-side tables (血常规 14 + 肝功能 11)
  plus 肾功能/血脂/血糖/其他; mixed naming (`谷丙转氨酶(ALT)`, `甘油三酯 TG`,
  `肌酐 Cr`), ↑↓ / H / L / * markers, an arrow inside the result cell (`6.4↑`),
  one-sided ranges (`<5.20`, `>1.04`), 尿酸 printed in **mg/dL** (must convert to
  μmol/L), two qualitative rows; exam date 2026-08-18 with a different print date
  (2026-08-25) in the footer as a trap;
- page B: 一般检查 (incl. `血压 138/88`, range `90-139/60-89`), 超声 所见 + 结论
  (脂肪肝（轻度）, 胆囊息肉 0.4cm, 甲状腺结节 TI-RADS 3类), normal ECG, 总检建议;
- `report.pdf` = cover + A + B + ad (4 image pages, JPEG-embedded via mupdf, 0.6 MB);
- `photo-a.jpg`: page A as a phone photo (72 % scale, keystone, 3° rotation,
  uneven lighting, noise, q72); `page-b.heic` via ImageMagick's HEIC encoder.

`scripts/score-extraction.mjs <reportId> <ground-truth.json> <pdf|photo>` scores
a report through the live API: per row code / value (canonical unit, ±0.5 %) /
unit / ref range / flag / page; findings key + severity; exam date; provider;
nothing taken from skipped pages.

## Results (45 expected rows, 3 findings)

| run | rows fully correct | precision | recall | findings | date / provider | skipped pages | time |
|---|---|---|---|---|---|---|---|
| PDF baseline (UI upload) | 41/45 | 0.932 | 0.911 | 3/3 | ✓ / ✓ | nothing extracted from p1/p4 | 35.7 s |
| photo+HEIC baseline | 41/45 | 0.932 | 0.911 | 3/3 | ✓ / ✓ | – | 40.0 s |
| PDF after fixes ×4 | 45/45 each | 1.0 | 1.0 | 3/3 | ✓ / ✓ | p1, p4 marked | 26.5–26.9 s |
| photo after fixes ×4 | 45/45 each | 1.0 | 1.0 | 3/3 | ✓ / ✓ | – | 22.4–24.9 s |

Baseline misses: `血压 138/88` stayed one unmapped row (no SBP/DBP), and the
ground truth wrongly expected `normal` for 身高/体重, which have no printed
range (the app correctly leaves the flag empty — ground-truth fix, not an app change).

## Changes

- `splitCompoundRow` (domain/normalize): a printed pair `血压 138/88` becomes
  收缩压 + 舒张压 rows, splitting paired ranges (`90-139/60-89`, `<140/90`);
  the extractor is told to copy the pair verbatim. Also removes the mapper call
  the unmapped row used to trigger (~8 s).
- Skipped pages are persisted (`pageImages[].skipped`, only when nothing was taken
  from the page; cleared on re-extraction). The review viewer labels them 已跳过
  and opens on the first page with data.
- `isNormalConclusion` (domain/findings): unkeyed normal-only conclusions
  (窦性心律 / 正常心电图 / 双肾未见明显异常) are dropped before review.
- Extractor prompt: finding `text` = the 结论 sentence, not the whole 所见 paragraph;
  numbers on skipped pages must not become results.
- Review table: rebalanced columns, tighter cell/input padding, wrapping raw names
  (0 of 135 inputs clip at 1440 and 1024 px); confirm bar clears the host chat bubble
  on desktop too; `10^9` rendered as 10⁹ in AI report/trend text.
