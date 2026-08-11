# Privacy

This package has two parts, and they behave differently. Read the one you use.

- **The skill** (`SKILL.md`, `skills/`, the host files) is instructions your AI
  coding agent follows. It makes no network calls of its own, and what it opens
  is decided by the agent.
- **The CLI** (`falsegreen-llm`, `bin/falsegreen-llm.js`) is a program that calls
  a model provider directly. It uploads only what you hand it, and one command
  executes model-generated code on your machine.

There is no falsegreen server, no account, and no telemetry in either part.

## What the CLI uploads, per command

Exactly this, and nothing else:

| Command | Sent to the provider |
|---|---|
| `analyze <files>` | the content of each file you name, plus the `--conventions` file verbatim if you pass one |
| `generate <spec>` | the content of the spec file you name |
| `fix <file>` | the content of that test file only |

**`fix` does not upload the implementation under test.** The `--sut` file is used
only by the local gate on your machine; it never enters the provider request.

**`--conventions` is uploaded verbatim.** It is read whole and embedded in the
message, so treat that file as content you are sending, not as configuration.

The endpoint depends on `--provider`:

| `--provider` | Endpoint |
|---|---|
| `anthropic` (default) | `https://api.anthropic.com/v1/messages` |
| `openai` | `https://api.openai.com/v1` |
| `gemini` | `https://generativelanguage.googleapis.com/v1beta/models/` |
| `openai-compatible` | whatever you pass to `--base-url` |

The request goes under your own API key, so your account and that provider's
terms and retention policy govern it.

**The skill sends nothing by itself**, but the analysis runs inside your agent,
so your test code reaches whichever provider that agent uses, under that
provider's terms. This project is not in the middle of it and receives no copy.

**Nothing is sent to us**, because there is nowhere to send it. No telemetry, no
analytics, no crash reporting, no phone-home.

## `fix` runs AI-generated code on your machine, unsandboxed

Read this before running `fix`. It is the sharpest edge in the package.

`fix` asks the model for a strengthened test file and then **executes that
generated file** with `pytest` to check it. That execution is not isolated:

- **Your whole environment is inherited.** The subprocess gets a copy of
  `process.env`, so anything in it, including API keys and tokens, is readable by
  the generated test.
- **The filesystem is not restricted.** The working directory is a temp replica,
  which keeps *relative* paths off your tree, but an absolute path writes
  wherever it points, and the original checkout stays reachable.
- **The network is available.** Nothing blocks outbound calls from the test.

A replica directory is not a sandbox. If the proposed test, or anything it
imports, has side effects, those side effects happen for real. Run `fix` only
where you would be willing to run any unreviewed code, or review the proposed
patch before letting the gate execute it.

## What gets read

**The CLI reads only what you name:** each file in the command, plus the
`--conventions` file. Pointing it at a directory does not discover anything;
there is no config, fixture, or implementation lookup.

**The skill reads more, and the extras are deliberate**, because the agent has to
find what a verdict depends on:

- the test files.
- the implementation under test, needed to judge whether a test can fail.
- **project configuration**, when a judgment turns on it. A plain
  `@pytest.mark.xfail` is exempt only if the project enables strict xfail
  globally, so the protocol reads `pytest.ini`, `[tool.pytest.ini_options]` in
  `pyproject.toml`, or `setup.cfg` to check `xfail_strict`.
- **fixtures such as `conftest.py`**, when adjudicating shared state.
- any conventions or authoring spec you supply.

Those are read even when you point the agent only at a tests directory, because
the verdict is wrong without them.

## What gets written

**The skill** writes nothing unless you ask for a report, which lands where you
asked.

**`fix` writes outside your working tree.** It creates a `falsegreen-fix-*`
directory under the system temp directory, writes the generated test there, and
copies the implementation under test into it. Cleanup on exit is best effort: the
removal is wrapped in a `catch` that swallows errors, so a crash or a failed
delete can leave a copy of your source there until the operating system clears
it. If you work with code that must not persist outside your tree, clear that
directory yourself after a run.

## Installing from npm

npm records download counts for the `falsegreen-skill` package, like any public
package. That is npm's collection, not ours, and it says nothing about your code.

## Contact

Questions, or a correction to this page: open an issue at
https://github.com/vinicq/falsegreen-skill/issues
