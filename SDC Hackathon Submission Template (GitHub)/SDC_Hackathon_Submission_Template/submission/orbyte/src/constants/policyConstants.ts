/**
 * Centralized Malaysian Policy Reference Constants, Thresholds & Calculation Rules
 * Aligned to versioned LHDN references and MOF Budget 2027 announcements; verify enactment and applicability before relying on any proposed measure.
 */

// -------------------------------------------------------------------------
// Statutory Thresholds (Ringgit Malaysia / Headcount)
// -------------------------------------------------------------------------

/** Maximum annual sales turnover to qualify as an MSME under SME Corp / MOF definition (RM 50,000,000) */
export const MSME_SALES_MAX = 50_000_000;

/** Maximum SSM paid-up share capital to claim preferential MSME corporate tax rate (RM 2,500,000) */
export const MSME_CAPITAL_MAX = 2_500_000;

/** RM10,000 is a threshold used in specific e-Invoice/consolidation contexts. Applicability must be checked against the current official guideline; do not treat this as a universal mandate for every transaction. */
export const INVOICE_REVIEW_THRESHOLD = 10_000;

/** LHDN's published implementation timeline lists taxpayers with annual turnover/revenue below RM3,000,000 as exempt from e-Invoice implementation. This is a screening reference only: verify the business-specific exemption criteria, historical turnover year, ownership, and related-entity conditions against current LHDN guidance. */
export const EXEMPTION_RADAR_THRESHOLD = 3_000_000;

/** Budget 2027 announcement: qualifying SMEs must have fewer than 75 employees. Final programme criteria must be verified before confirming eligibility. */
export const MEDIASAS_STAFF_MAX = 75;

/** The Budget 2027 announcement caps the first-year premium subsidy at 50 employees per company. */
export const MEDIASAS_MAX_SUBSIDIZED_EMPLOYEES = 50;

/** Announced first-year MediAsas premium subsidy per eligible employee, subject to final programme rules. */
export const MEDIASAS_GRANT_PER_EMPLOYEE = 200;

/** Budget 2027 announcement scenario: proposed/announced minimum wage baseline for June 2027. Confirm final applicable rules before making legal claims. */
export const MIN_WAGE_BASELINE_2027 = 2_000;

/** Current baseline value used for scenario analysis only; check current legal requirements before advising a business. */
export const MIN_WAGE_STANDARD_SME = 1_700;

/** Illustrative difference between announced wage figures; not a confirmed saving or exemption. */
export const MIN_WAGE_SAVING_PER_EMPLOYEE_ANNUAL = (MIN_WAGE_BASELINE_2027 - MIN_WAGE_STANDARD_SME) * 12;

/** Reference standard corporate tax rate for non-SMEs or non-qualifying income (24%); confirm the relevant assessment year. */
export const STANDARD_CORP_TAX_RATE = 0.24;

/** Tier 1 chargeable income cap (first RM 150,000) */
export const TIER1_CHARGEABLE_INCOME_CAP = 150_000;

/** Tier 2 chargeable income cap (RM 150,001 to RM 600,000) */
export const TIER2_CHARGEABLE_INCOME_CAP = 600_000;

// -------------------------------------------------------------------------
// Tax Rate Schedules & Brackets
// -------------------------------------------------------------------------

export const BASELINE_TIER1_RATE = 0.15;
export const BASELINE_TIER2_RATE = 0.17;
export const BUDGET2027_TIER1_RATE = 0.14;
export const BUDGET2027_TIER2_RATE = 0.16;

/**
 * Single source of truth for the published MSME corporate-tax reference schedule.
 * LHDN's published reference lists these rates for YA 2023–2025. This application
 * treats them as a reference baseline, not a substitute for checking the relevant
 * year of assessment and the company's statutory eligibility.
 */
export const REFERENCE_MSME_TAX_BRACKETS = [
  { upTo: TIER1_CHARGEABLE_INCOME_CAP, rate: BASELINE_TIER1_RATE },
  { upTo: TIER2_CHARGEABLE_INCOME_CAP, rate: BASELINE_TIER2_RATE },
  { upTo: null, rate: STANDARD_CORP_TAX_RATE },
] as const;

/**
 * Single source of truth for the Budget 2027 announcement scenario.
 * The announced 14% / 16% rates are kept separate from the reference schedule and
 * must not be represented as enacted, effective or payable tax until formal rules,
 * the relevant year of assessment and the effective date have been verified.
 */
export const BUDGET2027_ANNOUNCED_TAX_BRACKETS = [
  { upTo: TIER1_CHARGEABLE_INCOME_CAP, rate: BUDGET2027_TIER1_RATE },
  { upTo: TIER2_CHARGEABLE_INCOME_CAP, rate: BUDGET2027_TIER2_RATE },
  { upTo: null, rate: STANDARD_CORP_TAX_RATE },
] as const;

/** Calculation-format reference schedule used for rate-comparison functions. */
export const BASELINE_TAX_BRACKETS = REFERENCE_MSME_TAX_BRACKETS.map((bracket) => ({
  limit: bracket.upTo ?? Infinity,
  rate: bracket.rate,
}));

/** Calculation-format announcement scenario; never use as active law by default. */
export const BUDGET2027_TAX_BRACKETS = BUDGET2027_ANNOUNCED_TAX_BRACKETS.map((bracket) => ({
  limit: bracket.upTo ?? Infinity,
  rate: bracket.rate,
}));

