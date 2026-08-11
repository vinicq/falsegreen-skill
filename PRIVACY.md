# Privacy

falsegreen-skill is a set of instructions that runs inside the AI coding agent
you already use, such as Codex CLI or Claude Code. It ships no service, no
server, and no account.

## What it reads

Only the test files you point it at, plus the implementation files it needs to
judge whether a test can actually fail. Nothing else in your repository is
opened.

## What it sends

Nothing. There is no telemetry, no analytics, no crash reporting, and no
network call of any kind in this package.

Worth stating plainly, because it is the part people get wrong: the analysis
itself happens in your agent, so your test code is processed by whichever model
provider your agent is configured to use, under that provider's terms. That
traffic is between you and them. This project is not in the middle of it and
receives no copy.

## What it stores

Nothing outside your working tree. Findings are printed to your session. If you
ask the agent to write a report, that file lands where you asked and stays
local.

## Installing from npm

`npm` records download counts for the `falsegreen-skill` package, the same as
for any public package. That is npm's collection, not ours, and it carries no
information about your code.

## Contact

Questions or a correction to this page: open an issue at
https://github.com/vinicq/falsegreen-skill/issues
