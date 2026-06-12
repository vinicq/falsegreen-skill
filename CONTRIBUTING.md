# Contributing to falsegreen-skill

falsegreen-skill is the LLM semantic pass companion to the
[falsegreen](https://github.com/vinicq/falsegreen) Python scanner. It detects
false-positive test patterns that no static tool can see, across Python,
TypeScript, and JavaScript.

## 30-second cheat sheet

```bash
# 1. Fork the repo on GitHub first (vinicq/falsegreen-skill → your-username/falsegreen-skill)
# 2. Clone your fork
git clone https://github.com/<your-username>/falsegreen-skill
cd falsegreen-skill
# no runtime dependencies — this is a skill definition, not a package
```

Branch, make your changes, and open a pull request against `vinicq/falsegreen-skill`.

## Validate your changes

Before opening a PR, run:

```bash
npm run validate
```

This checks required files, skill frontmatter, manifest JSON, schema field names, and unsupported language claims. It takes under a second.

For CLI changes, also run:

```bash
node --check bin/falsegreen-llm.js
```

If you changed `SKILL.md`, check that the same text appears in `llm.md`, `AGENTS.md`, and `GEMINI.md` — they carry the same protocol and must stay in sync.

## How the skill is built

One file does the work: `SKILL.md`. It defines the protocol Claude follows
when analyzing a test. `reference.md` is the supporting catalog: per-language
patterns, framework cues, and the J1-J6 judgment index.

The skill inherits the same methodology as the scanner: a test is useful only
if it fails when the code breaks. Cases 10, 11, 12, 15, and 18 need semantic
judgment that a parser cannot make. This skill makes that judgment.

## Precision over recall

Same rule as the scanner: a finding that wrongly flags a legitimate test is
worse than a missed finding. Before adding a detection cue or tightening a
boundary rule, test it against common legitimate patterns (characterization
tests, TDD tests, integration doubles).

## Filing an issue

A useful false-positive report includes the test snippet, the case number the
skill attributed, and why that attribution is wrong. A useful false-negative
report shows the bad test and the case it should have caught.

## Adding a language pattern

A new language-specific pattern touches two places:

1. **`reference.md`**: the case entry for the relevant language, with a
   bad-pattern example and a clean look-alike.
2. **`SKILL.md`**: the detection cues section for that language, if the
   pattern requires a new cue the model should look for.

## Authorship and AI tooling

Use any tools you like. The authorship is yours. Do not add `Co-Authored-By`
trailers for AI agents. Human co-authors are welcome.

## Commit messages: Conventional Commits

Format: `type(scope): summary`. Recognised types: `feat`, `fix`, `docs`,
`refactor`, `chore`. Scope is usually the language or case number.

```
feat(python): add C35 flaky-decorator detection to reference
fix(typescript): stop flagging jest.spyOn when SUT is an edge
docs(reference): add JavaScript Sinon stub look-alike examples
```

## License

By contributing you agree your contributions are MIT-licensed.
