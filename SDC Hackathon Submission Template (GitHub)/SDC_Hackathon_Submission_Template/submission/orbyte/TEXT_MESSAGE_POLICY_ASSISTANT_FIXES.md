# Text / Message Intake and Policy Assistant Fixes

## Text / WhatsApp Message Intake
- Expanded deterministic extraction for common labels such as `Amount`, `Amount Due`, `Invoice Amount`, and `Jumlah`.
- Improved buyer/customer name extraction for labeled fields and common phrases such as `invoice to ...`.
- Return deterministic results promptly when a valid total amount was found, instead of waiting for unnecessary AI retries when the TIN is missing.
- Bound individual AI extraction attempts to 12 seconds and clear timeout timers after completion.
- Prevent creating zero-value invoice drafts when no amount can be found; the user now receives a visible, actionable error.
- Show extraction errors inside the chat bubble, and make background dashboard refresh failures non-blocking after successful extraction.

## Policy Assistant
- Enforced readable dark text on assistant/user message bubbles.
- Added visible fallback text when a response payload is empty or the AI, evidence, or source service is unavailable.
- Automatically scroll the conversation to the latest answer.

## Checks performed
- TypeScript/TSX syntax transpilation checks passed for the modified files.
- Deterministic parser tests passed for three sample message formats, including an RM 11,200 WhatsApp message, an explicit buyer/TIN format, and a plain `Amount` label.
- A full Vite/TypeScript project build could not be completed in this environment because project dependencies were not installed and `npm install` timed out. Please run `npm install` and `npm run build` in the deployment environment before publishing.
