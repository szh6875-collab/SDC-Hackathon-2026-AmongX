# Orbyte Hub: Supabase 动态政策清单与规则安全验证架构

## 架构与核心设计

本更新将代码中写死的政策来源全面改造为由 **Supabase 持久化管理的动态来源清单**，并配套定时与按需自动抓取、正文提取、以及 **7 点自动化规则安全验证机制**。

### 核心安全准则
**原始 PDF 与网页正文文本绝不能在未经结构化解析与安全验证的情况下，直接用于税率或合规金额计算。**
抓取任务提取的正文将暂存为“候选规则包（Candidate Package，状态为 pending_validation）”。候选规则包必须通过安全检查并由授权人员审核，但这不等于预算公告已经成为生效法律。企业税率比较统一读取 `src/constants/policyConstants.ts` 的中央税率表；动态规则包不能自行覆盖税率。若 Supabase 已配置但没有符合条件的已验证活动包，系统不会退回本地旧包冒充正式规则。

---

## 1. 数据库表设计 (`database/policy-monitor-schema.sql`)

1. **`public.policy_sources`**：动态政策来源清单表。
   - 字段包括：`id`, `name`, `url`, `document_type`, `category` (guideline / faq / budget_speech / gazette / sst / custom), `source_format` (pdf / html / json), `check_interval_hours`, `is_active`, `current_sha256`, `status` 等。
2. **`public.policy_approved_packages`**：已验证与已批准规则包表。
   - 保存候选/审核规则包、来源证据、税率分阶和安全验证报告。企业税率计算仍以中央税率表为准；规则包中的税阶必须与中央参考表一致，才可能被标记为活动包。
3. **`public.policy_monitor_history`**：官方 PDF 与 FAQ HTML 的提取正文及历史 SHA-256 审计存证表。

---

## 2. 7 点自动化规则安全验证体系 (`policySafetyVerifier.ts`)

抓取并提取出新规则草案后，系统自动执行 7 点安全性与合理性校验：
1. **税阶单调递增性 (`CHK-BRACKET-MONOTONIC`)**：各级收入门槛必须严格升序递增，最高阶必须为开放区间。
2. **法定税率合理范围 (`CHK-RATE-BOUNDS`)**：所有边际税率必须介于 0% 到 45% 之间，严禁负数或异常超标数值。
3. **电子发票豁免门槛合规性 (`CHK-EXEMPTION-SANITY`)**：免于即时实施的年营业额门槛需在合理区间（RM 500,000 至 RM 50,000,000，以官方公布的 RM 3,000,000 为基准）。
4. **最低薪资阶梯核验 (`CHK-WAGE-BOUNDS`)**：核验员工薪金基准符合国家最低薪金令（RM 1,200 至 RM 5,000，当前基准 RM 1,700）。
5. **SST 分类税率核验 (`CHK-SST-RATE`)**：销售与服务税率符合大马皇家海关标准（0% 至 25%，基准 8%）。
6. **来源可信度与 SHA-256 完整性 (`CHK-SOURCE-PROVENANCE`)**：正文字符串 SHA-256 摘要有效，且来源需为官方域名（`hasil.gov.my`, `mof.gov.my` 等）。
7. **规则逻辑自洽性 (`CHK-RULE-CONSISTENCY`)**：确保无重复标识符与冲突的前置条件。

---

## 3. 核心 API 接口

- `GET /api/policy-sources`：查询 Supabase 动态来源列表。
- `POST /api/policy-sources`：在清单中注册新政策来源。
- `PUT /api/policy-sources/:id`：修改政策来源或切换启用/禁用状态。
- `DELETE /api/policy-sources/:id`：删除政策来源。
- `POST /api/policy-sources/:id/crawl`：立即抓取指定来源、提取 PDF 正文、计算哈希并暂存候选规则。
- `POST /api/policy-sources/crawl-all`：批量抓取所有活跃来源。
- `GET /api/policy-packages`：获取所有候选规则包与已批准规则包。
- `GET /api/policy-packages/active`：获取已验证的活动规则包状态；税率比较仍来自中央税率表。若没有合格的活动包，接口返回明确标记为未验证的本地演示 fallback。
- `POST /api/policy-packages/:id/verify`：重新运行 7 点安全验证测试套件。
- `POST /api/policy-packages/:id/approve`：授权审核候选包（拥有者/专家权限）；税阶与中央参考表不同的包会被拒绝激活。政策公告不会仅因通过结构检查和人工点击就自动变成生效税法。
- `POST /api/policy-packages/:id/reject`：驳回候选规则包。
- `GET /api/policy-packages/:id/diff`：提供候选包与当前生效包的税阶与门槛差异对比。


## 4. 企业税率统一计算护栏

税率唯一配置入口为 `src/constants/policyConstants.ts`：

