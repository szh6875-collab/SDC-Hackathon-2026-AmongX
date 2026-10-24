/**
 * Server-only text/JSON AI provider fallback.
 * API keys are read only from server environment variables and are never returned
 * to callers or included in logs.
 */
import { GoogleGenAI } from '@google/genai';

export type TextAiProvider = 'gemini' | 'openai';
export type TextAiPurpose = 'policy-qa' | 'policy-summary' | 'policy-draft';

export interface TextAiResult {
  text: string;
  provider: TextAiProvider;
  model: string;
  keySlot: number;
}

export interface TextAiOptions {
  purpose: TextAiPurpose;
  /** Gemini structured-output schema. OpenAI uses JSON-object mode and validates JSON after the call. */
  geminiResponseSchema?: unknown;
}

export class TextAiUnavailableError extends Error {
  readonly attempts: Array<{ provider: TextAiProvider; keySlot: number; status: number | null }>;

  constructor(attempts: Array<{ provider: TextAiProvider; keySlot: number; status: number | null }>) {
    super('All configured text AI providers failed or returned invalid JSON.');
    this.name = 'TextAiUnavailableError';
    this.attempts = attempts;
  }
}

const PLACEHOLDER_KEYS = new Set([
  '', 'YOUR_GEMINI_API_KEY', 'YOUR_OPENAI_API_KEY', 'MY_GEMINI_API_KEY',
  'MY_OPENAI_API_KEY', 'YOUR_API_KEY', 'REPLACE_ME', 'CHANGEME',
]);

