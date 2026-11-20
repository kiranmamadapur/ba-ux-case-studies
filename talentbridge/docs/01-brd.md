# TalentBridge: Business Requirements Document (summary)

> **Concept project.** Independent case study created to demonstrate BA and UI/UX method. The client, users and data are fictional, and the KPI baselines and targets are assumptions. Nothing here is client work.

[← All case studies](../README.md)

**Version 1.0 · Status: Draft for review**

## 1. Background

A shared candidate pipeline to replace spreadsheets and email threads for a small recruiting team.

## 2. Problem statement

Candidates get lost between recruiters, and nobody sees the true status of a role.

## 3. Business objectives

- One pipeline for every role
- Fewer lost candidates
- Faster shortlist

## 4. Scope

**In scope:** pipeline board, candidate profile, interview scheduling, reports

**Out of scope:** payroll, job-board posting

## 5. Stakeholders

| Stakeholder | Interest |
|---|---|
| Business owner | HR head: time to hire |
| End users | Recruiters and hiring managers |
| Operations | Coordinators: interview scheduling |
| Customer support | Candidates: status questions |
| Product / IT | Access control and exports |
| Admin | HR admin: roles and reports |

## 6. Current-state process

Candidates live in spreadsheets and email threads, and nobody sees the true status.

## 7. Future-state process

One board per role with stages, notes and scheduled interviews.

## 8. Business rules

- A candidate sits in one stage at a time
- Only assigned recruiters see contact details

## 9. Assumptions

- Teams handle under 500 active candidates
- Interviewers use a shared calendar

## 10. Constraints

- No payroll integration
- Resumes are stored as files

## 11. Risks and mitigation

| Risk | Mitigation |
|---|---|
| Recruiters keep using sheets | Import existing data |
| Wrong stage moves | Allow undo for 10 minutes |

## 12. Success metrics

- Days to shortlist
- Candidates lost in handoff (%)
- Recruiter hours on status updates per week
