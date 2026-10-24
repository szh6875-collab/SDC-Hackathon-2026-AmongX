import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFromText, extractFromTextRegex } from '../extract.ts';

interface Case { id: string; text: string; amount: number | null; tin: string | null }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cases = JSON.parse(fs.readFileSync(path.join(root, 'benchmark', 'messages.json'), 'utf8')) as Case[];
const useAi = process.env.BENCHMARK_USE_AI === 'true';
const minConfidence = Number(process.env.BENCHMARK_MIN_CONFIDENCE || 0.9);
const consolidationLimit = Number(process.env.CONSOLIDATION_LIMIT_MYR || 10000);

function expectedDecision(amount: number | null, tin: string | null): string {
  if (amount == null) return 'no_amount';
  if (amount <= consolidationLimit) return 'consolidate';
  return tin ? 'own_invoice' : 'blocked_no_tin';
}

function normalizeTin(value: string | null | undefined): string | null {
  const normalized = (value || '').trim().toUpperCase();
  return normalized || null;
}

const rows: any[] = [];
for (const testCase of cases) {
  const result = useAi ? await extractFromText(testCase.text) : extractFromTextRegex(testCase.text);
  const gotAmount = result.amount > 0 ? result.amount : null;
  const gotTin = normalizeTin(result.buyerTIN);
  const expectedTin = normalizeTin(testCase.tin);
  const amountOk = gotAmount === null || testCase.amount === null
    ? gotAmount === testCase.amount
    : Math.abs(gotAmount - testCase.amount) < 0.01;
  const tinOk = gotTin === expectedTin;
  const decisionOk = expectedDecision(gotAmount, gotTin) === expectedDecision(testCase.amount, expectedTin);
  const sentToHuman = result.confidence < minConfidence || gotAmount === null;
  rows.push({ id: testCase.id, amountOk, tinOk, decisionOk, sentToHuman, silentError: (!amountOk || !tinOk) && !sentToHuman, expectedAmount: testCase.amount, gotAmount, expectedTIN: expectedTin, gotTIN: gotTin, confidence: result.confidence, method: result.method });
}
const pct = (field: 'amountOk' | 'tinOk' | 'decisionOk') => Math.round((rows.filter((row) => row[field]).length / Math.max(rows.length, 1)) * 1000) / 10;
const summary = {
  reader: useAi ? ((process.env.AI_PROVIDER || 'gemini').toLowerCase()) : 'deterministic-regex-only',
  total: rows.length,
  amountAccuracyPct: pct('amountOk'),
  tinAccuracyPct: pct('tinOk'),
  decisionAccuracyPct: pct('decisionOk'),
  sentToHuman: rows.filter((row) => row.sentToHuman).length,
  silentErrors: rows.filter((row) => row.silentError).length,
  minConfidence,
  consolidationLimitMYR: consolidationLimit,
};
console.log(JSON.stringify({ summary, rows }, null, 2));
if (process.env.BENCHMARK_FAIL_ON_SILENT_ERROR === 'true' && summary.silentErrors > 0) process.exitCode = 1;
