# QuickBite: Business Requirements Document (summary)

> **Concept project.** Independent case study created to demonstrate BA and UI/UX method. The client, users and data are fictional, and the KPI baselines and targets are assumptions. Nothing here is client work.

[← All case studies](../README.md)

**Version 1.0 · Status: Draft for review**

## 1. Background

A service design of ordering, restaurant and delivery-partner journeys, with the KPIs to run it.

## 2. Problem statement

Orders arrive late and wrong because the restaurant and the rider are not in sync.

## 3. Business objectives

- Shorten order-to-door time
- Raise order accuracy
- Give customers honest tracking

## 4. Scope

**In scope:** ordering, restaurant tablet, rider app, tracking, KPI dashboard

**Out of scope:** restaurant onboarding, payouts

## 5. Stakeholders

| Stakeholder | Interest |
|---|---|
| Business owner | Operations head: delivery time and cost |
| End users | Customers and riders |
| Operations | Restaurant partners: a clear queue |
| Customer support | Fewer where-is-my-order chats |
| Product / IT | Reliable live tracking |
| Admin | Dispatcher: rider assignment |

## 6. Current-state process

Restaurants confirm by phone, riders are assigned by hand and arrival times are guesses.

## 7. Future-state process

Restaurants accept on a tablet with a prep time, riders are assigned automatically and customers see live tracking.

## 8. Business rules

- An order is assigned only after the restaurant accepts
- Cancelled paid orders are refunded automatically

## 9. Assumptions

- Restaurants keep a tablet at the counter
- Riders share location while delivering

## 10. Constraints

- The rider app runs on low-end phones
- Map requests cost money

## 11. Risks and mitigation

| Risk | Mitigation |
|---|---|
| Prep time estimates are wrong | Update them from real prep history |
| Rider shortage at peak | Show a longer, honest arrival time |

## 12. Success metrics

- Order-to-door time (min)
- Order accuracy (%)
- Cancelled orders (%)
