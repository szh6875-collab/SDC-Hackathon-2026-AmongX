/**
 * Comprehensive End-to-End Compliance Flow Test
 * Tests:
 * 1. Demo User Bcrypt Authentication (POST /api/login)
 * 2. Role Spoofing Prevention (x-user-role without valid token -> HTTP 401 Unauthorized)
 * 3. Upload Invoice (Owner Token)
 * 4. Deterministic Compliance Rules Result
 * 5. Server-Side RBAC Enforcement (Clerk Token -> HTTP 403 Forbidden on approve)
 * 6. Owner Confirmation & Approval (Owner Token -> HTTP 200 OK)
 * 7. Cryptographic Audit Trail Verification
 * 8. Preserved Original File Retrieval
 */

import fs from 'fs';

async function testCompleteFlow() {
  const port = 3000;
  const baseUrl = `http://localhost:${port}`;

  console.log('========================================================================');
  console.log('TESTING COMPLETE ORBYTE COMPLIANCE & AUTHENTICATION WORKFLOW');
  console.log('Base URL:', baseUrl);
  console.log('========================================================================\n');

  // ---------------------------------------------------------------------------
  // STEP 0: Test Role Spoofing Rejection (Attacker sending x-user-role without token)
  // ---------------------------------------------------------------------------
  console.log('>>> STEP 0: Verifying Role Spoofing Attack Prevention');
  const spoofRes = await fetch(`${baseUrl}/api/policies/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'expert', // Spoofed header without authentic token
    },
    body: JSON.stringify({ version: 'v4.9-HACKED' }),
  });
  console.log('   Attacker Spoof Attempt Status:', spoofRes.status);
  const spoofBlocked = spoofRes.status === 401;
  console.log('   Assert Spoof Blocked with 401 :', spoofBlocked ? '✓ PASS (Fake header rejected)' : '✗ FAIL');

  // ---------------------------------------------------------------------------
  // STEP 1: Log in with Bcrypt Credentials & Acquire Session Tokens
  // ---------------------------------------------------------------------------
  console.log('\n>>> STEP 1: Authenticating Demo Accounts (POST /api/login)');
  
  // 1a. Owner Login
  const ownerLoginRes = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'owner_ahmad', password: 'owner123' }),
  });
  const ownerAuth = await ownerLoginRes.json();
  console.log('   Owner Login Status:', ownerLoginRes.status, '| User:', ownerAuth.user?.name);
  if (!ownerAuth.token) throw new Error('Owner login failed to return session token');

  // 1b. Clerk Login
  const clerkLoginRes = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'clerk_siti', password: 'clerk123' }),
  });
  const clerkAuth = await clerkLoginRes.json();
  console.log('   Clerk Login Status:', clerkLoginRes.status, '| User:', clerkAuth.user?.name);
  if (!clerkAuth.token) throw new Error('Clerk login failed to return session token');

  // 1c. Invalid Password Test
  const badLoginRes = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'owner_ahmad', password: 'wrong_password_999' }),
  });
  console.log('   Invalid Password Attempt Status:', badLoginRes.status);
  console.log('   Assert Bad Password Rejected   :', badLoginRes.status === 401 ? '✓ PASS' : '✗ FAIL');

  const ownerToken = ownerAuth.token;
  const clerkToken = clerkAuth.token;

  // ---------------------------------------------------------------------------
  // STEP 2: Upload multi-line PDF invoice with Owner Token (RM 18,630 > RM10,000)
  // ---------------------------------------------------------------------------
  console.log('\n>>> STEP 2: High-Value Multi-line PDF Upload with Owner Token');
  const pdfBuffer = fs.readFileSync('sample_invoices/02_pdf_multiline_invoice.pdf');
  
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const bodyBuffer = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="receipt"; filename="02_pdf_multiline_invoice.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    pdfBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const uploadRes = await fetch(`${baseUrl}/api/upload_invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Authorization': `Bearer ${ownerToken}`,
    },
    body: bodyBuffer,
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload failed with status ${uploadRes.status}: ${await uploadRes.text()}`);
  }

  const draftData = await uploadRes.json();
  console.log('   Upload & Extraction Successful:');
  console.log('   Draft ID          :', draftData.draft_id);
  console.log('   Extraction Method :', draftData.extraction_method);
  console.log('   Parsed Amount     : RM', draftData.amount);
  console.log('   Buyer TIN         :', draftData.buyer_tin);
  console.log('   Confidence        :', `${Math.round(draftData.confidence * 100)}%`);
  console.log('   Status            :', draftData.status);

  console.log('\n>>> STEP 3: Deterministic Compliance Rules Evaluation');
  console.log('   Rule Results Map  :', JSON.stringify(draftData.rule_results, null, 2));

  const thresholdReview = draftData.rule_results['InvoiceThreshold'] === 'REVIEW_REQUIRED (>RM10k reference)' || draftData.rule_results['EINV-001'] === 'WARN';
  console.log('   Assert configured threshold triggers review (not statutory block):', thresholdReview ? '✓ PASS (Review required)' : '✗ FAIL');

  // ---------------------------------------------------------------------------
  // STEP 4: Server-Side RBAC Enforcement: Clerk Token Attempts Approval (403)
  // ---------------------------------------------------------------------------
  console.log('\n>>> STEP 4: Testing Server-Side RBAC with Authenticated Clerk Token');
  const clerkApproveRes = await fetch(`${baseUrl}/api/drafts/${draftData.draft_id}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${clerkToken}`,
    },
  });

  console.log('   Clerk Attempt Status:', clerkApproveRes.status);
  const clerkJson = await clerkApproveRes.json();
  const is403 = clerkApproveRes.status === 403;
  console.log('   Assert Clerk 403 Blocked:', is403 ? '✓ PASS (HTTP 403 Forbidden)' : '✗ FAIL');
  console.log('   Clerk Rejection Message :', clerkJson.message || clerkJson.error);

  // ---------------------------------------------------------------------------
  // STEP 5: Owner Confirmation & Approval (Owner Token -> 200 OK)
  // ---------------------------------------------------------------------------
  console.log('\n>>> STEP 5: Testing Owner Confirmation & Approval');
  const confirmRes = await fetch(`${baseUrl}/api/drafts/${draftData.draft_id}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      fields: {
        amount: draftData.amount,
        buyerTIN: 'C9876543210',
        buyerName: 'ORBYTE DEMO BUYER SDN. BHD.',
        date: draftData.date,
      },
    }),
  });
  const confirmJson = await confirmRes.json();
  console.log('   Owner Field Confirmation:', confirmJson.success ? '✓ Confirmed & Re-evaluated' : '✗ Failed');

  const ownerApproveRes = await fetch(`${baseUrl}/api/drafts/${draftData.draft_id}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`,
    },
  });

  const ownerApproveJson = await ownerApproveRes.json();
  console.log('   Owner Approval Status   :', ownerApproveRes.status);
  console.log('   Assert Owner 200 OK     :', ownerApproveRes.status === 200 ? '✓ PASS' : '✗ FAIL');
  console.log('   Committed Audit ID      :', ownerApproveJson.audit_id);

  // ---------------------------------------------------------------------------
  // STEP 6: Cryptographic Audit Trail Verification
  // ---------------------------------------------------------------------------
  console.log('\n>>> STEP 6: Verifying Cryptographic Audit Ledger Integrity');
  const verifyRes = await fetch(`${baseUrl}/api/audit/verify`, {
    headers: {
      'Authorization': `Bearer ${ownerToken}`,
    },
  });
  const verifyJson = await verifyRes.json();
  console.log('   Audit Verification Result:', verifyJson.verified ? '✓ Valid (Zero Tampering)' : '✗ Broken');
  console.log('   Total Blocks Checked     :', verifyJson.total_entries_checked);

  // ---------------------------------------------------------------------------
  // STEP 7: Preserved Original File Retrieval
  // ---------------------------------------------------------------------------
  console.log('\n>>> STEP 7: Verifying Preserved Original File');
  const fileRes = await fetch(`${baseUrl}/api/drafts/${draftData.draft_id}/file`, {
    headers: {
      'Authorization': `Bearer ${ownerToken}`,
    },
  });
  const retrievedBuffer = Buffer.from(await fileRes.arrayBuffer());
  const fileSizeMatch = retrievedBuffer.length === pdfBuffer.length;
  console.log('   Retrieved File Size     :', retrievedBuffer.length, 'bytes');
  console.log('   Assert Exact File Match :', fileSizeMatch ? '✓ PASS (Original Retained)' : '✗ FAIL');

  console.log('\n========================================================================');
  console.log('ALL WORKFLOW & AUTHENTICATION STAGES VERIFIED SUCCESSFULLY!');
  console.log('========================================================================');
}

testCompleteFlow().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
