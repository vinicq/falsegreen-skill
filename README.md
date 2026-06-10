# falsegreen-skill

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**LLM-based semantic analysis for false-positive test detection.** Companion
to [falsegreen](https://github.com/vinicq/falsegreen), the Python static
scanner.

For Python, this skill applies the complete falsegreen catalog directly — all
structural and semantic patterns — via LLM analysis, without requiring the
static scanner to run first. For TypeScript and JavaScript, it is the primary
detection tool.

---

## What it catches

For Python, the complete falsegreen catalog applied via LLM (no scanner required):

| Family | Codes | What is wrong |
|---|---|---|
| Never checks | C1, C2, C2b, C3, C4, C4b, C20, C21, C22, CC | assertion unreachable, missing, swallowed, or uncollected |
| Weak / always-true | C5, C6, C6b, C7, C8, C9, C11a, C13, C13b, C14, C16, C18, C25, C34 | tautology, truthiness-only, self-compare, broad exception, repr coupling |
| Checks own setup | C19, C28, C29 | raises context wraps too much, binding unread, env mutation |
| External state | C17, C23, C24, C27, C30, C31, C32, C35 | skip-on-failure, hard path, shared state, try/pass, flaky |
| Wrong thing | C33, C36, C37 | metric unasserted, fail without reason, duplicate parametrize |
| Semantic (all languages) | 10, 11, 12, 15, 18 | mocks SUT, echo mock value, re-implements formula, order-dependent, frozen bug |

For TypeScript and JavaScript, the semantic and structural patterns from `reference.md`.

---

## How to use

### Claude Code (primary path)

Install [Claude Code](https://github.com/anthropics/claude-code), then invoke
the skill inside a session:

```
/falsegreen-skill
```

Attach a test file or paste a snippet. The skill identifies the language and
framework, classifies the test intent, applies the six-judgment protocol, and
reports findings with case numbers, confidence levels, and fix hints.

For Python, the skill applies the full pattern catalog directly. Optionally,
run the static scanner first to speed up batch analysis:

```bash
pip install falsegreen
falsegreen tests/
```

If you provide the scanner output, the skill uses it as the structural pass
and applies semantic judgment on top. Without it, the skill runs everything.

### Other LLM providers

This skill is not tied to Claude. The SKILL.md protocol and J1-J6 framework run
on any instruction-following LLM. Supported providers: Anthropic, OpenAI, Google
Gemini, Meta LLaMA (Groq/Ollama/Together), Alibaba Qwen, Moonshot Kimi.

See [providers.md](providers.md) for per-provider invocation code and Cursor setup.

### Cursor

Add `.cursor/rules/falsegreen-skill.mdc` to your project (template in
[providers.md](providers.md)). Open a test file, ask Cursor to analyze it for
false-positive smells, and the J1-J6 protocol runs automatically.

---

## Supported languages and frameworks

| Language | Frameworks |
|---|---|
| Python | pytest, unittest |
| TypeScript | Jest, Vitest, Mocha + Chai |
| JavaScript | Jest, Vitest, Mocha + Chai, Jasmine |

---

## The methodology

One rule sits under everything: a test is useful only if it fails when the
code breaks. The six-judgment framework (J1-J6) structures the analysis:

- **J1:** Does the assertion run?
- **J2:** Is the expected value from an independent oracle?
- **J3:** Is the real unit under test (not a mock of it)?
- **J4:** Does the assertion verify enough?
- **J5:** Is the test coupled to implementation internals?
- **J6:** Does the test pass in isolation?

The methodology and its research basis are documented in
[falsegreen CREDITS.md](https://github.com/vinicq/falsegreen/blob/main/CREDITS.md)
and in this repo's [CREDITS.md](CREDITS.md).

---

## Precision over recall

A finding that wrongly flags a legitimate test is worse than a missed
finding. The skill applies the same guardrail as the scanner:

- Case 18 requires a cited independent oracle: spec, docstring, API contract.
  No oracle, no finding.
- An adversarial verification pass runs on every case 18 HIGH finding.
- Characterization tests (intentionally freezing current behavior) are not
  false positives.
- In web/UI layer tests, a truthiness check on a response or locator object
  is not a weak assertion.

Full protocol: [SKILL.md](SKILL.md).

---

## Project layout

```
falsegreen-skill/
  SKILL.md          the skill protocol (language and LLM agnostic)
  reference.md      per-language case catalog and framework cues
  providers.md      multi-LLM invocation guide and Cursor setup
  CREDITS.md        the research this skill builds on
  examples/         test snippets per language (bad and clean)
    python/
    typescript/
    javascript/
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The main contribution paths are
language-specific patterns and look-alike examples in `reference.md`.

License: **MIT**, see [LICENSE](LICENSE).
