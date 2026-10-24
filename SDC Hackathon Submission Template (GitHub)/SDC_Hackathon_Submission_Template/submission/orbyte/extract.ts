import { GoogleGenAI, Type } from '@google/genai';
import { generateContentWithProviderFallback, hasConfiguredTextAiProvider } from './src/services/aiProviderFallback.ts';

export interface ExtractionResult {
  amount: number;
  buyerTIN: string | null;
  buyerName?: string;
  confidence: number;
  confidenceBasis?: 'model-reported' | 'parser-heuristic' | 'unknown';
  method: 'regex' | 'ai';
  fieldConfidence: {
    amount: number;
    buyerTIN: number;
  };
}

let aiClient: GoogleGenAI | null = null;

/**
 * Returns a Gemini SDK-shaped adapter used by existing extraction call sites.
 * The adapter now honors AI_PROVIDER_ORDER and can fall back across multiple
 * Gemini keys and OpenAI when quota, authentication, network, or server failures
 * prevent the preferred provider from responding. It never exposes API keys.
 */
export function getGenAIClient(): GoogleGenAI | null {
  if (!hasConfiguredTextAiProvider()) return null;
  if (!aiClient) {
    aiClient = {
      models: {
        generateContent: (request: any) => generateContentWithProviderFallback(request),
      },
    } as unknown as GoogleGenAI;
  }
  return aiClient;
}

interface ParsedAiFields {
  amount: number | null;
  buyerTIN: string | null;
  buyerName?: string;
  confidence: number;
}

function runPodConfigured(): boolean {
  return Boolean(
    process.env.RUNPOD_API_KEY?.trim() &&
    process.env.RUNPOD_ENDPOINT_ID?.trim() &&
    process.env.RUNPOD_API_KEY !== 'MY_RUNPOD_API_KEY' &&
    process.env.RUNPOD_ENDPOINT_ID !== 'MY_RUNPOD_ENDPOINT_ID'
  );
}

