import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 45000 + (process.pid % 1000);
const baseUrl = `http://127.0.0.1:${port}`;

test('e-Invoice complete applicable structure, strict company isolation, and genuine XLSM export', async () => {
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

    // 1. Authenticate as SME Owner
    const loginRes = await jsonRequest('/api/login', { username: 'owner_ahmad', password: 'owner123' });
    assert.equal(loginRes.status, 200, 'Owner login must succeed');
    const loginData = await loginRes.json();
    const token = loginData.token;
    assert.ok(token, 'Token must be present in login response');

    // Exports must not return login pages or files to unauthenticated callers.
    const unauthCsv = await request('/api/audit/export?format=csv&company_id=COMP-A');
    assert.equal(unauthCsv.status, 401, 'Audit CSV export must require a valid session token');
    const noCompanyCsv = await request('/api/audit/export?format=csv', { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(noCompanyCsv.status, 400, 'Activity export must require an explicit company scope');

    // 2. Strict company isolation test
    const resA = await request('/api/drafts?company_id=COMP-A', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(resA.status, 200);
    const draftsA = await resA.json();
    assert.ok(Array.isArray(draftsA));
    assert.ok(draftsA.length > 0, 'COMP-A must have seeded drafts');
    for (const d of draftsA) {
      assert.equal(d.company_id, 'COMP-A', `Draft ${d.draft_id} must have company_id COMP-A`);
    }

    const resB = await request('/api/drafts?company_id=COMP-B', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(resB.status, 200);
    const draftsB = await resB.json();
    for (const d of draftsB) {
      assert.equal(d.company_id, 'COMP-B', `Draft ${d.draft_id} must have company_id COMP-B`);
    }

    // COMP-C has no drafts initially - should return empty array, never mix with COMP-A
    const resC = await request('/api/drafts?company_id=COMP-C', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(resC.status, 200);
    const draftsC = await resC.json();
    assert.equal(draftsC.length, 0, 'COMP-C must have 0 drafts and never leak COMP-A data');

    // 3. Genuine .xlsm export validation
    const excelRes = await request('/api/drafts/DRF-0125/export-excel?company_id=COMP-A', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(excelRes.status, 200, 'Export-excel endpoint should succeed');
    assert.equal(
      excelRes.headers.get('content-type'),
      'application/vnd.ms-excel.sheet.macroEnabled.12',
      'Content-type must be Excel Macro-Enabled Workbook'
    );
    const disposition = excelRes.headers.get('content-disposition');
    assert.ok(disposition.includes('.xlsm'), 'Disposition must specify .xlsm file');

    const crossCompanyInvoice = await request('/api/drafts/DRF-0125/export-excel?company_id=COMP-B', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(crossCompanyInvoice.status, 403, 'Invoice export must reject a different company scope');

    const sourceWithoutCompany = await request('/api/drafts/DRF-0125/file?download=true', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(sourceWithoutCompany.status, 400, 'Source-file download must require an explicit company scope');
    const crossCompanySource = await request('/api/drafts/DRF-0125/file?download=true&company_id=COMP-B', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(crossCompanySource.status, 403, 'Source-file download must reject a different company scope');

    const arrayBuf = await excelRes.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    assert.ok(buf.length > 1000, 'Workbook buffer should be substantial');

    // Unzip and inspect OpenXML structure
    const zip = await JSZip.loadAsync(buf);
    const contentTypesXml = await zip.file('[Content_Types].xml')?.async('string');
    assert.ok(contentTypesXml, '[Content_Types].xml must exist in OpenXML package');
    assert.ok(
      contentTypesXml.includes('application/vnd.ms-excel.sheet.macroEnabled.main+xml'),
      'Package must declare macroEnabled.main+xml content type for valid .xlsm'
    );

    // Verify workbook has all 7 structured sheets
    const workbookXml = await zip.file('xl/workbook.xml')?.async('string');
    assert.ok(workbookXml, 'xl/workbook.xml must exist');
    assert.ok(workbookXml.includes('Invoice Summary'), 'Must contain Invoice Summary sheet');
    assert.ok(workbookXml.includes('Supplier &amp; Buyer') || workbookXml.includes('Supplier & Buyer'), 'Must contain Supplier & Buyer sheet');
    assert.ok(workbookXml.includes('Invoice Details'), 'Must contain Invoice Details sheet');
    assert.ok(workbookXml.includes('Line Items'), 'Must contain Line Items sheet');
    assert.ok(workbookXml.includes('Tax &amp; Totals') || workbookXml.includes('Tax & Totals'), 'Must contain Tax & Totals sheet');
    assert.ok(workbookXml.includes('Payment &amp; References') || workbookXml.includes('Payment & References'), 'Must contain Payment & References sheet');
    assert.ok(workbookXml.includes('Validation &amp; Compliance') || workbookXml.includes('Validation & Compliance'), 'Must contain Validation & Compliance sheet');

    // 4. Audit ledger XLSM download
    const auditRes = await request('/api/audit/export?format=xlsm&company_id=COMP-A', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(auditRes.status, 200);
    assert.equal(
      auditRes.headers.get('content-type'),
      'application/vnd.ms-excel.sheet.macroEnabled.12'
    );
    const auditArrayBuf = await auditRes.arrayBuffer();
    const auditZip = await JSZip.loadAsync(Buffer.from(auditArrayBuf));
    const auditContentTypesXml = await auditZip.file('[Content_Types].xml')?.async('string');
    assert.ok(auditContentTypesXml.includes('application/vnd.ms-excel.sheet.macroEnabled.main+xml'));

    // 5. CSV is valid UTF-8 CSV, never an HTML/JavaScript error response.
    const csvRes = await request('/api/audit/export?format=csv&company_id=COMP-A', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(csvRes.status, 200);
    assert.match(csvRes.headers.get('content-type') || '', /text\/csv/i);
    const csvBuffer = Buffer.from(await csvRes.arrayBuffer());
    assert.ok(csvBuffer.length > 10, 'CSV output must contain records or the header');
    const csvText = csvBuffer.toString('utf8').replace(/^\uFEFF/, '');
    assert.match(csvText, /^"?Event_ID"?,/i, 'CSV output must start with the intended activity header');
    assert.doesNotMatch(csvText.slice(0, 500), /<html|window\.location|<!doctype/i, 'CSV must not contain an HTML/JavaScript response');

    console.log('✓ XLSM structure, CSV encoding, authentication, and company isolation tests passed!');
  } finally {
    if (!child.killed) {
      if (isWindows) {
        child.kill();
      } else {
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {
          child.kill();
        }
      }
    }
  }
});
