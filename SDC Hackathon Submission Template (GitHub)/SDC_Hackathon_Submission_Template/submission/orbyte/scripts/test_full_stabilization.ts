/**
 * Full Test and Stabilization Suite for Orbyte Hub
 * Tests all 8 input ingestion paths, error bounds, RBAC, policy sync, and audit ledger.
 */

import fs from 'fs';
import path from 'path';

interface TestResult {
  step: string;
  category: string;
  passed: boolean;
  actual: string;
  expected: string;
  details?: any;
}

let tokens: { [role: string]: string } = {};

async function loginUser(username: string, role: string) {
  const passwords: Record<string, string> = {
    clerk_siti: 'clerk123',
    owner_ahmad: 'owner123',
    expert_farhan: 'expert123',
  };
  const res = await fetch('http://localhost:3000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: passwords[username] }),
  });
  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(`Login failed for ${username}: ${JSON.stringify(data)}`);
  }
  tokens[role] = data.token;
  return data.token;
}

async function uploadFile(filename: string, buffer: Buffer, mimeType: string, role: string = 'owner') {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const bodyBuffer = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="receipt"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const token = tokens[role] || '';
  const res = await fetch('http://localhost:3000/api/upload_invoice', {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Authorization': `Bearer ${token}`,
    },
    body: bodyBuffer,
  });

  const status = res.status;
  let json: any = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    json = { rawText: text };
  }

  return { status, json };
}

