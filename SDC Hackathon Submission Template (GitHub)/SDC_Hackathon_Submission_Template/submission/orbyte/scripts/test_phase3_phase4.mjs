import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 43000 + (process.pid % 1000);
const baseUrl = `http://127.0.0.1:${port}`;

test('Phase 3/4 API integration and regression checks', async () => {
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
        // server still starting
      }
      await delay(250);
    }
    assert.equal(healthy, true, `Server did not start in time. Output:\n${serverOutput}`);

    // Missing credentials and role-only login must never create a session.
    const roleOnly = await jsonRequest('/api/login', { role: 'owner' });
    assert.equal(roleOnly.status, 401);
    const missingPassword = await jsonRequest('/api/login', { username: 'owner_ahmad' });
    assert.equal(missingPassword.status, 401);
    const wrongPassword = await jsonRequest('/api/login', { username: 'owner_ahmad', password: 'wrong-password' });
    assert.equal(wrongPassword.status, 401);

    // An unauthenticated text intake must be rejected before extraction/input validation.
    const unauthText = await jsonRequest('/api/upload_invoice_text', { text: '' });
    assert.equal(unauthText.status, 401);

    const login = await jsonRequest('/api/login', { username: 'owner_ahmad', password: 'owner123' });
    assert.equal(login.status, 200);
    const loginData = await login.json();
    assert.ok(loginData.token);
    const auth = { Authorization: `Bearer ${loginData.token}` };

    // The e-Invoice radar must use the current official headline threshold reference (RM3M),
    // and must not mark a business as exempt solely from turnover.
    const radarResponse = await jsonRequest('/api/radar/update', { monthlyRevenue: 250000 }, auth);
    assert.equal(radarResponse.status, 200);
    const radarResult = await radarResponse.json();
    assert.equal(radarResult.threshold, 3000000);
    assert.equal(radarResult.status, 'CHECK_REQUIRED', 'At the threshold reference, the user must check official conditions');

    // Text intake must parse source text and disclose the confidence basis, not trust client-supplied fields.
    const textDraftResponse = await jsonRequest('/api/upload_invoice_text', {
      text: 'Total Payable: RM 120.00', amount: 99999, confidence: 1, buyerTIN: 'CLIENT-SPOOFED-TIN',
    }, auth);
    assert.equal(textDraftResponse.status, 201);
    const textDraft = await textDraftResponse.json();
    assert.equal(textDraft.amount, 120);
    assert.equal(textDraft.confidenceBasis, 'parser-heuristic');
    assert.notEqual(textDraft.buyerTIN, 'CLIENT-SPOOFED-TIN');
    assert.equal(textDraft.status, 'Review Required');

    // Protected policy reads require a valid session and never claim live official synchronization.
    assert.equal((await request('/api/policy/active')).status, 401);
    const activePolicyResponse = await request('/api/policy/active', { headers: auth });
    assert.equal(activePolicyResponse.status, 200);
    const activePolicy = await activePolicyResponse.json();
    assert.equal(activePolicy.mode, 'demo');
    assert.equal(activePolicy.liveSync, false);
    assert.equal(activePolicy.isStale, true);

    const clerkLogin = await jsonRequest('/api/login', { username: 'clerk_siti', password: 'clerk123' });
    assert.equal(clerkLogin.status, 200);
    const clerkData = await clerkLogin.json();
    const clerkAuth = { Authorization: `Bearer ${clerkData.token}` };
    const clerkReplay = await jsonRequest('/api/replay/run', {}, clerkAuth);
    assert.equal(clerkReplay.status, 403, 'A clerk must not execute privileged policy replay');
    const clerkInvoiceApproval = await jsonRequest('/api/drafts/DRF-8840/approve', {}, { ...clerkAuth, 'x-user-role': 'owner' });
    assert.equal(clerkInvoiceApproval.status, 403, 'A clerk must not give final invoice approval');
    const expertLogin = await jsonRequest('/api/login', { username: 'expert_farhan', password: 'expert123' });
    assert.equal(expertLogin.status, 200);
    const expertData = await expertLogin.json();
    const expertAuth = { Authorization: `Bearer ${expertData.token}` };
    const expertInvoiceApproval = await jsonRequest('/api/drafts/DRF-8840/approve', {}, expertAuth);
    assert.equal(expertInvoiceApproval.status, 403, 'An expert may manage policy but may not give final invoice approval');
    const invalidManualReview = await jsonRequest('/api/drafts/DRF-8841/confirm', { fields: { amount: -1, buyerName: 'Farhans Bistro', date: '2026-10-20' } }, auth);
    assert.equal(invalidManualReview.status, 400, 'Manual review must reject invalid monetary values');
    const manualReview = await jsonRequest('/api/drafts/DRF-8841/confirm', { fields: { amount: 4500, buyerTIN: 'C2891928301', buyerName: 'Farhans Bistro Sdn. Bhd.', date: '2026-10-20' } }, auth);
    assert.equal(manualReview.status, 200);
    const reviewedDraft = (await manualReview.json()).updatedDraft;
    assert.equal(reviewedDraft.confidence, 0.87, 'Human review must not falsify the original extraction confidence');
    assert.equal(reviewedDraft.ruleResults.find((rule) => rule.rule_id === 'OCRConfidence')?.status, 'PASS');
    assert.match(reviewedDraft.ruleResults.find((rule) => rule.rule_id === 'OCRConfidence')?.explanation || '', /Original machine-extraction confidence remains 87%/);

    const ownerApproval = await jsonRequest('/api/drafts/DRF-8840/approve', {}, auth);
    assert.equal(ownerApproval.status, 200, 'Owner can approve a reviewed draft that is pending approval');
    assert.equal((await ownerApproval.json()).success, true);

    // A file with a valid extension but invalid content must be rejected without OCR.
    const form = new FormData();
    form.append('receipt', new Blob(['not actually a PDF'], { type: 'application/pdf' }), 'fake.pdf');
    const fakePdf = await request('/api/invoices/upload', { method: 'POST', headers: auth, body: form });
    assert.equal(fakePdf.status, 415);

    // The policy preview/approval flow must clearly state that it uses local demo data.
    const approveBeforePreview = await jsonRequest('/api/policy/approve', { version: 'Budget2027-LHDNv4.9' }, expertAuth);
    assert.equal(approveBeforePreview.status, 409);
    const sync = await jsonRequest('/api/policy/sync', {}, auth);
    assert.equal(sync.status, 200);
    const syncData = await sync.json();
    assert.equal(syncData.mode, 'demo');
    assert.equal(syncData.liveSync, false);
    assert.equal(syncData.sourceType, 'local-fixture');
    assert.match(syncData.disclaimer, /No official LHDN endpoint was contacted/i);

    const wrongVersion = await jsonRequest('/api/policy/approve', { version: 'UNEXPECTED-VERSION' }, expertAuth);
    assert.equal(wrongVersion.status, 409);
    const approve = await jsonRequest('/api/policy/approve', { version: syncData.candidateVersion }, expertAuth);
    assert.equal(approve.status, 200);
    const approvedData = await approve.json();
    assert.equal(approvedData.mode, 'demo');
    assert.equal(approvedData.liveSync, false);
    const state = await request('/api/state');
    assert.equal(state.status, 200);
    const stateData = await state.json();
    assert.equal(stateData.isStale, true, 'A local demo activation must not clear the live-sync staleness flag');

    // Audit verification must check stored prev_hash linkage and detect tampering.
    const initialAudit = await request('/api/audit/verify', { headers: auth });
    assert.equal(initialAudit.status, 200);
    assert.equal((await initialAudit.json()).valid, true);

    const tamper = await jsonRequest('/api/audit/tamper', { index: 1 }, auth);
    assert.equal(tamper.status, 200);
    const invalidAudit = await request('/api/audit/verify', { headers: auth });
    assert.equal(invalidAudit.status, 409);
    const invalidAuditData = await invalidAudit.json();
    assert.equal(invalidAuditData.valid, false);
    assert.equal(invalidAuditData.first_bad_index, 1);

    const restore = await jsonRequest('/api/audit/restore', {}, auth);
    assert.equal(restore.status, 200);
    const restoredAudit = await request('/api/audit/verify', { headers: auth });
    assert.equal(restoredAudit.status, 200);
    assert.equal((await restoredAudit.json()).valid, true);

    const idTamper = await jsonRequest('/api/audit/tamper', { index: 1, field: 'id' }, auth);
    assert.equal(idTamper.status, 200);
    const invalidIdAudit = await request('/api/audit/verify', { headers: auth });
    assert.equal(invalidIdAudit.status, 409, 'Tampering with an audit record ID must be detected');
    assert.equal((await invalidIdAudit.json()).valid, false);
    const idTamperRehash = await jsonRequest('/api/audit/restore', {}, auth);
    assert.equal(idTamperRehash.status, 200, 'Demo rehash should restore chain consistency, not original identity values');
    const rehashedAudit = await request('/api/audit/verify', { headers: auth });
    assert.equal(rehashedAudit.status, 200);
    const previousHashTamper = await jsonRequest('/api/audit/tamper', { index: 1, field: 'prev_hash' }, auth);
    assert.equal(previousHashTamper.status, 200);
    assert.equal((await request('/api/audit/verify', { headers: auth })).status, 409, 'Changing a stored previous-hash link must be detected');
    assert.equal((await jsonRequest('/api/audit/restore', {}, auth)).status, 200);
    assert.equal((await request('/api/audit/verify', { headers: auth })).status, 200);

    // Replay must explicitly mark synthetic inputs and compute summary fields from results.
    const replay = await jsonRequest('/api/replay/run', {}, auth);
    assert.equal(replay.status, 200);
    const replayData = await replay.json();
    assert.equal(replayData.mode, 'demo');
    assert.equal(replayData.dataMode, 'synthetic');
    assert.equal(replayData.summary.totalCases, replayData.cases.length);
    assert.equal(replayData.cases.length, 50);
    assert.ok(replayData.cases.every((item) => item.dataMode === 'synthetic'));
    const computedPassRate = Math.round(((replayData.summary.totalCases - replayData.summary.regressionsCount) / replayData.summary.totalCases) * 100);
    assert.equal(replayData.summary.passRate, `${computedPassRate}%`);
    assert.ok(replayData.cases.some((item) => item.taxSavingsMYR === 0));
    assert.ok(replayData.cases.some((item) => item.taxSavingsMYR > 0));

    // Rule-level regression suite must be authenticated and its security/audit/policy checks must execute.
    const unauthTests = await request('/api/tests/run', { method: 'POST' });
    assert.equal(unauthTests.status, 401);
    const suite = await request('/api/tests/run', { method: 'POST', headers: auth });
    assert.equal(suite.status, 200);
    const suiteData = await suite.json();
    const byId = new Map(suiteData.results.map((result) => [result.id, result]));
    for (const id of ['T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'T13', 'T14']) {
      assert.equal(byId.get(id)?.passed, true, `${id} should pass. Actual: ${byId.get(id)?.actual}`);
    }
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
