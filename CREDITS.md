# Credits and academic references

falsegreen-skill builds on the same research base as the falsegreen scanner,
plus work specific to LLM-based detection and multi-language test smells.
Credit to the authors.

## Foundation (shared with falsegreen)

**A Multimethod Study of Test Smells: Cataloging, Removal, and New Types.**
Elvys Alves Soares. PhD thesis, UFPE, 2023. The source for the six-judgment
framework (J1-J6), the smell vs. ineffective vs. rotten distinction, and the
AAA Assert-phase framing. The semantic cases (10/11/12/15/18) map directly
onto the judgment classifications in this thesis.

**Rotten Green Tests.** Julien Delplanque, Stéphane Ducasse, Guillermo
Polito, Andrew P. Black, Anne Etien. ICSE 2019. Origin of the rotten-green-test
concept: a passing test that holds an assertion which never runs.

**Test Smell Catalog.** easy-software-ufal.
<https://test-smell-catalog.readthedocs.io/>. Cross-walked against
falsegreen-skill's scope; basis for the semantic-logic subset.

## LLM-based detection

**Agentic LMs: Hunting Down Test Smells.** Rian Melo, Pedro Simões, Rohit
Gheyi, Marcelo d'Amorim, Márcio Ribeiro, Gustavo Soares, Eduardo Almeida,
Elvys Soares. SBES 2025. arXiv:2504.07277. Empirical evidence that small local
models in agent workflows detect and refactor test smells (Phi-4-14B, pass@5
75.3%; six generated PRs merged). Backs the multi-agent adversarial verify
protocol for case 18 and the choice of a small model (Haiku) for the semantic
pass.

**Evaluating LLMs Effectiveness in Detecting and Correcting Test Smells.**
E. G. Santana Jr., Jander Pereira Santos Junior, Erlon P. Almeida, Iftekhar
Ahmed, Paulo Anselmo da Mota Silveira Neto, Eduardo Santana de Almeida. 2025.
arXiv:2506.07594. Their finding that standalone LLM refactoring consistently
drops test coverage, and their recommendation of a multi-agent system with a
detector, a refactoring agent, and a coverage-checking validation gate, is why
the AI-fix path in falsegreen requires explicit validation before accepting a
proposed change.

**Evaluating Large Language Models in Detecting Test Smells.** Keila Lucas,
Rohit Gheyi, Elvys Soares, Márcio Ribeiro, Ivan Machado. SBES 2024.
arXiv:2407.19261. LLMs detected 21 of 30 test smell types across seven
languages (ChatGPT-4 best). Backs the choice to handle cross-language
coverage via LLM rather than per-language parsers, and shapes the set of
cases expected to be reachable with a small model.

**Test smells in LLM-Generated Unit Tests.** Wendkûuni C. Ouédraogo, Yinghua
Li, Xueqi Dang, Xunzhu Tang, Anil Koyuncu, Jacques Klein, David Lo,
Tegawendé F. Bissyandé. 2024. arXiv:2410.10628. AI-generated tests carry
smells at a high rate (Assertion Roulette, Magic Number Test most often).
Supports the broader premise that LLM-written tests need a second reader.

## Multi-language and language-specific work

**Uma Investigação sobre Test Smells em Códigos de Testes JavaScript.**
Dalton Nicodemos Jorge. PhD thesis, UFCG, 2023. Tool STEEL:
<https://github.com/daltonjorge/steel>. The JavaScript Exception Test smell
(a `try/catch` that swallows the thrown error) and assertion-in-`forEach`-
over-empty are the source for the J1 detection cues for Jest/Vitest in
`reference.md`.

**Detecção de smells em testes automatizados em diferentes linguagens de
programação.** Gustavo Augusto Calazans Lopes. TCC, UFAL, 2023. Its
srcML-per-language approach (one shared rule backend over a common AST, plus
a per-framework assert vocabulary) validated the decision to keep one shared
case catalog across languages and supply per-language framework cues.

**xNose: A Test Smell Detector for C# Tests.** 2024. arXiv:2405.04063.
xNose adapts the PyNose/tsDetect approach to C# (NUnit, xUnit.net, MSTest).
Source for the C# framework detection cues and the C#-specific patterns in
`reference.md` (empty `[Test]` methods, `async void` test methods that lose
exceptions, `Assert.Pass()` vacuous patterns).

**SENTINEL: Processo para Remoção Automática de Test Smells.** Adriano
Pizzini. PhD thesis, PUCPR / PPGIa, 2024. The bidirectional validation gate
(run on clean replica, run on mutated replica) informs the AI-fix path: a
proposed fix must pass the original test suite and fail on a mutation before
being accepted.

## A note on GitHub handles

Handles in the falsegreen scanner's
[CREDITS.md](https://github.com/vinicq/falsegreen/blob/main/CREDITS.md) are
not repeated here. Authors without a confidently matched account are credited
by name only. If you are one of these authors and want your handle added or
removed, open an issue.
