#!/usr/bin/env node
/**
 * Synthetic Chinese 体检报告 generator for end-to-end extraction tests.
 *
 * Everything here is FICTIONAL (patient 测试用户, provider 康瑞健康体检中心
 * — not a real institution). No real medical data is used or produced.
 *
 * Produces, in OUT_DIR (default: ../../default/family-health-verification/synthetic):
 *   page-cover.png  封面（应跳过）
 *   page-a.png      密集检验表格页：血常规/肝功能 两栏 + 肾功能/血脂/血糖/其他
 *   page-b.png      一般检查 + 超声 + 心电图 + 总检建议
 *   page-ad.png     广告页（应跳过）
 *   report.pdf      封面 + A + B + 广告 （4 页，图像型 PDF，经 mupdf 组装）
 *   photo-a.jpg     A 页的“手机拍照”版本（旋转、透视、光照不均、噪点、降分辨率）
 *   page-b.heic     B 页的 HEIC 版本（需要 ImageMagick 的 HEIC 编码器）
 *   ground-truth.json
 *
 * HTML is rendered to PNG through a local Chrome DevTools endpoint
 * (CHROME_CDP, default http://127.0.0.1:9222); photo/HEIC variants use
 * ImageMagick `convert`. Nothing leaves the machine.
 *
 *   node scripts/gen-synthetic-report.mjs [outDir]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(process.argv[2] ?? join(appDir, "../../default/family-health-verification/synthetic"));
const CDP = process.env.CHROME_CDP ?? "http://127.0.0.1:9222";
const W = 1240;
const H = 1754; // A4 at 150 dpi
mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------ report content

const PATIENT = { name: "测试用户", sex: "男", age: 45, examNo: "KR2026081800457" };
const PROVIDER = "康瑞健康体检中心";
const EXAM_DATE = "2026-08-18";
const REPORT_DATE = "2026-08-25";

/**
 * Lab rows. `v` / `u` / `ref` / `mark` are printed exactly; `exp` is the
 * expected normalized result (canonical units): [code, valueNum|valueText, unit, refLow, refHigh, flag]
 * (flag is null when nothing is printed to judge against, e.g. 身高/体重).
 */
const R = (name, v, mark, u, ref, exp) => ({ name, v, mark, u, ref, exp });

const BLOOD = [
  R("白细胞计数(WBC)", "6.52", "", "10^9/L", "3.5-9.5", ["WBC", 6.52, "10^9/L", 3.5, 9.5, "normal"]),
  R("中性粒细胞百分比(NEUT%)", "62.3", "", "%", "40-75", ["NEUT_PCT", 62.3, "%", 40, 75, "normal"]),
  R("淋巴细胞百分比(LYMPH%)", "28.4", "", "%", "20-50", ["LYMPH_PCT", 28.4, "%", 20, 50, "normal"]),
  R("中性粒细胞绝对值(NEUT#)", "4.06", "", "10^9/L", "1.8-6.3", ["NEUT", 4.06, "10^9/L", 1.8, 6.3, "normal"]),
  R("淋巴细胞绝对值(LYMPH#)", "1.85", "", "10^9/L", "1.1-3.2", ["LYMPH", 1.85, "10^9/L", 1.1, 3.2, "normal"]),
  R("红细胞计数(RBC)", "5.12", "", "10^12/L", "4.3-5.8", ["RBC", 5.12, "10^12/L", 4.3, 5.8, "normal"]),
  R("血红蛋白(HGB)", "156", "", "g/L", "130-175", ["HGB", 156, "g/L", 130, 175, "normal"]),
  R("红细胞压积(HCT)", "46.2", "", "%", "40-50", ["HCT", 46.2, "%", 40, 50, "normal"]),
  R("平均红细胞体积(MCV)", "90.2", "", "fL", "82-100", ["MCV", 90.2, "fL", 82, 100, "normal"]),
  R("平均红细胞血红蛋白量(MCH)", "30.5", "", "pg", "27-34", ["MCH", 30.5, "pg", 27, 34, "normal"]),
  R("平均红细胞血红蛋白浓度(MCHC)", "338", "", "g/L", "316-354", ["MCHC", 338, "g/L", 316, 354, "normal"]),
  R("红细胞分布宽度-CV(RDW-CV)", "12.6", "", "%", "11.5-14.5", ["RDW_CV", 12.6, "%", 11.5, 14.5, "normal"]),
  R("血小板计数(PLT)", "98", "L", "10^9/L", "125-350", ["PLT", 98, "10^9/L", 125, 350, "L"]),
  R("平均血小板体积(MPV)", "10.8", "", "fL", "7.4-12.5", ["MPV", 10.8, "fL", 7.4, 12.5, "normal"]),
];

