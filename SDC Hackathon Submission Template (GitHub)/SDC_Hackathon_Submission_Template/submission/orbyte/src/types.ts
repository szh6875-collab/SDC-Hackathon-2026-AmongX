export type RoleType = 'owner' | 'clerk' | 'expert';

export type LanguageType = 'en' | 'bm';

export interface AuditEntry {
  event_id: number;
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  entity_id: string;
  company_id?: string;
  detail: string;
  details?: any;
  prev_hash: string | null;
  curr_hash: string;
  hash: string; // alias
}

export interface RuleResult {
  rule: string;
  rule_id?: string;
  status: 'PASS' | 'WARN' | 'BLOCKED' | 'FAIL' | 'MISSING_DATA' | 'REVIEW_REQUIRED';
  explanation: string;
  reference?: string;
}

export interface InvoiceSupplierInfo {
  name: string;
  tin: string | null;
  brn?: string | null;
  sst?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  signatory?: string | null;
}

export interface InvoiceBuyerInfo {
  name: string;
  tin: string | null;
  brn?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface InvoiceLineItem {
  id?: string;
  itemNo?: number;
  classification?: string; // e.g. "010"
  description: string;
  quantity?: number | null;
  unit?: string | null; // e.g. "month", "service", "unit"
  unitPrice?: number | null;
  discount?: number | null;
  charges?: number | null;
  taxRate?: number | string | null; // e.g. "8%" or 0.08
  taxAmount?: number | null;
  taxableAmount?: number | null;
  tax?: number | null;
  total?: number | null;
}

export interface InvoiceTotals {
  subtotal?: number | null;
  discount?: number | null;
  charges?: number | null;
  taxableAmount?: number | null;
  taxRate?: number | string | null;
  taxAmount?: number | null;
  rounding?: number | null;
  totalPayable?: number | null;
}

export interface InvoicePaymentInfo {
  mode?: string | null; // e.g. "Bank Transfer"
  terms?: string | null; // e.g. "30 days"
  bankName?: string | null;
  bankAccountNumber?: string | null;
  payeeName?: string | null;
  paymentTerms?: string | null; // alias for backwards compatibility
}

export interface InvoiceValidationInfo {
  uuid?: string | null;
  status?: string | null; // e.g. "DEMO", "VERIFIED"
  qrPayload?: string | null;
  qrImageUrl?: string | null;
}

export interface PreExportValidationCheck {
  rule: string;
  field?: string;
  status: 'Passed' | 'Warning' | 'Missing' | 'Invalid';
  message: string;
}

export interface PreExportValidationResult {
  overall?: 'Passed' | 'Warning' | 'Missing' | 'Invalid';
  status: 'Passed' | 'Warning' | 'Missing' | 'Invalid';
  passed?: boolean;
  summary?: string;
  checks: PreExportValidationCheck[];
}

export interface InvoiceDraft {
  draft_id: string;
  company_id?: string;
  filename?: string;
  uploaded_by?: string;
  parsedAmount: number;
  amount?: number;
  subtotal?: number | null;
  tax?: number | null;
  discount?: number | null;
  currency?: string;
  confidence: number;
  confidenceBasis?: 'ocr-engine' | 'model-reported' | 'parser-heuristic' | 'demo-fixture' | 'unknown';
  company: string;
  status: 'pending_review' | 'pending_approval' | 'approved' | 'rejected' | 'Ready' | 'Review Required' | 'Missing Information';
  created_at: string;
  date?: string;
  time?: string;
  buyer_tin?: string | null;
  supplier_tin?: string | null;
  approved_at?: string;

  // Full e-Invoice details
  documentType?: string; // e.g. "Invoice"
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceTime?: string;
  supplier?: InvoiceSupplierInfo;
  buyer?: InvoiceBuyerInfo;
  totals?: InvoiceTotals;
  payment?: any;
  validation?: InvoiceValidationInfo;
  preExportValidation?: PreExportValidationResult;
  references?: {
    originalReference?: string;
    purchaseOrder?: string;
  };