/** Convert the single reference schedule to the policy-package representation. */
export function getReferenceTaxBracketsForPolicyPackage() {
  return REFERENCE_MSME_TAX_BRACKETS.map(({ upTo, rate }) => ({ upTo, rate }));
}

/**
 * A policy package may be considered active for tax schedule display only when its
 * brackets match the centrally configured reference schedule. Proposed or newly
 * scraped rates require an explicit code/release update after legal review; the
 * generic policy-package approval action must not silently activate them.
 */
export function matchesReferenceTaxSchedule(
  brackets: ReadonlyArray<{ upTo: number | null; rate: number }> | null | undefined,
): boolean {
  if (!Array.isArray(brackets) || brackets.length !== REFERENCE_MSME_TAX_BRACKETS.length) return false;
  return REFERENCE_MSME_TAX_BRACKETS.every((referenceBracket, index) => {
    const candidate = brackets[index];
    return candidate !== undefined
      && candidate.upTo === referenceBracket.upTo
      && Math.abs(candidate.rate - referenceBracket.rate) < 0.0000001;
  });
}

// -------------------------------------------------------------------------
// Policy Versions, Monitoring & Effective Dates
// -------------------------------------------------------------------------

export const POLICY_BASE_VERSION = 'LHDN-General-Guideline-v4.8';
export const POLICY_CANDIDATE_VERSION = 'source-review-pending';
export const POLICY_MONITOR_INTERVAL_HOURS = 6;
export const POLICY_MONITOR_INTERVAL_MS = POLICY_MONITOR_INTERVAL_HOURS * 3600 * 1000;

export const MIN_WAGE_EFFECTIVE_DATE = '2027-06-01';
export const EINVOICE_MANDATE_EFFECTIVE_DATE = '2026-08-01';

// -------------------------------------------------------------------------
// Centralized Deterministic Evaluation Functions
// -------------------------------------------------------------------------

/**
 * Computes tax payable for given chargeable income across tiered tax brackets.
 */
export function calculateTaxForBrackets(
  income: number,
  brackets: ReadonlyArray<{ limit: number; rate: number }>
): number {
  if (income <= 0 || !Number.isFinite(income)) return 0;
  let tax = 0;
  let prevLimit = 0;

  for (const bracket of brackets) {
    if (income > prevLimit) {
      const taxableSlice = Math.min(income, bracket.limit) - prevLimit;
      tax += taxableSlice * bracket.rate;
      prevLimit = bracket.limit;
    } else {
      break;
    }
  }

  return Math.round(tax * 100) / 100;
}

/**
 * Computes an illustrative scenario difference between baseline brackets and the rates announced in Budget 2027. This is not a statement of tax payable or a confirmed statutory saving.
 */
export function calculateTaxSaving(chargeableIncome: number): number {
  if (!chargeableIncome || chargeableIncome <= 0 || !Number.isFinite(chargeableIncome)) {
    return 0;
  }
  const baselineTax = calculateTaxForBrackets(chargeableIncome, BASELINE_TAX_BRACKETS);
  const proposedTax = calculateTaxForBrackets(chargeableIncome, BUDGET2027_TAX_BRACKETS);
  const saving = baselineTax - proposedTax;
  return Math.max(0, Math.round(saving * 100) / 100);
}

/**
 * Validates if an enterprise qualifies for the preferential MSME corporate tax rate:
 * Requires sales turnover <= RM50M AND paid-up capital <= RM2.5M.
 */
export function isMsmeEligible(sales: number, paidUpCapital: number | null | undefined): boolean {
  if (paidUpCapital === null || paidUpCapital === undefined) return false;
  return sales <= MSME_SALES_MAX && paidUpCapital <= MSME_CAPITAL_MAX;
}

/**
 * Validates if an enterprise qualifies for minimum wage hike exemption (turnover < RM50M).
 */
export function isExemptFromWageHike(_sales: number): boolean {
  // Budget 2027 describes a future measure; do not expose it as a current legal exemption before final rules take effect.
  return false;
}

/**
 * Screens a business against the currently known headline conditions from the Budget 2027 announcement. This is preliminary only; final programme rules and SME definition must be confirmed.
 */
export function isMediAsasEligible(_sales: number, staff: number): boolean {
  // The published Budget 2027 headline condition is fewer than 75 employees.
  // Do not add a turnover ceiling that is not stated in that announcement; final programme conditions still require verification.
  return Number.isFinite(staff) && staff > 0 && staff < MEDIASAS_STAFF_MAX;
}

/**
 * Calculates an illustrative first-year premium subsidy using the announced cap of 50 employees. Final eligibility and programme rules require official confirmation.
 */
export function calculateMediAsasGrant(sales: number, staff: number): number {
  return isMediAsasEligible(sales, staff)
    ? Math.min(staff, MEDIASAS_MAX_SUBSIDIZED_EMPLOYEES) * MEDIASAS_GRANT_PER_EMPLOYEE
    : 0;
}

/**
 * Legacy scenario helper only. The Budget 2027 wage announcement is not treated as a confirmed exemption or payroll saving.
 */
export function calculateWageHikeSaving(_sales: number, _staff: number): number {
  // Do not manufacture payroll savings from turnover until final legal rules are verified.
  return 0;
}
