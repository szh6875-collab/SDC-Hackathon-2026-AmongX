/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { XMLParser } from 'fast-xml-parser';
import { createRequire } from 'module';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import jsQR from 'jsqr';
import Tesseract from 'tesseract.js';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { extractFromTextRegex, getGenAIClient } from '../../extract.ts';

import { PDFParse } from 'pdf-parse';
import {
  InvoiceLineItem,
  InvoicePaymentInfo,
  InvoiceSupplierInfo,
  InvoiceBuyerInfo,
  InvoiceTotals,
  InvoiceValidationInfo,
} from '../types.ts';

export type ExtractionMethod = 'xml' | 'json' | 'qr' | 'pdf_text' | 'ocr' | 'ai' | 'regex' | 'manual';

export interface NormalizedInvoiceData {
  amount: number;
  subtotal?: number | null;
  tax?: number | null;
  discount?: number | null;
  currency?: string | null;
  documentType?: string;
  invoiceNumber?: string;
  date?: string;
  invoiceTime?: string;

  // Parties
  buyerTIN: string | null;
  buyerName?: string;
  buyerBRN?: string | null;
  buyerAddress?: string | null;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  buyer?: InvoiceBuyerInfo;

  supplierTIN?: string | null;
  vendorName?: string;
  supplierBRN?: string | null;
  supplierSST?: string | null;
  supplierAddress?: string | null;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  supplierSignatory?: string | null;
  supplier?: InvoiceSupplierInfo;

  // Items
  items?: InvoiceLineItem[];

  // Totals
  taxableAmount?: number | null;
  taxRate?: number | string | null;
  rounding?: number | null;
  totalPayable?: number | null;
  totals?: InvoiceTotals;

  // Payment
  paymentInfo?: InvoicePaymentInfo | null;

  // Validation
  validation?: InvoiceValidationInfo;
  validationUUID?: string | null;
  qrPayload?: string | null;

  confidence: number;
  confidenceBasis?: 'ocr-engine' | 'model-reported' | 'parser-heuristic' | 'demo-fixture' | 'unknown';
  method: ExtractionMethod;
  fieldConfidence: {
    amount: number;
    buyerTIN: number;
    buyerName?: number;
    supplierName?: number;
    supplierTIN?: number;
    date?: number;
    invoiceNumber?: number;
    items?: number;
  };
  extractionNotes?: string;
  rawPayload?: any;
}

/**
 * Helper to deep search an object for candidate keys.
 */
function findValueByKeys(obj: any, candidateKeys: string[], maxDepth = 6): any {
  if (!obj || typeof obj !== 'object' || maxDepth <= 0) return undefined;

  const lowerCandidates = candidateKeys.map((k) => k.toLowerCase());

  // First pass: direct properties
  for (const key of Object.keys(obj)) {
    const cleanKey = key.replace(/^[a-zA-Z0-9]+:/, '').toLowerCase();
    if (lowerCandidates.includes(cleanKey)) {
      const val = obj[key];
      if (val !== undefined && val !== null && val !== '') {
        return val;
      }
    }
  }

  // Second pass: nested properties
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val && typeof val === 'object') {
      const nested = findValueByKeys(val, candidateKeys, maxDepth - 1);
      if (nested !== undefined && nested !== null && nested !== '') {
        return nested;
      }
    }
  }

  return undefined;
}

/**
 * Clean numeric string into a float (e.g. "RM 11,200.50" -> 11200.5)
 */
