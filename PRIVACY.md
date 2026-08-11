# Privacy

This package has two parts, and they behave differently. Read the one you use.

- **The skill** (`SKILL.md`, `skills/`, the host files) is instructions your AI
  coding agent follows. It makes no network calls of its own.
- **The CLI** (`falsegreen-llm`, `bin/falsegreen-llm.js`) is a program that calls
  a model provider directly. It uploads the content you give it.

There is no falsegreen server, no account, and no telemetry in either part.

## What leaves your machine

**The CLI uploads your code.** `analyze`, `generate`, and `fix` POST the test and
spec content you pass them to the provider you selected:

| `--provider` | Endpoint |
|---|---|
| `anthropic` (default) | `https://api.anthropic.com/v1/messages` |
| `openai` | `https://api.openai.com/v1` |
| `gemini` | `https://generativelanguage.googleapis.com/v1beta/models/` |
| `openai-compatible` | whatever you pass to `--base-url` |

That request carries your test source, and for `fix` the implementation under
test as well. It goes under your own API key, so it is your account and that
provider's terms and retention policy that govern it. Decide accordingly before
pointing the CLI at code you cannot send to a third party.

**The skill sends nothing by itself**, but the analysis still runs inside your
agent, so your test code reaches whichever provider that agent is configured to
use, under that provider's terms. This project is not in the middle of it and
receives no copy either way.

**Nothing is sent to us**, because there is nowhere to send it. No telemetry, no
analytics, no crash reporting, no phone-home.

## What gets read

More than the file you point at, and the extras are deliberate:

- The test files you name.
- The implementation under test, needed to judge whether a test can fail.
- **Project configuration**, when a judgment depends on it. A plain
  `@pytest.mark.xfail` is only exempt if the project enables strict xfail
  globally, so the protocol reads `pytest.ini`, `[tool.pytest.ini_options]` in
  `pyproject.toml`, or `setup.cfg` to check `xfail_strict`.
- **Fixtures such as `conftest.py`**, when adjudicating shared state.
- Any conventions or authoring spec you supply.

These are read even when you point only at a tests directory, because the
verdict is wrong without them.

## What gets written

**The skill** writes nothing unless you ask for a report, which lands where you
asked.

**`falsegreen-skill fix` writes outside your working tree.** It creates a
`falsegreen-fix-*` directory under the system temp directory, writes the patched
test there, and copies the implementation under test into it, so the gates run
against a replica instead of your files. Cleanup on exit is best effort: the
removal is wrapped in a `catch` that swallows errors, so a crash or a failed
delete can leave a copy of your source in the temp directory until the operating
system clears it. If you work with code that must not persist outside your tree,
clear that directory yourself after a run.

## Installing from npm

npm records download counts for the `falsegreen-skill` package, like any public
package. That is npm's collection, not ours, and it says nothing about your code.

## Contact

Questions, or a correction to this page: open an issue at
https://github.com/vinicq/falsegreen-skill/issues