const LIVER = [
  R("谷丙转氨酶(ALT)", "68", "↑", "U/L", "9-50", ["ALT", 68, "U/L", 9, 50, "H"]),
  R("谷草转氨酶(AST)", "41", "↑", "U/L", "15-40", ["AST", 41, "U/L", 15, 40, "H"]),
  R("γ-谷氨酰转移酶(GGT)", "72", "H", "U/L", "10-60", ["GGT", 72, "U/L", 10, 60, "H"]),
  R("碱性磷酸酶(ALP)", "85", "", "U/L", "45-125", ["ALP", 85, "U/L", 45, 125, "normal"]),
  R("总胆红素(TBIL)", "15.2", "", "μmol/L", "3.4-20.5", ["TBIL", 15.2, "μmol/L", 3.4, 20.5, "normal"]),
  R("直接胆红素(DBIL)", "4.1", "", "μmol/L", "0-6.8", ["DBIL", 4.1, "μmol/L", 0, 6.8, "normal"]),
  R("间接胆红素(IBIL)", "11.1", "", "μmol/L", "1.7-13.7", ["IBIL", 11.1, "μmol/L", 1.7, 13.7, "normal"]),
  R("总蛋白(TP)", "72.5", "", "g/L", "65-85", ["TP", 72.5, "g/L", 65, 85, "normal"]),
  R("白蛋白(ALB)", "46.8", "", "g/L", "40-55", ["ALB", 46.8, "g/L", 40, 55, "normal"]),
  R("球蛋白(GLB)", "25.7", "", "g/L", "20-40", ["GLB", 25.7, "g/L", 20, 40, "normal"]),
  R("白球比(A/G)", "1.82", "", "", "1.2-2.4", ["AG_RATIO", 1.82, "", 1.2, 2.4, "normal"]),
];

const KIDNEY = [
  R("尿素 UREA", "5.6", "", "mmol/L", "3.1-8.0", ["UREA", 5.6, "mmol/L", 3.1, 8.0, "normal"]),
  R("肌酐 Cr", "82", "", "μmol/L", "57-97", ["CREA", 82, "μmol/L", 57, 97, "normal"]),
  // Printed in mg/dL on purpose: must be converted to μmol/L (×59.48).
  R("尿酸 UA", "7.8", "↑", "mg/dL", "3.5-7.2", ["UA", 463.944, "μmol/L", 208.18, 428.256, "H"]),
  R("胱抑素C Cys-C", "0.92", "", "mg/L", "0.59-1.03", ["CYSC", 0.92, "mg/L", 0.59, 1.03, "normal"]),
];

const LIPID = [
  R("总胆固醇 TC", "5.92", "↑", "mmol/L", "<5.20", ["TC", 5.92, "mmol/L", null, 5.2, "H"]),
  R("甘油三酯 TG", "2.35", "↑", "mmol/L", "<1.70", ["TG", 2.35, "mmol/L", null, 1.7, "H"]),
  R("高密度脂蛋白胆固醇 HDL-C", "0.98", "↓", "mmol/L", ">1.04", ["HDL_C", 0.98, "mmol/L", 1.04, null, "L"]),
  R("低密度脂蛋白胆固醇 LDL-C", "3.86", "↑", "mmol/L", "<3.40", ["LDL_C", 3.86, "mmol/L", null, 3.4, "H"]),
  R("载脂蛋白B ApoB", "1.08", "", "g/L", "0.46-1.13", ["APOB", 1.08, "g/L", 0.46, 1.13, "normal"]),
];

