# Orbyte InvoisReady

> A web app that helps Malaysian SME owners check WhatsApp e-invoice requests against the latest LHDN rules, with a human approving every draft before anything is issued.

---

## Team Information

| Field                  | Details                                     |
| ---------------------- | ------------------------------------------- |
| **Team Name**          | Among X                                     |
| **Team Domain**        | Domain 2 — Orbyte Smart SME Challenge: Less Busywork, Better Business (Alpha Red Solutions) |
| **SDG Track (1–17)**   | SDG 8 — Decent Work and Economic Growth (relevant: SDG 9) |
| **Team Leader**        | Soh Zheng Hao                               |
| **University**         | HELP University and University Malaya       |
| **Number of Members**  | 4                                           |

## Links

| Resource          | Link                                           |
| ----------------- | ---------------------------------------------- |
| GitHub Repository | https://github.com/your-username/your-project  |
| Replit Project    | https://replit.com/@your-username/your-project |
| Live Demo         | https://your-project.replit.app                |
| RunPod Endpoint   | https://api.runpod.ai/v2/your-endpoint-id      |
| Slide Deck        | https://example.com/slides                     |
| Demo Video        | https://example.com/demo-video                 |

---

## Overview

### Problem
Malaysian micro and small businesses run on WhatsApp, spreadsheets and manual follow-up. Since e-invoicing began in August 2024, owners must turn chat messages into LHDN-compliant e-invoices while the rules keep changing (for example, the exemption threshold rising from RM1 million to RM3 million from 1 September 2026). A busy owner or clerk has to decide from memory whether the amount forces an individual invoice, whether the buyer's TIN is present and whether the rule they remember is still current. Mistakes can attract reported fines of RM200 to RM20,000 per offence, and small firms cannot afford consultants.

### Solution
Orbyte InvoisReady is a plug-in module for the Orbyte business hub. When a buyer's WhatsApp message arrives, a Policy Checker Agent extracts the amount and buyer TIN, and deterministic Python rules decide pass, missing or fail against the current policy pack. Only the Owner role can approve a draft, and every action is written to a hash-chained audit log. AI is used only to read messy English, Malay and Manglish messages and to propose policy updates for human approval; it never decides compliance. The app only prepares drafts. It never files with LHDN, handles payments or gives legal or tax advice.

### Key Features

**WhatsApp automation** — Reads a chat message, extracts amount and TIN, and shows green / yellow / red rule checks with the source rule.
**Policy Checker** — Syncs a new rule pack, shows a diff, and applies it only after Owner approval. Each rule carries a clause, source and verified flag.
**Human in Control** — Clerks see masked TINs and a locked Approve button; Owners approve.
**Tamper-evident audit log** — SHA-256 hash chain with a Verify button that detects edits.
**AI with fallback** — RunPod-hosted model for extraction, with a regex extractor if the AI service is slow or offline.
**Blueprints** — Exempt Shield, Smart Consolidator and 72-Hour SLA Chaser.

### Tech Stack

| Layer         | Technology                   |
| ------------- | ---------------------------- |
| Frontend      | HTML, CSS, JavaScript        |
| Backend       |  |
| Database      | JSON files (hub, policy packs, announcements, audit log), all synthetic, Supabase |
| AI / Compute  | Gemini AI Studio             |
| Hosting / Dev | Replit, GitHub               |

---

## Project Structure
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

### Architecture
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

### Option 1 — Run on Replit (Recommended)