function normalizeKey(raw: string): string {
  return raw.trim().replace(/^['"]|['"]$/g, '').trim();
}

function keyIsUsable(raw: string): boolean {
  const normalized = normalizeKey(raw);
  if (!normalized || PLACEHOLDER_KEYS.has(normalized.toUpperCase())) return false;
  if (/^(YOUR|MY|REPLACE|CHANGEME)_/i.test(normalized)) return false;
  return true;
}

/** Supports comma-, semicolon-, or newline-separated keys plus the legacy singular variable. */
export function parseApiKeyList(...values: Array<string | undefined>): string[] {
  const keys: string[] = [];
  for (const value of values) {
    for (const item of (value || '').split(/[\n,;]+/)) {
      const key = normalizeKey(item);
      if (keyIsUsable(key) && !keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

export function getConfiguredTextAiProviders(): Array<{ provider: TextAiProvider; keys: string[] }> {
  const geminiKeys = parseApiKeyList(
    process.env.GEMINI_API_KEYS,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
  );
  const openAiKeys = parseApiKeyList(process.env.OPENAI_API_KEYS, process.env.OPENAI_API_KEY);
  const orderText = process.env.POLICY_QA_PROVIDER_ORDER || process.env.AI_PROVIDER_ORDER || 'gemini,openai';
  const order = orderText.split(/[\s,;]+/).map((item) => item.toLowerCase()).filter(Boolean);
  const selected: Array<{ provider: TextAiProvider; keys: string[] }> = [];
  for (const item of order) {
    if (item === 'gemini' && geminiKeys.length && !selected.some((entry) => entry.provider === 'gemini')) {
      selected.push({ provider: 'gemini', keys: geminiKeys });
    }
    if (item === 'openai' && openAiKeys.length && !selected.some((entry) => entry.provider === 'openai')) {
      selected.push({ provider: 'openai', keys: openAiKeys });
    }
  }
  // Unknown or omitted provider-order entries cannot disable a configured fallback accidentally.
  if (geminiKeys.length && !selected.some((entry) => entry.provider === 'gemini')) selected.push({ provider: 'gemini', keys: geminiKeys });
  if (openAiKeys.length && !selected.some((entry) => entry.provider === 'openai')) selected.push({ provider: 'openai', keys: openAiKeys });
  return selected;
}

export function hasConfiguredTextAiProvider(): boolean {
  return getConfiguredTextAiProviders().length > 0;
}

function statusFromError(error: unknown): number | null {
  const candidate = error as any;
  const direct = Number(candidate?.status ?? candidate?.statusCode ?? candidate?.response?.status);
  if (Number.isInteger(direct) && direct >= 100 && direct <= 599) return direct;
  const message = String(candidate?.message || error || '');
  const match = message.match(/(?:HTTP|status|code)?\s*[:=]?\s*(401|403|408|429|500|502|503|504)\b/i);
  return match ? Number(match[1]) : null;
}

/** Determines whether another key for this same provider is worth trying. */
export function shouldTryNextKey(error: unknown): boolean {
  const status = statusFromError(error);
  if (status !== null) return [401, 403, 408, 429, 500, 502, 503, 504].includes(status);
  const message = String((error as any)?.message || error || '').toLowerCase();
  return /quota|resource_exhausted|rate.?limit|too many requests|temporar|timeout|timed out|network|fetch failed|econnreset|socket hang up|service unavailable|invalid api key|unauthorized|forbidden|json parse|invalid json/.test(message);
}

function modelFor(provider: TextAiProvider, purpose: TextAiPurpose): string {
  if (provider === 'gemini') {
    if (purpose === 'policy-qa') return process.env.POLICY_QA_GEMINI_MODEL || process.env.POLICY_QA_MODEL || process.env.AI_GEMINI_MODEL || 'gemini-3.8-flash';
    return process.env.AI_GEMINI_MODEL || 'gemini-3.8-flash';
  }
  if (purpose === 'policy-qa') return process.env.POLICY_QA_OPENAI_MODEL || process.env.AI_OPENAI_MODEL || 'gpt-4.1-mini';
  return process.env.AI_OPENAI_MODEL || 'gpt-4.1-mini';
}

function cleanJsonText(raw: string): string {
  let cleaned = (raw || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  }
  const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return match ? match[0] : cleaned;
}

async function callGemini(key: string, model: string, prompt: string, responseSchema?: unknown): Promise<string> {
  const targetModel = (model === 'gemini-2.5-flash' || !model) ? 'gemini-3.8-flash' : model;
  const client = new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'orbyte-invoisready',
      },
    },
  });

  const timeoutMs = 9000;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Gemini API call timed out')), timeoutMs)
  );

  let response;
  try {
    const callPromise = client.models.generateContent({
      model: targetModel,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        ...(responseSchema ? { responseSchema: responseSchema as any } : {}),
      },
    });
    response = await Promise.race([callPromise, timeoutPromise]);
  } catch (err: any) {
    const status = statusFromError(err);
    if (targetModel !== 'gemini-3.1-flash-lite' && (status === 503 || status === 429 || status === 404)) {
      const fallbackCall = client.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          ...(responseSchema ? { responseSchema: responseSchema as any } : {}),
        },
      });
      response = await Promise.race([fallbackCall, timeoutPromise]);
    } else {
      throw err;
    }
  }
  const text = cleanJsonText(response.text?.trim() || '');
  try { JSON.parse(text); } catch { throw new Error('Invalid JSON response from Gemini provider'); }
  return text;
}

