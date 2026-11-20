# MediCare Plus prototype

A working browser app for the MediCare Plus concept project (fictional clinic, simulated data). Open `index.html` in a browser, or serve the repo with GitHub Pages. No build step, no network calls.

Run the rule tests (Node 18 or later): `node --test` in this folder.

## What is real and what is simulated

| Real in this prototype | Simulated or not built |
|---|---|
| Booking, rescheduling, cancelling from live availability, with double booking blocked at commit time and across two open tabs | Patients, doctors, schedules and the 7 seeded sample visits are fictional |
| Role views: a patient sees only appointments booked with their phone number | No login. Identity is a name and phone typed on the page |
| Reminders are generated 24 hours before each visit | Nothing is ever sent (no SMS or email) |
| Expected wait at check-in from the queue and each doctor's average consult length | Consult lengths are assumptions |
| Report figures are computed from appointments in this browser | KPI baselines and targets in the case study are assumptions; no UAT has been run |
| Data is saved in `localStorage` under `mc:v2` with a schema version | **Not encrypted.** Encryption of patient data is a requirement of the case study but cannot be done meaningfully in a browser demo |

## Files

| File | Purpose |
|---|---|
| `logic.js` | Pure business rules (no DOM). Loaded as `window.MC` in the browser and with `require` in Node |
| `logic.test.js` | 16 `node:test` tests for the rules |
| `app.js` | State, rendering, role switcher, cross-tab sync |
| `index.html`, `extra.css` | Page and styles. Shared base styles come from `../../shared/` |

## Traceability

| Requirement | Where it is built | Tests |
|---|---|---|
| FR1 Book a slot from live doctor availability | `availableSlots`, `book` in `logic.js`; Patient view in `app.js` | AC1, UAT1 |
| FR2 Block a slot once booked | `taken` check in `book` and `reschedule`; `commit` re-reads stored data before writing; `storage` event in `app.js` clears a slot another tab just took | AC1, UAT1 (stale tabs), reschedule into a taken slot |
| FR3 Reminder 24 hours before the visit | `reminderAt`, `reminders`; Reminders card in the Patient view | AC3 |
| FR4 Show expected wait time at check-in | `waitFor`, `checkIn`; shown to the patient and in the doctor list | AC4 / FR4, UAT3 |
| NFR Patient data is role-restricted | `patientView`, `dayList`, `calendar`; the Patient view never lists other people's visits | NFR role test |
| NFR Patient data is encrypted | **Not implemented** (stated in the app and above) | none |
| NFR Booking completes in under 4 taps | Doctor, slot, confirm = 3 taps once details are saved; the date defaults to tomorrow | `BOOKING_FLOW` test |

### Acceptance criteria

1. Open slot booked then gone for other patients: AC1.
2. Booked slot visible to staff with the patient name: AC2 (Receptionist calendar).
3. Reminder sent 24 hours before: AC3 (generated, not sent).

### UAT scenarios

1. Two users book the same slot, second is blocked: UAT1.
2. Reschedule, old slot reopens: UAT2.
3. Check in, wait time shown: UAT3.

### Other behaviour covered

Walk-ins take the next free slot today and are flagged. Call-in and mark-done follow visit order. The doctor day list is ordered by time. Name and 10-digit phone are validated. Online booking covers tomorrow to three days ahead. Old or corrupt stored data falls back to fresh seeded data.

## Not verified

Screen-reader behaviour and keyboard-only use were not tested by a person. Contrast was reasoned from the colours, not measured with a tool.
