import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASELINE_TAX_BRACKETS,
  BUDGET2027_TAX_BRACKETS,
  REFERENCE_MSME_TAX_BRACKETS,
  BUDGET2027_ANNOUNCED_TAX_BRACKETS,
  calculateTaxForBrackets,
  calculateTaxSaving,
  getReferenceTaxBracketsForPolicyPackage,
  matchesReferenceTaxSchedule,
} from '../src/constants/policyConstants.ts';
import { parsePolicyTextToCandidatePackage } from '../src/services/policySafetyVerifier.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The reference schedule and policy-package seed must share the same one source of truth.
assert.deepEqual(getReferenceTaxBracketsForPolicyPackage(), [
  { upTo: 150000, rate: 0.15 },
  { upTo: 600000, rate: 0.17 },
  { upTo: null, rate: 0.24 },
]);
assert.deepEqual(REFERENCE_MSME_TAX_BRACKETS.map((b) => b.rate), [0.15, 0.17, 0.24]);
assert.deepEqual(BUDGET2027_ANNOUNCED_TAX_BRACKETS.map((b) => b.rate), [0.14, 0.16, 0.24]);
assert.equal(matchesReferenceTaxSchedule(getReferenceTaxBracketsForPolicyPackage()), true);
assert.equal(matchesReferenceTaxSchedule(BUDGET2027_ANNOUNCED_TAX_BRACKETS), false);

// Numerical checks at tier boundaries and across the RM600k threshold.
assert.equal(calculateTaxForBrackets(150000, BASELINE_TAX_BRACKETS), 22500);
assert.equal(calculateTaxForBrackets(150000, BUDGET2027_TAX_BRACKETS), 21000);
assert.equal(calculateTaxSaving(150000), 1500);
assert.equal(calculateTaxForBrackets(200000, BASELINE_TAX_BRACKETS), 31000);
assert.equal(calculateTaxForBrackets(200000, BUDGET2027_TAX_BRACKETS), 29000);
assert.equal(calculateTaxSaving(200000), 2000);
assert.equal(calculateTaxForBrackets(700000, BASELINE_TAX_BRACKETS), 123000);
assert.equal(calculateTaxForBrackets(700000, BUDGET2027_TAX_BRACKETS), 117000);
assert.equal(calculateTaxSaving(700000), 6000);

// A parsed policy document starts with the same reference schedule; it cannot infer
// that an announcement has become legally active just because it was scraped.
const candidate = parsePolicyTextToCandidatePackage('Sample official text mentioning RM 3,000,000 and 8% SST.', {
  sourceId: 'test-source',
  sourceName: 'Test source',
  sourceUrl: 'https://example.com/policy',
});
assert.deepEqual(candidate.taxBrackets, getReferenceTaxBracketsForPolicyPackage());
assert.notEqual(candidate.status, 'approved');

const budgetCandidate = parsePolicyTextToCandidatePackage(
  'The Fifth MADANI Budget 2027: the first band will be reduced to 14 per cent and the next band to 16 per cent.',
  {
    sourceId: 'mof-budget',
    sourceName: 'MOF Budget 2027 speech',
    sourceUrl: 'https://www.mof.gov.my/portal/en/news/speech/speech-the-fifth-madani-budget-2027',
  },
);
assert.deepEqual(budgetCandidate.taxBrackets, [
  { upTo: 150000, rate: 0.14 },
  { upTo: 600000, rate: 0.16 },
  { upTo: null, rate: 0.24 },
]);
assert.equal(budgetCandidate.isActive, false, 'announcement candidate must not activate itself');
assert.match(budgetCandidate.rules.find((rule) => rule.rule_id === 'R-MSME-TAX-RATE')?.explanation || '', /announcement-only scenario/i);

// The checked-in demo fallback is explicitly inactive/unverified and has reference rates.
const packages = JSON.parse(fs.readFileSync(path.join(root, 'data/policy-approved-packages.json'), 'utf8')) as Array<any>;
const fallback = packages.find((item) => item.version === 'demo-baseline');
assert.ok(fallback, 'demo-baseline package must exist');
assert.equal(fallback.status, 'draft');
assert.equal(fallback.isActive, false);
assert.deepEqual(fallback.taxBrackets, getReferenceTaxBracketsForPolicyPackage());

// Runtime calculations must not silently pull a tax rate from a dynamic package.
const serverSource = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
const policyStoreSource = fs.readFileSync(path.join(root, 'src/services/policyStore.ts'), 'utf8');
assert.match(serverSource, /calculateTaxForBrackets\(chargeableIncome, BUDGET2027_TAX_BRACKETS\)/);
assert.doesNotMatch(serverSource, /calculateTaxWithBrackets\(chargeableIncome, activePackage\.taxBrackets\)/);
assert.match(policyStoreSource, /pkg\.safetyVerification\?\.passed === true/);
assert.match(policyStoreSource, /matchesReferenceTaxSchedule\(pkg\.taxBrackets\)/);
assert.match(policyStoreSource, /matchesReferenceTaxSchedule\(row\?\.tax_brackets\)/);
assert.match(policyStoreSource, /const meetsActivationRequirements = !sb/);
assert.match(serverSource, /p\.safetyVerification\?\.passed === true/);

console.log('Tax schedule consistency checks passed: reference=15%/17%/24%, Budget 2027 scenario=14%/16%/24%.');