function parseNumericAmount(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  if (val && typeof val === 'object') {
    if (val['#text'] !== undefined) return parseNumericAmount(val['#text']);
    if (val.value !== undefined) return parseNumericAmount(val.value);
    if (val._ !== undefined) return parseNumericAmount(val._);
  }
  if (!val || typeof val !== 'string') return 0;
  const cleaned = val.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Format and sanitize Malaysian TIN (e.g. "C 2891928301" -> "C2891928301")
 */
function sanitizeTIN(val: any): string | null {
  if (val && typeof val === 'object') {
    if (val['#text']) val = val['#text'];
    else if (val.value) val = val.value;
  }
  if (!val || typeof val !== 'string') return null;
  const cleaned = val.replace(/[\s-]/g, '').toUpperCase();
  const tinMatch = cleaned.match(/(C\d{10,11}|IG\d{9,11}|SG\d{9,11}|OG\d{9,11}|PT\d{9,11}|TC\d{9,11})/);
  if (tinMatch) return tinMatch[1];
  // Fallback if 8-14 alphanumeric
  if (/^[A-Z0-9]{8,14}$/.test(cleaned)) return cleaned;
  return null;
}

// =========================================================================
// 1. Priority 1: Deterministic XML Parser (UBL 2.1 & General Invoice XML)
// =========================================================================
export function parseInvoiceXML(content: string | Buffer): NormalizedInvoiceData | null {
  try {
    const text = typeof content === 'string' ? content : content.toString('utf-8');
    // Sanity check for XML markers
    if (!text.trim().startsWith('<') && !text.includes('<?xml')) {
      return null;
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      trimValues: true,
      parseTagValue: false,
    });

    const parsed = parser.parse(text);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const doc = parsed.Invoice || parsed.InvoiceRoot || parsed;

    // 1. Extract amount (check Totals node first to avoid line item amount collision)
    let rawAmount: any = undefined;
    let subtotal: number | null = null;
    let tax: number | null = null;
    let discount: number | null = null;

    if (doc.Totals && typeof doc.Totals === 'object') {
      rawAmount = doc.Totals.TotalPayable || doc.Totals.Total || doc.Totals.TotalAmount || doc.Totals.PayableAmount;
      if (doc.Totals.Subtotal) subtotal = parseNumericAmount(doc.Totals.Subtotal);
      if (doc.Totals.TaxAmount) tax = parseNumericAmount(doc.Totals.TaxAmount);
      if (doc.Totals.Discount) discount = parseNumericAmount(doc.Totals.Discount);
    }

    if (!rawAmount && doc.LegalMonetaryTotal && typeof doc.LegalMonetaryTotal === 'object') {
      rawAmount = doc.LegalMonetaryTotal.PayableAmount || doc.LegalMonetaryTotal.TaxInclusiveAmount;
      if (doc.LegalMonetaryTotal.LineExtensionAmount) subtotal = parseNumericAmount(doc.LegalMonetaryTotal.LineExtensionAmount);
    }

    if (!rawAmount) {
      rawAmount = findValueByKeys(parsed, [
        'TotalPayable',
        'TotalPayableAmount',
        'PayableAmount',
        'TaxInclusiveAmount',
        'TotalAmount',
        'InvoiceTotal',
        'GrossAmount',
      ]);
    }
    const amount = parseNumericAmount(rawAmount);

    if (amount <= 0) {
      return null;
    }

    // 2. Extract Buyer & Supplier nodes specifically to avoid TIN confusion
    const buyerNode = doc.Buyer || doc.AccountingCustomerParty?.Party || findValueByKeys(doc, ['Buyer', 'AccountingCustomerParty']);
    let buyerTIN: string | null = null;
    let buyerName: string | undefined = undefined;
    let buyerBRN: string | undefined = undefined;
    let buyerAddress: string | undefined = undefined;
    let buyerEmail: string | undefined = undefined;
    let buyerPhone: string | undefined = undefined;

    if (buyerNode && typeof buyerNode === 'object') {
      buyerTIN = sanitizeTIN(buyerNode.TIN || buyerNode.CompanyID || buyerNode.TaxID);
      const rawName = buyerNode.Name || buyerNode.RegistrationName || buyerNode.PartyName;
      if (typeof rawName === 'string') buyerName = rawName.trim();
      else if (rawName && typeof rawName === 'object') buyerName = rawName['#text'] || rawName.value;
      buyerBRN = findValueByKeys(buyerNode, ['BRN', 'RegistrationNumber', 'BusinessRegistrationNumber']);
      buyerAddress = findValueByKeys(buyerNode, ['Address', 'PostalAddress', 'AddressLine']);
      buyerEmail = findValueByKeys(buyerNode, ['Email', 'ElectronicMail']);
      buyerPhone = findValueByKeys(buyerNode, ['Phone', 'Telephone']);
    }

    const supplierNode = doc.Supplier || doc.AccountingSupplierParty?.Party || findValueByKeys(doc, ['Supplier', 'AccountingSupplierParty']);
    let supplierTIN: string | null = null;
    let vendorName: string | undefined = undefined;
    let supplierBRN: string | undefined = undefined;
    let supplierSST: string | undefined = undefined;
    let supplierAddress: string | undefined = undefined;
    let supplierEmail: string | undefined = undefined;
    let supplierPhone: string | undefined = undefined;

    if (supplierNode && typeof supplierNode === 'object') {
      supplierTIN = sanitizeTIN(supplierNode.TIN || supplierNode.CompanyID || supplierNode.TaxID);
      const rawSName = supplierNode.Name || supplierNode.RegistrationName || supplierNode.PartyName;
      if (typeof rawSName === 'string') vendorName = rawSName.trim();
      else if (rawSName && typeof rawSName === 'object') vendorName = rawSName['#text'] || rawSName.value;
      supplierBRN = findValueByKeys(supplierNode, ['BRN', 'RegistrationNumber', 'BusinessRegistrationNumber']);
      supplierSST = findValueByKeys(supplierNode, ['SST', 'SSTNumber', 'TaxRegistrationNumber']);
      supplierAddress = findValueByKeys(supplierNode, ['Address', 'PostalAddress', 'AddressLine']);
      supplierEmail = findValueByKeys(supplierNode, ['Email', 'ElectronicMail']);
      supplierPhone = findValueByKeys(supplierNode, ['Phone', 'Telephone']);
    }

    // Fallbacks if not under dedicated nodes
    if (!buyerTIN) {
      buyerTIN = sanitizeTIN(findValueByKeys(parsed, ['BuyerTIN', 'CustomerTIN', 'BuyerTaxID']));
    }
    if (!buyerName) {
      const bn = findValueByKeys(parsed, ['BuyerName', 'CustomerName', 'RecipientName']);
      buyerName = typeof bn === 'string' ? bn.trim() : undefined;
    }
    if (!buyerBRN) {
      buyerBRN = findValueByKeys(parsed, ['BuyerBRN', 'CustomerBRN']);
    }
    if (!supplierTIN) {
      supplierTIN = sanitizeTIN(findValueByKeys(parsed, ['SupplierTIN', 'VendorTIN']));
    }
    if (!supplierBRN) {
      supplierBRN = findValueByKeys(parsed, ['SupplierBRN', 'VendorBRN']);
    }
    if (!supplierSST) {
      supplierSST = findValueByKeys(parsed, ['SupplierSST', 'SST']);
    }

    // 3. Extract Invoice Number, Date, Currency, Document Type
    const rawInvNum = findValueByKeys(doc, ['InvoiceNumber', 'InvoiceNo', 'ID', 'DocNumber']);
    const invoiceNumber = typeof rawInvNum === 'string' || typeof rawInvNum === 'number' ? String(rawInvNum) : undefined;

    const rawDate = findValueByKeys(doc, ['InvoiceDate', 'IssueDate', 'Date']);
    const date = typeof rawDate === 'string' ? rawDate : undefined;

    const rawCurrency = findValueByKeys(doc, ['Currency', 'DocumentCurrencyCode']) || 'MYR';
    const currency = typeof rawCurrency === 'string' ? rawCurrency.trim().toUpperCase() : 'MYR';

    const documentType = findValueByKeys(doc, ['DocumentType', 'InvoiceTypeCode']) || 'Invoice';

    // 4. Extract Line items if present
    let items: InvoiceLineItem[] | undefined = undefined;
    const rawLines = doc.InvoiceLines?.Line || doc.InvoiceLine;
    if (rawLines) {
      const linesArray = Array.isArray(rawLines) ? rawLines : [rawLines];
      items = linesArray.map((l: any, idx: number) => ({
        itemNo: idx + 1,
        classification: findValueByKeys(l, ['Classification', 'CommodityClassification']) || '010',
        description: String(l.Description || l.Item?.Description || l.Item?.Name || 'Item').trim(),
        quantity: parseNumericAmount(l.Quantity || l.InvoicedQuantity || 1),
        unit: findValueByKeys(l, ['Unit', 'UnitCode', 'unit']) || 'unit',
        unitPrice: parseNumericAmount(l.UnitPrice || l.Price?.PriceAmount),
        discount: parseNumericAmount(l.Discount || l.AllowanceCharge?.Amount),
        taxRate: findValueByKeys(l, ['TaxRate', 'Percent']) || findValueByKeys(doc.Totals || doc, ['TaxRate', 'Rate']) || '8%',
        taxAmount: parseNumericAmount(l.TaxAmount || l.Tax),
        taxableAmount: parseNumericAmount(l.Amount || l.LineExtensionAmount),
        total: parseNumericAmount(l.Amount || l.LineExtensionAmount),
      }));
    }

    // 5. Totals & Tax Details
    const taxableAmount = parseNumericAmount(findValueByKeys(doc.Totals || doc, ['TaxableAmount', 'TaxExclusiveAmount'])) || subtotal;
    const taxRate = findValueByKeys(doc.Totals || doc, ['TaxRate', 'Rate']) || '8%';
    const rounding = parseNumericAmount(findValueByKeys(doc.Totals || doc, ['Rounding', 'PayableRoundingAmount']));

    // 6. Payment Information
    const paymentMode = findValueByKeys(doc.Payment || doc, ['PaymentMode', 'PaymentMeansCode', 'Mode']) || 'Bank Transfer';
    const paymentTerms = findValueByKeys(doc.Payment || doc.PaymentTerms || doc, ['Terms', 'PaymentTerms', 'Note']) || '30 days';

    // 7. Validation & UUID
    const validationUUID = findValueByKeys(doc.Validation || doc, ['UUID', 'InvoiceUUID', 'ID']) || `DEMO-INV-${invoiceNumber || '00125'}`;
    const validationStatus = findValueByKeys(doc.Validation || doc, ['Status']) || 'DEMO';
    const qrPayload = findValueByKeys(doc.Validation || doc, ['QRPayload', 'QRCode']) || 'SYNTHETIC-DEMO-PAYLOAD';

    const confidence = buyerTIN ? 0.99 : 0.95; // parser heuristic based on field presence, not a calibrated probability

    return {
      amount,
      subtotal,
      tax,
      discount,
      currency,
      documentType,
      invoiceNumber,
      date,
      buyerTIN,
      buyerName,
      buyerBRN,
      buyerAddress,
      buyerEmail,
      buyerPhone,
      buyer: {
        name: buyerName || '',
        tin: buyerTIN,
        brn: buyerBRN,
        address: buyerAddress,
        email: buyerEmail,
        phone: buyerPhone,
      },
      supplierTIN,
      vendorName,
      supplierBRN,
      supplierSST,
      supplierAddress,
      supplierEmail,
      supplierPhone,
      supplier: {
        name: vendorName || '',
        tin: supplierTIN,
        brn: supplierBRN,
        sst: supplierSST,
        address: supplierAddress,
        email: supplierEmail,
        phone: supplierPhone,
      },
      items,
      taxableAmount,
      taxRate,
      rounding,
      totalPayable: amount,
      totals: {
        subtotal,
        discount,
        taxableAmount,
        taxRate,
        taxAmount: tax,
        rounding,
        totalPayable: amount,
      },
      paymentInfo: {
        mode: paymentMode,
        terms: paymentTerms,
        paymentTerms,
      },
      validation: {
        uuid: validationUUID,
        status: validationStatus,
        qrPayload,
      },
      validationUUID,
      qrPayload,
      confidence,
      confidenceBasis: 'parser-heuristic',
      method: 'xml',
      fieldConfidence: {
        amount: 1.0,
        buyerTIN: buyerTIN ? 1.0 : 0.0,
        supplierTIN: supplierTIN ? 1.0 : 0.0,
        buyerName: buyerName ? 0.98 : 0.0,
        supplierName: vendorName ? 0.98 : 0.0,
        date: date ? 0.98 : 0.0,
        invoiceNumber: invoiceNumber ? 0.98 : 0.0,
        items: items && items.length > 0 ? 0.98 : 0.0,
      },
      extractionNotes: 'Deterministically parsed from structured e-Invoice XML (UBL 2.1 schema).',
      rawPayload: parsed,
    };
  } catch (err: any) {
    console.warn('[parseInvoiceXML] Deterministic XML parsing failed:', err?.message);
    return null;
  }
}

