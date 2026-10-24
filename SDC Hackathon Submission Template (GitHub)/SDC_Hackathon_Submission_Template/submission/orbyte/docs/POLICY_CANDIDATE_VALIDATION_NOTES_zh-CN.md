# 候选规则包验证说明（重要）

## `Safety Score 100%` 不代表政策已经被证实

7 点验证主要检查结构/参数范围，例如税率顺序、数值上下界、SST 参数范围、SHA-256 字符串格式和规则 ID。它不检查每一条规则是否确实出现在来源文件里，也不证明法规已经生效。人工批准前必须逐条核对官方文件、版本、适用年度、生效日期和原文依据。

## MySST 来源特别处理

`lhdn-sst-reference` 链接到 `https://mysst.customs.gov.my/`，这是一般 MySST 门户首页，不是一个具备明确版本号的 e-Invoice 指南。旧的通用解析器会给不同来源生成相同的默认税务和 e-Invoice 规则，因此不能仅凭 100% 结构分数来批准这些旧包。

该来源现在只用于归档/监测其 SST 页面文本，不会自动生成可激活的操作规则包；服务器端也会拒绝激活由旧 `lhdn-sst-reference` 来源产生的候选包。旧本地示例中的相关包已标为 rejected。若 Supabase 中仍保存旧记录，请在 Advanced Policy Management 中逐条拒绝这些旧候选，并保留审计记录。

## 正式 e-Invoice 来源

请使用 HASiL 官方 e-Invoice Guideline / Specific Guideline 的版本化 PDF。只有在确认源文档、版本、生效日期及每条规则依据后，才能考虑发布规则。SHA-256 仅用于识别内容快照是否变化，不证明其法律含义。
