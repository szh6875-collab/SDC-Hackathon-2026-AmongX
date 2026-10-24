# Orbyte Hub — official policy sources (verified 23 October 2026)

The Policy Source Monitoring section intentionally uses policy/document listing pages, not a generic government homepage or a developer SDK as if it were a policy source.

1. **LHDN e-Invoice Guidelines — General and Specific PDFs**  
   https://www.hasil.gov.my/e-invois/rujukan-pelaksanaan-e-invois/garis-panduan/  
   The official listing currently shows General Guideline v4.8 (published 30 August 2026) and Specific Guideline v4.9 (published 7 September 2026). These are the primary e-Invoice guidance documents.

2. **LHDN e-Invoice FAQs — General and industry-specific official clarifications**  
   https://www.hasil.gov.my/e-invois/rujukan-pelaksanaan-e-invois/soalan-lazim/  
   The official page lists general, industry-specific and MyInvois portal FAQs; the page reported an update on 22 June 2026 when checked. Read the update date on each linked FAQ/PDF before relying on it.

3. **Ministry of Finance — The Fifth MADANI Budget 2027 Speech**  
   https://www.mof.gov.my/portal/en/news/speech/speech-the-fifth-madani-budget-2027  
   Official speech dated 9 October 2026 with budget policy announcements relevant to SMEs and taxation. A Budget speech is not by itself proof every measure has been enacted or commenced; check subsequent legislation/gazette and each measure's effective date.

## What the monitor actually verifies

- The local website checker hashes each configured official listing/speech page and flags page changes for review. A changed web page is not automatically considered a legal-policy change.
- The n8n + Supabase snapshot pipeline stores extracted-text SHA-256 baselines for the **General and Specific e-Invoice PDFs and the official FAQ index and the linked downloadable FAQ PDFs**. All three IDs (`lhdn-general-guideline`, `lhdn-specific-guideline`, `lhdn-faq`) must be present in `policy_sources`; the same history table stores PDF and HTML text. The scheduled crawler fetches each linked official FAQ PDF and includes its extracted text in the searchable corpus; each citation links to the specific PDF where available. MOF Budget speech pages remain registered sources but are not included in the scheduled n8n crawl by default.
- The MyInvois SDK (`https://sdk.myinvois.hasil.gov.my/`) is an official **technical documentation** resource, not a primary legal/policy publication, so it is no longer shown as a policy source card. It can still be used as a technical reference for API/schema changes.
- No source-page or PDF hash automatically activates a compliance rule. Compare the actual document, effective date and legal status, test the candidate rule, and obtain authorised human approval.