// =========================================================================
// 2. Priority 2: Deterministic JSON Parser (LHDN MyInvois & Generic JSON)
// =========================================================================
export function parseInvoiceJSON(content: string | Buffer): NormalizedInvoiceData | null {
  try {
    const text = typeof content === 'string' ? content : content.toString('utf-8');
    const trimmed = text.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return null;
    }

    const data = JSON.parse(trimmed);
    const root = Array.isArray(data) ? data[0] : data;
    if (!root || typeof root !== 'object') {
      return null;
    }

    // 1. Amount extraction (check totals node first)
    let rawAmount: any = undefined;
    let subtotal: number | null = null;
    let tax: number | null = null;
    let discount: number | null = null;

    if (root.totals && typeof root.totals === 'object') {
      rawAmount = root.totals.totalPayable ?? root.totals.totalPayableAmount ?? root.totals.total_payable ?? root.totals.total ?? root.totals.totalAmount;
      if (root.totals.subtotal !== undefined) subtotal = parseNumericAmount(root.totals.subtotal);
      if (root.totals.taxAmount !== undefined || root.totals.tax !== undefined) {
        tax = parseNumericAmount(root.totals.taxAmount ?? root.totals.tax);
      }
      if (root.totals.discount !== undefined) discount = parseNumericAmount(root.totals.discount);
    }

    if (!rawAmount) {
      rawAmount = findValueByKeys(root, [
        'totalPayable',
        'total_payable',
        'total_payable_amount',
        'totalPayableAmount',
        'PayableAmount',
        'payableAmount',
        'totalAmount',
        'total_amount',
        'grandTotal',
        'grand_total',
        'TaxInclusiveAmount',
        'total',
        'parsedAmount',
      ]);
    }
    const amount = parseNumericAmount(rawAmount);

    if (amount <= 0) {
      return null;
    }

    // 2. Buyer extraction
    let buyerObj = root.buyer || root.customer || root.recipient || root.AccountingCustomerParty;
    let buyerTIN: string | null = null;
    let buyerName: string | undefined = undefined;
    let buyerBRN: string | undefined = undefined;
    let buyerAddress: string | undefined = undefined;
    let buyerEmail: string | undefined = undefined;
    let buyerPhone: string | undefined = undefined;

    if (buyerObj && typeof buyerObj === 'object') {
      buyerTIN = sanitizeTIN(buyerObj.tin || buyerObj.buyer_tin || buyerObj.buyerTIN || buyerObj.tax_id || buyerObj.company_id || buyerObj.CompanyID);
      const rawBName = buyerObj.legal_name || buyerObj.name || buyerObj.buyer_name || buyerObj.company;
      if (typeof rawBName === 'string') buyerName = rawBName.trim();
      buyerBRN = findValueByKeys(buyerObj, ['brn', 'buyer_brn', 'registration_number', 'registrationNumber']);
      buyerAddress = findValueByKeys(buyerObj, ['address', 'postal_address', 'address_line']);
      buyerEmail = findValueByKeys(buyerObj, ['email', 'electronic_mail']);
      buyerPhone = findValueByKeys(buyerObj, ['phone', 'telephone']);
    }

    if (!buyerTIN) {
      buyerTIN = sanitizeTIN(findValueByKeys(root, ['buyer_tin', 'buyerTIN', 'buyerTaxId', 'customerTIN']));
    }
    if (!buyerName) {
      const bn = findValueByKeys(root, ['buyer_name', 'buyerName', 'customer_name', 'legal_name']);
      buyerName = typeof bn === 'string' ? bn.trim() : undefined;
    }
    if (!buyerBRN) {
      buyerBRN = findValueByKeys(root, ['buyer_brn', 'buyerBRN', 'customer_brn']);
    }

    // 3. Supplier extraction
    let supplierObj = root.supplier || root.vendor || root.seller || root.AccountingSupplierParty;
    let supplierTIN: string | null = null;
    let vendorName: string | undefined = undefined;
    let supplierBRN: string | undefined = undefined;
    let supplierSST: string | undefined = undefined;
    let supplierAddress: string | undefined = undefined;
    let supplierEmail: string | undefined = undefined;
    let supplierPhone: string | undefined = undefined;

    if (supplierObj && typeof supplierObj === 'object') {
      supplierTIN = sanitizeTIN(supplierObj.tin || supplierObj.supplier_tin || supplierObj.supplierTIN || supplierObj.tax_id);
      const rawSName = supplierObj.legal_name || supplierObj.name || supplierObj.supplier_name || supplierObj.company;
      if (typeof rawSName === 'string') vendorName = rawSName.trim();
      supplierBRN = findValueByKeys(supplierObj, ['brn', 'supplier_brn', 'registration_number', 'registrationNumber']);
      supplierSST = findValueByKeys(supplierObj, ['sst', 'supplier_sst', 'tax_number', 'sstNumber']);
      supplierAddress = findValueByKeys(supplierObj, ['address', 'postal_address', 'address_line']);
      supplierEmail = findValueByKeys(supplierObj, ['email', 'electronic_mail']);
      supplierPhone = findValueByKeys(supplierObj, ['phone', 'telephone']);
    }

    if (!supplierTIN) {
      supplierTIN = sanitizeTIN(findValueByKeys(root, ['supplier_tin', 'supplierTIN', 'vendor_tin']));
    }
    if (!supplierBRN) {
      supplierBRN = findValueByKeys(root, ['supplier_brn', 'supplierBRN']);
    }
    if (!supplierSST) {
      supplierSST = findValueByKeys(root, ['supplier_sst', 'supplierSST', 'sst']);
    }

    // 4. Invoice Number, Date, Currency, Document Type
    const rawInvNum = findValueByKeys(root, ['invoiceNumber', 'invoice_number', 'invoiceNo', 'id', 'doc_number']);
    const invoiceNumber = typeof rawInvNum === 'string' || typeof rawInvNum === 'number' ? String(rawInvNum) : undefined;

    const rawDate = findValueByKeys(root, ['invoiceDate', 'issue_date', 'issueDate', 'date']);
    const date = typeof rawDate === 'string' ? rawDate.split('T')[0] : undefined;

    const rawCurrency = findValueByKeys(root, ['currency', 'documentCurrencyCode']) || 'MYR';
    const currency = typeof rawCurrency === 'string' ? rawCurrency.trim().toUpperCase() : 'MYR';

    const documentType = findValueByKeys(root, ['documentType', 'document_type', 'docType']) || 'Invoice';

    // 5. Line items
    let items: InvoiceLineItem[] | undefined = undefined;
    const rawItems = root.items || root.line_items || root.lines || root.InvoiceLines;
    if (Array.isArray(rawItems)) {
      items = rawItems.map((it: any, idx: number) => ({
        itemNo: idx + 1,
        classification: it.classification || findValueByKeys(it, ['classification', 'classCode']) || '010',
        description: String(it.description || it.name || it.item || 'Item').trim(),
        quantity: parseNumericAmount(it.quantity ?? it.qty ?? 1),
        unit: it.unit || findValueByKeys(it, ['unit', 'unitCode']) || 'unit',
        unitPrice: parseNumericAmount(it.unitPrice ?? it.unit_price ?? it.price),
        discount: parseNumericAmount(it.discount),
        charges: parseNumericAmount(it.charges ?? it.charge),
        taxRate: it.taxRate ?? it.tax_rate ?? root.totals?.taxRate ?? '8%',
        taxAmount: parseNumericAmount(it.taxAmount ?? it.tax_amount ?? it.tax),
        taxableAmount: parseNumericAmount(it.taxableAmount ?? it.amount ?? it.total),
        total: parseNumericAmount(it.amount ?? it.total ?? it.totalAmount),
      }));
    }

    // 6. Totals & Tax Details
    const taxableAmount = parseNumericAmount(findValueByKeys(root.totals || root, ['taxableAmount', 'taxable_amount', 'taxExclusiveAmount'])) || (subtotal ? subtotal - (discount || 0) : null);
    const taxRate = root.totals?.taxRate ?? findValueByKeys(root.totals || root, ['taxRate', 'tax_rate']) ?? '8%';
    const rounding = parseNumericAmount(findValueByKeys(root.totals || root, ['rounding', 'roundingAdjustment']));

    // 7. Payment Information
    const paymentMode = findValueByKeys(root.payment || root.payment_info || root, ['mode', 'paymentMode', 'payment_mode']) || 'Bank Transfer';
    const paymentTerms = findValueByKeys(root.payment || root.payment_info || root, ['terms', 'paymentTerms', 'payment_terms']) || '30 days';

    // 8. Validation & UUID
    const validationUUID = findValueByKeys(root.validation || root, ['uuid', 'validation_uuid', 'id']) || `DEMO-INV-${invoiceNumber || '00125'}`;
    const validationStatus = findValueByKeys(root.validation || root, ['status']) || 'DEMO';
    const qrPayload = findValueByKeys(root.validation || root, ['qrPayload', 'qr_payload']) || 'SYNTHETIC-DEMO-PAYLOAD';

    const confidence = buyerTIN ? 0.99 : 0.95; // parser heuristic based on field presence, not a calibrated probability

    return {
      amount,
      subtotal,
      tax,
      discount,
      currency,
      documentType,
      invoiceNumber,
      date,
      buyerTIN,
      buyerName,
      buyerBRN,
      buyerAddress,
      buyerEmail,
      buyerPhone,
      buyer: {
        name: buyerName || '',
        tin: buyerTIN,
        brn: buyerBRN,
        address: buyerAddress,
        email: buyerEmail,
        phone: buyerPhone,
      },
      supplierTIN,
      vendorName,
      supplierBRN,
      supplierSST,
      supplierAddress,
      supplierEmail,
      supplierPhone,
      supplier: {
        name: vendorName || '',
        tin: supplierTIN,
        brn: supplierBRN,
        sst: supplierSST,
        address: supplierAddress,
        email: supplierEmail,
        phone: supplierPhone,
      },
      items,
      taxableAmount,
      taxRate,
      rounding,
      totalPayable: amount,
      totals: {
        subtotal,
        discount,
        taxableAmount,
        taxRate,
        taxAmount: tax,
        rounding,
        totalPayable: amount,
      },
      paymentInfo: {
        mode: paymentMode,
        terms: paymentTerms,
        paymentTerms,
      },
      validation: {
        uuid: validationUUID,
        status: validationStatus,
        qrPayload,
      },
      validationUUID,
      qrPayload,
      confidence,
      confidenceBasis: 'parser-heuristic',
      method: 'json',
      fieldConfidence: {
        amount: 1.0,
        buyerTIN: buyerTIN ? 1.0 : 0.0,
        supplierTIN: supplierTIN ? 1.0 : 0.0,
        buyerName: buyerName ? 0.98 : 0.0,
        supplierName: vendorName ? 0.98 : 0.0,
        date: date ? 0.98 : 0.0,
        invoiceNumber: invoiceNumber ? 0.98 : 0.0,
        items: items && items.length > 0 ? 0.98 : 0.0,
      },
      extractionNotes: 'Deterministically parsed from structured e-Invoice JSON.',
      rawPayload: root,
    };
  } catch (err: any) {
    console.warn('[parseInvoiceJSON] Deterministic JSON parsing failed:', err?.message);
    return null;
  }
}

