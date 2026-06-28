# Architecture decisions

Short records of the decisions that shape this repository. Each ADR is one file, in the standard
format: Title, Status, Context, Decision, Consequences. They stay short and factual; the full
protocol lives in [`SKILL.md`](../../SKILL.md) and [`reference.md`](../../reference.md).

| ADR | Title | Status |
|---|---|---|
| [0001](0001-protocol-boundary.md) | J1-J6 protocol boundary: semantic skill vs static scanners | Accepted |
| [0002](0002-skill-is-superset.md) | The skill is a superset of the three static scanners | Accepted |
| [0003](0003-level-detection.md) | Level detection (the pyramid) and level-aware oracle reading | Accepted |
| [0004](0004-authoring-mode.md) | Mode B (authoring) and its J1-J6 self-check | Accepted |
| [0005](0005-thin-host-entry-points.md) | Thin multi-host entry points over duplicated catalogs | Accepted |