async function extractWithRunPod(input: { text?: string; imageBuffer?: Buffer; mimeType?: string }): Promise<ParsedAiFields> {
  const apiKey = process.env.RUNPOD_API_KEY?.trim();
  const endpointId = process.env.RUNPOD_ENDPOINT_ID?.trim();
  if (!apiKey || !endpointId || !runPodConfigured()) throw new Error('NO_RUNPOD_CONFIGURED');

  const content: Array<Record<string, unknown>> = [];
  if (input.text) {
    content.push({ type: 'text', text: `Invoice or WhatsApp text:\n"""${input.text.slice(0, 30000)}"""` });
  }
  if (input.imageBuffer) {
    const mimeType = input.mimeType || 'image/jpeg';
    if (!mimeType.startsWith('image/')) throw new Error('RunPod image reading only supports image/* media.');
    content.push({ type: 'text', text: 'Read the invoice or receipt image and extract visible fields only.' });
    content.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${input.imageBuffer.toString('base64')}` } });
  }
  const response = await fetch(`https://api.runpod.ai/v2/${encodeURIComponent(endpointId)}/openai/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.RUNPOD_MODEL?.trim() || 'default',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You extract invoice facts for a Malaysian SME. Return JSON only with amount (number or null), buyerTIN (string or null), buyerName (string or null), confidence (number from 0 to 1). Never invent missing values. Use the buyer/customer, not the seller. Amounts must be numeric MYR. If uncertain, set confidence to 0.',
        },
        { role: 'user', content },
      ],
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`RunPod HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const payload: any = await response.json();
  const reply = String(payload?.choices?.[0]?.message?.content ?? '');
  const begin = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (begin < 0 || end < begin) throw new Error('RunPod did not return a JSON extraction object.');
  const parsed = JSON.parse(reply.slice(begin, end + 1));
  const rawAmount = typeof parsed.amount === 'number' ? parsed.amount : Number(parsed.amount);
  const amount = Number.isFinite(rawAmount) && rawAmount > 0 ? Math.round(rawAmount * 100) / 100 : null;
  const tinRaw = typeof parsed.buyerTIN === 'string' ? parsed.buyerTIN.trim() : '';
  const buyerTIN = tinRaw && tinRaw.toLowerCase() !== 'null' ? tinRaw.replace(/\s+/g, '').toUpperCase() : null;
  const buyerName = typeof parsed.buyerName === 'string' && parsed.buyerName.trim() && parsed.buyerName.toLowerCase() !== 'null'
    ? parsed.buyerName.trim()
    : undefined;
  const confidence = typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
    ? Math.max(0, Math.min(1, parsed.confidence))
    : 0;
  return { amount, buyerTIN, buyerName, confidence };
}

/**
 * Pure deterministic regex extractor for Malaysian receipts, invoices, and WhatsApp chats.
 */
export function extractFromTextRegex(text: string): ExtractionResult {
  if (!text || typeof text !== 'string') {
    return {
      amount: 0,
      buyerTIN: null,
      confidence: 0.3,
      confidenceBasis: 'parser-heuristic',
      method: 'regex',
      fieldConfidence: { amount: 0, buyerTIN: 0 },
    };
  }

  // 1. Extract Amounts
  const foundAmounts: number[] = [];
  let workingText = text;

  // Check for labeled totals first (highest priority)
  const labeledTotalPattern = /(?:Total\s*Payable|Jumlah\s*Perlu\s*Dibayar|Grand\s*Total|Total\s*Amount|Invoice\s*Total|Invoice\s*Amount|Amount\s*Due|Amount|Jumlah(?:\s*Keseluruhan)?|Bayaran|Payable|Total)[:\s]*(?:RM|MYR)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\b/gi;
  let labeledMatch: RegExpExecArray | null;
  while ((labeledMatch = labeledTotalPattern.exec(workingText)) !== null) {
    const cleaned = labeledMatch[1].replace(/,/g, '');
    const val = parseFloat(cleaned);
    if (!isNaN(val) && val > 0) {
      foundAmounts.unshift(val); // high priority at front
    }
  }

  // Match "rm11.2k", "11.2k", "RM 11k"
  const kPattern = /(?:RM|MYR)?\s*(\d+(?:\.\d+)?)\s*k\b(?:\s*ringgit(?:s)?)?/gi;
  workingText = workingText.replace(kPattern, (_match, p1) => {
    const val = parseFloat(p1) * 1000;
    if (!isNaN(val) && val > 0) {
      foundAmounts.push(val);
    }
    return ' __PROCESSED_AMT__ ';
  });

  // Match standard "RM 11,200.50", "MYR 1,350.00", "RM11200", etc.
  const rmPattern = /(?:RM|MYR)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\b/gi;
  let rmMatch: RegExpExecArray | null;
  while ((rmMatch = rmPattern.exec(workingText)) !== null) {
    const cleaned = rmMatch[1].replace(/,/g, '');
    const val = parseFloat(cleaned);
    if (!isNaN(val) && val > 0) {
      foundAmounts.push(val);
    }
  }

  // Match "11200 ringgit", "11200.00 MYR"
  const suffixPattern = /\b([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:ringgit(?:s)?|MYR)\b/gi;
  let sufMatch: RegExpExecArray | null;
  while ((sufMatch = suffixPattern.exec(workingText)) !== null) {
    const cleaned = sufMatch[1].replace(/,/g, '');
    const val = parseFloat(cleaned);
    if (!isNaN(val) && val > 0) {
      foundAmounts.push(val);
    }
  }

  // De-duplicate amounts within small floating differences
  const uniqueAmounts: number[] = [];
  for (const amt of foundAmounts) {
    if (!uniqueAmounts.some((u) => Math.abs(u - amt) < 0.001)) {
      uniqueAmounts.push(amt);
    }
  }

  let finalAmount = 0;
  let isAmbiguous = false;
  if (uniqueAmounts.length === 1) {
    finalAmount = uniqueAmounts[0];
  } else if (uniqueAmounts.length > 1) {
    // If we found a labeled total, prefer that
    finalAmount = uniqueAmounts[0];
    // If the largest amount is much bigger, check ambiguity
    isAmbiguous = uniqueAmounts.length > 2;
  }

  // 2. Extract Malaysian TIN (e.g., C2891928301, C24892019020, IG1234567890)
  let foundTIN: string | null = null;
  // Specific pattern for Malaysian LHDN TIN (Corporate: C..., Individual Business: IG..., SG..., OG..., PT...)
  const tinRegex = /\b(C\d{10,11}|IG\d{9,11}|SG\d{9,11}|OG\d{9,11}|PT\d{9,11}|TC\d{9,11})\b/i;
  const tinMatch = text.match(tinRegex);
  if (tinMatch) {
    foundTIN = tinMatch[1].toUpperCase();
  } else {
    // Check labelled TIN e.g. "TIN: C1234567890", "Tax ID: 1234567890"
    const labelMatch = text.match(/(?:TIN|No\.?\s*Cukai|Tax\s*ID)[:\s#]*([A-Z0-9-]{8,14})\b/i);
    if (labelMatch) {
      foundTIN = labelMatch[1].replace(/-/g, '').toUpperCase();
    }
  }

  // 3. Extract Buyer Name if available. Prefer explicit labels, then common WhatsApp phrasing.
  let foundBuyerName: string | undefined = undefined;
  const cleanBuyerName = (raw: string | undefined): string | undefined => {
    if (!raw) return undefined;
    const cleaned = raw
      .split(/\b(?:TIN|Tax\s*ID|Total|Amount|Grand\s*Total|Invoice\s*Date|Date|Payable|Payment|RM|MYR|Please|Today)\b/i)[0]
      .split(/[\n;|]/)[0]
      .replace(/[.,:;\s-]+$/g, '')
      .trim();
    if (cleaned.length < 2 || cleaned.length > 90) return undefined;
    if (/^(?:not provided|not available|unknown|null|n\/?a)$/i.test(cleaned)) return undefined;
    return cleaned;
  };

  // Explicit forms: "Buyer: ABC Sdn Bhd", "Customer Name is Kedai Maju", "Bill to: ...".
  const explicitBuyerMatch = text.match(/\b(?:buyer(?:\s*name)?|customer(?:\s*name)?|bill(?:ed)?\s*to|invoice\s*recipient|pembeli|pelanggan)\b\s*(?::|=|\bis\b)?\s*([^\n;|]{2,100})/i);
  foundBuyerName = cleanBuyerName(explicitBuyerMatch?.[1]);

  // Common WhatsApp wording: "invoice to Farhans Bistro" or "payable to ABC Trading".
  if (!foundBuyerName) {
    const namedRecipientMatch = text.match(/\b(?:payable\s+to|invoice\s+to|send\s+(?:the\s+)?(?:invoice|receipt)\s+to|to|kepada)\s+([A-Za-z0-9][A-Za-z0-9&'().,\-/ ]{1,75}?(?:Sdn\.?\s*Bhd\.?|Bhd\.?|Enterprise|Trading|Store|Kedai|Bistro|Restaurant|Supplies|Grocers|Machinery|Fleet|Solutions))\b/i);
    foundBuyerName = cleanBuyerName(namedRecipientMatch?.[1]);
  }

  // Keep a final conservative fallback for company names without a standard suffix.
  if (!foundBuyerName) {
    const genericRecipientMatch = text.match(/\b(?:buyer|customer|pembeli|pelanggan)\b\s*(?::|=|\bis\b)?\s*([A-Za-z0-9][A-Za-z0-9&'().,\-/ ]{1,70})/i);
    foundBuyerName = cleanBuyerName(genericRecipientMatch?.[1]);
  }

  // 4. Deterministic Confidence Rules
  // - Both amount and TIN found: 0.95
  // - Only amount found: 0.85
  // - Amount ambiguous: 0.80
  // - Neither found: 0.30
  const hasAmount = finalAmount > 0;
  const hasTIN = Boolean(foundTIN);

  let confidence = 0.30;
  if (hasAmount && hasTIN) {
    confidence = isAmbiguous ? 0.80 : 0.95;
  } else if (hasAmount && !hasTIN) {
    confidence = isAmbiguous ? 0.80 : 0.85;
  } else {
    confidence = 0.30;
  }

  return {
    amount: finalAmount,
    buyerTIN: foundTIN,
    buyerName: foundBuyerName,
    confidence,
    confidenceBasis: 'parser-heuristic',
    method: 'regex',
    fieldConfidence: {
      amount: hasAmount ? (isAmbiguous ? 0.80 : 0.95) : 0.0,
      buyerTIN: hasTIN ? 0.95 : 0.0,
    },
  };
}

/**
 * Main text extractor: checks deterministic regex first, then uses the configured multi-provider AI fallback only when deterministic extraction cannot reliably parse.
 */
export async function extractFromText(text: string): Promise<ExtractionResult> {
  // Step 1: Best deterministic reader first (regex parser).
  const regexResult = extractFromTextRegex(text);
  // Text/WhatsApp intake should not wait for an external AI call when the amount is already
  // deterministically present. Missing TIN/name remains visible for human review instead of
  // making users wait through repeated model timeouts for a mostly readable message.
  if (regexResult.amount > 0 && regexResult.confidence >= 0.80) {
    return regexResult;
  }

  // Optional RunPod endpoint merged from the lightweight version. It is only used when
  // explicitly selected and configured; failures return the deterministic result.
  if ((process.env.AI_PROVIDER || '').toLowerCase() === 'runpod') {
    try {
      const parsed = await extractWithRunPod({ text });
      if (parsed.amount == null) return regexResult;
      const amountDisagrees = regexResult.amount > 0 && Math.abs(regexResult.amount - parsed.amount) > 0.01;
      const tinDisagrees = Boolean(parsed.buyerTIN && regexResult.buyerTIN && parsed.buyerTIN !== regexResult.buyerTIN);
      const disagrees = amountDisagrees || tinDisagrees;
      const safeConfidence = disagrees ? Math.min(parsed.confidence, 0.6) : parsed.confidence;
      return {
        amount: parsed.amount,
        buyerTIN: parsed.buyerTIN,
        buyerName: parsed.buyerName,
        confidence: safeConfidence,
        confidenceBasis: disagrees ? 'unknown' : 'model-reported',
        method: 'ai',
        fieldConfidence: { amount: amountDisagrees ? Math.min(safeConfidence, 0.6) : safeConfidence, buyerTIN: tinDisagrees ? Math.min(safeConfidence, 0.6) : (parsed.buyerTIN ? safeConfidence : 0) },
      };
    } catch (err: any) {
      console.warn('[extract] RunPod failed; falling back to deterministic text extraction:', err?.message || err);
      return regexResult;
    }
  }

  // Step 2: Gemini fallback if deterministic extraction cannot reliably extract
  const ai = getGenAIClient();
  if (!ai) {
    return regexResult;
  }

  try {
    const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    let response: any = null;

    for (const modelName of candidateModels) {
      try {
        const aiPromise = ai.models.generateContent({
          model: modelName,
          contents: `You are an invoice document parser for Malaysian SME e-invoicing. Extract the invoice fields from the following text into structured JSON.