- **参考税率表：** 15% / 17% / 24%，依据 LHDN 已发布的 YA 2023–2025 参考资料；使用时仍须确认适用的课税年度及企业资格。
- **Budget 2027 公告情景：** 14% / 16% / 24%，只作比较情景，不被默认当作已生效税率。
- 首页、财务影响计算及资格预检使用同一套中央计算函数。展示的差额不是已确认节税额，也不是正式应缴税额。
- 本地演示 fallback 为 `draft` 且 `isActive=false`。若 Supabase 已配置但没有通过安全验证、已批准且税阶匹配的活动包，系统不得悄悄改用本地旧包充当正式规则。
- 只有核实正式法律文件、课税年度、生效日期及资格后，才能通过经过审核的代码/发布流程更新中央税率表。

## 5. 一般政策问答的 Supabase 读取权限

启用证据检索问答前，在 Supabase SQL Editor 执行 `database/policy-qa-read-access.sql`，为后端服务角色授予 `policy_sources`、`policy_monitor_documents`、`policy_monitor_history` 与 `policy_approved_packages` 的读取权限。提取后的政策全文只由服务端使用 `SUPABASE_SECRET_KEY` 读取；不要给 `anon` / `authenticated` 角色开放全文表权限，也不要把 Secret Key 放进前端。

## 6. 新增 n8n 定时任务（本项目已包含可导入工作流）

本项目提供 `automation/n8n/policy-monitor.json`。它每 12 小时调用 Orbyte 后端的受保护路由：`POST /api/automation/policy-monitor/run`，抓取 General 与 Specific e-Invoice guideline 官方 PDF，并解析官方 e-Invoice FAQ 索引页，并下载其中链接的官方 FAQ PDF、提取正文后存入可检索历史；不接受外部传入任意 URL，也不会自动激活候选规则。FAQ 正文只用于检索证据，不会自动生成税务规则包。

### 配置顺序

1. 在 Supabase SQL Editor 依次运行 `database/policy-monitor-schema.sql`、`database/policy-monitor-rpc.sql`。
2. 在 Orbyte 服务端 secret/environment 中设置 `SUPABASE_URL`、`SUPABASE_SECRET_KEY` 与 `ORBYTE_AUTOMATION_SECRET`。自动化 secret 必须是至少 32 个字符的随机值。不要将 Supabase Secret Key 放进前端、`VITE_*` 环境变量或 n8n workflow 文件。
3. 导入 `automation/n8n/policy-monitor.json` 到 n8n。
4. 编辑 `Run Official LHDN PDFs + FAQ Snapshot Check` HTTP Request 节点，把 URL 中的 `YOUR_ORBYTE_HOST` 替换为实际部署地址。
5. 在 n8n 新建 **HTTP Header Auth** 凭据：Header Name 为 `x-orbyte-automation-secret`，Header Value 与服务端 `ORBYTE_AUTOMATION_SECRET` 完全一致，然后在 HTTP Request 节点选择此凭据。
6. 先运行 **Manual Test Run**。确认执行结果 `success: true`、三个来源（两份指南 PDF 与 FAQ 索引及其链接 PDF）都成功，并在 Supabase 的 `policy_monitor_documents` 与 `policy_monitor_history` 中看到快照，再启用 workflow。
7. 若是已有 Supabase 项目，另需执行 `database/policy-qa-read-access.sql`，让后端服务角色读取保存的官方正文和已审核规则包，且不向浏览器开放提取文本。

只有在 n8n Executions 页面确认一次计划任务成功后，才把 Orbyte 服务端的 `N8N_POLICY_MONITOR_SCHEDULE_ENABLED` 改为 `true`。这只是 UI 状态开关，不会自行启用 n8n 工作流。

### 失败时先检查

- `503 Automation is not configured`：后端未设置足够长的 `ORBYTE_AUTOMATION_SECRET`。
- `401 Unauthorized`：n8n Header Auth header name 或 secret 不匹配。
- `503 Supabase is not configured`：缺少 `SUPABASE_URL` / `SUPABASE_SECRET_KEY`。
- `502` 并提示 source/RPC：确认 schema 和 RPC SQL 已部署、`policy_sources` 中存在三个来源 ID：`lhdn-general-guideline`、`lhdn-specific-guideline`、`lhdn-faq`，并检查服务端出站网络与 n8n execution logs。
- 如果官方页面没有包含可匹配的 General/Specific PDF 链接，或 FAQ 索引页没有找到允许的官方 FAQ PDF，任务会失败而不是退回本地 JSON fixture。需更新链接解析逻辑或修正官方来源页面后再重试。

### 安全与事实边界

首次成功抓取的指南 PDF 会建立 SHA-256 基线，并可生成待人工审核的候选规则包；FAQ PDF 只归档为问答证据，不会自动生成操作规则包；这不能证明文件的法律效力，也不会自动批准或激活税务规则。后续哈希变化仅代表内容变化，仍需人工审查。真实 Supabase/n8n 连通性需要用你自己的项目 URL、密钥、部署主机和 n8n workspace 做端到端验证；没有这些外部凭据时，代码文件本身不能证明已经上线运行。