// =========================================================================
// 3. Priority 3: QR Code Decoder (Malaysian e-Invoice & Receipt QR Codes)
// =========================================================================
export function parseInvoiceQR(buffer: Buffer): NormalizedInvoiceData | null {
  try {
    let width = 0;
    let height = 0;
    let data: Uint8ClampedArray | null = null;

    // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      const png = PNG.sync.read(buffer);
      width = png.width;
      height = png.height;
      data = new Uint8ClampedArray(png.data);
    } else {
      // Try JPEG decoding
      try {
        const decodedJpeg = jpeg.decode(buffer, { useTArray: true });
        width = decodedJpeg.width;
        height = decodedJpeg.height;
        data = new Uint8ClampedArray(decodedJpeg.data);
      } catch {
        // Not a recognizable JPEG
      }
    }

    if (!data || width <= 0 || height <= 0) {
      return null;
    }

    const qrResult = jsQR(data, width, height, {
      inversionAttempts: 'attemptBoth',
    });

    if (!qrResult || !qrResult.data) {
      return null;
    }

    const rawQR = qrResult.data.trim();

    // 1. Check if QR payload is JSON
    if (rawQR.startsWith('{') && rawQR.endsWith('}')) {
      const jsonRes = parseInvoiceJSON(rawQR);
      if (jsonRes && jsonRes.amount > 0) {
        return {
          ...jsonRes,
          method: 'qr',
          confidence: jsonRes.buyerTIN ? 0.98 : 0.92,
          confidenceBasis: 'parser-heuristic',
          extractionNotes: `Decoded from QR code containing structured JSON data: ${rawQR.slice(0, 100)}...`,
        };
      }
    }

    // 2. Check if QR payload is URL (e.g. https://myinvois.hasil.gov.my/verify?tin=C2891928301&amount=11200.00)
    if (rawQR.startsWith('http://') || rawQR.startsWith('https://')) {
      try {
        const url = new URL(rawQR);
        const params = url.searchParams;
        const rawAmt = params.get('amount') || params.get('total') || params.get('amt') || params.get('total_payable_amount');
        const rawTin = params.get('tin') || params.get('buyer_tin') || params.get('buyerTIN') || params.get('tax_id');
        const rawBuyer = params.get('buyer') || params.get('buyer_name') || params.get('name') || params.get('company');
        const rawInv = params.get('inv') || params.get('invoice_no') || params.get('invoiceNumber') || params.get('id');
        const rawDate = params.get('date') || params.get('issue_date');

        const amount = parseNumericAmount(rawAmt);
        if (amount > 0) {
          const buyerTIN = sanitizeTIN(rawTin);
          return {
            amount,
            buyerTIN,
            buyerName: rawBuyer ? decodeURIComponent(rawBuyer) : undefined,
            invoiceNumber: rawInv ? decodeURIComponent(rawInv) : undefined,
            date: rawDate || undefined,
            confidence: buyerTIN ? 0.98 : 0.92,
            confidenceBasis: 'parser-heuristic',
            method: 'qr',
            fieldConfidence: {
              amount: 0.98,
              buyerTIN: buyerTIN ? 0.98 : 0.0,
            },
            extractionNotes: `Decoded QR content / verification URL: ${rawQR}. Orbyte did not independently verify this URL against LHDN or a vendor service.`,
          };
        }
      } catch {
        // Not a standard URL, continue
      }
    }

    // 3. Complete Multi-Section QR Payload Parser (matching 08_FULL_INVOICE_INFO_QR_PAYLOAD.txt)
    const docTypeMatch = rawQR.match(/Document\s*Type:\s*([^\r\n]+)/i);
    const documentType = docTypeMatch ? docTypeMatch[1].trim() : 'Invoice';

    const invNumMatch = rawQR.match(/(?:Invoice\s*No\.?|Invoice\s*Number|ID)[:=\s]*([A-Z0-9-]+)/i);
    const invoiceNumber = invNumMatch ? invNumMatch[1].trim() : undefined;

    const dateMatch = rawQR.match(/(?:Invoice\s*Date|Date)[:=\s]*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
    const date = dateMatch ? dateMatch[1].trim() : undefined;

    const currMatch = rawQR.match(/Currency:\s*([A-Z]{3})/i);
    const currency = currMatch ? currMatch[1].trim().toUpperCase() : 'MYR';

    // Supplier extraction from SUPPLIER block
    const supplierBlockMatch = rawQR.match(/SUPPLIER[\s\S]*?(?=BUYER|ITEM|TOTALS|$)/i);
    const supplierBlockText = supplierBlockMatch ? supplierBlockMatch[0] : '';
    const vendorName = supplierBlockText.match(/Name:\s*([^\r\n]+)/i)?.[1]?.trim() || undefined;
    const supplierTIN = sanitizeTIN(supplierBlockText.match(/TIN:\s*([^\r\n]+)/i)?.[1]);
    const supplierBRN = supplierBlockText.match(/BRN:\s*([^\r\n]+)/i)?.[1]?.trim();
    const supplierSST = supplierBlockText.match(/SST:\s*([^\r\n]+)/i)?.[1]?.trim();
    const supplierAddress = supplierBlockText.match(/Address:\s*([^\r\n]+)/i)?.[1]?.trim();
    const supplierEmail = supplierBlockText.match(/Email:\s*([^\r\n]+)/i)?.[1]?.trim();
    const supplierPhone = supplierBlockText.match(/Phone:\s*([^\r\n]+)/i)?.[1]?.trim();

    // Buyer extraction from BUYER block
    const buyerBlockMatch = rawQR.match(/BUYER[\s\S]*?(?=ITEM|TOTALS|PAYMENT|$)/i);
    const buyerBlockText = buyerBlockMatch ? buyerBlockMatch[0] : '';
    const buyerName = buyerBlockText.match(/Name:\s*([^\r\n]+)/i)?.[1]?.trim() || undefined;
    const buyerTIN = sanitizeTIN(buyerBlockText.match(/TIN:\s*([^\r\n]+)/i)?.[1]);
    const buyerBRN = buyerBlockText.match(/BRN:\s*([^\r\n]+)/i)?.[1]?.trim();
    const buyerAddress = buyerBlockText.match(/Address:\s*([^\r\n]+)/i)?.[1]?.trim();
    const buyerEmail = buyerBlockText.match(/Email:\s*([^\r\n]+)/i)?.[1]?.trim();

    // Line items extraction (ITEM 1, ITEM 2...)
    const items: InvoiceLineItem[] = [];
    const itemRegex = /ITEM\s+(\d+)[\s\S]*?(?=(?:ITEM\s+\d+|TOTALS|PAYMENT|VALIDATION|$))/gi;
    let iMatch: RegExpExecArray | null;
    while ((iMatch = itemRegex.exec(rawQR)) !== null) {
      const itemBlock = iMatch[0];
      const itemNo = parseInt(iMatch[1], 10);
      const classification = itemBlock.match(/Classification:\s*([^\r\n]+)/i)?.[1]?.trim() || '010';
      const description = itemBlock.match(/Description:\s*([^\r\n]+)/i)?.[1]?.trim() || `Item ${itemNo}`;
      const qtyMatch = itemBlock.match(/Qty:\s*([0-9.]+)(?:\s*([a-zA-Z]+))?/i);
      const quantity = qtyMatch ? parseFloat(qtyMatch[1]) : 1;
      const unit = qtyMatch && qtyMatch[2] ? qtyMatch[2].trim() : 'unit';
      const unitPrice = parseNumericAmount(itemBlock.match(/Unit\s*Price:\s*(?:MYR|RM)?\s*([0-9,.]+)/i)?.[1]);
      const discount = parseNumericAmount(itemBlock.match(/Discount:\s*(?:MYR|RM)?\s*([0-9,.]+)/i)?.[1]);
      const taxRate = itemBlock.match(/Tax\s*Rate:\s*([^\r\n]+)/i)?.[1]?.trim() || '8%';
      const taxAmount = parseNumericAmount(itemBlock.match(/Tax\s*Amount:\s*(?:MYR|RM)?\s*([0-9,.]+)/i)?.[1]);
      const lineAmount = parseNumericAmount(itemBlock.match(/Amount:\s*(?:MYR|RM)?\s*([0-9,.]+)/i)?.[1]);

      items.push({
        itemNo,
        classification,
        description,
        quantity,
        unit,
        unitPrice,
        discount,
        taxRate,
        taxAmount,
        taxableAmount: lineAmount,
        total: lineAmount || (quantity * unitPrice),
      });
    }

    // Totals extraction
    const totalsBlockMatch = rawQR.match(/TOTALS[\s\S]*?(?=PAYMENT|VALIDATION|$)/i);
    const totalsText = totalsBlockMatch ? totalsBlockMatch[0] : rawQR;
    const subtotal = parseNumericAmount(totalsText.match(/Subtotal:\s*(?:MYR|RM)?\s*([0-9,.]+)/i)?.[1]);
    const discount = parseNumericAmount(totalsText.match(/Discount:\s*(?:MYR|RM)?\s*([0-9,.]+)/i)?.[1]);
    const taxableAmount = parseNumericAmount(totalsText.match(/Taxable\s*Amount:\s*(?:MYR|RM)?\s*([0-9,.]+)/i)?.[1]);
    const tax = parseNumericAmount(totalsText.match(/Tax\s*Amount:\s*(?:MYR|RM)?\s*([0-9,.]+)/i)?.[1]);
    const rounding = parseNumericAmount(totalsText.match(/Rounding:\s*(?:MYR|RM)?\s*([0-9,.]+)/i)?.[1]);
    const payableMatch = totalsText.match(/Total\s*Payable:\s*(?:MYR|RM)?\s*([0-9,.]+)/i);
    const amount = parseNumericAmount(payableMatch?.[1] || rawQR.match(/(?:Total\s*Payable|Total\s*Amount|Grand\s*Total|AMT)[:=\s]*(?:MYR|RM)?\s*([0-9,.]+)/i)?.[1]);

    // Payment extraction
    const paymentBlockMatch = rawQR.match(/PAYMENT[\s\S]*?(?=VALIDATION|$)/i);
    const paymentText = paymentBlockMatch ? paymentBlockMatch[0] : '';
    const paymentMode = paymentText.match(/Mode:\s*([^\r\n]+)/i)?.[1]?.trim() || 'Bank Transfer';
    const paymentTerms = paymentText.match(/Terms:\s*([^\r\n]+)/i)?.[1]?.trim() || '30 days';

    // Validation extraction
    const validationBlockMatch = rawQR.match(/VALIDATION[\s\S]*?$/i);
    const validationText = validationBlockMatch ? validationBlockMatch[0] : '';
    const validationUUID = validationText.match(/UUID:\s*([^\r\n]+)/i)?.[1]?.trim() || `DEMO-INV-${invoiceNumber || '00125'}`;
    const validationStatus = validationText.match(/Status:\s*([^\r\n]+)/i)?.[1]?.trim() || 'DEMO';

    if (amount > 0) {
      return {
        amount,
        subtotal: subtotal || amount,
        tax: tax || 0,
        discount: discount || 0,
        currency,
        documentType,
        invoiceNumber,
        date,
        buyerTIN: buyerTIN || null,
        buyerName,
        buyerBRN,
        buyerAddress,
        buyerEmail,
        buyer: {
          name: buyerName || '',
          tin: buyerTIN || null,
          brn: buyerBRN,
          address: buyerAddress,
          email: buyerEmail,
        },
        supplierTIN: supplierTIN || null,
        vendorName,
        supplierBRN,
        supplierSST,
        supplierAddress,
        supplierEmail,
        supplierPhone,
        supplier: {
          name: vendorName || '',
          tin: supplierTIN || null,
          brn: supplierBRN,
          sst: supplierSST,
          address: supplierAddress,
          email: supplierEmail,
          phone: supplierPhone,
        },
        items: items.length > 0 ? items : undefined,
        taxableAmount: taxableAmount || subtotal,
        taxRate: '8%',
        rounding,
        totalPayable: amount,
        totals: {
          subtotal: subtotal || amount,
          discount,
          taxableAmount: taxableAmount || subtotal,
          taxRate: '8%',
          taxAmount: tax,
          rounding,
          totalPayable: amount,
        },
        paymentInfo: {
          mode: paymentMode,
          terms: paymentTerms,
          paymentTerms,
        },
        validation: {
          uuid: validationUUID,
          status: validationStatus,
          qrPayload: rawQR,
        },
        validationUUID,
        qrPayload: rawQR,
        confidence: buyerTIN ? 0.99 : 0.92,
        confidenceBasis: 'parser-heuristic',
        method: 'qr',
        fieldConfidence: {
          amount: 0.99,
          buyerTIN: buyerTIN ? 0.99 : 0.0,
          supplierTIN: supplierTIN ? 0.99 : 0.0,
          invoiceNumber: invoiceNumber ? 0.99 : 0.0,
          date: date ? 0.99 : 0.0,
          items: items.length > 0 ? 0.99 : 0.0,
        },
        extractionNotes: `Deterministically decoded from complete structured e-Invoice QR code payload (${items.length} items parsed).`,
        rawPayload: rawQR,
      };
    }

    // 4. Fallback: Run deterministic regex on QR text
    const regexRes = extractFromTextRegex(rawQR);
    if (regexRes.amount > 0) {
      return {
        amount: regexRes.amount,
        buyerTIN: regexRes.buyerTIN,
        buyerName: regexRes.buyerName,
        confidence: regexRes.buyerTIN ? 0.98 : 0.92,
        confidenceBasis: 'parser-heuristic',
        method: 'qr',
        fieldConfidence: regexRes.fieldConfidence,
        extractionNotes: `Decoded text content from QR code: ${rawQR.slice(0, 100)}`,
      };
    }

    return null;
  } catch (err: any) {
    console.warn('[parseInvoiceQR] QR decoding encountered error:', err?.message);
    return null;
  }
}

