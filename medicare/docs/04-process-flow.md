# MediCare Plus: Process flow

> **Concept project.** Independent case study created to demonstrate BA and UI/UX method. The client, users and data are fictional, and the KPI baselines and targets are assumptions. Nothing here is client work.

[← All case studies](../README.md)

## Current state

Reception books by phone in a paper register and slots overlap.

## Future-state flow

![BPMN-style flow](../assets/bpmn.svg)

Same flow as a diagram GitHub renders from text:

```mermaid
flowchart LR
  subgraph L0["Patient"]
    S(("Start"))
    T0["Request slot"]
    T3["Check in"]
  end
  subgraph L1["System"]
    T1["Check availability"]
    G{"Slot free?"}
    T2["Confirm, remind"]
  end
  subgraph L2["Clinic staff"]
    T4["Call patient in"]
    T5["Close visit"]
    E(("End"))
    X["Offer next slot"]
  end
  S --> T0
  T0 --> T1
  T1 --> G
  G -->|Yes| T2
  T2 --> T3
  T3 --> T4
  T4 --> T5
  T5 --> E
  G -->|No| X
  style X stroke:#e5484d,stroke-dasharray:4 2
```

## Sitemap

![Sitemap](../assets/sitemap.svg)
