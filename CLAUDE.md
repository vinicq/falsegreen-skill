# CLAUDE.md — falsegreen-skill

Contexto de projeto para Claude Code, Codex e qualquer LLM que abrir este repo.

---

## O que é este projeto

`falsegreen-skill` é uma skill LLM semântica para detecção de test smells false-positive.
**Não é estática nem exclusiva do Claude Code.** Roda em qualquer LLM provider.

Companion do scanner determinístico [falsegreen](https://github.com/vinicq/falsegreen) (Python AST).

---

## Topologia do ecossistema

| Repo | Visibilidade | Papel |
|---|---|---|
| `falsegreen` (`C:\Users\vinic\projetos-edge\falsegreen`) | público | Scanner Python AST, C1-C37, v0.3.0 PyPI |
| **`falsegreen-skill`** (este repo) | **público** | Skill LLM, produto público |
| `falsegreen-skill-audit` (`C:\Users\vinic\projetos-edge\falsegreen-skill-audit`) | privado | Agentes, pesquisa, Dataset B, artigo |
| `falsegreen-audit` (`C:\Users\vinic\projetos-edge\falsegreen-audit`) | privado | Artigo do scanner Python |

---

## O que pertence a este repo

**Fica aqui:**
- `SKILL.md` — protocolo J1-J6, casos 1-22
- `reference.md` — catálogo por linguagem, padrões de detecção
- `providers.md` — invocação multi-LLM (Anthropic/OpenAI/Gemini/LLaMA/Qwen/Kimi) + Cursor
- `examples/` — testes ruins e limpos por linguagem

**Não fica aqui (vai em falsegreen-skill-audit):**
- `.agents/` — bloqueado no `.gitignore`
- Datasets, adjudicação, scripts de coleta, benchmarks internos, rascunhos de artigo

---

## Providers suportados

Detalhes de invocação em `providers.md`.

| Provider | Modelo default |
|---|---|
| Anthropic Claude | claude-sonnet-4-6 |
| OpenAI | gpt-4o |
| Google Gemini | gemini-2.5-pro |
| Meta LLaMA (Groq) | llama-3.3-70b-versatile |
| Alibaba Qwen (OpenRouter) | Qwen2.5-72B-Instruct |
| Moonshot Kimi | kimi-k2-0711-instruct |
| Cursor | `.cursor/rules/falsegreen-skill.mdc` |

---

## Desenvolvimento e pesquisa

Todo trabalho de desenvolvimento, construção de agentes, coleta de dados e pipeline
do artigo fica em `falsegreen-skill-audit` (privado). Ver o CLAUDE.md daquele repo
para o contexto completo de agentes, Dataset B e pipeline do professor-smells.
