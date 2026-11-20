# NovaBank: Business Requirements Document (summary)

> **Concept project.** Independent case study created to demonstrate BA and UI/UX method. The client, users and data are fictional, and the KPI baselines and targets are assumptions. Nothing here is client work.

[← All case studies](../README.md)

**Version 1.0 · Status: Draft for review**

## 1. Background

A mobile banking flow for transfers, beneficiaries and transaction search, using simulated data.

## 2. Problem statement

Customers drop transfers when adding a beneficiary is slow and security prompts are unclear.

## 3. Business objectives

- Raise transfer completion
- Speed up adding a beneficiary
- Make security steps understandable

## 4. Scope

**In scope:** transfer, beneficiaries, transaction search, security prompts

**Out of scope:** loans, cards, investments

## 5. Stakeholders

| Stakeholder | Interest |
|---|---|
| Business owner | Retail banking head: digital adoption |
| End users | Customers making transfers |
| Operations | Payments team: clean transfer data |
| Customer support | Fewer failed-transfer calls |
| Product / IT | Secure, auditable transfers |
| Admin | Risk team: limits and fraud rules |

## 6. Current-state process

Adding a beneficiary takes many fields and a delayed code, and error messages are vague.

## 7. Future-state process

Account validation shows the holder name, the one-time code is clear and receipts are searchable.

## 8. Business rules

- Transfers above the daily limit are blocked
- New beneficiaries need a one-time code

## 9. Assumptions

- Account validation answers within 2 seconds
- Customers have a registered mobile number

## 10. Constraints

- Regulatory limits cannot change
- Release 1 covers domestic transfers only

## 11. Risks and mitigation

| Risk | Mitigation |
|---|---|
| Fraud on new beneficiaries | Keep the one-time code and a cooling limit |
| Customers confuse limits | Show the limit before the amount |

## 12. Success metrics

- Transfer completion (%)
- Time to add beneficiary (sec)
- Failed-transfer calls per week
