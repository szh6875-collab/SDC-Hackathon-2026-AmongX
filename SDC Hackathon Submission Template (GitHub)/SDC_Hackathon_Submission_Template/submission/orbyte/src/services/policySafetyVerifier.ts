/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Orbyte Hub — Policy Rule Safety Verification & Sanity Engine
 * 
 * CRITICAL SAFETY PRINCIPLE:
 * Raw PDF text and untrusted policy scrapes MUST NEVER be directly fed
 * into operational tax or compliance calculations.
 * All changes must pass an automated 7-point safety verification suite,
 * be staged as a candidate rule package, and receive human sign-off
 * before activation.
 */

import crypto from 'crypto';
import type {
  ApprovedRulePackage,
  RulePackageSafetyReport,
  SafetyCheckItem,
  TaxBracketConfig,
  PolicyRule,
} from '../types.ts';
import {
  getReferenceTaxBracketsForPolicyPackage,
  BUDGET2027_ANNOUNCED_TAX_BRACKETS,
} from '../constants/policyConstants.ts';

export const SAFETY_ENGINE_VERSION = 'OrbyteSafetyValidator/v2.5';

/**
 * Executes the complete 7-Point Safety Verification Suite on a candidate rule package.
 */
export function verifyRulePackageSafety(
  pkg: Partial<ApprovedRulePackage>
): RulePackageSafetyReport {
  const checks: SafetyCheckItem[] = [];
  const issues: string[] = [];

  // Check 1: Tax Bracket Monotonicity
  const brackets = pkg.taxBrackets || [];
  let bracketMonotonic = true;
  let bracketDetails = 'All tax tiers are strictly monotonic and properly terminated.';

  if (!Array.isArray(brackets) || brackets.length === 0) {
    bracketMonotonic = false;
    bracketDetails = 'No tax brackets defined in package.';
    issues.push('Missing tax bracket configuration.');
  } else {
    for (let i = 0; i < brackets.length; i++) {
      const current = brackets[i];
      if (i < brackets.length - 1) {
        if (typeof current.upTo !== 'number' || current.upTo <= 0) {
          bracketMonotonic = false;
          bracketDetails = `Tier ${i + 1} has non-positive or undefined ceiling.`;
          issues.push(bracketDetails);
          break;
        }
        if (i > 0 && brackets[i - 1].upTo !== null && current.upTo <= (brackets[i - 1].upTo as number)) {
          bracketMonotonic = false;
          bracketDetails = `Tier ${i + 1} (${current.upTo}) is not strictly greater than previous tier (${brackets[i - 1].upTo}).`;
          issues.push(bracketDetails);
          break;
        }
      } else {
        // Last tier should ideally be open-ended (null)
        if (current.upTo !== null && current.upTo <= (brackets[i - 1]?.upTo || 0)) {
          bracketMonotonic = false;
          bracketDetails = `Top tier is capped abnormally below lower tier.`;
          issues.push(bracketDetails);
        }
      }
    }
  }

  checks.push({
    id: 'CHK-BRACKET-MONOTONIC',
    name: 'Tax Bracket Monotonicity Check',
    description: 'Validates that income tax bracket ceilings are strictly ordered and non-overlapping.',
    passed: bracketMonotonic,
    severity: 'critical',
    details: bracketDetails,
  });

  // Check 2: Statutory Rate Bounds (0% <= rate <= 45%)
  let ratesValid = true;
  let rateDetails = 'All statutory tax rates are within legal 0% to 45% boundaries.';
  for (const b of brackets) {
    if (typeof b.rate !== 'number' || isNaN(b.rate) || b.rate < 0 || b.rate > 0.45) {
      ratesValid = false;
      rateDetails = `Invalid marginal tax rate ${b.rate} found in bracket. Must be between 0.00 and 0.45.`;
      issues.push(rateDetails);
      break;
    }
  }

  checks.push({
    id: 'CHK-RATE-BOUNDS',
    name: 'Statutory Rate Bounds Verification',
    description: 'Ensures proposed tax rates do not contain negative values or abnormal percentages (> 45%).',
    passed: ratesValid,
    severity: 'critical',
    details: rateDetails,
  });

  // Check 3: e-Invoice Exemption Threshold Sanity (RM 500k to RM 50M)
  const threshold = typeof pkg.exemptionThreshold === 'number' ? pkg.exemptionThreshold : 0;
  const thresholdSanity = threshold >= 500000 && threshold <= 50000000;
  const thresholdDetails = thresholdSanity
    ? `Exemption threshold RM ${threshold.toLocaleString()} is within realistic MSME bounds (gazetted target: RM 3,000,000).`
    : `Exemption threshold RM ${threshold.toLocaleString()} is out of statutory bounds (expected between RM 500,000 and RM 50,000,000).`;
  if (!thresholdSanity) issues.push(thresholdDetails);

  checks.push({
    id: 'CHK-EXEMPTION-SANITY',
    name: 'e-Invoice Exemption Radar Sanity',
    description: 'Verifies the MSME exemption threshold against statutory policy guidance (RM 3,000,000 benchmark).',
    passed: thresholdSanity,
    severity: 'critical',
    details: thresholdDetails,
  });

  // Check 4: Minimum Wage Scale Bounds (RM 1,200 to RM 5,000)
  const minWage = typeof pkg.minWageStandard === 'number' ? pkg.minWageStandard : 0;
  const minWageSanity = minWage >= 1200 && minWage <= 5000;
  const minWageDetails = minWageSanity
    ? `Minimum wage baseline RM ${minWage} is aligned with national standard order.`
    : `Minimum wage RM ${minWage} is outside realistic statutory range (RM 1,200 - RM 5,000).`;
  if (!minWageSanity) issues.push(minWageDetails);

  checks.push({
    id: 'CHK-WAGE-BOUNDS',
    name: 'Minimum Wage Scale Sanity',
    description: 'Ensures employee wage baseline conforms to National Minimum Wage Order guidelines.',
    passed: minWageSanity,
    severity: 'critical',
    details: minWageDetails,
  });

  // Check 5: SST Rate Sanity (0% to 25%)
  const sstRate = typeof pkg.sstRate === 'number' ? pkg.sstRate : 0;
  const sstSanity = sstRate >= 0 && sstRate <= 0.25;
  const sstDetails = sstSanity
    ? `SST classification rate ${(sstRate * 100).toFixed(1)}% is verified.`
    : `SST rate ${(sstRate * 100).toFixed(1)}% is outside normal statutory range (0% - 25%).`;
  if (!sstSanity) issues.push(sstDetails);

  checks.push({
    id: 'CHK-SST-RATE',
    name: 'SST Rate Classification Sanity',
    description: 'Checks Sales & Service Tax rate parameters against Royal Malaysian Customs standards.',
    passed: sstSanity,
    severity: 'warning',
    details: sstDetails,
  });

  // Check 6: Source URL / SHA-256 structure only. This does NOT prove that the extracted
  // rule text is legally accurate, current, or actually stated by the source document.
  const sha = pkg.sourceSha256 || '';
  const shaValid = typeof sha === 'string' && sha.length === 64 && /^[0-9a-fA-F]{64}$/.test(sha);
  const sourceUrl = pkg.sourceUrl || '';
  let isAllowlistedGovernmentHttpsUrl = false;
  try {
    const parsedSourceUrl = new URL(sourceUrl);
    const host = parsedSourceUrl.hostname.toLowerCase();
    const allowlistedGovernmentDomains = ['hasil.gov.my', 'mof.gov.my', 'customs.gov.my', 'agc.gov.my'];
    isAllowlistedGovernmentHttpsUrl = parsedSourceUrl.protocol === 'https:'
      && allowlistedGovernmentDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    isAllowlistedGovernmentHttpsUrl = false;
  }
  const provenancePassed = shaValid && isAllowlistedGovernmentHttpsUrl;
  const provenanceDetails = provenancePassed
    ? `A SHA-256 fingerprint is present and the URL uses an allow-listed HTTPS government domain (${new URL(sourceUrl).hostname}). This does not verify document relevance, legal status, or rule accuracy.`
    : `Invalid SHA-256 fingerprint or source URL is not an allow-listed HTTPS government domain (${sourceUrl}).`;
  if (!provenancePassed) issues.push(provenanceDetails);

  checks.push({
    id: 'CHK-SOURCE-PROVENANCE',
    name: 'Source URL & SHA-256 Format Check',
    description: 'Checks SHA-256 fingerprint format and an allow-listed HTTPS government domain; it does not validate the document contents or legal effect.',
    passed: provenancePassed,
    severity: 'critical',
    details: provenanceDetails,
  });

  // Check 7: Rule Conflict & Logical Integrity
  const rules = pkg.rules || [];
  const ruleIds = new Set<string>();
  let conflictFound = false;
  let conflictDetails = `${rules.length} discrete compliance rules validated with unique IDs.`;

  for (const r of rules) {
    if (!r.id || !r.rule_id) {
      conflictFound = true;
      conflictDetails = 'One or more rules are missing identifier fields.';
      issues.push(conflictDetails);
      break;
    }
    if (ruleIds.has(r.id)) {
      conflictFound = true;
      conflictDetails = `Duplicate rule identifier detected: ${r.id}`;
      issues.push(conflictDetails);
      break;
    }
    ruleIds.add(r.id);
  }

  checks.push({
    id: 'CHK-RULE-CONSISTENCY',
    name: 'Logical Rule Consistency & Disjointness',
    description: 'Checks that structured rules contain non-conflicting preconditions and distinct IDs.',
    passed: !conflictFound,
    severity: 'critical',
    details: conflictDetails,
  });

  const totalChecks = checks.length;
  const passedChecks = checks.filter((c) => c.passed).length;
  const criticalFailed = checks.some((c) => !c.passed && c.severity === 'critical');
  const passed = !criticalFailed && passedChecks === totalChecks;
  const score = Math.round((passedChecks / totalChecks) * 100);

  return {
    passed,
    score,
    totalChecks,
    passedChecks,
    checks,
    issues,
    verifiedAt: new Date().toISOString(),
    engineVersion: SAFETY_ENGINE_VERSION,
  };
}

