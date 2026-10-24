# Orbyte AI API 多 Key / 多供应商自动回退

## 支持范围

服务器端的 AI 调用会按顺序尝试配置的供应商与 Key：

- 一般政策问答（证据检索 + 引用校验仍然保留）。
- 政策变更摘要。
- 政策规则草稿提取。
- 发票文本、图片和 PDF 的 AI 提取入口。

AI 的税务计算不会交给模型决定；税率与资格计算仍由确定性规则负责。AI 供应商切换仅负责生成/提取内容，不会绕过规则验证或审批。

## 环境变量

把真实 Key 放在服务器 `.env.local` 或部署平台的 Secret/Environment Variables 中，不要提交真实 Key 到 Git，也不要放进 `VITE_*` 浏览器变量。

```dotenv
# 可以添加多把 Key，用逗号或换行分隔
GEMINI_API_KEYS=gemini_key_1,gemini_key_2
OPENAI_API_KEYS=openai_key_1,openai_key_2

# 旧变量仍兼容，建议迁移到上面的多 Key 变量
GEMINI_API_KEY=
OPENAI_API_KEY=

# 全站文本/发票 AI 的默认顺序；左边先尝试
AI_PROVIDER_ORDER=gemini,openai
AI_GEMINI_MODEL=gemini-3.8-flash
AI_OPENAI_MODEL=gpt-4.1-mini

# 政策问答可单独覆盖顺序和模型
POLICY_QA_PROVIDER_ORDER=gemini,openai
POLICY_QA_GEMINI_MODEL=gemini-3.8-flash
POLICY_QA_OPENAI_MODEL=gpt-4.1-mini
```

## 自动回退行为

1. 按供应商顺序调用，例如先 Gemini，再 OpenAI。
2. 同一供应商依次尝试该供应商的 Key。
3. Key 无效/认证失败、额度或速率限制（通常 HTTP 429）、请求超时、网络故障、临时服务故障或返回非法 JSON 时，尝试下一个 Key。
4. 属于请求格式/模型配置等不可通过换 Key 解决的错误时，跳到下一个供应商，避免把每把 Key 都重复浪费在同一个错误请求上。
5. 所有供应商失败时，政策问答仍返回 `ai_unavailable`，不会生成无来源答案；发票提取会沿用原有确定性/OCR/人工复核路径。

服务器日志只记录供应商与 Key 槽位序号，不记录完整 API Key。系统状态接口只返回已配置的 Key 数量与供应商顺序，不返回 Key 本身。

## 配额注意事项

多个 API Key 不一定等于多份独立额度。Gemini 的 RPM/TPM/RPD 限额通常按 API 项目计算；同一 Google 项目下创建多把 Key，不能保证绕过项目额度限制。遇到整个 Gemini 项目额度用尽时，配置 OpenAI 作为第二供应商更有价值。OpenAI 侧也应检查所用组织/项目的用量与限额。

不同供应商的模型输出、延迟、价格和支持的输入格式可能不同。回退会产生对应供应商的实际 API 费用；发票或政策文本也会发送到当次成功调用的供应商。部署前请确认供应商、数据处理条件与公司隐私要求。

## 验证

运行：

```bash
npm run test:ai-fallback
npm run test:policy-qa
npm run test:tax-consistency
```

`test:ai-fallback` 使用模拟 API 响应检查 Key 列表解析、429 配额错误后的 Key 轮换，以及 PDF 输入向 OpenAI Responses API 的转换，不会消耗真实 API 额度。
