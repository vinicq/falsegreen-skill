# Contributing to falsegreen-skill

falsegreen-skill is the LLM semantic pass companion to the
[falsegreen](https://github.com/vinicq/falsegreen) Python scanner. It detects
false-positive test patterns that no static tool can see, across Python,
TypeScript, JavaScript, Java, C#, PHP, Ruby, and C++.

## 30-second cheat sheet

```bash
git clone https://github.com/vinicq/falsegreen-skill
cd falsegreen-skill
# no runtime dependencies — this is a skill definition, not a package
```

Then branch, change, and open a pull request.

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
feat(java): add JUnit5 assertThrows boundary rule (case 9)
fix(typescript): stop flagging jest.spyOn when SUT is an edge
docs(reference): add C# NUnit Assert.That look-alike examples
```

## License

By contributing you agree your contributions are MIT-licensed.