  fields: {
    amount: number;
    buyerTIN: string | null;
    buyerName: string;
    vendorName: string;
    supplierName?: string;
    supplierTIN?: string | null;
    date: string;
    invoiceNumber: string;
    subtotal?: number | null;
    tax?: number | null;
    discount?: number | null;
    currency?: string;
    notes?: string;
    // Expanded optional fields
    documentType?: string;
    supplierBRN?: string | null;
    supplierSST?: string | null;
    supplierAddress?: string | null;
    supplierEmail?: string | null;
    supplierPhone?: string | null;
    buyerBRN?: string | null;
    buyerAddress?: string | null;
    buyerEmail?: string | null;
    buyerPhone?: string | null;
    taxableAmount?: number | null;
    rounding?: number | null;
    paymentMode?: string | null;
    paymentTerms?: string | null;
    validationUUID?: string | null;
  };
  items?: InvoiceLineItem[];
  payment_info?: InvoicePaymentInfo | null;
  rule_results?: Record<string, string>;
  ruleResults: RuleResult[];
  history?: Array<{
    timestamp: string;
    actor: string;
    action: string;
    detail: string;
  }>;
  extractionMethod?: 'xml' | 'json' | 'qr' | 'pdf_text' | 'ocr' | 'ai' | 'regex' | 'manual';
  originalFile?: {
    filename: string;
    mimetype: string;
    size: number;
    uploaded_at: string;
    dataBase64?: string;
    textContent?: string;
  };
}

export interface SyntheticCompany {
  id: string;
  name: string;
  industry: string;
  sales: number;
  salesDisplay: string;
  paidUpCapital: number | null;
  paidUpCapitalDisplay: string;
  staff: number;
  chargeableIncome?: number;
  r1_tax: {
    status: 'PASS' | 'WARN' | 'BLOCKED';
    label: string;
    details: string;
    estimatedSaving: string;
  };
  r2_wage: {
    status: 'PASS' | 'WARN' | 'BLOCKED';
    label: string;
    details: string;
  };
  r3_mediasas: {
    status: 'PASS' | 'WARN' | 'BLOCKED';
    label: string;
    details: string;
    grantAmount: string;
  };
}

export interface CompanyEntity extends SyntheticCompany {
  uen_or_tin: string;
  ssm_registration: string;
  director_name: string;
  is_resident_director: boolean;
  local_equity_percent: number;
  msic_code: string;
  staffCount?: number;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  address?: string;
  email?: string;
  phone?: string;
  sst?: string;
  tin?: string;
  brn?: string;
  pendingInvoicesCount?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  riskReasons?: string[];
  eInvoicingStatus?: 'POTENTIAL_EXEMPTION' | 'REVIEW_REQUIRED' | 'CHECK_REQUIRED';
  isCurrentActive?: boolean;
}

export interface PortfolioOverview {
  totalCompanies: number;
  activeCount: number;
  archivedCount: number;
  totalTurnover: number;
  totalPendingInvoices: number;
  currentActiveCompanyId?: string;
  companies: CompanyEntity[];
}

export interface PolicyRule {
  id: string;
  rule_id?: string;
  version: string;
  category: 'e-invoicing' | 'budget2027' | 'tax' | 'wage' | 'subsidy' | 'guideline';
  title: string;
  description: string;
  condition: string | Record<string, any>;
  explanation: string;
  reference: string;
  enabled?: boolean;
  source?: string;
  status: 'proposed' | 'in_force' | 'awaiting_details';
  approved_by: string | null;
  source_sentence: string;
  confidence?: number;
  benefit?: string;
}

export type PolicyQaStatus = 'supported' | 'partially_supported' | 'insufficient_evidence' | 'ai_unavailable' | 'source_unavailable';

export interface PolicyQaCitation {
  id: string;
  title: string;
  sourceUrl: string;
  evidenceType: 'official_document' | 'approved_policy_package';
  sourceCategory: string | null;
  version: string | null;
  capturedAt: string | null;
  lastCheckedAt: string | null;
  lastSuccessfulRetrievalAt: string | null;
  sourceStatus: string;
  trustStatus: string;
  contentSha256: string | null;
  paragraphLabel: string;
  requiresReview: boolean;
  excerpt: string;
  relevanceScore?: number;
}

export interface PolicyQaResponse {
  status: PolicyQaStatus;
  answer: string;
  citations: PolicyQaCitation[];
  caveats?: string[];
  provider?: string;
  retrievedAt?: string;
}

export interface PolicyDiffItem {
  id: string;
  title: string;
  change: string;
  source: string;
}

export interface SystemState {
  activePolicyVersion: string;
  policyLastSyncedDaysAgo: number | null;
  isStale: boolean;
  projectedAnnualRevenue: number;
  companyName: string;
  ownerName: string;
  currentUser: {
    username: string;
    role: RoleType;
    name: string;
  };
  activeCompanyId?: string;
}

export interface TestCaseResult {
  id: string; // T1 to T14
  name: string;
  feature: string;
  description: string;
  passed: boolean;
  actual: string;
  expected: string;
  durationMs: number;
}

export interface ReplayCaseResult {
  id: string;
  name: string;
  industry: string;
  sales: number;
  salesDisplay: string;
  paidUpCapital: number | null;
  paidUpCapitalDisplay: string;
  staff: number;
  v48Status: 'ELIGIBLE' | 'PARTIAL' | 'NOT_ELIGIBLE';
  v49Status: 'ELIGIBLE' | 'PARTIAL' | 'NOT_ELIGIBLE';
  impact: 'UNCHANGED' | 'NEWLY_ELIGIBLE' | 'REGRESSION';
  details: string;
  taxSavingsMYR: number;
  estimatedChargeableIncome?: number;
  dataMode?: 'synthetic';
}

export interface ReplayRunSummary {
  totalCases: number;
  unchangedCount: number;
  newlyEligibleCount: number;
  regressionsCount: number;
  durationMs: number;
  timestamp: string;
  policyFrom: string;
  policyTo: string;
  passRate: string;
  totalEstimatedTaxSavingsMYR?: number;
  benefitCaseCount?: number;
  cases: ReplayCaseResult[];
}

export interface CustomEligibilityOutcome {
  sales: number;
  paidUpCapital: number | null;
  staff: number;
  r1_tax: { status: 'PASS' | 'WARN' | 'BLOCKED'; label: string; details: string; estimatedSaving: string };
  r2_wage: { status: 'PASS' | 'WARN' | 'BLOCKED'; label: string; details: string };
  r3_mediasas: { status: 'PASS' | 'WARN' | 'BLOCKED'; label: string; details: string; grantAmount: string };
  overallEligible: boolean;
  policyPack: {
    name: string;
    version: string;
    effectiveDate: string;
  };
}

export interface TaxBracketConfig {
  upTo: number | null;
  rate: number;
}

export interface SafetyCheckItem {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
  details: string;
}

export interface RulePackageSafetyReport {
  passed: boolean;
  score: number;
  totalChecks: number;
  passedChecks: number;
  checks: SafetyCheckItem[];
  issues: string[];
  verifiedAt: string;
  engineVersion: string;
}

export interface ApprovedRulePackage {
  id: string;
  packageName: string;
  version: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  sourceSha256: string;
  status: 'draft' | 'pending_validation' | 'validated' | 'approved' | 'rejected' | 'archived';
  isActive: boolean;
  taxBrackets: TaxBracketConfig[];
  exemptionThreshold: number;
  minWageStandard: number;
  sstRate: number;
  rules: PolicyRule[];
  safetyVerification: RulePackageSafetyReport;
  extractedAt: string;
  validatedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  approvalNotes?: string | null;
  changeSummary?: string | null;
}

export interface PolicySourceRecord {
  id: string;
  name: string;
  url: string;
  documentType: string;
  category: 'guideline' | 'faq' | 'budget_speech' | 'gazette' | 'sst' | 'custom';
  sourceFormat: 'pdf' | 'html' | 'json';
  checkIntervalHours: number;
  isActive: boolean;
  lastChecked: string | null;
  lastSuccessfulRetrieval: string | null;
  currentSha256: string | null;
  previousSha256: string | null;
  detectedVersion: string | null;
  status: 'idle' | 'checking' | 'unchanged' | 'changed' | 'failed' | 'baseline_saved';
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonitoredSource {
  id: string;
  name: string;
  url: string;
  documentType: string;
  category?: 'guideline' | 'faq' | 'budget_speech' | 'gazette' | 'sst' | 'custom';
  sourceFormat?: 'pdf' | 'html' | 'json';
  isActive?: boolean;
  lastChecked: string | null;
  lastSuccessfulRetrieval?: string | null;
  lastStatus: 'changed' | 'unchanged' | 'baseline_saved' | 'unverifiable' | 'failed' | 'unavailable' | 'simulated' | 'connected' | 'network_error' | 'timeout' | 'update_detected' | 'checking' | 'idle';
  httpStatus: number | null;
  errorMessage?: string | null;
  monitoredVersion: string;
  detectedVersion?: string | null;
  hasUpdate: boolean;
  sourceSnippet?: string;
  snapshotHash?: string | null;
  snapshotSnippet?: string | null;
  retrievalMethod?: 'live_network' | 'manual_import' | 'simulated' | 'none';
  checkIntervalHours: number;
}

export interface PolicyMonitoringStatus {
  autoCheckEnabled: boolean;
  checkIntervalHours: number;
  lastCheckedTime: string | null;
  nextScheduledCheck: string | null;
  lastSuccessfulRetrieval?: string | null;
  overallStatus: 'active_monitoring' | 'connection_error' | 'network_restricted' | 'update_pending' | 'check_failed' | 'up_to_date' | 'idle';
  activeVersion: string;
  isStale: boolean;
  monitoredSources: MonitoredSource[];
  pendingUpdate: PendingPolicyUpdate | null;
  connectionNote: string;
  hasNetworkRestriction?: boolean;
  networkRestrictionNote?: string;
}

export interface PendingPolicyUpdate {
  candidateVersion: string;
  sourceUrl: string;
  sourceName: string;
  detectedAt: string;
  status: 'pending_verification' | 'verified' | 'rejected';
  isSimulated?: boolean;
  importMethod?: 'live_network' | 'manual_import' | 'simulation';
  importedBy?: string | null;
  aiSummary: {
    executiveSummary: string;
    keyChanges: Array<{
      clause: string;
      change: string;
      category: 'e-invoicing' | 'tax' | 'wage' | 'subsidy';
      impact: string;
    }>;
    smeImpactAnalysis: string;
    recommendedActions: string[];
    isAiGenerated: boolean;
  };
  ruleChanges: Array<{
    id: string;
    title: string;
    type: 'added' | 'changed' | 'removed';
    description: string;
    condition: any;
    oldValue?: string;
    newValue?: string;
  }>;
}

export interface MissingDataItem {
  id: string;
  field: string;
  label: string;
  impact: string;
  severity: 'high' | 'medium' | 'low';
  actionTab: string;
}

export interface FinancialImpactRecalculation {
  companyId: string;
  companyName: string;
  policyVersion: string;
  calculatedAt: string;
  metrics: {
    annualTurnover: number;
    annualTurnoverDisplay: string;
    paidUpCapital: number | null;
    paidUpCapitalDisplay: string;
    staffCount: number;
    chargeableIncome: number;
    chargeableIncomeDisplay: string;
  };
  taxImpact: {
    status: 'PASS' | 'WARN' | 'BLOCKED' | 'MISSING_DATA';
    baselineTaxMYR: number;
    /** Tax computed with the Budget 2027 announcement schedule; scenario only. */
    policyTaxMYR: number;
    /** Explicitly named alias for UI/reporting clarity. */
    budget2027ScenarioTaxMYR: number;
    annualTaxSavingsMYR: number;
    displaySavings: string;
    calculationFormula: string;
    explanation: string;
  };
  wageImpact: {
    status: 'PASS' | 'WARN' | 'BLOCKED';
    isExempt: boolean;
    wageRateBaselineMYR: number;
    standardWageMYR: number;
    annualPayrollSavingsMYR: number;
    displaySavings: string;
    explanation: string;
  };
  subsidyImpact: {
    status: 'PASS' | 'WARN' | 'BLOCKED';
    isEligible: boolean;
    grantPerStaffMYR: number;
    totalAnnualGrantMYR: number;
    displayGrant: string;
    explanation: string;
  };
  invoiceCompliance: {
    totalInvoicesCount: number;
    totalInvoicesAmountMYR: number;
    individualMandateCount: number; // Legacy API field: invoices crossing the configured review threshold
    consolidatedCount: number; // Invoices <=RM10k
    missingTinCount: number;
    reviewRequiredCount: number;
    complianceRiskScore: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  totals: {
    netAnnualBenefitMYR: number;
    displayNetBenefit: string;
    previousNetBenefitMYR: number;
    deltaBenefitMYR: number;
    displayDeltaBenefit: string;
  };
  missingData: MissingDataItem[];
  recommendedActions: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'urgent' | 'recommended' | 'optional';
    tab: string;
  }>;
}

export interface OwnerNotification {
  id: string;
  timestamp: string;
  type: 'policy_update' | 'financial_recalc' | 'missing_data' | 'threshold_alert';
  title: string;
  message: string;
  policyVersion: string;
  deltaSavingsMYR: number;
  recommendedActions: Array<{
    label: string;
    tab: string;
    priority: 'urgent' | 'recommended' | 'optional';
  }>;
  dismissed: boolean;
}