CRITICAL RULES:
1. Never invent missing values. If a field cannot be determined, set it to null.
2. Do not assess compliance. Extract visible document facts only.
3. Return raw numbers for amounts.

Text:
"""${text}"""
`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER, description: 'Total invoice/receipt amount in MYR' },
                buyerTIN: { type: Type.STRING, description: 'Buyer Malaysian Tax Identification Number, e.g. C1234567890 or null' },
                buyerName: { type: Type.STRING, description: 'Buyer company or customer name' },
                confidence: { type: Type.NUMBER, description: 'Extraction confidence score between 0.0 and 1.0' },
              },
            },
          },
        });

        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('AI extraction timed out after 12000ms')), 12000);
        });

        try {
          response = await Promise.race([aiPromise, timeoutPromise]);
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }
        if (response && response.text) {
          break;
        }
      } catch (err: any) {
        console.warn(`[extractFromText] Model ${modelName} failed:`, err?.message);
      }
    }

    if (!response || !response.text) {
      throw new Error('All AI models failed');
    }

    const rawText = response.text?.trim() || '{}';
    let cleanJson = rawText;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanJson = jsonMatch[0];
    }
    const parsed = JSON.parse(cleanJson);

    const amount = typeof parsed.amount === 'number' ? parsed.amount : parseFloat(parsed.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Invalid amount extracted by AI');
    }

    const buyerTIN = parsed.buyerTIN && typeof parsed.buyerTIN === 'string' && parsed.buyerTIN.trim() !== '' && parsed.buyerTIN !== 'null'
      ? parsed.buyerTIN.trim().toUpperCase()
      : null;

    // If the model did not supply a valid score, confidence is unknown rather than invented.
    const confidence = typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1
      ? parsed.confidence
      : 0;

    // Merge the small version's human-in-the-loop safeguard: compare the AI with an independent
    // deterministic read. Any material disagreement forces human review instead of confident automation.
    const amountDisagrees = regexResult.amount > 0 && Math.abs(regexResult.amount - amount) > 0.01;
    const aiTin = buyerTIN || null;
    const regexTin = regexResult.buyerTIN || null;
    const tinDisagrees = Boolean(aiTin && regexTin && aiTin !== regexTin);
    const crossCheckDisagrees = amountDisagrees || tinDisagrees;
    const safeConfidence = crossCheckDisagrees ? Math.min(confidence, 0.6) : confidence;

    return {
      amount,
      buyerTIN,
      buyerName: parsed.buyerName || undefined,
      confidence: safeConfidence,
      confidenceBasis: crossCheckDisagrees ? 'unknown' : 'model-reported',
      method: 'ai',
      fieldConfidence: {
        amount: amountDisagrees ? Math.min(safeConfidence, 0.6) : safeConfidence,
        buyerTIN: tinDisagrees ? Math.min(safeConfidence, 0.6) : (buyerTIN ? safeConfidence : 0),
      },
    };
  } catch (err) {
    console.warn('[extract] AI extraction failed or timed out, falling back to regex:', (err as any)?.message);
    return regexResult;
  }
}

/**
 * Multimodal OCR image extractor with a 30s timeout to allow the configured provider fallback chain.
 */
export async function extractFromImage(fileBuffer: Buffer, mimeType: string): Promise<{
  amount: number;
  buyerTIN: string | null;
  buyerName?: string;
  confidence: number;
  confidenceBasis: 'model-reported';
}> {
  if ((process.env.AI_PROVIDER || '').toLowerCase() === 'runpod') {
    const parsed = await extractWithRunPod({ imageBuffer: fileBuffer, mimeType });
    if (parsed.amount == null) throw new Error('RunPod could not extract a reliable positive invoice amount.');
    return {
      amount: parsed.amount,
      buyerTIN: parsed.buyerTIN,
      buyerName: parsed.buyerName,
      confidence: parsed.confidence,
      confidenceBasis: 'model-reported',
    };
  }

  const ai = getGenAIClient();
  if (!ai) {
    throw new Error('NO_AI_CONFIGURED');
  }

  const aiPromise = ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: fileBuffer.toString('base64'),
          },
        },
        {
          text: `You are an invoice image data extractor for an Orbyte demo. You are not an official authority. Inspect this receipt or invoice image and extract:
