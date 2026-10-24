# Orbyte：Supabase + AI API Keys 配置方式

## 1. 最推荐的方式

不要把真实 API Key 写进 React/TypeScript 前端。全部放在**服务器环境变量**或部署平台的 Secret/Environment Variables。

复制 `.env.example` 为 `.env.local`，然后填写：

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_KEY

GEMINI_API_KEYS=YOUR_GEMINI_KEY_1,YOUR_GEMINI_KEY_2
OPENAI_API_KEYS=YOUR_OPENAI_KEY_1,YOUR_OPENAI_KEY_2

AI_PROVIDER_ORDER=gemini,openai
POLICY_QA_PROVIDER_ORDER=gemini,openai
```

## 2. Supabase 怎么填

`SUPABASE_URL`：填你的 Supabase **Project URL**，例如：

```text
https://xxxxxxxx.supabase.co
```

`SUPABASE_SECRET_KEY`：填 Supabase 后台生成的 server-side Secret Key（通常是 `sb_secret_...`）。如果你的项目仍使用旧版 `service_role` key，也可以放在这里。

**不要**把 Secret Key 放到 `VITE_...` 变量、React 文件、浏览器 localStorage 或公开 GitHub 仓库。

## 3. 多个 AI API Key

Orbyte 已支持同一供应商多个 Key。可以用逗号、分号或换行分隔：

```dotenv
GEMINI_API_KEYS=key_1,key_2,key_3
OPENAI_API_KEYS=key_a,key_b
```

系统会按 `AI_PROVIDER_ORDER`：

```text
Gemini key 1 → Gemini key 2 → Gemini key 3 → OpenAI key 1 → OpenAI key 2
```

当某个 Key 遇到 401、403、429、超时或临时服务错误时，会尝试下一个 Key/供应商。

## 4. 如果只用 Gemini

最简单只需要：

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_KEY
GEMINI_API_KEYS=YOUR_GEMINI_KEY_1,YOUR_GEMINI_KEY_2
AI_PROVIDER_ORDER=gemini
POLICY_QA_PROVIDER_ORDER=gemini
```

也兼容单 Key：

```dotenv
GEMINI_API_KEY=YOUR_GEMINI_KEY
```

## 5. Google AI Studio / 部署环境

如果部署平台提供 Secrets / Environment Variables，就直接建立同名变量，不需要把 `.env.local` 上传。

至少配置：

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `GEMINI_API_KEYS` 或 `GEMINI_API_KEY`

如果要 Gemini 失败后自动切 OpenAI，再加：

- `OPENAI_API_KEYS` 或 `OPENAI_API_KEY`
- `AI_PROVIDER_ORDER=gemini,openai`

## 6. 重要安全规则

- `.env.local` 不要提交 Git。
- 不要把真实 Key 写进 `src/`。
- 不要使用 `VITE_SUPABASE_SECRET_KEY`。
- 不要把 Supabase Secret Key 放给浏览器。
- 如果一个真实 Key 已经被上传到 GitHub、ZIP、公开分享链接或截图中，应立即撤销并重新生成。

## 7. 启动

本地：

```bash
npm install
npm run dev
```

启动时服务器会自动读取 `.env.local` / `.env`。项目不再读取 `.env.example` 作为实际配置，避免 placeholder 被误当成真实 secret。

## 8. 验证

```bash
npm run test:ai-fallback
npm run test:policy-qa
```

如果 Policy Q&A 仍然显示没有资料，除了 AI Key，还必须确认 Supabase 中已经有政策来源/已批准 package，并且已经执行对应的 SQL 权限设置。
