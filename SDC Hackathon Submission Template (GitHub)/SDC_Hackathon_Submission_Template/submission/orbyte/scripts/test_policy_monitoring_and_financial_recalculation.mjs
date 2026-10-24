import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 44000 + (process.pid % 1000);
const baseUrl = `http://127.0.0.1:${port}`;

test('End-to-end Policy Monitoring, AI Summarization, Financial Recalculation, and System Synchronization', async () => {
  const isWindows = process.platform === 'win32';
  const child = spawn(
    isWindows ? 'npm.cmd' : 'npm',
    ['run', 'dev', '--', '--port', String(port)],
    {
      cwd: projectRoot,
      detached: !isWindows,
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: 'test',
        GEMINI_API_KEY: '',
        GOOGLE_API_KEY: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  let serverOutput = '';
  child.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  child.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

  const request = async (pathname, options = {}) => fetch(`${baseUrl}${pathname}`, options);
  const jsonRequest = (pathname, body, headers = {}) => request(pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

  try {
    let healthy = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (child.exitCode !== null) {
        throw new Error(`Server exited before becoming healthy. Output:\n${serverOutput}`);
      }
      try {
        const response = await request('/healthz');
        if (response.ok) { healthy = true; break; }
      } catch {
        // waiting for server
      }
      await delay(250);
    }
    assert.equal(healthy, true, 'Server must start up cleanly');

    // Step 1: Login Demo Users
    const ownerLogin = await jsonRequest('/api/login', { username: 'owner_ahmad', password: 'owner123' });
    assert.equal(ownerLogin.status, 200);
    const ownerData = await ownerLogin.json();
    const ownerAuth = { Authorization: `Bearer ${ownerData.token}` };

    const clerkLogin = await jsonRequest('/api/login', { username: 'clerk_siti', password: 'clerk123' });
    const clerkData = await clerkLogin.json();
    const clerkAuth = { Authorization: `Bearer ${clerkData.token}` };

    const expertLogin = await jsonRequest('/api/login', { username: 'expert_farhan', password: 'expert123' });
    const expertData = await expertLogin.json();
    const expertAuth = { Authorization: `Bearer ${expertData.token}` };

    // Step 2: Automatic Policy Monitoring & Honest Status
    const monitorStatusRes = await request('/api/policy/monitoring/status', { headers: ownerAuth });
    assert.equal(monitorStatusRes.status, 200);
    const monitorStatus = await monitorStatusRes.json();
    assert.ok(Array.isArray(monitorStatus.monitoredSources), 'Must return monitored sources list');
    assert.equal(monitorStatus.monitoredSources.length, 3, 'Must monitor LHDN portal, SDK, and MOF Budget');
    assert.ok(monitorStatus.monitoredSources.some((s) => s.url.includes('hasil.gov.my')));
    assert.equal(monitorStatus.autoCheckEnabled, true);

    // Manual "Check for Updates" - Honest check without fake sync
    const liveCheckRes = await jsonRequest('/api/policy/monitoring/check', { triggerTestUpdate: false }, ownerAuth);
    assert.equal(liveCheckRes.status, 200);
    const liveCheck = await liveCheckRes.json();
    assert.ok(liveCheck.lastCheckedTime, 'Must track last checked time');
    // Both network success and failure are acceptable; status must be explicit and truthful.
    assert.equal(typeof liveCheck.hasError, 'boolean');
    assert.equal(typeof liveCheck.hasNetworkRestriction, 'boolean');
    assert.ok(liveCheck.monitoredSources.every((source) => ['changed', 'unchanged', 'unverifiable', 'failed', 'unavailable', 'checking', 'idle'].includes(source.lastStatus)), 'Live sync should report a recognised status');
    if (liveCheck.hasError || liveCheck.hasNetworkRestriction) {
      assert.ok(liveCheck.monitoredSources.some((source) => source.errorMessage), 'Failed checks must retain an explanatory status');
    }

    // Step 3: Trigger Detected Policy Change with AI Summarization
    const realCheckTimestamp = liveCheck.lastCheckedTime;
    const realSuccessfulRetrieval = (liveCheck.monitoredSources || []).map((source) => source.lastSuccessfulRetrieval).filter(Boolean).sort().at(-1) || null;
    const updateCheckRes = await jsonRequest('/api/policy/monitoring/check', { triggerTestUpdate: true }, ownerAuth);
    assert.equal(updateCheckRes.status, 200);
    const updateCheck = await updateCheckRes.json();
    assert.ok(updateCheck.pendingUpdate, 'Must create pending policy update on detected changes');
    assert.equal(updateCheck.pendingUpdate.status, 'pending_verification', 'Must require verification before activation');
    assert.match(updateCheck.pendingUpdate.candidateVersion, /^demo-source-review-/);
    assert.equal(updateCheck.pendingUpdate.isSimulated, true);
    assert.equal(updateCheck.pendingUpdate.importMethod, 'simulation');
    assert.equal(updateCheck.liveSyncPerformed, false, 'A simulation must not perform live sync');
    assert.equal(updateCheck.success, false, 'A simulation must not be reported as a successful live sync');
    assert.equal(updateCheck.lastCheckedTime, realCheckTimestamp, 'A simulation must not change the real check timestamp');
    const statusAfterSimulationRes = await request('/api/policy/monitoring/status', { headers: ownerAuth });
    assert.equal(statusAfterSimulationRes.status, 200);
    const statusAfterSimulation = await statusAfterSimulationRes.json();
    assert.equal(statusAfterSimulation.lastCheckedTime, realCheckTimestamp, 'A simulation must not overwrite the real monitoring timestamp');
    assert.equal(statusAfterSimulation.lastSuccessfulRetrieval, realSuccessfulRetrieval, 'A simulation must not overwrite the last real retrieval timestamp');
    assert.ok(updateCheck.pendingUpdate.aiSummary.executiveSummary, 'Must contain AI/factual summary');
    assert.ok(updateCheck.pendingUpdate.aiSummary.keyChanges.length > 0, 'Must break down key clause changes');

    // Step 4: RBAC Verification Enforcement - Clerk cannot activate rules
    const clerkActivateRes = await jsonRequest('/api/policy/verify-and-activate', { candidateVersion: updateCheck.pendingUpdate.candidateVersion }, clerkAuth);
    assert.equal(clerkActivateRes.status, 403, 'Staff/Clerk must be denied rule activation (403)');

    // Step 5: Verify and Activate Rules (Expert or Owner)
    const activateRes = await jsonRequest('/api/policy/verify-and-activate', { candidateVersion: updateCheck.pendingUpdate.candidateVersion }, expertAuth);
    assert.equal(activateRes.status, 409, 'A demo simulation must never activate live operating rules');

    // Manual import creates an attributable review record, but does not overwrite live source status or activate rules.
    const sourceBeforeImport = (await (await request('/api/policy/monitoring/status', { headers: ownerAuth })).json()).monitoredSources;
    const importRes = await jsonRequest('/api/policy/import-document', {
      sourceId: 'lhdn-portal', documentTitle: 'Test document for review', versionName: 'manual-review-test',
      documentText: 'This is a test document only. It is not an official legal instrument and must not activate any operational rules.'
    }, expertAuth);
    assert.equal(importRes.status, 200);
    const imported = await importRes.json();
    assert.equal(imported.pendingUpdate.importMethod, 'manual_import');
    assert.match(imported.message, /not independently verified/i);
    const activateManualRes = await jsonRequest('/api/policy/verify-and-activate', { candidateVersion: 'manual-review-test', notes: 'Test source review only' }, expertAuth);
    assert.equal(activateManualRes.status, 200);
    const activateManual = await activateManualRes.json();
    assert.equal(activateManual.operationalRulesChanged, false);
    assert.notEqual(activateManual.activePolicyVersion, 'manual-review-test');
    const sourceAfterImport = (await (await request('/api/policy/monitoring/status', { headers: ownerAuth })).json()).monitoredSources;
    assert.deepEqual(sourceAfterImport.map((source) => source.lastSuccessfulRetrieval), sourceBeforeImport.map((source) => source.lastSuccessfulRetrieval), 'Manual import must not overwrite live retrieval timestamps');

    // Step 6: Financial Recalculation for Active Company (ABC Trading)
    const impactRes = await request('/api/financial/impact', { headers: ownerAuth });
    assert.equal(impactRes.status, 200);
    const impact = await impactRes.json();
    assert.equal(impact.companyName, 'ABC Trading Sdn. Bhd.');
    assert.notEqual(impact.policyVersion, 'manual-review-test');
    // Deterministic tax calculation: Chargeable income RM200k, baseline 31k vs Budget 2027 29k = RM 2,000 saving
    assert.equal(impact.taxImpact.annualTaxSavingsMYR, 2000);
    assert.equal(impact.wageImpact.isExempt, false, 'Announced future wage measures must not be treated as current exemptions');
    assert.equal(impact.wageImpact.annualPayrollSavingsMYR, 0, 'No payroll saving without confirmed rules');
    assert.equal(impact.subsidyImpact.totalAnnualGrantMYR, 1600); // Indicative headline ceiling; not a confirmed entitlement
    assert.equal(impact.totals.netAnnualBenefitMYR, 0, 'Do not aggregate unconfirmed policy scenarios into a net benefit');

    // Step 7: Missing Data Identification (Test Company B with missing paidUpCapital)
    const compBImpactRes = await request('/api/financial/impact?company_id=COMP-B', { headers: ownerAuth });
    assert.equal(compBImpactRes.status, 200);
    const compBImpact = await compBImpactRes.json();
    assert.equal(compBImpact.taxImpact.status, 'MISSING_DATA', 'Must clearly identify missing capital instead of inventing values');
    assert.equal(compBImpact.taxImpact.annualTaxSavingsMYR, 0, 'Cannot invent tax savings when capital is missing');
    assert.ok(compBImpact.missingData.some((m) => m.field === 'paidUpCapital'), 'Must list missing capital in missingDataItems');

    // Step 8: Owner Notification and Recommendation
    const notifsRes = await request('/api/owner-notifications', { headers: ownerAuth });
    assert.equal(notifsRes.status, 200);
    const notifs = await notifsRes.json();
    assert.ok(Array.isArray(notifs) && notifs.length > 0, 'Must generate owner notifications on policy update');
    assert.ok(notifs[0].recommendedActions.length > 0, 'Must include actionable recommendations');

    // Step 9: Cryptographic Audit Ledger Integrity
    const auditVerifyRes = await request('/api/audit/verify', { headers: ownerAuth });
    assert.equal(auditVerifyRes.status, 200);
    const auditVerify = await auditVerifyRes.json();
    assert.equal(auditVerify.valid, true, 'Audit ledger hash chain must be mathematically intact');

    console.log('✓ All Policy Monitoring, AI Summarization, Financial Recalculation, and Synchronization tests passed!');
  } finally {
    try {
      if (!isWindows && child.pid) {
        process.kill(-child.pid, 'SIGTERM');
      } else {
        child.kill('SIGTERM');
      }
    } catch {}
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      delay(1500),
    ]);
    try {
      if (!isWindows && child.pid) {
        process.kill(-child.pid, 'SIGKILL');
      } else if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
    } catch {}
  }
});