1. Open the [Replit Project](https://replit.com/@your-username/your-project), or import this repository via **Create Repl → Import from GitHub**.
2. Open the **Secrets** tab (🔒) and add the variables listed in `.env.example`:
   - `RUNPOD_API_KEY`
   - `RUNPOD_ENDPOINT_ID`
3. Click **Run**. Replit uses the `.replit` file to start `python src/main.py`.

### Option 2 — Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/your-username/your-project.git
cd your-project

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables
cp .env.example .env            # then fill in your values

# 5. Run the app
python src/main.py
```

### Run Tests

```bash
python -m unittest discover tests
```

---

## How We Use Replit *(Required)*

Describe how your team used Replit. For example:

- **Development:** Collaborative coding in a shared Repl using Multiplayer.
- **Hosting:** The app is deployed with Replit Deployments at the Live Demo link above.
- **Secrets:** API keys are stored in Replit Secrets, never in the code.

📄 Proof of use: [`submission/REPLIT PROOF OF USE.pdf`](submission/REPLIT%20PROOF%20OF%20USE.pdf)

## How We Use RunPod *(Required)*

Describe how your team used RunPod. For example:

- **Workload:** Model inference (e.g. text generation, image processing) runs on a RunPod GPU.
- **Setup:** `runpod/handler.py` is deployed as a **RunPod Serverless Endpoint**.
- **Integration:** The Replit app sends requests to the endpoint using `RUNPOD_API_KEY` and `RUNPOD_ENDPOINT_ID`.

Example request:

```bash
curl -X POST https://api.runpod.ai/v2/$RUNPOD_ENDPOINT_ID/runsync \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"prompt": "Hello"}}'
```

📄 Proof of use: [`submission/RUNPOD PROOF OF USE.pdf`](submission/RUNPOD%20PROOF%20OF%20USE.pdf)

---

## Challenges & Learnings (DONE)

- **Remote teamwork across universities:** Our team members study at different universities, so communication was less efficient than working in one place. Different university timetables made it hard to find a common time for meetings.
- **Progress tracking:** With no shared place to see who was doing what, it was hard to know the team's progress. We split the work by role (Backend, Frontend, Data & Pitch), agreed on one API contract (route and field names), and saved our work to GitHub at the end of each session.
- **Limited time:** The hackathon ran alongside school assignments, projects and other events, so we had little free time and had to rush to finish. We built the required journey first (WhatsApp check, role lock, audit log, policy sync) and treated extra features as optional, so a working demo came before polish.
- **Messy input:** Chat messages mix English, Malay and Manglish, and amounts appear as "RM 11,200", "RM11200" or "11200 ringgit". We used AI only to read the text, kept compliance decisions in deterministic rules, and added a regex fallback.
- **Rules keep changing:** The exemption threshold changed on 1 September 2026, so every rule carries a clear source and verified flag, and policy updates need Owner approval.
- **What we learned:** Clear roles, a shared API contract and short written updates matter more than long meetings for a remote team. Planning around everyone's workload and doing the essential parts first kept the project deliverable.

## Future Improvements

- [ ] Improvement 1
- [ ] Improvement 2

## Team (Done)

| Name            | Role                    | GitHub                                                        |
| --------------- | ----------------------- | ------------------------------------------------------------- |
| Soh Zheng Hao   | Leader and Backend      | [@szh6875-collab](https://github.com/szh6875-collab)          |
| Lau Wei Zhe     | AI, Frontend and Slides | [@lausteady68-hue](https://github.com/lausteady68-hue)        |
| Wong Shun Bing  | AI, Replit and Backend  | [@beeengs · bing](https://github.com/beeengs)                 |
| Zhang Yuan Ming | AI and Backend          | [[@3195635953-cmd](https://github.com/3195635953-cmd)         |
| Lee Wei Yeng    | AI, Frontend ans Slides | [[@lee154897-creator](https://github.com/lee154897-creator)   |

---

## Submission Checklist

- [DONE] Team name, domain (Domain 1 / Domain 2) and SDG track filled in
- [ ] Slide deck link added
- [ ] Demo video link added
- [ ] Replit used, with proof of use in `submission/`
- [ ] RunPod used, with proof of use in `submission/`
- [ ] Submission template completed in `submission/`
- [ ] "How to Run" steps verified
- [ ] No API keys or secrets committed to the repository

## License

This project is licensed under the [Apache License 2.0](LICENSE).
