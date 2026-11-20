# UrbanThread: Process flow

> **Concept project.** Independent case study created to demonstrate BA and UI/UX method. The client, users and data are fictional, and the KPI baselines and targets are assumptions. Nothing here is client work.

[← All case studies](../README.md)

## Current state

Filters open on a separate page and reset on every change. Checkout needs an account and has six steps.

## Future-state flow

![BPMN-style flow](../assets/bpmn.svg)

Same flow as a diagram GitHub renders from text:

```mermaid
flowchart LR
  subgraph L0["Customer"]
    S(("Start"))
    T0["Browse, filter"]
    T1["Add to bag"]
    T3["Guest checkout"]
  end
  subgraph L1["App"]
    T2["Check stock"]
    G{"In stock?"}
    T4["Confirm, notify"]
  end
  subgraph L2["Support"]
    T5["Handle issues"]
    E(("End"))
    X["Grey out size"]
  end
  S --> T0
  T0 --> T1
  T1 --> T2
  T2 --> G
  G -->|Yes| T3
  T3 --> T4
  T4 --> T5
  T5 --> E
  G -->|No| X
  style X stroke:#e5484d,stroke-dasharray:4 2
```

## Sitemap

![Sitemap](../assets/sitemap.svg)
