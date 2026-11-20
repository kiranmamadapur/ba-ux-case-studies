# MediCare Plus: Business Requirements Document (summary)

> **Concept project.** Independent case study created to demonstrate BA and UI/UX method. The client, users and data are fictional, and the KPI baselines and targets are assumptions. Nothing here is client work.

[← All case studies](../README.md)

**Version 1.0 · Status: Draft for review**

## 1. Background

Patient, doctor and admin flows for a clinic that books by phone and paper.

## 2. Problem statement

Patients wait long and double bookings happen because slots live in separate notebooks.

## 3. Business objectives

- Remove double bookings
- Show expected wait time
- Cut front-desk phone load

## 4. Scope

**In scope:** booking, rescheduling, doctor calendar, check-in, admin report

**Out of scope:** billing, electronic health records

## 5. Stakeholders

| Stakeholder | Interest |
|---|---|
| Business owner | Clinic director: patient throughput |
| End users | Patients and doctors |
| Operations | Reception: one shared calendar |
| Customer support | Patient helpline: fewer booking calls |
| Product / IT | A secure, role-based system |
| Admin | Clinic admin: schedules and reports |

## 6. Current-state process

Reception books by phone in a paper register and slots overlap.

## 7. Future-state process

Patients book online from live availability, and a booked slot disappears for everyone else.

## 8. Business rules

- A slot holds one patient only
- A cancellation reopens the slot immediately

## 9. Assumptions

- Doctors maintain their own availability
- Patients have a phone number or email

## 10. Constraints

- No hospital records integration in release 1
- Patient data must stay encrypted

## 11. Risks and mitigation

| Risk | Mitigation |
|---|---|
| Doctors run late | Show expected wait time at check-in |
| Older patients avoid the app | Keep phone booking at reception |

## 12. Success metrics

- Average wait (min)
- Double bookings per week
- No-show rate (%)