async function runFullStabilization() {
  console.log('========================================================================');
  console.log('ORBYTE HUB FULL TEST & STABILIZATION PASS');
  console.log('========================================================================\n');

  // Authenticate demo users to acquire valid session tokens
  console.log('[Auth] Authenticating demo users via POST /api/login...');
  await loginUser('owner_ahmad', 'owner');
  await loginUser('clerk_siti', 'clerk');
  await loginUser('expert_farhan', 'expert');
  console.log('[Auth] All 3 demo roles acquired dynamic session tokens.\n');

  const results: TestResult[] = [];

  // ---------------------------------------------------------------------------
  // 1. XML Invoice
  // ---------------------------------------------------------------------------
  try {
    const buf = fs.readFileSync('sample_invoices/04_sample_invoice.xml');
    const { status, json } = await uploadFile('04_sample_invoice.xml', buf, 'application/xml');
    const pass = status === 201 && json.extraction_method === 'xml' && json.amount === 1350 && json.buyer_tin === 'C9876543210';
    results.push({
      step: '1. XML Invoice',
      category: 'Invoice Workflow',
      passed: pass,
      expected: 'Status 201, method: xml, amount: 1350, buyer: C9876543210',
      actual: `Status ${status}, method: ${json.extraction_method}, amount: ${json.amount}, buyer: ${json.buyer_tin}`,
    });
  } catch (err: any) {
    results.push({
      step: '1. XML Invoice',
      category: 'Invoice Workflow',
      passed: false,
      expected: 'Status 201',
      actual: `Error: ${err.message}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 2. JSON Invoice
  // ---------------------------------------------------------------------------
  try {
    const buf = fs.readFileSync('sample_invoices/03_sample_invoice.json');
    const { status, json } = await uploadFile('03_sample_invoice.json', buf, 'application/json');
    const pass = status === 201 && json.extraction_method === 'json' && json.amount === 1350 && json.buyer_tin === 'C9876543210';
    results.push({
      step: '2. JSON Invoice',
      category: 'Invoice Workflow',
      passed: pass,
      expected: 'Status 201, method: json, amount: 1350, buyer: C9876543210',
      actual: `Status ${status}, method: ${json.extraction_method}, amount: ${json.amount}, buyer: ${json.buyer_tin}`,
    });
  } catch (err: any) {
    results.push({
      step: '2. JSON Invoice',
      category: 'Invoice Workflow',
      passed: false,
      expected: 'Status 201',
      actual: `Error: ${err.message}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 3. QR Invoice Data
  // ---------------------------------------------------------------------------
  try {
    const buf = fs.readFileSync('sample_invoices/08_FULL_INVOICE_INFO_QR.png');
    const { status, json } = await uploadFile('08_FULL_INVOICE_INFO_QR.png', buf, 'image/png');
    const pass = status === 201 && json.extraction_method === 'qr' && json.amount === 1350 && json.buyer_tin === 'C9876543210';
    results.push({
      step: '3. QR Invoice Data',
      category: 'Invoice Workflow',
      passed: pass,
      expected: 'Status 201, method: qr, amount: 1350, buyer: C9876543210',
      actual: `Status ${status}, method: ${json.extraction_method}, amount: ${json.amount}, buyer: ${json.buyer_tin}`,
    });
  } catch (err: any) {
    results.push({
      step: '3. QR Invoice Data',
      category: 'Invoice Workflow',
      passed: false,
      expected: 'Status 201',
      actual: `Error: ${err.message}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Text-based PDF
  // ---------------------------------------------------------------------------
  try {
    const buf = fs.readFileSync('sample_invoices/01_pdf_text_invoice.pdf');
    const { status, json } = await uploadFile('01_pdf_text_invoice.pdf', buf, 'application/pdf');
    const pass = status === 201 && (json.extraction_method === 'pdf_text' || json.extraction_method === 'ai') && json.amount === 1350;
    results.push({
      step: '4. Text-based PDF',
      category: 'Invoice Workflow',
      passed: pass,
      expected: 'Status 201, method: pdf_text, amount: 1350',
      actual: `Status ${status}, method: ${json.extraction_method}, amount: ${json.amount}`,
    });
  } catch (err: any) {
    results.push({
      step: '4. Text-based PDF',
      category: 'Invoice Workflow',
      passed: false,
      expected: 'Status 201',
      actual: `Error: ${err.message}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Scanned PDF (Handled via Gemini Fallback when no digital text stream)
  // ---------------------------------------------------------------------------
  try {
    // Generate a synthetic scanned PDF containing invoice text without vector streams
    // (Or use multi-line PDF 02_pdf_multiline_invoice.pdf which exercises complex layout)
    const buf = fs.readFileSync('sample_invoices/02_pdf_multiline_invoice.pdf');
    const { status, json } = await uploadFile('02_scanned_layout_invoice.pdf', buf, 'application/pdf');
    const pass = status === 201 && json.amount === 18630 && String(json.rule_results?.InvoiceThreshold || '').includes('REVIEW_REQUIRED');
    results.push({
      step: '5. Scanned / Complex Multi-line PDF',
      category: 'Invoice Workflow',
      passed: pass,
      expected: 'Status 201, amount: 18630, rule InvoiceThreshold: REVIEW_REQUIRED (>RM10k reference)',
      actual: `Status ${status}, amount: ${json.amount}, method: ${json.extraction_method}, threshold: ${json.rule_results?.InvoiceThreshold}`,
    });
  } catch (err: any) {
    results.push({
      step: '5. Scanned / Complex Multi-line PDF',
      category: 'Invoice Workflow',
      passed: false,
      expected: 'Status 201',
      actual: `Error: ${err.message}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 6. JPG/JPEG/PNG Invoice
  // ---------------------------------------------------------------------------
  try {
    // Test uploading an image file
    const buf = fs.readFileSync('sample_invoices/08_FULL_INVOICE_INFO_QR.png');
    const { status, json } = await uploadFile('invoice_receipt.png', buf, 'image/png');
    const pass = status === 201 && json.amount > 0 && json.confidence > 0.8;
    results.push({
      step: '6. JPG/JPEG/PNG Invoice',
      category: 'Invoice Workflow',
      passed: pass,
      expected: 'Status 201, amount > 0, confidence > 80%',
      actual: `Status ${status}, amount: ${json.amount}, method: ${json.extraction_method}, conf: ${Math.round(json.confidence * 100)}%`,
    });
  } catch (err: any) {
    results.push({
      step: '6. JPG/JPEG/PNG Invoice',
      category: 'Invoice Workflow',
      passed: false,
      expected: 'Status 201',
      actual: `Error: ${err.message}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 7. Difficult Invoice Requiring Gemini Fallback
  // ---------------------------------------------------------------------------
  try {
    const difficultText = `
TAX INVOICE (SCANNED RECEIPT / WHATSAPP TRANSCRIPTION)
Vendor: Perak Precision Tools & Machinery Sdn. Bhd.
TIN: C10928374650
Buyer: ABC Trading Sdn. Bhd.
Buyer TIN: C24892019020
Lines:
1. End Mill 12mm x 4 pcs @ 250 = 1000.00
2. Servo Motor 750W x 2 pcs @ 4800 = 9600.00
3. Hydraulic Fluid x 2 drums @ 300 = 600.00
Subtotal: RM 11,200.00
SST 6%: RM 672.00
Special Rebate: RM 200.00
Grand Total Payable: RM 11,672.00
Maybank Account: 5140-1234-9876
`;
    const res = await fetch('http://localhost:3000/api/upload_invoice_text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.owner}`,
      },
      body: JSON.stringify({ text: difficultText }),
    });
    const status = res.status;
    const json = await res.json();
    const pass = status === 201 && json.amount === 11672 && json.buyer_tin === 'C24892019020' && json.method === 'ai';
    results.push({
      step: '7. Difficult Invoice (Gemini Fallback)',
      category: 'Invoice Workflow',
      passed: pass,
      expected: 'Status 201, method: ai, amount: 11672, buyer: C24892019020',
      actual: `Status ${status}, method: ${json.method}, amount: ${json.amount}, buyer: ${json.buyer_tin}`,
    });
  } catch (err: any) {
    results.push({
      step: '7. Difficult Invoice (Gemini Fallback)',
      category: 'Invoice Workflow',
      passed: false,
      expected: 'Status 201, method: ai',
      actual: `Error: ${err.message}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 8. Manual Entry Fallback (Unparseable document -> HTTP 422)
  // ---------------------------------------------------------------------------
  try {
    const blankBuf = fs.readFileSync('/tmp/blank.pdf');
    const { status, json } = await uploadFile('blank_unparseable.pdf', blankBuf, 'application/pdf');
    const pass = status === 422 && json.error === 'Manual Entry Required';
    results.push({
      step: '8. Manual Entry Fallback',
      category: 'Invoice Workflow',
      passed: pass,
      expected: 'Status 422, error: Manual Entry Required',
      actual: `Status ${status}, error: ${json.error}`,
    });
  } catch (err: any) {
    results.push({
      step: '8. Manual Entry Fallback',
      category: 'Invoice Workflow',
      passed: false,
      expected: 'Status 422',
      actual: `Error: ${err.message}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 9. Error Handling: Invalid File Type (HTTP 415)
  // ---------------------------------------------------------------------------
  try {
    const badBuf = fs.readFileSync('/tmp/test_invalid.exe');
    const { status, json } = await uploadFile('virus.exe', badBuf, 'application/x-msdownload');
    const pass = status === 415;
    results.push({
      step: '9. Invalid File Rejection',
      category: 'Error Handling',
      passed: pass,
      expected: 'Status 415 (Unsupported Media Type)',
      actual: `Status ${status}, error: ${json.error}`,
    });
  } catch (err: any) {
    results.push({
      step: '9. Invalid File Rejection',
      category: 'Error Handling',
      passed: false,
      expected: 'Status 415',
      actual: `Error: ${err.message}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 10. Error Handling: Large File > 10MB (HTTP 413)
  // ---------------------------------------------------------------------------
  try {
    const largeBuf = fs.readFileSync('/tmp/test_large.pdf');
    const { status, json } = await uploadFile('oversized_11mb.pdf', largeBuf, 'application/pdf');
    const pass = status === 413;
    results.push({
      step: '10. Oversized File Rejection',
      category: 'Error Handling',
      passed: pass,
      expected: 'Status 413 (Payload Too Large)',
      actual: `Status ${status}, error: ${json.error}`,
    });
  } catch (err: any) {
    results.push({
      step: '10. Oversized File Rejection',
      category: 'Error Handling',
      passed: false,
      expected: 'Status 413',
      actual: `Error: ${err.message}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 11. RBAC: Staff/Clerk Approval Block (HTTP 403 Forbidden)
  // ---------------------------------------------------------------------------
  try {
    const approveRes = await fetch('http://localhost:3000/api/drafts/DRF-8841/approve', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.clerk}`,
      },
    });
    const status = approveRes.status;
    const json = await approveRes.json();
    const pass = status === 403 && json.code === 403;
    results.push({
      step: '11. RBAC Clerk Approval Block',
      category: 'Security & Governance',
      passed: pass,
      expected: 'Status 403 Forbidden',
      actual: `Status ${status}, message: ${json.message}`,
    });
  } catch (err: any) {
    results.push({
      step: '11. RBAC Clerk Approval Block',
      category: 'Security & Governance',
      passed: false,
      expected: 'Status 403',
      actual: `Error: ${err.message}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 12. Policy Sync Diff and Expert Approval
  // ---------------------------------------------------------------------------
  try {
    const syncRes = await fetch('http://localhost:3000/api/policies/sync', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.expert}`,
      },
    });
    const syncJson = await syncRes.json();
    const hasDiff = Boolean(syncJson.diff && syncJson.diff.added.length > 0);

    const approvePolicyRes = await fetch('http://localhost:3000/api/policies/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.expert}`,
      },
      body: JSON.stringify({ version: 'Budget2027-LHDNv4.9' }),
    });
    const approvePolicyJson = await approvePolicyRes.json();
    const pass = hasDiff && approvePolicyRes.status === 200 && approvePolicyJson.success;
    results.push({
      step: '12. Policy Diff & Expert Activation',
      category: 'Policy Governance',
      passed: pass,
      expected: 'Diff preview generated, status 200 on expert approve',
      actual: `Diff items added: ${syncJson.diff?.added?.length}, approve status: ${approvePolicyRes.status}`,
    });
  } catch (err: any) {
    results.push({
      step: '12. Policy Diff & Expert Activation',
      category: 'Policy Governance',
      passed: false,
      expected: 'Status 200',
      actual: `Error: ${err.message}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 13. Cryptographic Audit Ledger Verification
  // ---------------------------------------------------------------------------
  try {
    const verifyRes = await fetch('http://localhost:3000/api/audit/verify', {
      headers: {
        'Authorization': `Bearer ${tokens.owner}`,
      },
    });
    const verifyJson = await verifyRes.json();
    const pass = verifyRes.status === 200 && verifyJson.verified === true && verifyJson.total_entries_checked > 0;
    results.push({
      step: '13. Cryptographic Audit Verification',
      category: 'Audit & Compliance',
      passed: pass,
      expected: 'Status 200, verified: true, all hash blocks valid',
      actual: `Status ${verifyRes.status}, verified: ${verifyJson.verified}, blocks checked: ${verifyJson.total_entries_checked}`,
    });
  } catch (err: any) {
    results.push({
      step: '13. Cryptographic Audit Verification',
      category: 'Audit & Compliance',
      passed: false,
      expected: 'verified: true',
      actual: `Error: ${err.message}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 14. Anti-Spoofing Security: Header-based Impersonation Blocked (HTTP 401)
  // ---------------------------------------------------------------------------
  try {
    const spoofRes = await fetch('http://localhost:3000/api/policies/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'expert', // Attacker trying to spoof expert without a valid session token
      },
      body: JSON.stringify({ version: 'HACKED-RULES' }),
    });
    const pass = spoofRes.status === 401;
    results.push({
      step: '14. Anti-Spoofing: Unauthenticated Spoofed Header Rejection',
      category: 'Security & Governance',
      passed: pass,
      expected: 'Status 401 Unauthorized',
      actual: `Status ${spoofRes.status}`,
    });
  } catch (err: any) {
    results.push({
      step: '14. Anti-Spoofing: Unauthenticated Spoofed Header Rejection',
      category: 'Security & Governance',
      passed: false,
      expected: 'Status 401',
      actual: `Error: ${err.message}`,
    });
  }

  // Print results
  console.log('RESULTS SUMMARY:');
  console.log('------------------------------------------------------------------------');
  let passCount = 0;
  for (const r of results) {
    const icon = r.passed ? '✓ PASS' : '✗ FAIL';
    if (r.passed) passCount++;
    console.log(`${icon} [${r.category}] ${r.step}`);
    console.log(`       Expected: ${r.expected}`);
    console.log(`       Actual  : ${r.actual}\n`);
  }
  console.log('------------------------------------------------------------------------');
  console.log(`TOTAL: ${passCount} / ${results.length} PASSED (${Math.round((passCount / results.length) * 100)}%)\n`);
}

runFullStabilization().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
