---
name: falsegreen-skill
description: Analyze test files for false-positive smells, meaning tests that pass even when the code breaks. Use when reviewing Python, TypeScript, JavaScript, or Robot Framework tests for weak assertions, vacuous passes, mock misuse, async assertion gaps, or whether a test can actually fail.
---

# falsegreen-skill (Antigravity CLI plugin)

Skill entry point for the Antigravity CLI (`agy`) plugin. Installed via
`agy plugin install`, this becomes the `/falsegreen-skill` slash command. The
canonical protocol lives at the repository root to avoid drift across hosts.

Read these files before judging a test:

1. `../../../SKILL.md` - full J1-J6 protocol, output format, and precision
   rules.
2. `../../../reference.md` - per-language catalog and look-alike exemptions.

Use `../../../schema/report.json` and `../../../schema/finding.json` when the
user requests machine-readable output.

For a self-contained copy that bundles the protocol (for `agy plugin install`
outside the repo), run `npm run build:targets` and install
`dist/antigravity-plugin/`.

## Guidance

- Use the model's long context for whole-suite analysis when the user points to
  a directory. Produce one consolidated report instead of one report per file.
- For case 18, run the adversarial verification step before reporting HIGH.
- For TypeScript and JavaScript, apply the semantic catalog directly; do not
  wait for a Python scanner output.
- For Python, apply the full structural catalog before semantic judgment unless
  the user provides `falsegreen` scanner output.

## Output

Use the CASE / SUMMARY format from the root `SKILL.md` unless the user asks for
JSON. In JSON mode, conform to `schema/report.json` exactly.
