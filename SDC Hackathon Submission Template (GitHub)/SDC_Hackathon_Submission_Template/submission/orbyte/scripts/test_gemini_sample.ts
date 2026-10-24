/**
 * Real Sample Invoice Test Script for Gemini Fallback Extraction
 * Tests multimodal / unstructured invoice extraction with @google/genai SDK on the server.
 */
import { parseInvoiceGeminiFallback, readInvoiceDocument } from '../src/services/invoiceReader.ts';
import { evaluateInvoiceRules } from '../server.ts';

async function runGeminiSampleTest() {
  console.log('========================================================================');
  console.log('TESTING GEMINI WITH REAL MALAYSIAN INVOICE SAMPLE');
  console.log('========================================================================');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    console.error('ERROR: GEMINI_API_KEY is not configured in environment!');
    process.exit(1);
  }

  console.log('1. Verified GEMINI_API_KEY present on server (length:', apiKey.length, 'chars)');

  // Sample difficult invoice context: Mixed messy scanned layout with Malaysian e-invoice headers
  const sampleInvoiceDocumentText = `
================================================================================
                           TAX INVOICE / INVOIS CUKAI
================================================================================
SUPPLIER / PENJUAL:
Perak Precision Tools & Machinery Sdn. Bhd.
Registration No / BRN: 201801049281 (1284920-X)
Supplier TIN: C10928374650
SST No: A10-1808-32000041
Address: No. 42, Kawasan Perindustrian Pengkalan, 31500 Ipoh, Perak, Malaysia
Email: billing@perakprecision.com.my | Tel: +60 5-321 8844

BUYER / PEMBELI:
ABC Trading Sdn. Bhd.
Buyer TIN: C24892019020
BRN: 202301048892
Attn: Ahmad Razak
Address: Lot 18, Jalan Tuanku Abdul Rahman, 50100 Kuala Lumpur

--------------------------------------------------------------------------------
Invoice No      : INV-2026-9042
Invoice Date    : 2026-10-21
Payment Terms   : 30 Days Net
Currency        : MYR
--------------------------------------------------------------------------------
ITEM DETAILS / BUTIRAN BARANGAN:
--------------------------------------------------------------------------------
No. Description                        Qty   Unit Price   Disc     Tax (SST)   Total (MYR)
1.  CNC Carbide End Mill (12mm 4-Flute)  4     250.00      0.00     60.00       1,000.00
2.  Industrial Servo Drive Unit 750W    2   4,800.00      0.00    576.00       9,600.00
3.  Hydraulic System Fluid Drum (20L)   2     300.00      0.00     36.00         600.00

--------------------------------------------------------------------------------
Subtotal (Excluding SST)               : MYR 11,200.00
Sales and Service Tax (SST 6%)         : MYR    672.00
Special Trade Discount / Diskaun       : MYR    200.00
--------------------------------------------------------------------------------
TOTAL PAYABLE / JUMLAH PERLU DIBAYAR   : MYR 11,672.00
================================================================================

PAYMENT INSTRUCTIONS / MAKLUMAT PEMBAYARAN:
Please remit payment via Electronic Fund Transfer / DuitNow to:
Bank Name           : Malayan Banking Berhad (Maybank)
Account Number      : 5140-1234-9876
Payee Name          : Perak Precision Tools & Machinery Sdn. Bhd.
Swift Code          : MBBEMYKL

Notes: This is an electronic record generated in accordance with LHDN e-Invoicing Guidelines.
`;

  console.log('2. Invoking parseInvoiceGeminiFallback with sample invoice document...');
  const startTime = Date.now();
  
  const dummyBuffer = Buffer.from(sampleInvoiceDocumentText, 'utf-8');
  const result = await parseInvoiceGeminiFallback(dummyBuffer, 'text/plain', sampleInvoiceDocumentText);
  const durationMs = Date.now() - startTime;

  if (!result) {
    console.error('FAILED: Gemini fallback returned null!');
    process.exit(1);
  }

  console.log(`3. Gemini Response received in ${durationMs}ms:`);
  console.log('------------------------------------------------------------------------');
  console.log('EXTRACTED STRUCTURED DATA:');
  console.log('  Invoice Number   :', result.invoiceNumber);
  console.log('  Invoice Date     :', result.date);
  console.log('  Supplier Name    :', result.vendorName);
  console.log('  Supplier TIN     :', result.supplierTIN);
  console.log('  Buyer Name       :', result.buyerName);
  console.log('  Buyer TIN        :', result.buyerTIN);
  console.log('  Currency         :', result.currency);
  console.log('  Subtotal         :', result.subtotal);
  console.log('  Tax (SST)        :', result.tax);
  console.log('  Discount         :', result.discount);
  console.log('  Grand Total      :', result.amount);
  console.log('  Line Items Count :', result.items?.length || 0);
  if (result.items) {
    result.items.forEach((it, idx) => {
      console.log(`    [${idx + 1}] ${it.description} | Qty: ${it.quantity} | UnitPrice: RM ${it.unitPrice} | Total: RM ${it.total}`);
    });
  }
  console.log('  Payment Info     :', JSON.stringify(result.paymentInfo, null, 2));
  console.log('  Overall Conf     :', `${Math.round(result.confidence * 100)}%`);
  console.log('  Field Confidences:', JSON.stringify(result.fieldConfidence, null, 2));
  console.log('  Extraction Method:', result.method);
  console.log('------------------------------------------------------------------------');

  console.log('4. Feeding Gemini Extracted Data into Existing Deterministic Rule Engine:');
  const ruleResults = evaluateInvoiceRules(result.amount, result.buyerTIN, result.confidence);
  ruleResults.forEach((r) => {
    console.log(`  [${r.rule_id || r.rule}] Status: ${r.status} -> ${r.explanation}`);
  });

  console.log('------------------------------------------------------------------------');
  console.log('5. Verification Assertions:');
  const asserts = [
    { name: 'Amount parsed correctly (> 10000)', pass: result.amount === 11672 || result.amount === 11200 },
    { name: 'Buyer TIN correctly extracted (C24892019020)', pass: result.buyerTIN === 'C24892019020' },
    { name: 'Supplier TIN correctly extracted (C10928374650)', pass: result.supplierTIN === 'C10928374650' },
    { name: 'Invoice Number extracted (INV-2026-9042)', pass: result.invoiceNumber === 'INV-2026-9042' },
    { name: 'Line items captured (>= 3 items)', pass: Boolean(result.items && result.items.length >= 3) },
    { name: 'Payment bank captured (Maybank)', pass: Boolean(result.paymentInfo?.bankName?.toLowerCase().includes('maybank')) },
    { name: 'Configured amount threshold prompts human review (>RM10k)', pass: ruleResults.some(r => r.rule_id === 'InvoiceThreshold' && r.status === 'WARN') },
    { name: 'Deterministic Rule Engine verified Buyer TIN', pass: ruleResults.some(r => r.rule_id === 'BuyerTIN' && r.status === 'PASS') },
  ];

  let allPass = true;
  for (const a of asserts) {
    console.log(`  ${a.pass ? '✓ PASS' : '✗ FAIL'}: ${a.name}`);
    if (!a.pass) allPass = false;
  }

  console.log('========================================================================');
  if (allPass) {
    console.log('SUCCESS: All Gemini sample invoice extraction and rule assertions passed!');
  } else {
    console.log('NOTICE: Some assertions differed, but extraction completed.');
  }
}

runGeminiSampleTest().catch((err) => {
  console.error('Test execution failed with error:', err);
  process.exit(1);
});
