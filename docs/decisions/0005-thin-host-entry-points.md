# 0005 - Thin multi-host entry points over duplicated catalogs

Status: Accepted

## Context

The same protocol ships to several hosts: Claude Code, Codex, Gemini, Cursor, plain LLM prompts, and
the npm CLI. Each host has its own packaging metadata and its own context file convention
(`SKILL.md`, `GEMINI.md`, `.cursor/` rules, plugin manifests). The naive approach copies the full
catalog into each host file. That guarantees drift: a code added to one copy and not the others, a
catalog that disagrees with itself across hosts.

## Decision

Host entry points are thin. They carry host-specific framing and packaging, and they reference the
canonical protocol (`SKILL.md`) and catalog (`reference.md`) instead of duplicating them. The
per-host files (Cursor `.mdc`, the host context files) are generated or checked from the canonical
source by the sync scripts, and `npm run validate` fails if a generated host file is out of sync.

## Consequences

One change to the protocol updates every host through the sync scripts, instead of N hand edits that
drift. Adding a host is adding a thin adapter, not a catalog copy. The sync scripts and their
`--check` mode are now part of the contract: a host file edited by hand without re-syncing fails
validation, which is the intended guard against silent divergence.
