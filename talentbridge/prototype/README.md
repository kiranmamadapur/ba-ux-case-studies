# TalentBridge prototype

A working browser app for the TalentBridge concept project (fictional recruiting team, simulated data). Open `index.html` in a browser, or serve the repo with GitHub Pages. No build step, no network calls.

Run the rule tests (Node 18 or later): `node --test` in this folder.

## What is real and what is simulated

| Real in this prototype | Simulated or not built |
|---|---|
| Pipeline board with stages. Move candidates by drag and drop or with the arrow buttons. Every move is saved with a timestamp and history | Candidates, roles and recruiters are fictional |
| Candidate profile with notes, rating and resume file name. Contact data is shown only to the assigned recruiter | A role switcher stands in for sign-in. There is no real access control. Anyone with browser access can read the stored data |
| Add candidate with validation and duplicate email detection | The resume is a file name only. No file is uploaded |
| Interview scheduling with a clash check for the interviewer and the candidate | No calendar sync and no invitations are sent |
| Hiring manager shortlist: rating 4 or above only | |
| Weekly report by role with stage counts and days open, plus CSV download | KPI baselines and targets in the case study are assumptions. No UAT has been run |
| Button to load 500 demo candidates and show the measured render time | Timing is for your browser, not a server |
| Data is saved in `localStorage` under `tb:v2` with a schema version | Not encrypted |

## Files

| File | Purpose |
|---|---|
| `logic.js` | Pure business rules (no DOM). Loaded as `window.TB` in the browser and with `require` in Node |
| `logic.test.js` | 32 `node:test` tests for the rules |
| `app.js` | State, rendering, role switcher, drag and drop |
| `index.html`, `extra.css` | Page and styles. Shared base styles come from `../../shared/` |

## Traceability

| Requirement | Where it is built | Tests |
|---|---|---|
| FR1 Move candidates across pipeline stages | `moveCandidate`, `canMove`; Pipeline board | AC1, UAT1, move rules, history |
| FR2 Candidate profile with notes and resume | `saveProfile`, `addCandidate`, `validateCandidate`; profile panel | profile and add-candidate tests |
| FR3 Schedule interviews with calendar check | `scheduleInterview`; profile panel | FR3 tests |
| FR4 Weekly pipeline report by role | `weeklyReport`, `reportToCsv`; Weekly report view | AC3, UAT3, CSV tests |
| NFR Only assigned recruiters see contact data | `canViewContact`, `contactFor`, `canEdit`, `canSchedule` | NFR1 tests |
| NFR Board loads 500 candidates in under 3 seconds | Load 500 button, measured in the page | NFR2 tests |

### Acceptance criteria

1. Drop a card in a new stage, change saved with a timestamp: AC1.
2. Role shortlist shows only candidates rated 4 or above: AC2.
3. Weekly report lists roles, stages and days open: AC3.

### UAT scenarios

1. Move a candidate to Interview, stage and date saved: UAT1.
2. Hiring manager opens a shortlist, only shortlisted shown: UAT2.
3. Run the weekly report, counts match the board: UAT3.

### Other behaviour covered

The CSV export neutralises formula injection. Old or corrupt saved data falls back to fresh sample data. A change made in one browser tab shows in another tab.

## Not verified

Screen-reader behaviour and keyboard-only use were not tested by a person. Contrast was reasoned from the colours, not measured with a tool. A headless Chromium run at 360px width loaded the board, switched roles and loaded 500 candidates (render about 50 ms), with no console errors. Drag and drop was not exercised in a browser.
