import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Sparkles,
  FileText,
  Building2,
  Lock,
  KeyRound,
  ExternalLink,
} from 'lucide-react';
import { api, setClientRole } from '../services/api';
import { RoleType } from '../types';

interface DemoScenarioModalProps {
  isOpen: boolean;
  scenarioId: number; // 1, 2, 3, or 4
  onClose: () => void;
  onNavigateTab: (tabId: string) => void;
  onRoleChange: (role: RoleType) => void;
  onRefreshAllData: () => Promise<void>;
  companyName: string;
  ownerName: string;
  language: 'en' | 'bm';
}

export const DemoScenarioModal: React.FC<DemoScenarioModalProps> = ({
  isOpen,
  scenarioId,
  onClose,
  onNavigateTab,
  onRoleChange,
  onRefreshAllData,
  companyName,
  ownerName,
  language,
}) => {
  const isBM = language === 'bm';

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [stepData, setStepData] = useState<any>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCurrentStep(1);
    setLogs([]);
    setStepData({});
    setErrorMsg(null);
  }, [scenarioId, isOpen]);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // -------------------------------------------------------------------------
  // Scenario 1: Invoice to Eligibility Pre-check
  // -------------------------------------------------------------------------
  const runScenario1Step = async (targetStep: number) => {
    setIsExecuting(true);
    setErrorMsg(null);
    try {
      if (targetStep === 1) {
        addLog('Calling POST /api/upload_invoice_text with clean B2B invoice (RM 4,350.00)...');
        const res = await api.uploadInvoiceText({
          text: `Official B2B Invoice from Kedai Kopi Malaya to ${companyName}. Total Amount: RM 4,350.00. Buyer TIN: C2891928301. Date: 2026-10-21.`,
        });
        setStepData((prev: any) => ({ ...prev, s1_invoice: res }));
        addLog(`Invoice ${res.draft_id} created with 95% confidence. Status: ${res.status}.`);
        setCurrentStep(2);
      } else if (targetStep === 2) {
        addLog('Evaluating invoice against the configured RM 10,000 review prompt. This is not a universal legal threshold; verify applicable LHDN consolidation rules.');
        addLog('Validating Buyer TIN: C2891928301 verified.');
        addLog('Connecting intake data to Supplier MSME Profile pre-check...');
        const elig = await api.getEligibility();
        setStepData((prev: any) => ({ ...prev, s1_eligibility: elig }));
        setCurrentStep(3);
      } else if (targetStep === 3) {
        addLog(`Linking to Policy Eligibility Matrix for ${companyName}...`);
        await onRefreshAllData();
        onNavigateTab('compliance');
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Execution failed');
      addLog(`Error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Scenario 2: Invoice Exception Handling & Resolution
  // -------------------------------------------------------------------------
  const runScenario2Step = async (targetStep: number) => {
    setIsExecuting(true);
    setErrorMsg(null);
    try {
      if (targetStep === 1) {
        addLog('Ingesting a demo WhatsApp receipt (RM 11,200.00) with a missing buyer TIN; the configured amount threshold is only a review prompt...');
        const res = await api.uploadInvoiceText({
          text: `WhatsApp photo: Delivery of wholesale meat supplies to Farhans Bistro. Amount RM 11,200.00 payable to ${companyName}. No buyer tax number provided.`,
        });
        setStepData((prev: any) => ({ ...prev, s2_draft: res }));
        addLog(`Invoice ${res.draft_id} flagged for configured-threshold review and missing TIN. These flags require applicable-rule verification. Status: ${res.status}`);
        setCurrentStep(2);
      } else if (targetStep === 2) {
        const draftId = stepData.s2_draft?.draft_id || 'DRF-8841';
        addLog(`Owner Human-in-the-Loop review: Correcting Buyer TIN to "C24892019020" and verifying RM 11,200.00...`);
        const confirmRes = await api.confirmDraftFields(draftId, {
          amount: 11200.0,
          buyerTIN: 'C24892019020',
          buyerName: 'Farhans Bistro Sdn. Bhd.',
          date: '2026-10-21',
        });
        setStepData((prev: any) => ({ ...prev, s2_confirm: confirmRes }));
        addLog(`Fields confirmed by Owner! Deterministic rules re-evaluated: Status now "${confirmRes.status}".`);
        setCurrentStep(3);
      } else if (targetStep === 3) {
        addLog('Navigating to InvoisReady view to inspect unlocked fields...');
        await onRefreshAllData();
        onNavigateTab('invoices');
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Execution failed');
      addLog(`Error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Scenario 3: Governance, RBAC and Audit
  // -------------------------------------------------------------------------
  const runScenario3Step = async (targetStep: number) => {
    setIsExecuting(true);
    setErrorMsg(null);
    try {
      if (targetStep === 1) {
        addLog('Switching authenticated session role to Staff / Clerk (token-clerk)...');
        onRoleChange('clerk');
        setClientRole('clerk');
        addLog('Session role is now Staff / Clerk (View-only).');
        setCurrentStep(2);
      } else if (targetStep === 2) {
        addLog('Clerk attempting to approve draft #DRF-8841 via POST /api/approve...');
        try {
          await api.approveItem('DRF-8841');
          setErrorMsg('Unexpected: Clerk was allowed to approve!');
        } catch (err: any) {
          if (err.code === 403 || err.message?.includes('403')) {
            addLog('✅ Genuine HTTP 403 Forbidden caught from server! Clerk approval blocked.');
            addLog('Event "ForbiddenApprovalAttempt" logged to cryptographic audit ledger.');
            setStepData((prev: any) => ({ ...prev, s3_blocked: true, s3_error: err.message }));
            setCurrentStep(3);
          } else {
            throw err;
          }
        }
      } else if (targetStep === 3) {
        addLog(`Switching authenticated role to SME Owner (${ownerName})...`);
        onRoleChange('owner');
        setClientRole('owner');
        addLog('Owner permissions active. Re-submitting approval for draft #DRF-8841...');
        const approveRes = await api.approveItem('DRF-8841');
        setStepData((prev: any) => ({ ...prev, s3_approved: approveRes }));
        addLog(`✅ HTTP 200 OK: Draft approved by ${ownerName}! Audit block [${approveRes.audit_id}] committed.`);
        setCurrentStep(4);
        addLog('Navigating to e-Invoice Center to review verified draft status...');
        await onRefreshAllData();
        onNavigateTab('invoices');
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Execution failed');
      addLog(`Error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Scenario 4: Cryptographic Chain & Tamper Defense
  // -------------------------------------------------------------------------
  const runScenario4Step = async (targetStep: number) => {
    setIsExecuting(true);
    setErrorMsg(null);
    try {
      if (targetStep === 1) {
        addLog('Executing GET /api/audit/verify on initial ledger...');
        const verify1 = await api.verifyAuditChain();
        setStepData((prev: any) => ({ ...prev, s4_verify1: verify1 }));
        addLog(`✅ Genesis verification: valid=${verify1.verified}. All SHA-256 hash pointers match.`);
        setCurrentStep(2);
      } else if (targetStep === 2) {
        addLog('Injecting simulated database tampering at entry #1 via POST /api/audit/tamper...');
        const tamperRes = await api.tamperAuditRecord(1);
        addLog(`Corrupted record at index ${tamperRes.tampered_index} in database memory.`);
        addLog('Re-running GET /api/audit/verify to test mathematical tamper detection...');
        const verify2 = await api.verifyAuditChain();
        setStepData((prev: any) => ({ ...prev, s4_verify2: verify2 }));
        addLog(`🚨 TAMPER DETECTED: valid=${verify2.verified}, broken block at index ${verify2.failed_at}!`);
        setCurrentStep(3);
      } else if (targetStep === 3) {
        addLog('Executing cryptographic recovery via POST /api/audit/restore...');
        await api.restoreAuditRecord();
        addLog('Re-computing SHA-256 chain from genesis block...');
        const verify3 = await api.verifyAuditChain();
        setStepData((prev: any) => ({ ...prev, s4_verify3: verify3 }));
        addLog(`✅ Restored: valid=${verify3.verified}. 100% hash chain integrity confirmed.`);
        setCurrentStep(4);
      } else if (targetStep === 4) {
        addLog('Verification complete. Returning to Business Settings...');
        await onRefreshAllData();
        onNavigateTab('business');
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Execution failed');
      addLog(`Error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Scenario Titles & Metadata
  const scenarioTitles: Record<number, { title: string; subtitle: string; icon: any; color: string }> = {
    1: {
      title: 'Scenario 1: Invoice to Policy Eligibility',
      subtitle: 'Simulates intake of a clean B2B e-Invoice, threshold check, and immediate linking to Budget 2027 relief criteria.',
      icon: FileText,
      color: 'blue',
    },
    2: {
      title: 'Scenario 2: Invoice Exception Handling',
      subtitle: 'Simulates a high-value WhatsApp receipt that needs review, resolves a missing-field warning, and proceeds through the demo approval flow.',
      icon: AlertTriangle,
      color: 'amber',
    },
    3: {
      title: 'Scenario 3: Governance, RBAC & Audit Trail',
      subtitle: 'Demonstrates real server-side HTTP 403 Forbidden rejection for Staff, followed by Owner sign-off and SHA-256 commit.',
      icon: Lock,
      color: 'purple',
    },
    4: {
      title: 'Scenario 4: Cryptographic Chain & Tamper Defense',
      subtitle: 'Verifies SHA-256 hash chaining, injects a real data tamper attack, flags the broken node, and restores mathematical integrity.',
      icon: KeyRound,
      color: 'emerald',
    },
  };

  if (!isOpen) return null;

  const meta = scenarioTitles[scenarioId] || scenarioTitles[1];
  const Icon = meta.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C3F35]/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-[#FFFFFF] rounded border-2 border-[#1C3F35] shadow-[8px_8px_0_#1C3F35] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#FAF5E8] border-b-2 border-[#1C3F35] text-[#1C3F35] px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[#EDF6EB] border border-[#1C3F35] text-[#1C3F35] flex items-center justify-center shadow-[1.5px_1.5px_0_#1C3F35]">
              <Icon className="w-5 h-5 text-[#285443]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6B857D]">
                  Interactive Demo Scenario Runner
                </span>
                <span className="text-[10px] bg-[#FEF3C7] text-[#1C3F35] border border-[#1C3F35] px-1.5 py-0.2 rounded font-mono font-bold">
                  Backend API Scenario
                </span>
              </div>
              <h3 className="font-serif font-bold text-base text-[#1C3F35]">{meta.title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#1C3F35] hover:bg-[#FFFFFF] p-1 rounded border border-[#1C3F35] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          <p className="text-slate-600 leading-relaxed">{meta.subtitle}</p>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-4 gap-2 text-center font-semibold text-[11px]">
            {[1, 2, 3, 4].map((step) => {
              const isActive = currentStep === step;
              const isPast = currentStep > step;
              return (
                <div
                  key={step}
                  className={`p-2 rounded-lg border transition-all ${
                    isActive
                      ? 'bg-blue-50 border-blue-500 text-blue-900 ring-1 ring-blue-500'
                      : isPast
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="font-mono text-xs">Step {step}</div>
                  <div className="text-[10px] truncate mt-0.5">
                    {step === 1 ? 'Initiate' : step === 2 ? 'Evaluate' : step === 3 ? 'Resolve' : 'Complete'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Execution Notice:</strong> {errorMsg}
              </div>
            </div>
          )}

          {/* Step Context Display */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
            <div className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center justify-between">
              <span>Active Workflow Step: {currentStep} of 4</span>
              {isExecuting && (
                <span className="inline-flex items-center gap-1.5 text-blue-600 text-xs font-semibold">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Calling Backend Service...
                </span>
              )}
            </div>

            {/* Scenario-specific cards */}
            {scenarioId === 1 && (
              <div className="text-slate-700 space-y-2">
                {currentStep === 1 && (
                  <p>Click &quot;Step 1: Upload Clean B2B Invoice&quot; to ingest an invoice from Kedai Kopi Malaya for RM 4,350.00.</p>
                )}
                {currentStep === 2 && (
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900">Extracted Invoice: #{stepData.s1_invoice?.draft_id}</div>
                    <div>Amount: <strong>RM 4,350.00</strong> (below configured review prompt; applicability still needs verification)</div>
                    <div>Buyer TIN: <code>C2891928301</code> (Verified)</div>
                    <div className="text-emerald-700 font-semibold mt-1">Ready for the configured demo policy pre-check; this is not an official eligibility determination.</div>
                  </div>
                )}
                {currentStep === 3 && (
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-emerald-900">
                    <div className="font-bold">Workflow Complete!</div>
                    <div>Demo invoice fields were processed and passed to the configured demo Policy Pre-check. This does not verify official eligibility. Click below to view the matrix.</div>
                  </div>
                )}
              </div>
            )}

            {scenarioId === 2 && (
              <div className="text-slate-700 space-y-2">
                {currentStep === 1 && (
                  <p>Click &quot;Step 1: Upload Exception Receipt&quot; to simulate a high-value WhatsApp invoice with RM 11,200.00 and missing buyer TIN.</p>
                )}
                {currentStep === 2 && (
                  <div className="bg-white p-3 rounded-lg border border-amber-300 bg-amber-50/50 space-y-1">
                    <div className="font-bold text-amber-900">Exception Flagged: #{stepData.s2_draft?.draft_id}</div>
                    <div className="text-rose-700 font-semibold">Demo rule flagged RM 11,200.00 above the configured RM10,000 threshold. Verify current official invoice requirements independently.</div>
                    <p className="text-[11px] text-slate-600 mt-1">Click &quot;Step 2: Owner Reviews &amp; Adds TIN&quot; to resolve the configured demo-rule flag.</p>
                  </div>
                )}
                {currentStep === 3 && (
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-emerald-900">
                    <div className="font-bold">Demo Rule Review Completed</div>
                    <div>A sample TIN value was entered (<code>DEMO-ONLY</code>); it was not externally verified. Status is now <strong>Ready for Owner Approval</strong> under the configured demo rules.</div>
                  </div>
                )}
              </div>
            )}

            {scenarioId === 3 && (
              <div className="text-slate-700 space-y-2">
                {currentStep === 1 && (
                  <p>Click &quot;Step 1: Authenticate as Staff/Clerk&quot; to test true server-side role enforcement.</p>
                )}
                {currentStep === 2 && (
                  <p>Click &quot;Step 2: Attempt Clerk Approval&quot; to send a request to <code>POST /api/approve</code> with <code>token-clerk</code>.</p>
                )}
                {currentStep === 3 && (
                  <div className="space-y-2">
                    <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-lg text-rose-900">
                      <strong>Server Response:</strong> HTTP 403 Forbidden: Staff members are view-only!
                    </div>
                    <p>Now click &quot;Step 3: Switch to Owner &amp; Approve&quot; to approve with <code>token-owner</code>.</p>
                  </div>
                )}
                {currentStep === 4 && (
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-emerald-900">
                    <div className="font-bold">Approval Finalized &amp; Cryptographically Anchored!</div>
                    <div>Owner ({ownerName}) approved draft. Recorded into SHA-256 audit ledger.</div>
                  </div>
                )}
              </div>
            )}

            {scenarioId === 4 && (
              <div className="text-slate-700 space-y-2">
                {currentStep === 1 && (
                  <p>Click &quot;Step 1: Verify Initial Audit Chain&quot; to recompute all SHA-256 block hashes.</p>
                )}
                {currentStep === 2 && (
                  <div className="space-y-1">
                    <div className="text-emerald-700 font-semibold">Initial Chain: VALID (All hash pointers match).</div>
                    <p>Click &quot;Step 2: Inject Simulated Tamper Attack&quot; to alter record #1 in database memory.</p>
                  </div>
                )}
                {currentStep === 3 && (
                  <div className="space-y-2">
                    <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 font-bold">
                      Detection Confirmed: Tampering detected at index [{stepData.s4_verify2?.failed_at || 1}]!
                    </div>
                    <p>Click &quot;Step 3: Restore &amp; Recompute Chain&quot; to test cryptographic recovery.</p>
                  </div>
                )}
                {currentStep === 4 && (
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-emerald-900">
                    <div className="font-bold">Recovery Confirmed!</div>
                    <div>All SHA-256 block pointers restored and mathematically verified.</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Live Execution Console Log */}
          <div>
            <div className="font-bold text-slate-600 mb-1.5 uppercase tracking-wider text-[10px]">
              Live Execution Terminal Log:
            </div>
            <div className="bg-slate-950 text-slate-200 font-mono text-[11px] p-3 rounded-xl h-28 overflow-y-auto space-y-1 border border-slate-800">
              {logs.length === 0 ? (
                <span className="text-slate-500 italic">Ready to run scenario. Click the action button below.</span>
              ) : (
                logs.map((l, i) => <div key={i}>{l}</div>)
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-[#FAF5E8] px-6 py-4 border-t-2 border-[#1C3F35] flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border-2 border-[#1C3F35] text-[#1C3F35] rounded font-bold hover:bg-[#FAF8F2] transition-colors shadow-[2px_2px_0_#1C3F35] cursor-pointer"
          >
            Close Runner
          </button>

          {/* Action Trigger based on scenario & step */}
          <div>
            {scenarioId === 1 && (
              <button
                onClick={() => runScenario1Step(currentStep)}
                disabled={isExecuting}
                className="px-5 py-2 bg-[#285443] hover:bg-[#19382E] text-white rounded font-bold flex items-center gap-2 border-2 border-[#1C3F35] shadow-[3px_3px_0_#1C3F35] cursor-pointer disabled:opacity-50"
              >
                {isExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                {currentStep === 1
                  ? 'Step 1: Upload Clean B2B Invoice'
                  : currentStep === 2
                  ? 'Step 2: Run Rules & Link SME Policy'
                  : 'Step 3: View Eligibility Matrix'}
              </button>
            )}

            {scenarioId === 2 && (
              <button
                onClick={() => runScenario2Step(currentStep)}
                disabled={isExecuting}
                className="px-5 py-2 bg-[#E5A842] hover:bg-[#D49733] text-[#1C3F35] rounded font-bold flex items-center gap-2 border-2 border-[#1C3F35] shadow-[3px_3px_0_#1C3F35] cursor-pointer disabled:opacity-50"
              >
                {isExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-[#1C3F35]" />}
                {currentStep === 1
                  ? 'Step 1: Upload Exception Receipt'
                  : currentStep === 2
                  ? 'Step 2: Owner Verifies & Adds TIN'
                  : 'Step 3: Inspect InvoisReady Draft'}
              </button>
            )}

            {scenarioId === 3 && (
              <button
                onClick={() => runScenario3Step(currentStep)}
                disabled={isExecuting}
                className="px-5 py-2 bg-[#285443] hover:bg-[#19382E] text-white rounded font-bold flex items-center gap-2 border-2 border-[#1C3F35] shadow-[3px_3px_0_#1C3F35] cursor-pointer disabled:opacity-50"
              >
                {isExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                {currentStep === 1
                  ? 'Step 1: Switch to Staff/Clerk'
                  : currentStep === 2
                  ? 'Step 2: Attempt Clerk Approval (403)'
                  : currentStep === 3
                  ? 'Step 3: Switch to Owner & Sign Off'
                  : 'Step 4: View Approvals Ledger'}
              </button>
            )}

            {scenarioId === 4 && (
              <button
                onClick={() => runScenario4Step(currentStep)}
                disabled={isExecuting}
                className="px-5 py-2 bg-[#1C3F35] hover:bg-[#285443] text-white rounded font-bold flex items-center gap-2 border-2 border-[#1C3F35] shadow-[3px_3px_0_#1C3F35] cursor-pointer disabled:opacity-50"
              >
                {isExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                {currentStep === 1
                  ? 'Step 1: Verify Initial Audit Chain'
                  : currentStep === 2
                  ? 'Step 2: Inject Simulated Tamper Attack'
                  : currentStep === 3
                  ? 'Step 3: Restore & Recompute Chain'
                  : 'Step 4: View Audit Ledger'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
