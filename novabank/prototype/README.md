# NovaBank prototype

A working browser app for the NovaBank concept project (fictional bank, simulated data). Open `index.html` in a browser, or serve the repo with GitHub Pages. No build step, no network calls. Demo PIN: `2468`.

Run the rule tests (Node 18 or later): `node --test` in this folder.

To see the inactivity rule quickly, open `index.html?timeout=20&warn=10` (seconds). Without the query string it is 5 minutes with a warning in the last 30 seconds.

## What is real and what is simulated

| Real in this prototype | Simulated or not built |
|---|---|
| Account number check (digits, 9 to 18 long, checksum) and IFSC format check, with errors that explain the problem | The account directory is 5 fictional accounts. No real bank lookup |
| One-time code for new beneficiaries, 3 tries then locked | The code is shown on screen in a labelled demo box. No SMS is sent |
| Per-transfer and daily limits, with the limit shown in the message and a form to change it | Limits and the bank-wide ceilings are assumptions |
| Balance can never go below zero. Each transfer gets a unique reference id and a receipt | No money moves. The balance is a number in your browser |
| Transaction search by name, note, reference, exact amount and date range, newest first | 12 seeded sample transactions |
| Session ends after 5 minutes of no activity, with a visible warning and countdown | Sign-in is a demo PIN. It is not real authentication |
| Balance and account numbers are masked until you press the reveal button | Masking on screen is not encryption. Nothing is protected from someone with browser access |
| Data is saved in `localStorage` under `nb:v2` with a schema version | Not encrypted. Reload signs you out |

## Files

| File | Purpose |
|---|---|
| `logic.js` | Pure business rules (no DOM). Loaded as `window.NB` in the browser and with `require` in Node |
| `logic.test.js` | 30 `node:test` tests for the rules |
| `app.js` | State, rendering, session timer, forms |
| `index.html`, `extra.css` | Page and styles. Shared base styles come from `../../shared/` |

## Traceability

| Requirement | Where it is built | Tests |
|---|---|---|
| FR1 Add a beneficiary with account validation | `validateAccount`, `validateIfsc`, `startBeneficiary`; Beneficiaries view | AC1, UAT1, duplicate and IFSC tests |
| FR2 Transfer with amount limit check | `checkTransfer`, `setLimits`, `transfer`; Send money view | AC2, UAT2, daily limit, balance, limit change |
| FR3 Search transactions by date, amount or name | `searchTxns`; Transactions view | AC3, UAT3, date range |
| FR4 One-time code for new beneficiaries | `newOtp`, `verifyOtp`, `addBeneficiary`; New tag for 24 hours | OTP tests |
| NFR Session expires after 5 minutes | `sessionStatus`; timer and warning in `app.js` | session tests, activity reset |
| NFR Sensitive data is masked on screen | `maskAccount`, `maskMoney`; reveal button | masking test |

### Acceptance criteria

1. Valid account number saved, name shown for confirmation: AC1.
2. Amount over the limit, limit shown with option to change: AC2.
3. Keyword search, newest first: AC3.

### UAT scenarios

1. Add a beneficiary with a wrong account, error explains the problem: UAT1.
2. Transfer above the limit, blocked with a clear message: UAT2.
3. Search by amount, correct results: UAT3.

### Other behaviour covered

PIN locks after 5 wrong tries. Old or corrupt saved data falls back to fresh sample data. The Insights view measures transfer completion and time to add a beneficiary from your own use of the demo.

## Not verified

Screen-reader behaviour and keyboard-only use were not tested by a person. Contrast was reasoned from the colours, not measured with a tool. A headless Chromium run at 360px width covered sign-in, add beneficiary, transfer, search, insights and the timeout warning, with no console errors.