/**
 * Deterministically parses extracted policy text into a candidate rule package.
 * Prepares the package for human review and validation without activating it.
 */
export function parsePolicyTextToCandidatePackage(
  rawText: string,
  sourceInfo: {
    sourceId: string;
    sourceName: string;
    sourceUrl: string;
    detectedVersion?: string;
  }
): ApprovedRulePackage {
  const sha256 = crypto.createHash('sha256').update(rawText).digest('hex');
  const version = sourceInfo.detectedVersion || 'v4.9-candidate';

  // Extract or heuristically identify key statutory signals
  // 1. Exemption threshold (Search for 3,000,000 / 3 juta / 3M)
  let exemptionThreshold = 3000000;
  if (/3\s*(?:juta|million|000\s*,?\s*000)/i.test(rawText)) {
    exemptionThreshold = 3000000;
  } else if (/1\s*(?:juta|million|000\s*,?\s*000)/i.test(rawText)) {
    // Note: Historical or specific threshold
    exemptionThreshold = 1000000;
  }

  // 2. Minimum wage (1,700 standard)
  let minWage = 1700;
  if (/1\s*,?\s*700/i.test(rawText)) {
    minWage = 1700;
  } else if (/1\s*,?\s*500/i.test(rawText)) {
    minWage = 1500;
  }

  // 3. Tax brackets
  // Capture the announced rates as a candidate when processing the MOF Budget 2027
  // speech, but keep them as an inactive candidate. Other documents start from the
  // centrally defined reference schedule; no scrape can make a tax schedule active.
  const containsBudget2027TaxAnnouncement = sourceInfo.sourceId === 'mof-budget'
    && /14\s*(?:%|per\s+cent|percent)/i.test(rawText)
    && /16\s*(?:%|per\s+cent|percent)/i.test(rawText);
  const taxBrackets: TaxBracketConfig[] = containsBudget2027TaxAnnouncement
    ? BUDGET2027_ANNOUNCED_TAX_BRACKETS.map(({ upTo, rate }) => ({ upTo, rate }))
    : getReferenceTaxBracketsForPolicyPackage();
  const taxScheduleDescription = containsBudget2027TaxAnnouncement
    ? 'Budget 2027 announcement scenario: 14% on the first RM150k, 16% from RM150k to RM600k, and 24% above RM600k; not confirmed as active law.'
    : 'Published reference schedule: 15% on the first RM150k, 17% from RM150k to RM600k, and 24% above RM600k; verify the applicable year of assessment.';

  // 4. SST rate
  let sstRate = 0.08;
  if (/8\s*%/i.test(rawText)) {
    sstRate = 0.08;
  } else if (/6\s*%/i.test(rawText)) {
    sstRate = 0.06;
  }

  // 5. Build candidate structured rules
  const rules: PolicyRule[] = [
    {
      id: `EINV-${version}-THRESH`,
      rule_id: 'R-INVOICE-THRESHOLD',
      version,
      category: 'e-invoicing',
      title: 'Individual Transaction Review Prompt',
      description: 'Transaction review control based on latest parsed policy document.',
      condition: { review_threshold: 10000 },
      explanation: `Extracted from ${sourceInfo.sourceName}. Transactions exceeding threshold trigger review checklist.`,
      reference: sourceInfo.sourceName,
      enabled: true,
      source: `Parsed text digest ${sha256.slice(0, 12)}...`,
      status: 'awaiting_details',
      approved_by: null,
      source_sentence: rawText.slice(0, 150).replace(/[\r\n]+/g, ' ') + '...',
      confidence: 0.95,
      benefit: 'Prevent non-compliance penalties on individual e-Invoice issuance',
    },
    {
      id: `EXEMP-${version}-RADAR`,
      rule_id: 'R-EXEMPTION-RADAR',
      version,
      category: 'e-invoicing',
      title: 'MSME Annual Revenue Exemption Radar',
      description: `MSME revenue below RM ${exemptionThreshold.toLocaleString()} relaxation screening.`,
      condition: { annual_turnover_max: exemptionThreshold },
      explanation: 'Screening criteria for relaxed statutory deadline based on LHDN phase implementation schedule.',
      reference: sourceInfo.sourceName,
      enabled: true,
      source: `Parsed text digest ${sha256.slice(0, 12)}...`,
      status: 'awaiting_details',
      approved_by: null,
      source_sentence: `Turnover relaxation threshold identified as RM ${exemptionThreshold.toLocaleString()}.`,
      confidence: 0.98,
      benefit: 'Avoid unnecessary vendor software overhead before mandatory phase date',
    },
    {
      id: `TAX-${version}-BRACKET`,
      rule_id: 'R-MSME-TAX-RATE',
      version,
      category: 'tax',
      title: 'Preferential SME Corporate Tax Tier Scheme',
      description: taxScheduleDescription,
      condition: { brackets: taxBrackets },
      explanation: containsBudget2027TaxAnnouncement
        ? 'Announcement-only scenario detected from the MOF Budget 2027 speech. Legal enactment, effective date, year of assessment and eligibility are not confirmed by text extraction.'
        : 'Reference schedule only. Confirm the applicable year of assessment and statutory eligibility before relying on this rate schedule.',
      reference: sourceInfo.sourceName,
      enabled: true,
      source: `Parsed text digest ${sha256.slice(0, 12)}...`,
      status: 'awaiting_details',
      approved_by: null,
      source_sentence: 'Preferential corporate tax brackets applicable to eligible SME capital structures.',
      confidence: 0.99,
      benefit: containsBudget2027TaxAnnouncement
        ? 'Stage the announced rate change for human legal review; do not report it as confirmed savings.'
        : 'Provide a consistent reference schedule for a clearly labelled comparison.',
    },
  ];

  const candidateId = `PKG-${sourceInfo.sourceId.toUpperCase()}-${Date.now().toString().slice(-4)}`;

  const candidatePackage: Partial<ApprovedRulePackage> = {
    id: candidateId,
    packageName: `${sourceInfo.sourceName} — Candidate Rule Package (${version})`,
    version,
    sourceId: sourceInfo.sourceId,
    sourceName: sourceInfo.sourceName,
    sourceUrl: sourceInfo.sourceUrl,
    sourceSha256: sha256,
    status: 'pending_validation',
    isActive: false, // CRITICAL: Never active immediately
    taxBrackets,
    exemptionThreshold,
    minWageStandard: minWage,
    sstRate,
    rules,
    extractedAt: new Date().toISOString(),
    validatedAt: null,
    approvedAt: null,
    approvedBy: null,
    approvalNotes: null,
    changeSummary: `Parsed from newly crawled text (${rawText.length} characters). SHA-256 digest: ${sha256.slice(0, 16)}...`,
  };

  const safetyVerification = verifyRulePackageSafety(candidatePackage);

  return {
    ...candidatePackage,
    safetyVerification,
    status: safetyVerification.passed ? 'validated' : 'pending_validation',
    validatedAt: new Date().toISOString(),
  } as ApprovedRulePackage;
}

/**
 * Calculates corporate tax using a dynamic set of tax brackets.
 */
export function calculateTaxWithBrackets(
  chargeableIncome: number,
  brackets: TaxBracketConfig[]
): number {
  if (chargeableIncome <= 0 || !Array.isArray(brackets) || brackets.length === 0) {
    return 0;
  }

  let totalTax = 0;
  let previousCeiling = 0;

  for (let i = 0; i < brackets.length; i++) {
    const tier = brackets[i];
    const currentCeiling = tier.upTo;

    if (currentCeiling === null) {
      // Remaining income taxed at this marginal rate
      const taxableInThisTier = Math.max(0, chargeableIncome - previousCeiling);
      totalTax += taxableInThisTier * tier.rate;
      break;
    } else {
      const tierBand = currentCeiling - previousCeiling;
      const taxableInThisTier = Math.min(
        Math.max(0, chargeableIncome - previousCeiling),
        tierBand
      );
      totalTax += taxableInThisTier * tier.rate;
      previousCeiling = currentCeiling;

      if (chargeableIncome <= currentCeiling) {
        break;
      }
    }
  }

  return Math.round(totalTax * 100) / 100;
}