1. Total amount in MYR (number).
2. Buyer TIN (Malaysian Tax ID e.g. C1234567890 or null).
3. Buyer company/trade name.
4. Confidence score (0.0 to 1.0). If confidence cannot be assessed, return 0 rather than guessing.`,
        },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          amount: { type: Type.NUMBER, description: 'Total amount in MYR' },
          buyerTIN: { type: Type.STRING, description: 'Buyer TIN e.g. C1234567890 or null' },
          buyerName: { type: Type.STRING, description: 'Buyer company or customer name' },
          confidence: { type: Type.NUMBER, description: 'Confidence between 0.0 and 1.0' },
        },
        required: ['amount'],
      },
    },
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('AI OCR timed out after 30000ms')), 30000)
  );

  const response = await Promise.race([aiPromise, timeoutPromise]);
  const rawText = response.text?.trim() || '{}';
  const parsed = JSON.parse(rawText);

  const amount = typeof parsed.amount === 'number' ? parsed.amount : parseFloat(parsed.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('OCR_PARSE_FAILED: Invalid amount extracted');
  }

  const buyerTIN = parsed.buyerTIN && typeof parsed.buyerTIN === 'string' && parsed.buyerTIN.trim() !== '' && parsed.buyerTIN !== 'null'
    ? parsed.buyerTIN.trim().toUpperCase()
    : null;

  const confidence = typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1
    ? parsed.confidence
    : 0;

  return {
    amount,
    buyerTIN,
    buyerName: parsed.buyerName || undefined,
    confidence,
    confidenceBasis: 'model-reported',
  };
}
