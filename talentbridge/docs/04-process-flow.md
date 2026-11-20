# TalentBridge: Process flow

> **Concept project.** Independent case study created to demonstrate BA and UI/UX method. The client, users and data are fictional, and the KPI baselines and targets are assumptions. Nothing here is client work.

[← All case studies](../README.md)

## Current state

Candidates live in spreadsheets and email threads, and nobody sees the true status.

## Future-state flow

![BPMN-style flow](../assets/bpmn.svg)

Same flow as a diagram GitHub renders from text:

```mermaid
flowchart LR
  subgraph L0["Recruiter"]
    S(("Start"))
    T0["Add candidate"]
    T2["Screen"]
  end
  subgraph L1["System"]
    T1["Match to role"]
    G{"Fits the role?"}
    T4["Schedule round"]
  end
  subgraph L2["Hiring manager"]
    T3["Review shortlist"]
    T5["Decide"]
    E(("End"))
    X["Add to talent pool"]
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