const GLUCOSE = [
  // Arrow printed inside the result cell (提示 column left empty).
  R("空腹血糖 GLU", "6.4↑", "", "mmol/L", "3.9-6.1", ["GLU", 6.4, "mmol/L", 3.9, 6.1, "H"]),
  R("糖化血红蛋白 HbA1c", "5.9", "", "%", "4.0-6.0", ["HBA1C", 5.9, "%", 4.0, 6.0, "normal"]),
];

const OTHER = [
  R("乙肝表面抗原 HBsAg", "阴性(-)", "", "", "阴性", ["HBSAG", "阴性", "", null, null, "normal"]),
  R("幽门螺杆菌抗体 Hp-IgG", "阳性(+)", "*", "", "阴性", ["HP_AB", "阳性", "", null, null, "abnormal"]),
];

const GENERAL = [
  R("身高", "172.0", "", "cm", "", ["HEIGHT", 172, "cm", null, null, null]),
  R("体重", "81.5", "", "kg", "", ["WEIGHT", 81.5, "kg", null, null, null]),
  R("体重指数(BMI)", "27.5", "↑", "kg/m²", "18.5-23.9", ["BMI", 27.5, "kg/m²", 18.5, 23.9, "H"]),
  R("腰围", "94", "↑", "cm", "<90", ["WAIST", 94, "cm", null, 90, "H"]),
  R("血压", "138/88", "", "mmHg", "90-139/60-89", null), // one printed row → two results
  R("心率", "76", "", "次/分", "60-100", ["HR", 76, "次/分", 60, 100, "normal"]),
];
const BP_EXPECTED = [
  ["SBP", 138, "mmHg", 90, 139, "normal"],
  ["DBP", 88, "mmHg", 60, 89, "normal"],
];

const FINDINGS = [
  { key: "fatty_liver", severity: "轻度", severityMatch: /轻/ },
  { key: "gallbladder_polyp", severity: "0.4cm", severityMatch: /0\.4/ },
  { key: "thyroid_nodule", severity: "TI-RADS 3类", severityMatch: /3/ },
];

