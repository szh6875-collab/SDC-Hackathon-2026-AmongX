import assert from 'node:assert/strict';
import {
  generateContentWithProviderFallback,
  generateJsonWithFallback,
  getConfiguredTextAiProviders,
  parseApiKeyList,
  shouldTryNextKey,
} from '../src/services/aiProviderFallback.ts';

const saved = {
  providerOrder: process.env.POLICY_QA_PROVIDER_ORDER,
  aiProviderOrder: process.env.AI_PROVIDER_ORDER,
  geminiKeys: process.env.GEMINI_API_KEYS,
  geminiKey: process.env.GEMINI_API_KEY,
  googleKey: process.env.GOOGLE_API_KEY,
  openaiKeys: process.env.OPENAI_API_KEYS,
  openaiKey: process.env.OPENAI_API_KEY,
};
const originalFetch = globalThis.fetch;

try {
  assert.deepEqual(
    parseApiKeyList('one, two\nthree;YOUR_GEMINI_API_KEY', 'two', ' MY_OPENAI_API_KEY '),
    ['one', 'two', 'three'],
    'key parser handles separators, de-duplicates and ignores placeholders',
  );
  assert.equal(shouldTryNextKey({ status: 429, message: 'quota exceeded' }), true, 'quota errors should advance to another key');
  assert.equal(shouldTryNextKey({ status: 503, message: 'service unavailable' }), true, 'transient service errors should advance to another key');
  assert.equal(shouldTryNextKey({ status: 400, message: 'bad request' }), false, 'bad request errors should not burn every key');

  process.env.POLICY_QA_PROVIDER_ORDER = 'openai,gemini';
  process.env.AI_PROVIDER_ORDER = '';
  process.env.GEMINI_API_KEYS = 'test-gemini-key';
  process.env.GEMINI_API_KEY = '';
  process.env.GOOGLE_API_KEY = '';
  process.env.OPENAI_API_KEYS = 'test-openai-key-1,test-openai-key-2';
  process.env.OPENAI_API_KEY = '';
  assert.deepEqual(getConfiguredTextAiProviders().map((item) => item.provider), ['openai', 'gemini'], 'configured provider order is respected');

  const seenAuthHeaders: string[] = [];
  let firstKeyAttempts = 0;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const auth = headers.get('Authorization') || '';
    seenAuthHeaders.push(auth);
    if (auth === 'Bearer test-openai-key-1') {
      firstKeyAttempts += 1;
      return new Response(JSON.stringify({
        error: { message: 'Quota exhausted', type: 'insufficient_quota', code: 'insufficient_quota' },
      }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }
    assert.equal(auth, 'Bearer test-openai-key-2', 'fallback should use the second configured OpenAI key');
    const body = JSON.parse(String(init?.body || '{}'));
    assert.ok(body.messages?.[0]?.content.includes('\"ok\"'), 'OpenAI fallback receives the equivalent output schema instruction');
    return new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":true,"terms":["policy"]}' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  const result = await generateJsonWithFallback('Return a JSON object with ok and terms.', { purpose: 'policy-qa', geminiResponseSchema: { type: 'OBJECT', properties: { ok: { type: 'BOOLEAN' } }, required: ['ok'] } });
  assert.equal(result.provider, 'openai');
  assert.equal(result.keySlot, 2);
  assert.equal(JSON.parse(result.text).ok, true);
  assert.equal(firstKeyAttempts, 1, 'quota-limited key should be tried once in this request');
  assert.deepEqual(seenAuthHeaders, ['Bearer test-openai-key-1', 'Bearer test-openai-key-2']);

  // Verify an existing Gemini-shaped multimodal call can fall back to OpenAI Responses
  // for PDF/image invoice extraction without moving keys into browser-facing code.
  process.env.POLICY_QA_PROVIDER_ORDER = 'openai';
  process.env.OPENAI_API_KEYS = 'test-openai-multimodal-key';
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    assert.ok(String(_input).includes('/v1/responses'), 'multimodal fallback uses the Responses API');
    assert.equal(body.text?.format?.type, 'json_object');
    const userContent = body.input?.find((item: any) => item.role === 'user')?.content || [];
    assert.ok(userContent.some((item: any) => item.type === 'input_file' && item.filename.endsWith('.pdf')), 'PDF inline data is translated into an OpenAI file input');
    assert.ok(body.input?.[0]?.content?.[0]?.text.includes('schema'), 'Gemini output schema is passed as an instruction to fallback provider');
    return new Response(JSON.stringify({ output_text: '{"amount":123.45,"buyerTIN":null,"confidence":0.9}' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  const multimodalResult = await generateContentWithProviderFallback({
    model: 'gemini-2.5-flash',
    contents: { parts: [
      { text: 'Extract invoice data from this document and return JSON.' },
      { inlineData: { mimeType: 'application/pdf', data: 'cGRmLWJ5dGVz' } },
    ] },
    config: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { amount: { type: 'NUMBER' } } } },
  });
  assert.equal(JSON.parse(multimodalResult.text).amount, 123.45);

  console.log('AI provider fallback tests passed.');
} finally {
  globalThis.fetch = originalFetch;
  if (saved.providerOrder === undefined) delete process.env.POLICY_QA_PROVIDER_ORDER; else process.env.POLICY_QA_PROVIDER_ORDER = saved.providerOrder;
  if (saved.aiProviderOrder === undefined) delete process.env.AI_PROVIDER_ORDER; else process.env.AI_PROVIDER_ORDER = saved.aiProviderOrder;
  if (saved.geminiKeys === undefined) delete process.env.GEMINI_API_KEYS; else process.env.GEMINI_API_KEYS = saved.geminiKeys;
  if (saved.geminiKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = saved.geminiKey;
  if (saved.googleKey === undefined) delete process.env.GOOGLE_API_KEY; else process.env.GOOGLE_API_KEY = saved.googleKey;
  if (saved.openaiKeys === undefined) delete process.env.OPENAI_API_KEYS; else process.env.OPENAI_API_KEYS = saved.openaiKeys;
  if (saved.openaiKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = saved.openaiKey;
}