async function callOpenAI(key: string, model: string, prompt: string, responseSchema?: unknown): Promise<string> {
  const schema = responseSchema ? normalizeGeminiSchemaForPrompt(responseSchema) : null;
  const schemaInstruction = schema ? `\nOutput JSON must conform to this schema (treat type names and field names literally): ${JSON.stringify(schema)}` : '';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_completion_tokens: 1800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `Return one valid JSON object only. Follow the user prompt exactly. Never add Markdown fences.${schemaInstruction}` },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(35_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const message = body.slice(0, 500);
    const error = new Error(`OpenAI HTTP ${response.status}: ${message}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  const payload = await response.json() as any;
  const text = String(payload?.choices?.[0]?.message?.content || '').trim();
  try { JSON.parse(text); } catch { throw new Error('Invalid JSON response from OpenAI provider'); }
  return text;
}


function toOpenAIResponsesContent(contents: unknown): Array<Record<string, unknown>> {
  const output: Array<Record<string, unknown>> = [];
  const addPart = (part: any) => {
    if (typeof part === 'string') {
      output.push({ type: 'input_text', text: part });
      return;
    }
    if (!part || typeof part !== 'object') return;
    const text = typeof part.text === 'string' ? part.text : null;
    if (text !== null) output.push({ type: 'input_text', text });
    const inline = part.inlineData || part.inline_data;
    if (inline && typeof inline.data === 'string') {
      const mimeType = String(inline.mimeType || inline.mime_type || 'application/octet-stream').toLowerCase();
      if (mimeType.startsWith('image/')) {
        output.push({ type: 'input_image', image_url: `data:${mimeType};base64,${inline.data}`, detail: 'high' });
      } else {
        const extension = mimeType === 'application/pdf' ? 'pdf' : 'bin';
        output.push({ type: 'input_file', filename: `orbyte-document.${extension}`, file_data: inline.data });
      }
    }
    const fileData = part.fileData || part.file_data;
    if (fileData && typeof fileData.fileUri === 'string') {
      output.push({ type: 'input_file', file_url: fileData.fileUri, filename: fileData.displayName || 'orbyte-document' });
    }
  };

  if (typeof contents === 'string') {
    addPart(contents);
  } else if (Array.isArray(contents)) {
    for (const item of contents) {
      if (Array.isArray(item?.parts)) item.parts.forEach(addPart);
      else addPart(item);
    }
  } else if (contents && typeof contents === 'object' && Array.isArray((contents as any).parts)) {
    (contents as any).parts.forEach(addPart);
  } else {
    addPart(JSON.stringify(contents ?? ''));
  }
  return output;
}

function normalizeGeminiSchemaForPrompt(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  const typeMap: Record<string, string> = {
    OBJECT: 'object', ARRAY: 'array', STRING: 'string', NUMBER: 'number', INTEGER: 'integer', BOOLEAN: 'boolean', NULL: 'null',
  };
  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'type' && typeof value === 'string') normalized.type = typeMap[value.toUpperCase()] || value.toLowerCase();
    else if (key === 'properties' && value && typeof value === 'object') {
      normalized.properties = Object.fromEntries(Object.entries(value as Record<string, any>).map(([name, child]) => [name, normalizeGeminiSchemaForPrompt(child)]));
    } else if (key === 'items') normalized.items = normalizeGeminiSchemaForPrompt(value);
    else if (key === 'anyOf' && Array.isArray(value)) normalized.anyOf = value.map(normalizeGeminiSchemaForPrompt);
    else if (key !== 'nullable' && key !== 'propertyOrdering') normalized[key] = value;
  }
  return normalized;
}

async function callOpenAIForGeminiRequest(key: string, request: any): Promise<{ text: string }> {
  const content = toOpenAIResponsesContent(request?.contents);
  if (!content.length) throw new Error('No supported content was provided for OpenAI fallback.');
  const model = process.env.AI_OPENAI_MODEL?.trim() || 'gpt-4.1-mini';
  const schema = request?.config?.responseSchema ? normalizeGeminiSchemaForPrompt(request.config.responseSchema) : null;
  const schemaInstruction = schema ? `\nOutput JSON must conform to this schema (treat type names and field names literally): ${JSON.stringify(schema)}` : '';
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: `Return valid JSON only. Follow the extraction instructions exactly. Never add Markdown fences, never guess missing invoice fields, and do not assess compliance unless the supplied task explicitly requests policy analysis grounded in provided evidence.${schemaInstruction}` }] },
        { role: 'user', content },
      ],
      text: { format: { type: 'json_object' } },
      max_output_tokens: 2200,
    }),
    signal: AbortSignal.timeout(35_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(`OpenAI Responses HTTP ${response.status}: ${body.slice(0, 500)}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  const payload = await response.json() as any;
  const text = String(payload?.output_text || payload?.output?.flatMap((item: any) => item?.content || []).find((part: any) => part?.type === 'output_text')?.text || '').trim();
  try { JSON.parse(text); } catch { throw new Error('Invalid JSON response from OpenAI multimodal fallback'); }
  return { text };
}

/** Multi-provider adapter for invoice extraction's existing Gemini SDK-shaped calls. */
export async function generateContentWithProviderFallback(request: any): Promise<{ text: string }> {
  const providers = getConfiguredTextAiProviders();
  const attempts: Array<{ provider: TextAiProvider; keySlot: number; status: number | null }> = [];
  for (const configured of providers) {
    for (let index = 0; index < configured.keys.length; index += 1) {
      try {
        if (configured.provider === 'gemini') {
          const client = new GoogleGenAI({
            apiKey: configured.keys[index],
            httpOptions: {
              headers: {
                'User-Agent': 'orbyte-invoisready',
              },
            },
          });
          const targetModel = (request.model === 'gemini-2.5-flash' || !request.model) ? 'gemini-3.8-flash' : request.model;
          const timeoutMs = 9000;
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Gemini API call timed out')), timeoutMs)
          );
          let result;
          try {
            const callPromise = client.models.generateContent({
              ...request,
              model: targetModel,
            });
            result = await Promise.race([callPromise, timeoutPromise]);
          } catch (modelErr: any) {
            const status = statusFromError(modelErr);
            if (targetModel !== 'gemini-3.1-flash-lite' && (status === 503 || status === 429 || status === 404)) {
              const fallbackCall = client.models.generateContent({
                ...request,
                model: 'gemini-3.1-flash-lite',
              });
              result = await Promise.race([fallbackCall, timeoutPromise]);
            } else {
              throw modelErr;
            }
          }
          const text = cleanJsonText(result.text?.trim() || '');
          try { JSON.parse(text); } catch { throw new Error('Invalid JSON response from Gemini provider'); }
          return { text };
        }
        const result = await callOpenAIForGeminiRequest(configured.keys[index], request);
        return result;
      } catch (error) {
        const status = statusFromError(error);
        attempts.push({ provider: configured.provider, keySlot: index + 1, status });
        console.warn(`[ai-content-fallback] ${configured.provider} key slot ${index + 1} failed${status ? ` (HTTP ${status})` : ''}; attempting the configured fallback without logging secrets.`);
        if (!shouldTryNextKey(error)) break;
      }
    }
  }
  throw new TextAiUnavailableError(attempts);
}

