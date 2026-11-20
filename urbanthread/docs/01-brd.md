# UrbanThread: Business Requirements Document (summary)

> **Concept project.** Independent case study created to demonstrate BA and UI/UX method. The client, users and data are fictional, and the KPI baselines and targets are assumptions. Nothing here is client work.

[← All case studies](../README.md)

**Version 1.0 · Status: Draft for review**

## 1. Background

A redesign of a mid-size fashion shopping app, focused on discovery, filters and checkout.

## 2. Problem statement

Shoppers abandon carts when filters are slow and checkout asks for too much.

## 3. Business objectives

- Cut checkout steps
- Make filters usable with one hand
- Show order status without a support call

## 4. Scope

**In scope:** browse, filters, product, wishlist, checkout, tracking

**Out of scope:** payment gateway build, seller portal

## 5. Stakeholders

| Stakeholder | Interest |
|---|---|
| Business owner | Head of e-commerce: conversion and sales |
| End users | Shoppers: quick filters and checkout |
| Operations | Warehouse: accurate stock and dispatch |
| Customer support | Fewer order-status calls |
| Product / IT | Maintainable filters and checkout |
| Admin | Merchandiser: collections and promotions |

## 6. Current-state process

Filters open on a separate page and reset on every change. Checkout needs an account and has six steps.

## 7. Future-state process

One filter sheet with live counts, guest checkout in three steps and an order tracking page.

## 8. Business rules

- Out-of-stock sizes show greyed out
- Guest orders need only email, address and payment

## 9. Assumptions

- Stock data updates in near real time
- Most traffic comes from mobile

## 10. Constraints

- The existing payment gateway stays
- The catalogue structure does not change

## 11. Risks and mitigation

| Risk | Mitigation |
|---|---|
| Filters slow on a large catalogue | Server-side filtering with caching |
| Fewer account sign-ups | Offer account creation after the order |

## 12. Success metrics

- Checkout completion (%)
- Filters used per session
- Status tickets per 100 orders
