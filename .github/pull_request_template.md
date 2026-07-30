<!--
Thanks for sending a pull request. A few notes before you submit:

- Keep this PR small and focused. One logical change per PR.
- Three commits is the comfortable ceiling for review. Squash on merge is the
  default, so you do not need to keep many commits.
- A change to detection behaviour should land with the matching example or
  fixture that proves it. See CONTRIBUTING.md.

PR title must follow Conventional Commits:  <type>(<scope>): <description>
Valid types: feat / fix / docs / refactor / test / chore / ci. Examples:

  feat(skill): detect a tautological assert that mirrors the call (S11)
  fix(skill): stop flagging a snapshot test as an empty assertion
-->

## Summary

<!-- One or two sentences describing the change. -->

## Changes

- ...

## Test plan

- [ ] `npm run validate`
- [ ] `npm run smoke`
- [ ] Manual run of the skill over a representative example (state host, provider, language)

## Checklist

- [ ] A new/changed detection pattern touches the prose that ships it: `SKILL.md`,
      `reference.md` (if a new case), and an example or fixture under `examples/`.
- [ ] For a new pattern: an example proves it fires on the bad test AND an example
      proves it does NOT fire on the legitimate look-alike.
- [ ] HIGH-confidence codes were stress-tested against legitimate look-alikes
      before being set to HIGH (they block).
- [ ] Generated targets stay in sync (`npm run validate` is green).
- [ ] If this PR touches a host's load instruction: the sentence **commands** the
      load, it does not merely describe where the catalog lives. `npm run validate`
      proves the definition is reachable; it cannot tell an imperative from a
      description, so a reviewer has to.
- [ ] No `Co-Authored-By:` AI agent trailers in the commit history.
- [ ] Commit count is reasonable for review (rule of thumb: at most 3).

## Related issues

<!-- Fixes #123, Refs #456 -->
