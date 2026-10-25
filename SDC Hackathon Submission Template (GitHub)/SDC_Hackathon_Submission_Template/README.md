# Orbyte InvoisReady (DONE)

> A web app that helps Malaysian SME owners check WhatsApp e-invoice requests against the latest LHDN rules, with a human approving every draft before anything is issued.

---

## Team Information (DONE)

| Field                  | Details                                     |
| ---------------------- | ------------------------------------------- |
| **Team Name**          | Among X                                     |
| **Team Domain**        | Domain 2 — Orbyte Smart SME Challenge: Less Busywork, Better Business (Alpha Red Solutions) |
| **SDG Track (1–17)**   | SDG 8 — Decent Work and Economic Growth (relevant: SDG 9) |
| **Team Leader**        | Soh Zheng Hao                               |
| **University**         | HELP University and University Malaya       |
| **Number of Members**  | 5                                           |

## Links (Haven't Done)

| Resource          | Link                                                              |
| ----------------- | ----------------------------------------------------------------- |
| GitHub Repository | (https://github.com/szh6875-collab/SDC-Hackathon-2026-AmongX.git) |
| Replit Project    | https://orbyte-zip.replit.app/app                  |
| Live Demo         | https://orbyte-zip.replit.app/app                                  |
| RunPod Endpoint   | https://api.runpod.ai/v2/your-endpoint-id                         |
| Slide Deck        | https://gamma.app/docs/A-safer-way-to-get-e-invoices-ready-7nw2r6dvxsfd36p?mode=doc|
| Demo Video        | https://youtu.be/fTDp3WtFyfY?si=K1u4tGq1SLu3Lym0                                  |

---

## Overview

### Problem (DONE)
Malaysian micro and small businesses run on WhatsApp, spreadsheets and manual follow-up. Since e-invoicing began in August 2024, owners must turn chat messages into LHDN-compliant e-invoices while the rules keep changing (for example, the exemption threshold rising from RM1 million to RM3 million from 1 September 2026). A busy owner or clerk has to decide from memory whether the amount forces an individual invoice, whether the buyer's TIN is present and whether the rule they remember is still current. Mistakes can attract reported fines of RM200 to RM20,000 per offence, and small firms cannot afford consultants.

### Solution (DONE)
Orbyte InvoisReady is a plug-in module for the Orbyte business hub. When a buyer's WhatsApp message arrives, a Policy Checker Agent extracts the amount and buyer TIN, and deterministic Python rules decide pass, missing or fail against the current policy pack. Only the Owner role can approve a draft, and every action is written to a hash-chained audit log. AI is used only to read messy English, Malay and Manglish messages and to propose policy updates for human approval; it never decides compliance. The app only prepares drafts. It never files with LHDN, handles payments or gives legal or tax advice.

### Key Features (Add if have extra)

- **WhatsApp automation** — Reads a chat message, extracts amount and TIN, and shows green / yellow / red rule checks with the source rule.
- **Policy Checker** — Syncs a new rule pack, shows a diff, and applies it only after Owner approval. Each rule carries a clause, source and verified flag.
- **Human in Control** — Clerks see masked TINs and a locked Approve button; Owners approve.
- **Tamper-evident audit log** — SHA-256 hash chain with a Verify button that detects edits.
- **AI with fallback** — RunPod-hosted model for extraction, with a regex extractor if the AI service is slow or offline.
- **Blueprints** — Exempt Shield, Smart Consolidator and 72-Hour SLA Chaser.

### Tech Stack (HAVEN'T DONE)

| Layer         | Technology                   |
| ------------- | ---------------------------- |
| Frontend      | HTML, CSS, JavaScript        |
| Backend       | JavaScript, TypeScript, SQL, Replit |
| Database      | JSON files (hub, policy packs, announcements, audit log), all synthetic, Supabase |
| AI / Compute  | Gemini AI Studio             |
| Hosting / Dev | Replit, GitHub               |

---

## Project Structure (DOUBLE CHECK)
.
├── data/
│   ├── hub.json                 # Simulated Orbyte hub data (synthetic)
│   ├── policy_pack.json         # Current rule pack
│   ├── policy_pack_next.json    # Next version, used for the Sync demo
│   ├── announcements.json
│   └── audit_log.json           # Hash-chained audit log
├── docs/                        # Screenshots, diagrams
├── runpod/
│   └── handler.py               # RunPod serverless handler (GPU workload)
├── static/                      # Frontend
│   ├── index.html
│   ├── policy.html
│   ├── invoice.html
│   ├── resources.html
│   ├── css/                     # main, home, policy, invoice, resources
│   └── js/                      # app, translations, policy, invoice, resources
├── submission/                  # Required submission documents
│   ├── REPLIT PROOF OF USE.pdf
│   ├── RUNPOD PROOF OF USE.pdf
│   └── Submission Template SDC Hackathon.pdf
├── tests/
│   └── test_utils.py            # Unit tests
├── app.py                       # Flask app: extract, check, approve, audit, policy sync
├── .env.example
├── .gitignore
├── .replit
├── LICENSE
├── requirements.txt
└── README.md

### Architecture (DOUBLE CHECK)
Browser (static/ + fetch with X-Role header)
        │
        ▼
Flask server (app.py)
  ├─ extract()  ──► RunPod Endpoint (AI)  ──fallback──► regex
  ├─ check()    ──► policy_pack.json rules (pass / missing / fail)
  ├─ approve()  ──► Owner role only (403 otherwise)
  └─ audit()    ──► hash-chained audit_log.json
        │
        ▼
Traffic-light result returned to the browser

---

## How to Run

### Option 1 — Run Locally

cd "/Users/wy/Downloads/orbyte-invoisready (1)"
npm install
npm run dev

---

## How We Use Replit *(Required)* (Done)

Lee Wei Yeng:
- **Development:** I use Replit’s edit and optimise code for our hackathon project. I use them to improve the HTML, CSS, and JavaScript, refine the website layout and test the prototype.
📄 Proof of use: [`submission/REPLIT PROOF OF USE.pdf`](https://drive.google.com/file/d/1c7mcnP-Hnb7Ty2PdNukc-AhvTb3ow1oJ/view?usp=drivesdk)

Wong Shun Bing:
- **Hosting the Orbyte Hub project:** running the combined Orbyte Hub backend (e-Invoice processing, policy monitoring, audit ledger API) and the Orbyte InvoisReady frontend as a single web app in the cloud. 
- **Development and testing:** importing the project, running it in Replit's preview, and checking the login, invoice submission, approval and audit-verification flows on a live URL. 
- **AI-assisted development (Replit Agent):** Replit Agent usage accounts for US$ 5.17 of the period's spend. 
- **Planned deployment:** publishing the app on a public replit.app link so the project can be demonstrated and shared.
📄 Proof of use: [`submission/REPLIT PROOF OF USE.pdf`](https://drive.google.com/file/d/12EDeSUvIXtx8IHlPoMhxV8DHos_F3kpd/view?usp=drive_link)

---

## Challenges & Learnings (DONE)

- **Remote teamwork across universities:** Our team members study at different universities, so communication was less efficient than working in one place. Different university timetables made it hard to find a common time for meetings.
- **Progress tracking:** With no shared place to see who was doing what, it was hard to know the team's progress. We split the work by role (Backend, Frontend, Data & Pitch), agreed on one API contract (route and field names), and saved our work to GitHub at the end of each session.
- **Limited time:** The hackathon ran alongside school assignments, projects and other events, so we had little free time and had to rush to finish. We built the required journey first (WhatsApp check, role lock, audit log, policy sync) and treated extra features as optional, so a working demo came before polish.
- **Messy input:** Chat messages mix English, Malay and Manglish, and amounts appear as "RM 11,200", "RM11200" or "11200 ringgit". We used AI only to read the text, kept compliance decisions in deterministic rules, and added a regex fallback.
- **Rules keep changing:** The exemption threshold changed on 1 September 2026, so every rule carries a clear source and verified flag, and policy updates need Owner approval.
- **What we learned:** Clear roles, a shared API contract and short written updates matter more than long meetings for a remote team. Planning around everyone's workload and doing the essential parts first kept the project deliverable.
- **Unfamiliar people and coding:** Collaborate at speed with relative strangers online using unfamiliar even new tools — ambiguity and exhaustion, not code, are the real adversaries.

## Future Improvements

_**Improvement 1**_
**Smarter Policy Impact Analysis**
- Instead of only explaining what a policy says, Orbyte can determine how a policy change affects a specific business. For example: “The minimum wage has changed. Your company has 18 employees, and 6 employees may be affected. Estimated monthly impact: RMXXX. Recommended action: Review payroll before the effective date.”This would make Orbyte more actionable and valuable for SME owners.]

_**Improvement 2**_
**Accounting & ERP Integration**
- Future versions could integrate with popular SME accounting systems such as:SQL Accounting, AutoCount,Xero,QuickBooks,Bukku
This would allow Orbyte to work directly with existing business data instead of requiring SMEs to manually upload information.


## Team (Done)

| Name            | Role                    | GitHub                                                        |
| --------------- | ----------------------- | ------------------------------------------------------------- |
| Soh Zheng Hao   | Leader, AI and Backend  | [@szh6875-collab](https://github.com/szh6875-collab)          |
| Lau Wei Zhe     | AI, Frontend and Slides | [@lausteady68-hue](https://github.com/lausteady68-hue)        |
| Wong Shun Bing  | AI, Replit and Backend  | [@beeengs · bing](https://github.com/beeengs)                 |
| Zhang Yuan Ming | AI and Backend          | [[@3195635953-cmd](https://github.com/3195635953-cmd)         |
| Lee Wei Yeng    | AI, Frontend ans Slides | [[@lee154897-creator](https://github.com/lee154897-creator)   |

---

## Submission Checklist

- [DONE] AmongX, domain (Domain 1 / Domain 2) and SDG track filled in
- [DONE] Slide deck link added
- [DONE] Demo video link added
- [DONE] Replit used, with proof of use in `submission/`
- [DONE] RunPod used, with proof of use in `submission/`
- [DONE] Submission template completed in `submission/`
- [ ] "How to Run" steps verified
- [DONE] No API keys or secrets committed to the repository

## License

This project is licensed under the [Apache License 2.0](LICENSE).
