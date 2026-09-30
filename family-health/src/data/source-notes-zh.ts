/**
 * Plain-Chinese presentation layer for 数据来源 (hand-written, reviewable).
 *
 * The research import (verified.ts) keeps the researchers' own notes, partly
 * in English and full of tool details. This file restates, for a reader
 * without a medical background, what each source is, whether it is still in
 * force, how its numbers were checked and what to watch out for — plus a
 * curated list of what could NOT be verified. It adds no numbers used for
 * judging results; every statement here restates the research notes.
 */

export interface SourceNoteZh {
  /** 现行状态, in plain words. Omit when the research did not check it. */
  status?: string;
  /** How the numbers were read. */
  checkedHow: string;
  /** Things a reader should know when relying on this source. */
  caveats?: string[];
}

export const SOURCE_NOTES_ZH: Record<string, SourceNoteZh> = {
  "legacy-unverified": {
    checkedHow: "应用第一版自带的数值和解释，没有和任何标准逐条核对过。",
    caveats: [
      "只在报告单没有印参考范围、而且还没有已核实标准时才会用到，界面上都标“未核实”。",
      "逐步被下面已核实的来源替换；替换后原来的数值不再参与判断。",
    ],
  },
  src_wst404_1_2012: {
    status: "现行（2013 年 8 月 1 日实施），没有查到修订版。",
    checkedHow: "在全国标准信息公共服务平台的官方在线阅读页上逐页看图读表（原文是扫描图片，没有可复制的文字）。",
    caveats: [
      "谷丙转氨酶（ALT）、谷草转氨酶（AST）各有两组数值：试剂里含 5'-磷酸吡哆醛的一组上限略高。本应用默认用不含的一组；报告单印有范围时以报告单为准。",
      "哪一组对应哪种试剂，是根据表格脚注判断的，原文没有逐字写明“不含”。",
      "ALT、AST、GGT 的适用年龄写在附录里，这次没有读到，暂按成年人处理。",
    ],
  },
  src_wst404_2_2012: {
    status: "现行（2013 年 8 月 1 日实施），没有查到修订版。",
    checkedHow: "在全国标准信息公共服务平台的官方在线阅读页上看图读表（扫描图片）。",
    caveats: ["标准标题只写了总蛋白、白蛋白，但表中同时给出了球蛋白和白球比。", "适用年龄写在附录里，这次没有读到，暂按成年人处理。"],
  },
  src_wst404_3_2012: {
    status: "现行（2013 年 8 月 1 日实施），没有查到修订版。",
    checkedHow: "国家卫健委官网拒绝了访问，改读第三方网站上的扫描版（中国标准出版社印刷版），看图读表。",
    caveats: ["这份扫描版缺少附录，适用年龄和检测方法没能确认。", "需要对照官方原文复核。"],
  },
  src_wst404_4_2018: {
    status: "现行（2018 年 11 月 1 日实施）。",
    checkedHow: "国家卫健委官网 PDF，文字可直接提取。",
    caveats: [
      "胆红素只有上限，没有下限。",
      "直接胆红素的上限随检测仪器不同：罗氏系统 ≤8.0，贝克曼系统 ≤4.0 μmol/L。本应用默认用 8.0；报告单印有范围时以报告单为准。",
    ],
  },
  src_wst404_5_2015: {
    status: "现行（2015 年 10 月 1 日实施）。",
    checkedHow: "国家卫健委官网 PDF，文字可直接提取；现行状态在国家标准信息平台上核对过。",
    caveats: ["尿素、肌酐按 60 岁分两段，男女分开。", "肌酐区间只适用于能溯源到同位素稀释质谱法（ID-MS）的检测方法，大多数医院的检测满足这一点。"],
  },
  src_wst404_6_2015: {
    status: "现行（2015 年 10 月 1 日实施）。这一点是从 WS/T 404 系列最新的分册清单推断的，没有单独查它的状态页。",
    checkedHow: "国家卫健委官网 PDF，文字可直接提取。",
    caveats: ["血磷（无机磷）没有可用于验证的标准物质，它的区间是按多个检测系统的数据和临床意见定的。"],
  },
  src_wst404_7_2015: {
    status: "现行（2015 年 10 月 1 日实施）。",
    checkedHow: "国家卫健委官网 PDF。",
    caveats: ["参考人群是 20~79 岁的中国成年人。"],
  },
  src_wst404_8_2015: {
    status: "现行（2015 年 10 月 1 日实施）。",
    checkedHow: "国家卫健委官网 PDF。",
    caveats: ["指的是血清总淀粉酶，不是尿淀粉酶。"],
  },
  src_wst405_2012: {
    status: "现行（2013 年 8 月 1 日实施），没有查到修订版。",
    checkedHow: "现行状态查自国家标准信息平台；数值来自第三方网站上的扫描全文，看图读表。国家卫健委官网拒绝了访问。",
    caveats: [
      "只适用于静脉血的仪器检测，不适用于指尖血。",
      "没有单独的老年人区间（参考人群是 20~79 岁）。",
      "RDW、MPV、PDW、血小板压积不在这份标准里。",
      "需要对照官方原文复核。",
    ],
  },
  src_nhc_weight_mgmt_2024: {
    status: "国家卫健委办公厅 2024 年 12 月印发（国卫办医急函〔2024〕469号）。",
    checkedHow: "国家卫健委官网 PDF，文字可直接提取。",
    caveats: ["文中的 BMI 和腰围分类表注明“引自《成人体重判定》（WS/T 428—2013）”，数值与该国家标准一致。"],
  },
  src_nhc_obesity_2024: {
    status: "国家卫健委办公厅 2024 年 10 月印发（国卫办医政函〔2024〕382号）。",
    checkedHow: "中国政府网上的官方 PDF，文字可直接提取。",
    caveats: ["给出了按 BMI 划分的肥胖症轻、中、重、极重度分级，以及腰臀比标准。"],
  },
  src_cds_dm_2024: {
    checkedHow: "中华医学会糖尿病学分会网站链接的全文 PDF，文字提取。",
    caveats: ["诊断标准表格在提取时行列被打散，是按提取顺序还原的。", "没有单独核对是否已有更新版本。"],
  },
  src_cse_hua_2019: {
    checkedHow: "中华医学会指南平台上的全文网页，直接阅读。",
    caveats: ["2023 年中华医学会风湿病学分会的《痛风诊疗规范》给出了相同的切点（420 μmol/L）。", "没有单独核对是否已有更新版本。"],
  },
  src_cra_gout_2023: {
    checkedHow: "第三方网站上的期刊 PDF（带期刊页眉和引用信息），没有打开官方页面。",
    caveats: ["需要对照官方原文复核。"],
  },
  src_cn_htn_2024: {
    status: "当前版本，替代 2018 年版。",
    checkedHow: "期刊官网的全文 PDF，文字提取。",
    caveats: ["标注的期刊页码是推算的（PDF 页脚数字提取时顺序颠倒）。", "baPWV ≥1800 cm/s 和部分心率切点只针对高血压患者，本应用不会自动套用。"],
  },
  src_cn_htn_tod_2025: {
    checkedHow: "全文 PDF，文字提取。",
    caveats: ["这份共识讨论的是高血压患者的器官损害，里面的切点都只适用于高血压患者，本应用不会自动套用。"],
  },
  src_cn_elderly_extremity_as_2012: {
    checkedHow: "中华医学会指南平台上的全文网页，直接阅读。",
    caveats: ["这是针对老年人的专家建议，年代较早；也是目前找到的唯一给出 ABI 四档分类的中文文件。它的切点只在指标库里列出，不会自动套用。"],
  },
  src_cn_echo_2016: {
    checkedHow: "出版社的全文网页，直接阅读（PDF 无法提取文字）。",
    caveats: [
      "数据来自中国健康成年人（18~79 岁，男 678 人、女 716 人）调查，本应用只用男女总体的 95% 范围，没有用分年龄段的数值。",
      "射血分数的范围是按 Simpson 法测得的；体检报告常用 M 型法，数值可能略有差别。",
    ],
  },
  src_cn_lipid_guideline_2023: {
    status: "现行（2023 年 3 月发表，替代 2016 年版《中国成人血脂异常防治指南》）。",
    checkedHow: "第三方网站上的期刊全文 PDF，文字提取；官方页面能打开，但没有逐字比对。",
    caveats: [
      "切点表格在提取时被压平，是按列顺序还原的，没有对照表格图片。",
      "表中切点只适用于心血管病一级预防中的低危人群；高危人群应看医生按风险等级给出的目标值。",
      "需要对照官方原文复核。",
    ],
  },
};