// ------------------------------------------------------------------ HTML

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unitHtml = (u) => esc(u).replace(/10\^(\d+)/, "10<sup>$1</sup>");

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${W}px; height: ${H}px; background: #fff; }
  body { font-family: "Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC", sans-serif; color: #1c1c1c; padding: 56px 64px; position: relative; font-size: 15px; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #0b6e4f; padding-bottom: 10px; }
  .logo { display: flex; align-items: center; gap: 12px; }
  .mark { width: 46px; height: 46px; border-radius: 50%; background: #0b6e4f; color: #fff; font-weight: 700; font-size: 22px; display: flex; align-items: center; justify-content: center; }
  .brand { font-size: 24px; font-weight: 700; color: #0b6e4f; letter-spacing: 2px; }
  .brand small { display: block; font-size: 11px; color: #6b7c74; letter-spacing: 1px; font-weight: 400; }
  .doc { font-size: 20px; font-weight: 700; }
  .pinfo { display: grid; grid-template-columns: repeat(5, auto); gap: 4px 28px; margin: 12px 0 18px; font-size: 14px; background: #f3f7f5; padding: 10px 14px; border: 1px solid #d5e2dc; }
  .pinfo b { font-weight: 600; }
  h2 { font-size: 16px; background: #0b6e4f; color: #fff; padding: 4px 10px; margin: 14px 0 0; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th { background: #e7efeb; font-weight: 600; text-align: left; padding: 5px 6px; border-bottom: 1px solid #9fb8ad; white-space: nowrap; }
  td { padding: 4.5px 6px; border-bottom: 1px solid #e3e8e6; white-space: nowrap; }
  td.res { font-weight: 600; }
  td.flag { color: #c0392b; font-weight: 700; text-align: center; width: 34px; }
  th.flag { text-align: center; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  .foot { position: absolute; left: 64px; right: 64px; bottom: 40px; border-top: 1px solid #b9c9c2; padding-top: 8px; font-size: 12px; color: #5b6b64; display: flex; justify-content: space-between; }
  .blk { border: 1px solid #d5e2dc; margin-top: 10px; padding: 8px 12px; font-size: 14px; line-height: 1.75; }
  .blk .lbl { color: #0b6e4f; font-weight: 600; }
  .concl { font-weight: 600; }
  p.adv { font-size: 14px; line-height: 1.85; text-indent: 0; }
`;

function header(page, total) {
  return `
  <div class="top">
    <div class="logo"><div class="mark">康</div><div class="brand">${PROVIDER}<small>KANGRUI HEALTH CHECKUP CENTER</small></div></div>
    <div class="doc">健康体检报告</div>
  </div>
  <div class="pinfo">
    <span>体检号：<b>${PATIENT.examNo}</b></span><span>姓名：<b>${PATIENT.name}</b></span><span>性别：<b>${PATIENT.sex}</b></span>
    <span>年龄：<b>${PATIENT.age}岁</b></span><span>体检日期：<b>${EXAM_DATE}</b></span>
  </div>`;
}
function footer(page, total) {
  return `<div class="foot"><span>报告日期：${REPORT_DATE}　　本报告仅对本次受检样本负责</span><span>第 ${page} 页 / 共 ${total} 页</span></div>`;
}

function labTable(rows, { flagCol = true } = {}) {
  return `<table><thead><tr><th>项目名称</th><th>结果</th>${flagCol ? '<th class="flag">提示</th>' : ""}<th>单位</th><th>参考范围</th></tr></thead><tbody>
  ${rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="res">${esc(r.v)}</td>${flagCol ? `<td class="flag">${esc(r.mark)}</td>` : ""}<td>${unitHtml(r.u)}</td><td>${esc(r.ref)}</td></tr>`).join("")}
  </tbody></table>`;
}

function fullTable(sections) {
  return `<table><thead><tr><th style="width:34%">项目名称</th><th style="width:16%">结果</th><th class="flag">提示</th><th style="width:16%">单位</th><th>参考范围</th></tr></thead><tbody>
  ${sections
    .map(
      ([title, rows]) =>
        `<tr><td colspan="5" style="background:#f3f7f5;font-weight:700;color:#0b6e4f;padding-top:7px">【${title}】</td></tr>` +
        rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="res">${esc(r.v)}</td><td class="flag">${esc(r.mark)}</td><td>${unitHtml(r.u)}</td><td>${esc(r.ref)}</td></tr>`).join(""),
    )
    .join("")}
  </tbody></table>`;
}

const doc = (body) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`;

const TOTAL = 4;
const pageCover = doc(`
  <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;text-align:center">
    <div class="mark" style="width:110px;height:110px;font-size:52px">康</div>
    <div style="font-size:30px;font-weight:700;color:#0b6e4f;letter-spacing:6px">${PROVIDER}</div>
    <div style="font-size:64px;font-weight:700;letter-spacing:18px;margin-top:40px">健康体检报告</div>
    <div style="font-size:16px;color:#6b7c74;letter-spacing:4px">HEALTH EXAMINATION REPORT</div>
    <table style="width:520px;margin-top:80px;font-size:20px"><tbody>
      <tr><td style="border:none;text-align:right;color:#555">姓　　名：</td><td style="border:none;text-align:left;font-weight:600">${PATIENT.name}</td></tr>
      <tr><td style="border:none;text-align:right;color:#555">性　　别：</td><td style="border:none;text-align:left">${PATIENT.sex}</td></tr>
      <tr><td style="border:none;text-align:right;color:#555">体 检 号：</td><td style="border:none;text-align:left">${PATIENT.examNo}</td></tr>
      <tr><td style="border:none;text-align:right;color:#555">体检日期：</td><td style="border:none;text-align:left">${EXAM_DATE}</td></tr>
      <tr><td style="border:none;text-align:right;color:#555">单　　位：</td><td style="border:none;text-align:left">个人体检</td></tr>
    </tbody></table>
    <div style="margin-top:120px;font-size:14px;color:#777;line-height:1.8">本报告为个人隐私资料，请妥善保管<br>咨询电话：400-000-0000（示例）</div>
  </div>`);

const pageA = doc(`
  ${header(2, TOTAL)}
  <div class="cols">
    <div><h2>血常规（五分类）</h2>${labTable(BLOOD)}</div>
    <div><h2>肝功能</h2>${labTable(LIVER)}</div>
  </div>
  <h2>生化检验</h2>
  ${fullTable([["肾功能", KIDNEY], ["血脂", LIPID], ["血糖", GLUCOSE], ["其他", OTHER]])}
  <div style="margin-top:10px;font-size:12.5px;color:#666">注：“↑/H”表示高于参考范围，“↓/L”表示低于参考范围，“*”表示异常。检验者：（示例）　审核者：（示例）</div>
  ${footer(2, TOTAL)}`);

const pageB = doc(`
  ${header(3, TOTAL)}
  <h2>一般检查</h2>
  ${labTable(GENERAL)}
  <h2>腹部及甲状腺彩超</h2>
  <div class="blk"><span class="lbl">检查所见：</span>肝脏形态大小正常，包膜光整，实质回声细密增强，远场回声轻度衰减，肝内血管显示清晰。胆囊大小正常，壁上可见一个强回声附着，大小约 0.4cm×0.3cm，后方无声影，不随体位改变移动。胰腺、脾脏大小形态正常，回声均匀。双肾大小形态正常，未见明显异常回声。甲状腺右叶见一低回声结节，大小约 0.6cm×0.5cm，边界清，形态规则，纵横比&lt;1，未见微钙化。<br>
  <span class="lbl">检查结论：</span><span class="concl">1. 脂肪肝（轻度）　2. 胆囊息肉（0.4cm）　3. 甲状腺右叶结节（TI-RADS 3类）　4. 胰、脾、双肾未见明显异常</span></div>
  <h2>心电图</h2>
  <div class="blk"><span class="lbl">检查所见：</span>心率 76 次/分，P-R 间期 0.16s，QRS 时限 0.09s，QT/QTc 0.38/0.41s。<br><span class="lbl">检查结论：</span><span class="concl">窦性心律　正常心电图</span></div>
  <h2>总检结论及建议</h2>
  <div class="blk">
    <p class="adv">【总检结论】① 超重（BMI 27.5）、腹型肥胖；② 血脂异常（总胆固醇、甘油三酯、低密度脂蛋白胆固醇升高，高密度脂蛋白胆固醇降低）；③ 空腹血糖偏高；④ 转氨酶轻度升高；⑤ 尿酸升高；⑥ 血小板计数偏低；⑦ 幽门螺杆菌抗体阳性；⑧ 脂肪肝（轻度）；⑨ 胆囊息肉；⑩ 甲状腺结节（TI-RADS 3类）。</p>
    <p class="adv" style="margin-top:6px">【总检建议】建议控制总热量摄入，减少高脂、高糖饮食及饮酒，每周进行不少于 150 分钟中等强度有氧运动，逐步将体重降至正常范围；3 个月后复查血脂、肝功能、空腹血糖及糖化血红蛋白，必要时内分泌科就诊；低嘌呤饮食、多饮水，复查尿酸；1 个月后复查血常规，血小板仍偏低请血液科就诊；消化内科就诊评估是否需要根除幽门螺杆菌；甲状腺结节建议 6～12 个月复查甲状腺超声；胆囊息肉建议每年复查腹部超声。</p>
  </div>
  <div style="margin-top:18px;font-size:14px;text-align:right">主检医师：（示例签名）　　审核医师：（示例签名）</div>
  ${footer(3, TOTAL)}`);

const pageAd = doc(`
  <div style="height:100%;display:flex;flex-direction:column;gap:26px;background:linear-gradient(160deg,#e8f5ef,#fff 55%);margin:-56px -64px;padding:90px 80px">
    <div style="display:flex;align-items:center;gap:16px"><div class="mark" style="width:70px;height:70px;font-size:34px">康</div><div class="brand" style="font-size:30px">${PROVIDER}</div></div>
    <div style="font-size:54px;font-weight:800;color:#0b6e4f;line-height:1.3">金秋关爱父母<br>体检套餐限时 8 折</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:20px">
      ${[
        ["父母关爱套餐", "¥1280", "含 32 项检查 · 低剂量螺旋CT · 颈动脉彩超"],
        ["肿瘤早筛套餐", "¥699", "肿瘤标志物 12 项 · 幽门螺杆菌检测"],
        ["心脑血管套餐", "¥980", "心脏彩超 · 同型半胱氨酸 · 血脂 7 项"],
        ["女性专属套餐", "¥860", "HPV 检测 · 乳腺彩超 · 甲状腺功能"],
      ]
        .map(([t, p, d]) => `<div style="border:2px solid #0b6e4f;border-radius:16px;padding:22px;background:#fff"><div style="font-size:24px;font-weight:700">${t}</div><div style="font-size:44px;font-weight:800;color:#c0392b;margin:8px 0">${p}<span style="font-size:18px;color:#999;text-decoration:line-through;margin-left:10px">原价 ¥${Math.round(Number(p.slice(1)) * 1.25)}</span></div><div style="font-size:17px;color:#444">${d}</div></div>`)
        .join("")}
    </div>
    <div style="font-size:22px;margin-top:30px;line-height:1.8">📞 预约热线 400-000-0000（示例）<br>活动时间：2026-09-01 至 2026-10-31　全国 60 家分院通用</div>
    <div style="margin-top:auto;font-size:14px;color:#888">*本页为宣传资料，与本次体检结果无关</div>
  </div>`);

// ------------------------------------------------------------------ render via CDP

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function renderPng(html, file) {
  const t = await (await fetch(`${CDP}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  try {
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    const { frameTree } = await send("Page.getFrameTree");
    await send("Page.setDocumentContent", { frameId: frameTree.frame.id, html });
    await sleep(800);
    const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    writeFileSync(file, Buffer.from(shot.data, "base64"));
  } finally {
    ws.close();
    await fetch(`${CDP}/json/close/${t.id}`);
  }
}

const files = {
  cover: join(OUT, "page-cover.png"),
  a: join(OUT, "page-a.png"),
  b: join(OUT, "page-b.png"),
  ad: join(OUT, "page-ad.png"),
};
await renderPng(pageCover, files.cover);
await renderPng(pageA, files.a);
await renderPng(pageB, files.b);
await renderPng(pageAd, files.ad);

// ------------------------------------------------------------------ PDF (mupdf, image pages)

const mupdf = await import(pathToFileURL(join(appDir, "node_modules/mupdf/dist/mupdf.js")).href);
{
  const buf = new mupdf.Buffer();
  const writer = new mupdf.DocumentWriter(buf, "pdf", "");
  for (const f of [files.cover, files.a, files.b, files.ad]) {
    // Embed as JPEG (like a scanner would) so the PDF stays a few MB, not 26 MB of raw pixels.
    const jpg = f.replace(/\.png$/, ".pdf-page.jpg");
    execFileSync("convert", [f, "-quality", "88", jpg]);
    const dev = writer.beginPage([0, 0, 595, 842]);
    dev.fillImage(new mupdf.Image(readFileSync(jpg)), [595, 0, 0, 842, 0, 0], 1);
    rmSync(jpg);
    writer.endPage();
  }
  writer.close();
  writeFileSync(join(OUT, "report.pdf"), buf.asUint8Array());
}

// ------------------------------------------------------------------ phone photo + HEIC (ImageMagick)

const photo = join(OUT, "photo-a.jpg");
execFileSync("convert", [
  files.a,
  "-resize", "72%", // ~893×1263: lower resolution than the scan
  "-background", "#6b6258", "-virtual-pixel", "background",
  // mild keystone: top edge narrower than bottom, like a phone held above the desk
  "-distort", "Perspective", "0,0 28,22  892,0 858,6  0,1262 6,1258  892,1262 884,1262",
  "-rotate", "3",
  // uneven lighting: darker toward the lower-right corner
  "(", "+clone", "-sparse-color", "Barycentric", "0,0 gray(100%) %[fx:w],%[fx:h] gray(68%)", ")",
  "-compose", "Multiply", "-composite",
  "-attenuate", "0.35", "+noise", "Gaussian",
  "-blur", "0x0.6",
  "-quality", "72",
  photo,
]);

let heic = null;
try {
  heic = join(OUT, "page-b.heic");
  execFileSync("convert", [files.b, "-quality", "60", heic]);
} catch (err) {
  heic = null;
  console.warn("HEIC encoder not available:", err.message);
}

// ------------------------------------------------------------------ ground truth

const toGt = (section, page) => (r) => {
  const [code, value, unit, refLow, refHigh, flag] = r.exp;
  return {
    page, section, printedName: r.name, printedValue: r.v, printedUnit: r.u, printedRef: r.ref, printedMark: r.mark,
    code, valueNum: typeof value === "number" ? value : null, valueText: typeof value === "string" ? value : null, unit, refLow, refHigh, flag,
  };
};
const pageAResults = (page) => [
  ...BLOOD.map(toGt("血常规", page)),
  ...LIVER.map(toGt("肝功能", page)),
  ...KIDNEY.map(toGt("肾功能", page)),
  ...LIPID.map(toGt("血脂", page)),
  ...GLUCOSE.map(toGt("血糖", page)),
  ...OTHER.map(toGt("其他", page)),
];
const pageBResults = (page) => [
  ...GENERAL.filter((r) => r.exp).map(toGt("一般检查", page)),
  ...BP_EXPECTED.map(([code, v, unit, lo, hi, flag]) => ({ page, section: "一般检查", printedName: "血压", printedValue: "138/88", printedUnit: "mmHg", printedRef: "90-139/60-89", printedMark: "", code, valueNum: v, valueText: null, unit, refLow: lo, refHigh: hi, flag })),
];
const gt = {
  note: "Synthetic, fictional report (测试用户 / 康瑞健康体检中心). Expected values are in the app's canonical units.",
  examDate: EXAM_DATE,
  reportDate: REPORT_DATE,
  provider: PROVIDER,
  sex: "male",
  variants: {
    pdf: {
      files: ["report.pdf"],
      pages: 4,
      skippedPages: [1, 4],
      results: [...pageAResults(2), ...pageBResults(3)],
      findings: FINDINGS.map((f) => ({ ...f, severityMatch: f.severityMatch.source, page: 3 })),
    },
    photo: {
      files: heic ? ["photo-a.jpg", "page-b.heic"] : ["photo-a.jpg"],
      pages: heic ? 2 : 1,
      skippedPages: [],
      results: [...pageAResults(1), ...(heic ? pageBResults(2) : [])],
      findings: heic ? FINDINGS.map((f) => ({ ...f, severityMatch: f.severityMatch.source, page: 2 })) : [],
    },
  },
};
writeFileSync(join(OUT, "ground-truth.json"), JSON.stringify(gt, null, 2));
console.log(JSON.stringify({ out: OUT, files: [...Object.values(files), "report.pdf", "photo-a.jpg", heic, "ground-truth.json"].filter(Boolean), pdfRows: gt.variants.pdf.results.length, photoRows: gt.variants.photo.results.length }, null, 2));
