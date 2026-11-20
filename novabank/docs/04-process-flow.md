# NovaBank: Process flow

> **Concept project.** Independent case study created to demonstrate BA and UI/UX method. The client, users and data are fictional, and the KPI baselines and targets are assumptions. Nothing here is client work.

[← All case studies](../README.md)

## Current state

Adding a beneficiary takes many fields and a delayed code, and error messages are vague.

## Future-state flow

![BPMN-style flow](../assets/bpmn.svg)

Same flow as a diagram GitHub renders from text:

```mermaid
flowchart LR
  subgraph L0["Customer"]
    S(("Start"))
    T0["Log in"]
    T1["Add beneficiary"]
    T3["Enter one-time code"]
  end
  subgraph L1["App"]
    T2["Validate account"]
    G{"Account valid?"}
    T5["Show receipt"]
    E(("End"))
  end
  subgraph L2["Bank"]
    T4["Process transfer"]
    X["Show error"]
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