// ------------------------------------------------------------------ gaps

export type GapKind = "no_standard" | "needs_check" | "not_imported";

export const GAP_KIND_ZH: Record<GapKind, { title: string; description: string }> = {
  no_standard: {
    title: "没有找到可用的国家标准或指南数值",
    description: "这些项目只能以报告单上印的范围为准；报告单没印时，用应用内置数值并标“未核实”。",
  },
  needs_check: {
    title: "已采用，但需要对照官方原文复核",
    description: "数值与业内通行值一致，但这次是从转载或镜像全文读的，或有个别细节没能确认。",
  },
  not_imported: {
    title: "有来源，但还没有接入",
    description: "已经知道出处或即将生效，下一步补上。",
  },
};

export interface GapZh {
  id: string;
  kind: GapKind;
  title: string;
  detail: string;
  /** Indicator codes this gap affects (links to 指标库). */
  codes: string[];
}

export const GAPS_ZH: GapZh[] = [
  {
    id: "no-ri-ua-co2-glu-cysc",
    kind: "no_standard",
    title: "尿酸、二氧化碳、空腹血糖、胱抑素C 没有国家参考区间",
    detail: "国家卫生行业标准 WS/T 404《临床常用生化检验项目参考区间》共 10 个部分，都不包含这几项；也没有找到其他成人标准。血糖、尿酸已有诊断切点（糖尿病、高尿酸血症指南）。",
    codes: ["UA", "CO2", "GLU", "CYSC"],
  },
  {
    id: "no-ri-rdw-mpv",
    kind: "no_standard",
    title: "红细胞分布宽度、血小板体积等血常规项目没有国家参考区间",
    detail: "血常规的国家标准 WS/T 405 只包含 18 项，不含 RDW、MPV、PDW、血小板压积。",
    codes: ["RDW_CV", "RDW_SD", "MPV", "PDW", "PCT_PLT"],
  },
  {
    id: "no-ri-lipids",
    kind: "no_standard",
    title: "血脂没有国家参考区间，只有指南切点",
    detail: "没有找到给出总胆固醇、甘油三酯、HDL、LDL、载脂蛋白参考区间的国家标准（只有一份 LDL 检测方法标准）。本应用用《中国血脂管理指南（2023年）》的切点来分级；载脂蛋白用的是指南对一般人群的描述性范围。",
    codes: ["TC", "TG", "HDL_C", "LDL_C", "APOA1", "APOB"],
  },
  {
    id: "no-ecg",
    kind: "no_standard",
    title: "心电图各项正常值没有找到可核实的中文标准原文",
    detail: "PR 间期、QRS 时限、QTc、电轴等常见正常范围没有找到能读到原文的中文标准或指南，所以暂不判断高低。",
    codes: ["ECG_PR", "ECG_QRS", "ECG_QT", "ECG_QTC", "ECG_P_AXIS", "ECG_QRS_AXIS", "ECG_T_AXIS"],
  },
  {
    id: "no-tcd",
    kind: "no_standard",
    title: "经颅多普勒血流速度正常值只找到转载",
    detail: "相关指南只找到二手转载，没能读到原文，暂不判断高低。",
    codes: ["TCD_MCA_VP_L", "TCD_MCA_VP_R", "TCD_MCA_VM_L", "TCD_MCA_VM_R", "TCD_MCA_VD_L", "TCD_MCA_VD_R"],
  },
  {
    id: "no-bapwv-bands",
    kind: "no_standard",
    title: "动脉硬化检测单上常印的 baPWV 三档（<1400 / 1400~1799 / ≥1800）找不到中文指南出处",
    detail: "只找到高血压指南中“高血压患者 baPWV ≥1800 cm/s 属于器官损害”这一条，只适用于高血压患者。血管年龄也没有指南定义。",
    codes: ["BAPWV_L", "BAPWV_R", "VASCULAR_AGE"],
  },
  {
    id: "no-qus",
    kind: "no_standard",
    title: "超声骨密度没有诊断切点",
    detail: "骨质疏松指南说超声骨密度只能用于筛查，不能用于诊断，不能套用双能 X 线骨密度的 T 值标准（≤-2.5）。",
    codes: ["QUS_T", "QUS_Z", "QUS_INDEX", "QUS_SOS", "QUS_BUA", "QUS_ADULT_PCT", "QUS_AGE_PCT"],
  },
  {
    id: "no-ebv-ubt",
    kind: "no_standard",
    title: "EB 病毒抗体的数值判读、¹³C 呼气试验的阳性切点没有核实到原文",
    detail: "呼气试验常说的“≥4.0 为阳性”只在转载里看到，原文说临界值随试剂在 2~6 之间。以报告单的判定为准。",
    codes: ["EBV_EA_IGA", "HP_C13", "HP_C13_QUAL"],
  },
  {
    id: "no-va",
    kind: "no_standard",
    title: "视力：国家标准只规定 5.0 为正常视力，暂未接入",
    detail: "《标准对数视力表》（GB/T 11533—2011）规定 5.0（相当于小数记录 1.0）为正常视力，但体检报告可能用小数记录，直接套用会误判，所以暂不接入。",
    codes: ["VA_CORRECTED_L", "VA_CORRECTED_R"],
  },
  {
    id: "check-mirrors",
    kind: "needs_check",
    title: "血常规、钾钠氯、血脂指南、痛风规范的数值读自转载或镜像全文",
    detail: "WS/T 405（血常规）、WS/T 404.3（钾钠氯）、《中国血脂管理指南（2023年）》、《痛风诊疗规范》的官方原文这次没能打开或没有逐字比对。数值与业内通行值一致。",
    codes: ["WBC", "HGB", "PLT", "K", "NA", "CL", "TC", "TG", "HDL_C", "LDL_C", "UA"],
  },
  {
    id: "check-ages",
    kind: "needs_check",
    title: "部分项目的适用年龄没能确认",
    detail: "WS/T 404.1、404.2、404.3 的适用年龄写在附录里，这次没有读到，暂按成年人处理；404.4 以后的分册明确是 20~79 岁。",
    codes: ["ALT", "AST", "GGT", "TP", "ALB", "GLB", "AG_RATIO", "K", "NA", "CL"],
  },
  {
    id: "check-alt-reagent",
    kind: "needs_check",
    title: "转氨酶两组数值和试剂条件的对应关系是由脚注推断的",
    detail: "标准只在其中一组写了“试剂中含有5'-磷酸吡哆醛”，另一组“不含”是推断的。",
    codes: ["ALT", "AST"],
  },
  {
    id: "todo-wst404-9-2026",
    kind: "not_imported",
    title: "WS/T 404.9—2026（C反应蛋白、前白蛋白、转铁蛋白、β2-微球蛋白）将于 2026 年 11 月 1 日实施",
    detail: "新版将代替 2018 版。两版都还没有接入。",
    codes: ["CRP", "PA", "TRF", "B2MG"],
  },
  {
    id: "todo-wst404-10",
    kind: "not_imported",
    title: "甲状腺功能有国家参考区间（WS/T 404.10—2022），还没有接入",
    detail: "",
    codes: ["T3", "T4", "FT3", "FT4", "TSH"],
  },
  {
    id: "todo-intl-loinc",
    kind: "not_imported",
    title: "国际标准和 LOINC 编码还没有开始",
    detail: "用于和国际标准对照（冲突时仍以国家标准为准），以及给每个指标一个国际通用编码。",
    codes: [],
  },
  {
    id: "todo-explain-critical",
    kind: "not_imported",
    title: "通俗解释和“建议就医”提醒规则还没有核实",
    detail: "指标的通俗解释、以及“数值超过多少建议尽快就医”的提醒规则，仍是应用内置内容，标“未核实”。",
    codes: [],
  },
  {
    id: "todo-nonhdl-targets",
    kind: "not_imported",
    title: "非HDL胆固醇按风险等级的目标值没有收录",
    detail: "血脂指南只给了换算公式（LDL 目标值 + 0.8 mmol/L），没有逐级印出数值，所以没有收录推算出来的数字。",
    codes: ["NON_HDL_C"],
  },
];

/** Research batch file -> plain topic name (for the raw research records). */
export const RESEARCH_TOPIC_ZH: Record<string, string> = {
  "r1a_wst404_liver_protein_bili.json": "肝功能、蛋白、胆红素（WS/T 404.1 / 404.2 / 404.4）",
  "r1b_wst404_electrolyte_kidney_mineral.json": "电解质、肾功能、钙磷镁（WS/T 404.3 / 404.5 / 404.6）",
  "r1c_wst405_blood_cells.json": "血常规（WS/T 405）",
  "r2a_cn_thresholds_body_glucose_ua.json": "体重、腰围、血糖、尿酸的判定切点",
  "r2b_cn_thresholds_bp_pwv_abi.json": "血压、动脉硬化（baPWV / ABI）的判定切点",
  "r6_new_items_cn.json": "新增项目（心脏彩超、骨密度、视力、心电图、CK、淀粉酶等）",
  "r7_cn_lipid_guideline_2023.json": "血脂（中国血脂管理指南 2023）",
};