// =========================================================================
// 4. Priority 4: Text-based PDF Parser
// =========================================================================
export async function parseInvoicePDFText(buffer: Buffer): Promise<NormalizedInvoiceData | null> {
  try {
    // Check PDF magic bytes "%PDF-"
    if (!buffer.slice(0, 5).toString('ascii').startsWith('%PDF-')) {
      return null;
    }

    const parser = new PDFParse({ data: buffer });
    const textObj = await parser.getText();
    const text = typeof textObj === 'string' ? textObj : (textObj?.text || '');

    if (!text || text.trim().length < 15) {
      return null; // Scanned or empty PDF
    }

    const regexResult = extractFromTextRegex(text);
    if (regexResult.amount <= 0) {
      return null;
    }

    // Extract invoice number if present
    const invMatch = text.match(/(?:Invoice\s*(?:No\.?|#|Number)|No\.?\s*Invois)[:\s]*([A-Z0-9-]{4,20})\b/i);
    const invoiceNumber = invMatch ? invMatch[1].trim() : undefined;

    // Extract date if present
    const dateMatch = text.match(/(?:Date|Tarikh)[:\s]*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i);
    const date = dateMatch ? dateMatch[1].trim() : undefined;

    const confidence = regexResult.buyerTIN ? 0.96 : 0.90;

    return {
      amount: regexResult.amount,
      buyerTIN: regexResult.buyerTIN,
      buyerName: regexResult.buyerName,
      invoiceNumber,
      date,
      confidence,
      confidenceBasis: 'parser-heuristic',
      method: 'pdf_text',
      fieldConfidence: {
        amount: 0.96,
        buyerTIN: regexResult.buyerTIN ? 0.96 : 0.0,
        invoiceNumber: invoiceNumber ? 0.90 : 0.0,
        date: date ? 0.90 : 0.0,
      },
      extractionNotes: 'Deterministically parsed from embedded vector text streams inside PDF document.',
    };
  } catch (err: any) {
    console.warn('[parseInvoicePDFText] PDF text extraction failed:', err?.message);
    return null;
  }
}

// =========================================================================
// 5. Priority 5: Local OCR for Scanned Documents / Images
// =========================================================================
export async function parseInvoiceOCR(buffer: Buffer): Promise<NormalizedInvoiceData | null> {
  try {
    const ocrPromise = Tesseract.recognize(buffer, 'eng');
    const timeoutPromise = new Promise<null>((r) => setTimeout(() => r(null), 5000));
    const result = await Promise.race([ocrPromise, timeoutPromise]);

    if (!result || !result.data || !result.data.text) {
      return null;
    }

    const text = result.data.text;
    const regexResult = extractFromTextRegex(text);
    if (regexResult.amount <= 0) {
      return null;
    }
    const rawOcrConfidence = Number(result.data.confidence);
    const ocrEngineConfidence = Number.isFinite(rawOcrConfidence) && rawOcrConfidence >= 0 && rawOcrConfidence <= 100
      ? rawOcrConfidence / 100
      : 0;
    const confidence = Math.min(ocrEngineConfidence, regexResult.confidence);

    return {
      amount: regexResult.amount,
      buyerTIN: regexResult.buyerTIN,
      buyerName: regexResult.buyerName,
      confidence,
      confidenceBasis: 'ocr-engine',
      method: 'ocr',
      fieldConfidence: regexResult.fieldConfidence,
      extractionNotes: `Extracted via local OCR. Reported OCR engine confidence: ${Math.round(ocrEngineConfidence * 100)}%; displayed overall score is conservatively bounded by the parser heuristic and is not a guarantee of correctness.`,
    };
  } catch (err: any) {
    console.warn('[parseInvoiceOCR] Local OCR failed:', err?.message);
    return null;
  }
}

// =========================================================================
// 6. Priority 6: Gemini Fallback (Multimodal AI)
// =========================================================================
export async function parseInvoiceGeminiFallback(
  buffer: Buffer,
  mimeType: string,
  rawTextContext?: string
): Promise<NormalizedInvoiceData | null> {
  const ai = getGenAIClient();
  if (!ai) {
    console.info('[parseInvoiceGeminiFallback] No AI provider key configured (check GEMINI_API_KEYS/GEMINI_API_KEY or OPENAI_API_KEYS/OPENAI_API_KEY).');
    return null;
  }

  try {
    const promptInstructions = `You are a specialized invoice data extraction engine for Malaysian and regional e-invoicing.
Your task is to analyze the provided invoice document (image, PDF, or text) and extract factual structured data.

CRITICAL RULES:
1. STRICT FIDELITY: Never invent, extrapolate, or guess missing information. If a field is not present or illegible, return null.
2. NUMERIC FIELDS: Total, subtotal, discount, tax, quantity, and unit prices must be raw numbers (e.g. 11200.50, not "RM 11,200.50").
3. MALAYSIAN TAX IDENTIFICATION NUMBERS (TIN): Extract Malaysian TINs without punctuation or spaces (e.g. C1234567890, IG1234567890). If none is present, return null.
4. DO NOT ASSESS COMPLIANCE: Do not judge whether the invoice is valid, compliant, or legally acceptable. Extract visible document facts only. Deterministic compliance engines will evaluate the statutory rules separately.
5. CONFIDENCE: Provide a realistic confidence score (0.0 to 1.0) based on image clarity, completeness of fields, and readability.`;

    let parts: any[] = [];
    if (rawTextContext) {
      parts = [
        {
          text: `${promptInstructions}

Document Content:
"""
${rawTextContext}
"""`,
        },
      ];
    } else {
      let effectiveMime = mimeType || 'image/jpeg';
      // Detect PDF from buffer magic bytes (%PDF-) if mimeType is ambiguous
      if (buffer.slice(0, 5).toString('ascii').startsWith('%PDF-') || mimeType === 'application/pdf') {
        effectiveMime = 'application/pdf';
      } else if (buffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a' || mimeType.includes('png')) {
        effectiveMime = 'image/png';
      } else if (mimeType.includes('webp')) {
        effectiveMime = 'image/webp';
      } else {
        effectiveMime = 'image/jpeg';
      }

      parts = [
        {
          inlineData: {
            mimeType: effectiveMime,
            data: buffer.toString('base64'),
          },
        },
        {
          text: promptInstructions,
        },
      ];
    }

    const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    let response: any = null;

    for (const modelName of candidateModels) {
      try {
        const aiPromise = ai.models.generateContent({
          model: modelName,
          contents: { parts },
          config: {
            responseMimeType: 'application/json',
            ...(modelName.includes('3.8') ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                invoice_number: { type: Type.STRING, description: 'Invoice number, reference code, or tax invoice ID. Null if missing or unknown.' },
                invoice_date: { type: Type.STRING, description: 'Invoice issue date in YYYY-MM-DD format. Null if missing or unknown.' },
                supplier_name: { type: Type.STRING, description: 'Seller / vendor / supplier company or individual trade name. Null if missing or unknown.' },
                supplier_tin: { type: Type.STRING, description: 'Supplier Malaysian Tax Identification Number (e.g. C1234567890). Null if missing or unknown.' },
                buyer_name: { type: Type.STRING, description: 'Buyer / customer / recipient company or client name. Null if missing or unknown.' },
                buyer_tin: { type: Type.STRING, description: 'Buyer Malaysian Tax Identification Number (e.g. C1234567890, IG123456789). Null if missing or unknown.' },
                currency: { type: Type.STRING, description: 'Currency code (e.g. MYR, RM, USD, SGD). Null if missing or unknown.' },
                subtotal: { type: Type.NUMBER, description: 'Subtotal amount before tax/discounts as a numeric float. Null if missing.' },
                discount: { type: Type.NUMBER, description: 'Overall invoice discount amount as a numeric float. Null if missing.' },
                tax: { type: Type.NUMBER, description: 'Tax amount (e.g. SST/GST/VAT) as a numeric float. Null if missing.' },
                total: { type: Type.NUMBER, description: 'Final grand total payable amount as a numeric float. Null if missing or cannot be determined.' },
                line_items: {
                  type: Type.ARRAY,
                  description: 'Array of line items / products / services on the invoice.',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      description: { type: Type.STRING, description: 'Description or item name.' },
                      quantity: { type: Type.NUMBER, description: 'Item quantity. Null if not specified.' },
                      unit_price: { type: Type.NUMBER, description: 'Unit price per item. Null if not specified.' },
                      discount: { type: Type.NUMBER, description: 'Line item discount. Null if not specified.' },
                      tax: { type: Type.NUMBER, description: 'Line item tax. Null if not specified.' },
                      total: { type: Type.NUMBER, description: 'Line item total price. Null if not specified.' },
                    },
                    required: ['description'],
                  },
                },
                payment_information: {
                  type: Type.OBJECT,
                  description: 'Banking or payment details listed on invoice.',
                  properties: {
                    bank_name: { type: Type.STRING, description: 'Bank name or null' },
                    bank_account_number: { type: Type.STRING, description: 'Bank account number or null' },
                    payment_terms: { type: Type.STRING, description: 'Payment terms or due period or null' },
                    payee_name: { type: Type.STRING, description: 'Payee or beneficiary name or null' },
                  },
                },
                confidence: {
                  type: Type.NUMBER,
                  description: 'Overall extraction confidence between 0.0 and 1.0 based on visual clarity and completeness.',
                },
                field_confidence: {
                  type: Type.OBJECT,
                  description: 'Per-field extraction confidence between 0.0 and 1.0.',
                  properties: {
                    total: { type: Type.NUMBER },
                    buyer_tin: { type: Type.NUMBER },
                    supplier_tin: { type: Type.NUMBER },
                    invoice_number: { type: Type.NUMBER },
                    invoice_date: { type: Type.NUMBER },
                  },
                },
              },
            },
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`AI extraction timed out after 35000ms on ${modelName}`)), 35000)
        );

        response = await Promise.race([aiPromise, timeoutPromise]);
        if (response && response.text) {
          break;
        }
      } catch (modelErr: any) {
        console.warn(`[parseInvoiceGeminiFallback] Attempt with model ${modelName} failed:`, modelErr?.message);
      }
    }

    if (!response || !response.text) {
      console.warn('[parseInvoiceGeminiFallback] All Gemini model extraction attempts exhausted.');
      return null;
    }
    const rawText = response.text?.trim() || '{}';
    let cleanJson = rawText;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanJson = jsonMatch[0];
    }
    const parsed = JSON.parse(cleanJson);

    const amount = parseNumericAmount(parsed.total ?? parsed.subtotal);
    if (amount <= 0) {
      console.warn('[parseInvoiceGeminiFallback] Gemini returned empty or non-positive total amount.');
      return null;
    }

    const subtotal = parsed.subtotal !== null && parsed.subtotal !== undefined ? parseNumericAmount(parsed.subtotal) : null;
    const tax = parsed.tax !== null && parsed.tax !== undefined ? parseNumericAmount(parsed.tax) : null;
    const discount = parsed.discount !== null && parsed.discount !== undefined ? parseNumericAmount(parsed.discount) : null;
    const currency = typeof parsed.currency === 'string' && parsed.currency.trim().length > 0 ? parsed.currency.trim().toUpperCase() : 'MYR';

    const buyerTIN = sanitizeTIN(parsed.buyer_tin);
    const supplierTIN = sanitizeTIN(parsed.supplier_tin);
    const buyerName = typeof parsed.buyer_name === 'string' && parsed.buyer_name.trim().length > 0 ? parsed.buyer_name.trim() : undefined;
    const vendorName = typeof parsed.supplier_name === 'string' && parsed.supplier_name.trim().length > 0 ? parsed.supplier_name.trim() : undefined;
    const invoiceNumber = typeof parsed.invoice_number === 'string' && parsed.invoice_number.trim().length > 0 ? parsed.invoice_number.trim() : undefined;
    const date = typeof parsed.invoice_date === 'string' && parsed.invoice_date.trim().length > 0 ? parsed.invoice_date.trim() : undefined;

    let items: InvoiceLineItem[] | undefined = undefined;
    if (Array.isArray(parsed.line_items) && parsed.line_items.length > 0) {
      items = parsed.line_items.map((it: any) => ({
        description: typeof it.description === 'string' ? it.description.trim() : 'Item',
        quantity: typeof it.quantity === 'number' ? it.quantity : (it.quantity ? parseNumericAmount(it.quantity) : null),
        unitPrice: typeof it.unit_price === 'number' ? it.unit_price : (it.unit_price ? parseNumericAmount(it.unit_price) : null),
        discount: typeof it.discount === 'number' ? it.discount : (it.discount ? parseNumericAmount(it.discount) : null),
        tax: typeof it.tax === 'number' ? it.tax : (it.tax ? parseNumericAmount(it.tax) : null),
        total: typeof it.total === 'number' ? it.total : (it.total ? parseNumericAmount(it.total) : null),
      }));
    }

    let paymentInfo: InvoicePaymentInfo | null = null;
    if (parsed.payment_information && typeof parsed.payment_information === 'object') {
      const p = parsed.payment_information;
      if (p.bank_name || p.bank_account_number || p.payment_terms || p.payee_name) {
        paymentInfo = {
          bankName: typeof p.bank_name === 'string' ? p.bank_name.trim() : null,
          bankAccountNumber: typeof p.bank_account_number === 'string' ? p.bank_account_number.trim() : null,
          paymentTerms: typeof p.payment_terms === 'string' ? p.payment_terms.trim() : null,
          payeeName: typeof p.payee_name === 'string' ? p.payee_name.trim() : null,
        };
      }
    }

    // Keep provider-supplied confidence only. A missing confidence value is unknown,
    // represented as 0 so downstream safety checks route the result for review.
    const confidence = typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1
      ? parsed.confidence
      : 0;

    const fieldConf = parsed.field_confidence || {};

    return {
      amount,
      subtotal,
      tax,
      discount,
      currency,
      documentType: 'Invoice',
      buyerTIN,
      buyerName,
      buyer: {
        name: buyerName || '',
        tin: buyerTIN,
      },
      supplierTIN,
      vendorName,
      supplier: {
        name: vendorName || '',
        tin: supplierTIN,
      },
      invoiceNumber,
      date,
      items,
      paymentInfo,
      taxableAmount: subtotal ? subtotal - (discount || 0) : amount,
      totalPayable: amount,
      totals: {
        subtotal,
        discount,
        taxableAmount: subtotal ? subtotal - (discount || 0) : amount,
        taxAmount: tax,
        totalPayable: amount,
      },
      confidence,
      confidenceBasis: 'model-reported',
      method: 'ai',
      fieldConfidence: {
        amount: typeof fieldConf.total === 'number' && fieldConf.total >= 0 && fieldConf.total <= 1 ? fieldConf.total : 0,
        buyerTIN: buyerTIN ? (typeof fieldConf.buyer_tin === 'number' && fieldConf.buyer_tin >= 0 && fieldConf.buyer_tin <= 1 ? fieldConf.buyer_tin : 0) : 0,
        buyerName: 0,
        supplierName: 0,
        supplierTIN: supplierTIN ? (typeof fieldConf.supplier_tin === 'number' && fieldConf.supplier_tin >= 0 && fieldConf.supplier_tin <= 1 ? fieldConf.supplier_tin : 0) : 0,
        invoiceNumber: invoiceNumber ? (typeof fieldConf.invoice_number === 'number' && fieldConf.invoice_number >= 0 && fieldConf.invoice_number <= 1 ? fieldConf.invoice_number : 0) : 0,
        date: date ? (typeof fieldConf.invoice_date === 'number' && fieldConf.invoice_date >= 0 && fieldConf.invoice_date <= 1 ? fieldConf.invoice_date : 0) : 0,
        items: 0,
      },
      extractionNotes: 'Extracted via server-side Gemini multimodal AI fallback (structured JSON).',
      rawPayload: parsed,
    };
  } catch (err: any) {
    console.warn('[parseInvoiceGeminiFallback] Gemini fallback failed:', err?.message);
    return null;
  }
}

