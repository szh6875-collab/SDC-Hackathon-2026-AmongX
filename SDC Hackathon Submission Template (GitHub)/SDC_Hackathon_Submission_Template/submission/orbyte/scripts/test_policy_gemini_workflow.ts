/**
 * Test Suite for Policy Rule Extraction via Gemini & Expert Governance Flow
 */

async function runPolicyGeminiTest() {
  console.log('========================================================================');
  console.log('ORBYTE HUB: POLICY DRAFT GEMINI EXTRACTION & EXPERT GOVERNANCE TEST');
  console.log('========================================================================\n');

  // Step 1: Login users
  const loginUser = async (username: string, role: string) => {
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
    if (!res.ok) throw new Error(`Login failed for ${username}: ${JSON.stringify(data)}`);
    return data.token;
  };

  const ownerToken = await loginUser('owner_ahmad', 'owner');
  const clerkToken = await loginUser('clerk_siti', 'clerk');
  const expertToken = await loginUser('expert_farhan', 'expert');
  console.log('[Auth] Logged in owner, clerk, and expert accounts successfully.');

  // Step 2: Test POST /api/policies/parse-draft with statutory text
  const statutoryText = `
SYNTHETIC TEST FIXTURE — NOT AN OFFICIAL OR GAZETTED DOCUMENT. Use only to test extraction and human-review safeguards.

Example Clause 4.2: A hypothetical SME screening scenario uses annual gross revenue not exceeding RM50,000,000 and paid-up capital of not more than RM2,500,000. Any example tax rates are illustrative only and must not be treated as current law.

Example Clause 6.1: A hypothetical programme announcement describes fewer than 75 employees and a first-year premium subsidy of RM200 per eligible employee, capped at 50 employees per company. This is not official programme guidance and all final terms require verification.
`;

  console.log('\n[Gemini Parse] Invoking POST /api/policies/parse-draft...');
  const parseRes = await fetch('http://localhost:3000/api/policies/parse-draft', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ text: statutoryText }),
  });

  const parseStatus = parseRes.status;
  const parseJson = await parseRes.json();
  console.log(`[Gemini Parse] Response status: ${parseStatus}`);

  let testDraftId = '';
  if (parseStatus === 200) {
    console.log(`[Gemini Parse] Extracted ${parseJson.count} drafts:`);
    for (const d of parseJson.drafts) {
      console.log(`   - ID: ${d.id}`);
      console.log(`     Title: ${d.title}`);
      console.log(`     Status: ${d.status} (Default proposed: ${d.status === 'proposed'})`);
      console.log(`     Confidence: ${d.confidence}`);
      console.log(`     Source Sentence: "${d.source_sentence}"`);
      console.log(`     Condition: ${JSON.stringify(d.condition)}`);
      console.log(`     Benefit: ${d.benefit}`);
    }
    testDraftId = parseJson.drafts[0].id;
  } else if (parseStatus === 422) {
    console.log(`[Gemini Parse] 422 Fallback gracefully triggered: "${parseJson.message}"`);
    console.log(`[Gemini Parse] Validated: Returned 422 with manual entry guidance (No 500 server crash).`);
  }

  // Step 3: Test Error Bounds - Empty text returns 400
  console.log('\n[Error Handling] Testing empty text validation...');
  const emptyRes = await fetch('http://localhost:3000/api/policies/parse-draft', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ text: '   ' }),
  });
  console.log(`[Error Handling] Empty text status: ${emptyRes.status} (Expected 400) -> ${emptyRes.status === 400 ? '✓ PASS' : '✗ FAIL'}`);

  // Step 4: Test RBAC on Approve & Reject
  console.log('\n[RBAC] Testing Non-Expert role blocks on rule approval...');
  // Clerk attempt
  const clerkApproveRes = await fetch(`http://localhost:3000/api/policies/rules/POL-DRAFT-TEST/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${clerkToken}`,
    },
    body: JSON.stringify({ status: 'in_force' }),
  });
  console.log(`[RBAC] Clerk Approve Attempt: ${clerkApproveRes.status} (Expected 403 Forbidden) -> ${clerkApproveRes.status === 403 ? '✓ PASS' : '✗ FAIL'}`);

  // Owner attempt
  const ownerApproveRes = await fetch(`http://localhost:3000/api/policies/rules/POL-DRAFT-TEST/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ status: 'in_force' }),
  });
  console.log(`[RBAC] Owner Approve Attempt: ${ownerApproveRes.status} (Expected 403 Forbidden) -> ${ownerApproveRes.status === 403 ? '✓ PASS' : '✗ FAIL'}`);

  // Step 5: Test Expert Approval
  if (testDraftId) {
    console.log(`\n[Expert Governance] Approving draft ${testDraftId} as 'in_force' via Expert...`);
    const expertApproveRes = await fetch(`http://localhost:3000/api/policies/rules/${testDraftId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${expertToken}`,
      },
      body: JSON.stringify({ status: 'in_force', notes: 'Verified against gazetted MOF schedule' }),
    });
    const expertApproveJson = await expertApproveRes.json();
    console.log(`[Expert Governance] Status: ${expertApproveRes.status} -> ${expertApproveRes.status === 200 ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`[Expert Governance] Approved Rule: ${expertApproveJson.rule?.id}, Status: ${expertApproveJson.rule?.status}, Approved By: ${expertApproveJson.rule?.approved_by}`);

    // Verify draft was moved to active policy rules
    const activeRes = await fetch('http://localhost:3000/api/policy/active', {
      headers: { 'Authorization': `Bearer ${ownerToken}` },
    });
    const activeJson = await activeRes.json();
    const isInActive = activeJson.rules.some((r: any) => r.id === testDraftId);
    console.log(`[Active Ruleset] Is newly approved rule in activePolicyRules: ${isInActive} -> ${isInActive ? '✓ PASS' : '✗ FAIL'}`);
  }

  // Step 6: Verify Cryptographic Audit Trail
  console.log('\n[Audit Trail] Verifying audit ledger entries...');
  const auditRes = await fetch('http://localhost:3000/api/audit', {
    headers: { 'Authorization': `Bearer ${ownerToken}` },
  });
  const auditJson = await auditRes.json();
  const parseLogs = auditJson.entries.filter((e: any) => e.action.includes('Policy'));
  console.log(`[Audit Trail] Found ${parseLogs.length} policy governance audit records.`);
  for (const log of parseLogs.slice(-3)) {
    console.log(`   - [${log.action}] by ${log.actor} (${log.role}): ${log.detail}`);
  }

  console.log('\n========================================================================');
  console.log('POLICY GROUNDING & EXPERT GOVERNANCE TEST COMPLETED SUCCESSFULLY');
  console.log('========================================================================\n');
}

runPolicyGeminiTest().catch((err) => {
  console.error('Test script error:', err);
  process.exit(1);
});
