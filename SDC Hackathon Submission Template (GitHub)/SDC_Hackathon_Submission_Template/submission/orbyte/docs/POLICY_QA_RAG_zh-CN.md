# Orbyte 一般政策问答：证据检索实现

## 工作流程

1. 前端向 `POST /api/policy-qa/ask` 提交问题和回答语言。Supabase secret 只由服务器读取。
2. 服务器从 `policy_sources`、`policy_monitor_documents`、`policy_monitor_history` 读取已保存的官方来源元数据和原文快照，并从 `policy_approved_packages` 读取通过安全验证、有人类批准记录的规则包。
3. 只接受 HTTPS 且域名属于 `.gov.my` 的官方来源；不把本地演示规则包、draft、rejected 包或任意非政府网址当作证据。
4. 将抓取原文切分成可追踪的摘录，通过关键词相关性检索，并使用配置的 AI 提供商扩展检索词。
5. 服务器按配置顺序调用 Gemini/OpenAI；当某个 key 遇到额度/速率限制、认证错误、网络故障或临时服务错误时，会尝试下一个 key，再切换下一个提供商。所有生成结果必须是合法 JSON，且回答引用仍由服务端验证。
6. AI 只能根据返回的证据摘录组织回答；每个事实回答行都必须带 `[E1]` 等引用。证据不足、Supabase 不可用或所有 AI 提供商均失败时，会明确显示“暂时无法核实”或服务不可用，不回退到关键词预设答案。

## 引用内容

每条证据显示官方来源链接、文件版本（如已记录）、原文摘录编号、抓取时间、最后成功获取时间、最后检查时间、监控状态和 SHA-256（如存在）。`checked_unchanged` 且在 45 天内成功获取的快照才会标记为近期未变化；首次 baseline、hash 不匹配、待人工审核、过期或非活动规则包均会降级并提示核实。SHA-256 改变不等于法律已经改变。

## 配置

需要服务器端 `SUPABASE_URL`、`SUPABASE_SECRET_KEY`（或现有的 `SUPABASE_KEY` 别名），以及至少一个 Gemini 或 OpenAI key。可通过 `GEMINI_API_KEYS` / `OPENAI_API_KEYS` 分别配置多个 key（用逗号或换行分隔），旧变量 `GEMINI_API_KEY` / `OPENAI_API_KEY` 仍兼容。默认按 `AI_PROVIDER_ORDER=gemini,openai` 尝试；政策问答可用 `POLICY_QA_PROVIDER_ORDER` 单独覆盖。模型可通过 `POLICY_QA_GEMINI_MODEL`、`POLICY_QA_OPENAI_MODEL` 配置。API keys 必须只放在服务器环境变量或 Secret Manager 中，不得放在浏览器代码或 `VITE_*` 变量里。

注意：这套回退机制也供政策摘要/规则草稿处理和现有发票文本、图片、PDF AI 识别入口使用。Gemini 的速率和请求额度通常按 Google Cloud/API 项目而非单个 API key 统计；同一个项目创建多个 Gemini key 不能保证绕过项目额度限制。配置 OpenAI 作为备用提供商，才可在 Gemini 整个项目额度用尽时尝试跨提供商切换。

## 部署前步骤

新版监控器会从官方 FAQ 索引继续下载每份链接的 FAQ PDF，并将带有独立标题、版本和 PDF 来源 URL 的证据段落保存到 Supabase。部署后必须在 n8n 手动执行一次 **Manual Test Run**。升级前仅存储 FAQ 索引 HTML 的旧快照会被问答接口排除，直到新 FAQ PDF 语料保存成功。

## 测试

执行 `npm run test:policy-qa` 检查检索与引用 fail-closed 规则；执行 `npm run test:ai-fallback` 检查 key 列表解析、错误分类和额度耗尽后轮换到下一 key。