// =========================================================================
// Master Multi-Format Reader Pipeline
// =========================================================================
export async function readInvoiceDocument(
  buffer: Buffer,
  filename: string,
  mimetype: string
): Promise<NormalizedInvoiceData> {
  const lowerName = (filename || '').toLowerCase();
  const lowerMime = (mimetype || '').toLowerCase();
  const isXML = lowerName.endsWith('.xml') || lowerMime.includes('xml') || buffer.slice(0, 50).toString('utf-8').includes('<?xml');
  const isJSON = lowerName.endsWith('.json') || lowerMime.includes('json');
  const isPDF = lowerName.endsWith('.pdf') || lowerMime.includes('pdf') || buffer.slice(0, 5).toString('ascii').startsWith('%PDF-');
  const isImage = lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerMime.startsWith('image/');

  // -----------------------------------------------------------------------
  // Priority 1: XML → Deterministic XML parser
  // (Do NOT use Gemini for XML when deterministic parsing is possible)
  // -----------------------------------------------------------------------
  if (isXML) {
    const xmlResult = parseInvoiceXML(buffer);
    if (xmlResult) {
      return xmlResult;
    }
    // If deterministic XML parsing failed to locate amount, attempt Gemini fallback
    const geminiXml = await parseInvoiceGeminiFallback(buffer, mimetype, buffer.toString('utf-8'));
    if (geminiXml) {
      return geminiXml;
    }
    throw new Error('FAILED_AUTOMATED_EXTRACTION');
  }

  // -----------------------------------------------------------------------
  // Priority 2: JSON → Deterministic JSON parser
  // (Do NOT use Gemini for JSON when deterministic parsing is possible)
  // -----------------------------------------------------------------------
  if (isJSON) {
    const jsonResult = parseInvoiceJSON(buffer);
    if (jsonResult) {
      return jsonResult;
    }
    // If deterministic JSON failed to locate amount, attempt Gemini fallback
    const geminiJson = await parseInvoiceGeminiFallback(buffer, mimetype, buffer.toString('utf-8'));
    if (geminiJson) {
      return geminiJson;
    }
    throw new Error('FAILED_AUTOMATED_EXTRACTION');
  }

  // -----------------------------------------------------------------------
  // Priority 3: QR Code → QR Decoder (for Images)
  // -----------------------------------------------------------------------
  if (isImage) {
    const qrResult = parseInvoiceQR(buffer);
    if (qrResult) {
      return qrResult;
    }
  }

  // -----------------------------------------------------------------------
  // Priority 4: Text-based PDF → PDF Text Extraction
  // -----------------------------------------------------------------------
  if (isPDF) {
    const pdfTextResult = await parseInvoicePDFText(buffer);
    if (pdfTextResult && pdfTextResult.amount > 0) {
      return pdfTextResult;
    }
    // For complex PDF layouts, scanned PDFs, or low-confidence PDF text, fall through to Gemini!
  }

  // -----------------------------------------------------------------------
  // Priority 5: Scanned PDF / JPG / JPEG / PNG → OCR
  // -----------------------------------------------------------------------
  if (isImage) {
    const ocrResult = await parseInvoiceOCR(buffer);
    if (ocrResult && ocrResult.amount > 0) {
      return ocrResult;
    }
    // For scanned invoices, poor OCR results, JPG/JPEG/PNG messy photos, fall through to Gemini!
  }

  // -----------------------------------------------------------------------
  // Priority 6: Gemini Fallback (if incomplete or unreliable)
  // Handles difficult cases: complex PDF layouts, scanned invoices, poor OCR, JPG/PNG receipts, unusual layouts
  // -----------------------------------------------------------------------
  const geminiResult = await parseInvoiceGeminiFallback(buffer, mimetype);
  if (geminiResult && geminiResult.amount > 0) {
    return geminiResult;
  }

  // -----------------------------------------------------------------------
  // Priority 7: Manual Entry Fallback (all automated methods failed)
  // -----------------------------------------------------------------------
  throw new Error('FAILED_AUTOMATED_EXTRACTION');
}
