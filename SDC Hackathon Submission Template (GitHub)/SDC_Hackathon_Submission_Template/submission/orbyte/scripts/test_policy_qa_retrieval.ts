import assert from 'node:assert/strict';
import { extractOfficialFaqPdfLinks } from '../src/services/policyFaqSources.ts';

import {
  extractPolicyQaCitationIds,
  hasValidPolicyQaCitations,
  rankPolicyQaPassages,
  selectBalancedPolicyFaqPassages,
  splitPolicyTextIntoPassages,
  tokenizePolicyQuestion,
} from '../src/services/policyQa.ts';

const officialText = `Section 4 — Effective date\n\nThe amended reporting requirement takes effect on 1 January 2027 for eligible businesses. Businesses must retain supporting records for seven years.\n\nFrequently asked questions: A company must determine its eligibility using the conditions in the official guideline.`;
const passages = splitPolicyTextIntoPassages(officialText, 100);
assert.ok(passages.length >= 2, 'long source should be split into evidence passages');
assert.ok(passages.some((passage) => passage.includes('1 January 2027')), 'split passages preserve exact source wording');

const candidates = passages.map((evidenceText, index) => ({ id: `P${index + 1}`, evidenceText }));
const ranked = rankPolicyQaPassages(candidates, 'When does the reporting requirement take effect?', ['effective date', '1 January 2027'], 4);
assert.ok(ranked.length > 0, 'relevant official excerpt should be retrieved');
assert.ok(ranked[0].passage.evidenceText.includes('takes effect on 1 January 2027'), 'the effective-date excerpt should rank first');
assert.equal(rankPolicyQaPassages(candidates, 'What is the weather forecast?', [], 4).length, 0, 'unrelated questions should not retrieve policy text');
assert.ok(tokenizePolicyQuestion('RM10,000 Buyer TIN') .includes('10000'), 'currency values should normalize for retrieval');

const validAnswer = '- It takes effect on 1 January 2027. [E1]\n- Supporting records must be retained for seven years. [E2]';
assert.deepEqual(extractPolicyQaCitationIds(validAnswer), ['E1', 'E2']);
assert.equal(hasValidPolicyQaCitations(validAnswer, new Set(['E1', 'E2'])), true, 'answer with valid citation on each line should pass');
assert.equal(hasValidPolicyQaCitations('- It takes effect in 2027.', new Set(['E1'])), false, 'uncited answer should fail closed');
assert.equal(hasValidPolicyQaCitations('- It takes effect in 2027. [E99]', new Set(['E1'])), false, 'unknown evidence references should fail closed');


const faqIndexHtml = `
  <h2>Soalan Lazim Umum</h2>
  <a href="https://www.hasil.gov.my/media/abcd1234/lhdnm-e-invoice-general-faqs.pdf">Muat Turun</a>
  <h2>Penjagaan Kesihatan</h2>
  <a href="https://www.hasil.gov.my/media/efgh5678/lhdnm-healthcare-faqs.pdf">Muat Turun</a>
  <a href="https://evil.example/media/bad/secret.pdf">Download</a>
  <a href="https://www.hasil.gov.my/media/abcd1234/lhdnm-e-invoice-general-faqs.pdf">Duplicate</a>
`;
const faqLinks = extractOfficialFaqPdfLinks(faqIndexHtml, 'https://www.hasil.gov.my/e-invois/rujukan-pelaksanaan-e-invois/soalan-lazim/');
assert.equal(faqLinks.length, 2, 'only unique official HASiL FAQ PDFs should be selected');
assert.ok(faqLinks[0].title.includes('Soalan Lazim Umum'), 'FAQ PDF title should inherit its section heading when link label is generic');
assert.equal(extractOfficialFaqPdfLinks(faqIndexHtml, 'https://evil.example/faq/').length, 0, 'untrusted FAQ indexes should be rejected');

const faqPassages = [
  '[FAQ_TITLE: General FAQ] [FAQ_SOURCE_URL: https://www.hasil.gov.my/media/a/general.pdf] passage A',
  '[FAQ_TITLE: General FAQ] [FAQ_SOURCE_URL: https://www.hasil.gov.my/media/a/general.pdf] passage B',
  '[FAQ_TITLE: Health FAQ] [FAQ_SOURCE_URL: https://www.hasil.gov.my/media/b/health.pdf] passage C',
  '[FAQ_TITLE: Health FAQ] [FAQ_SOURCE_URL: https://www.hasil.gov.my/media/b/health.pdf] passage D',
];
assert.deepEqual(selectBalancedPolicyFaqPassages(faqPassages, 3, 2), [faqPassages[0], faqPassages[2], faqPassages[1]], 'FAQ passage retrieval should round-robin across linked official documents');

console.log('Policy Q&A retrieval tests passed.');