/**
 * Tries configured providers and keys in order. Quota, rate-limit, auth, network,
 * and transient service failures fall through to the next key; provider/model
 * request errors move on to the next provider rather than burning every key.
 */
export async function generateJsonWithFallback(prompt: string, options: TextAiOptions): Promise<TextAiResult> {
  const providers = getConfiguredTextAiProviders();
  const attempts: Array<{ provider: TextAiProvider; keySlot: number; status: number | null }> = [];

  for (const configured of providers) {
    const model = modelFor(configured.provider, options.purpose);
    for (let index = 0; index < configured.keys.length; index += 1) {
      try {
        const key = configured.keys[index];
        const text = configured.provider === 'gemini'
          ? await callGemini(key, model, prompt, options.geminiResponseSchema)
          : await callOpenAI(key, model, prompt, options.geminiResponseSchema);
        return { text, provider: configured.provider, model, keySlot: index + 1 };
      } catch (error) {
        const status = statusFromError(error);
        attempts.push({ provider: configured.provider, keySlot: index + 1, status });
        console.warn(`[ai-fallback] ${configured.provider} key slot ${index + 1} failed${status ? ` (HTTP ${status})` : ''}; attempting configured fallback without logging secrets.`);
        if (!shouldTryNextKey(error)) break;
      }
    }
  }
  throw new TextAiUnavailableError(attempts);
}
