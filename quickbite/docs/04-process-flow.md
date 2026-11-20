# QuickBite: Process flow

> **Concept project.** Independent case study created to demonstrate BA and UI/UX method. The client, users and data are fictional, and the KPI baselines and targets are assumptions. Nothing here is client work.

[← All case studies](../README.md)

## Current state

Restaurants confirm by phone, riders are assigned by hand and arrival times are guesses.

## Future-state flow

![BPMN-style flow](../assets/bpmn.svg)

Same flow as a diagram GitHub renders from text:

```mermaid
flowchart LR
  subgraph L0["Customer"]
    S(("Start"))
    T0["Place order"]
    T5["Rate order"]
    E(("End"))
  end
  subgraph L1["Restaurant"]
    T1["Accept, set prep"]
    G{"Accepted?"}
    T2["Assign rider"]
  end
  subgraph L2["Rider"]
    T3["Pick up"]
    T4["Deliver"]
    X["Cancel and refund"]
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
