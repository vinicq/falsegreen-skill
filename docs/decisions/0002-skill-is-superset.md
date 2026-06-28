# 0002 - The skill is a superset of the three static scanners

Status: Accepted

## Context

Three static scanners ship structural codes in three languages, with the same id reused where the
mechanism matches (C5 is the always-true assertion in Python, JS/TS, and Robot). A consumer reading
the skill needs to trust that it covers everything the scanners cover, plus the semantic cases. If
the skill's catalog drifted below a scanner's, a code could pass the scanner and be invisible to
the skill.

## Decision

`reference.md` is the canonical superset. Every structural code that falsegreen, falsegreen-js, or
robotframework-falsegreen emits must appear in `reference.md`, plus the AI-only semantic codes
(the S-series and the five semantic cases). `SKILL.md` is a subset of `reference.md`: any canonical
code it names must be defined in the reference. The package validation enforces the SKILL.md subset
relation automatically; the scanner-vs-reference superset is enforced by review, because the
sibling code sets live in other repositories not present at this repo's CI time.

## Consequences

`reference.md` is the single source of truth for the code catalog and the place a new code lands
first. The skill can detect any structural pattern the scanners do, in any language, plus the
semantic ones. The gap in automation (sibling code is not vendored here) is named, not hidden: per-
repo enforcement that the siblings match the superset is a follow-up, and the canonical id to
family to title map (`schema/code-catalog.json`) is what those repos should validate against.
