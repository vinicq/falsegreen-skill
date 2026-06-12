# Multi-LLM invocation guide

falsegreen-skill is packaged for defined provider paths. The SKILL.md protocol
and the J1-J6 judgment framework are provider-agnostic, but this document only
covers maintained providers and host integrations.

---

## Provider overview

| Provider | Default model | Fast/cheap tier | Deep reasoning tier |
|---|---|---|---|
| Anthropic (Claude) | claude-sonnet-4-6 | claude-haiku-4-5-20251001 | claude-opus-4-8 |
| OpenAI | gpt-4o | gpt-4o-mini | o3 |
| Google Gemini | gemini-2.5-pro | gemini-2.0-flash | gemini-2.5-pro (thinking) |
| Meta LLaMA (Groq) | llama-3.3-70b-versatile | - | llama-3.1-405b (Together.ai) |
| Alibaba Qwen | Qwen2.5-72B-Instruct | - | QwQ-32B |
| Moonshot Kimi | kimi-k2-0711-instruct | - | kimi-k2-0711-preview |

---

## Anthropic (Claude Code / API)

### Via Claude Code (primary path)

Install the plugin, then invoke the skill:

```
/plugin marketplace add vinicq/falsegreen-skill
/plugin install falsegreen-skill@falsegreen
/falsegreen-skill:falsegreen-llm
```

Attach a test file or paste a snippet, or just ask in natural language
("analyze this test file for false-positive smells"). The skill loads
`skills/falsegreen-llm/SKILL.md` automatically.

### Via API (programmatic)

```python
import anthropic

client = anthropic.Anthropic()
skill_protocol = open("SKILL.md").read()
test_code = open("tests/test_example.py").read()

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=2048,
    system=skill_protocol,
    messages=[{"role": "user", "content": test_code}]
)
print(response.content[0].text)
```

For structured JSON output, use tool use with the canonical report schema from
`schema/report.json` in this repo.

---

## OpenAI

```python
from openai import OpenAI

client = OpenAI()
skill_protocol = open("SKILL.md").read()
test_code = open("tests/test_example.py").read()

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": skill_protocol},
        {"role": "user", "content": test_code}
    ],
    response_format={"type": "json_object"}  # use the schema from schema/report.json
)
print(response.choices[0].message.content)
```

**Note:** o1/o3 models do not support `system` messages; fold the protocol into the
first user message instead.

---

## Google Gemini

```python
import google.generativeai as genai

genai.configure(api_key="YOUR_API_KEY")
model = genai.GenerativeModel(
    model_name="gemini-2.5-pro",
    system_instruction=open("SKILL.md").read()
)
test_code = open("tests/test_example.py").read()
response = model.generate_content(test_code)
print(response.text)
```

For structured output, use `response_mime_type="application/json"` with a
`response_schema` matching the canonical schema.

---

## Meta LLaMA (via Groq)

```python
from groq import Groq

client = Groq()
skill_protocol = open("SKILL.md").read()
test_code = open("tests/test_example.py").read()

response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[
        {"role": "system", "content": skill_protocol},
        {"role": "user", "content": test_code}
    ],
    response_format={"type": "json_object"}
)
print(response.choices[0].message.content)
```

**Alternative runtimes:** Ollama (local), Together.ai (llama-3.1-405b for deep cases).

---

## Alibaba Qwen (via OpenRouter)

Qwen is available via OpenRouter using the OpenAI-compatible API:

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="YOUR_OPENROUTER_KEY"
)
skill_protocol = open("SKILL.md").read()
test_code = open("tests/test_example.py").read()

response = client.chat.completions.create(
    model="qwen/qwen2.5-72b-instruct",
    messages=[
        {"role": "system", "content": skill_protocol},
        {"role": "user", "content": test_code}
    ]
)
print(response.choices[0].message.content)
```

**Reasoning variant:** `qwen/qwq-32b` for difficult case 18 analysis.

---

## Moonshot Kimi

Kimi uses an OpenAI-compatible API:

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://api.moonshot.cn/v1",
    api_key="YOUR_MOONSHOT_KEY"
)
skill_protocol = open("SKILL.md").read()
test_code = open("tests/test_example.py").read()

response = client.chat.completions.create(
    model="kimi-k2-0711-instruct",
    messages=[
        {"role": "system", "content": skill_protocol},
        {"role": "user", "content": test_code}
    ]
)
print(response.choices[0].message.content)
```

---

## Cursor

Cursor is an AI-native code editor. Install falsegreen-skill as a project rule
by following the instructions in [`contexts/cursor.md`](contexts/cursor.md).
That file contains the complete `.cursor/rules/falsegreen-skill.mdc` template,
usage patterns for Chat and Composer, and model selection guidance.

---

## Case 18 two-pass invocation

Case 18 (expected value contradicts the spec) requires two independent API calls with
separate context windows. A single call risks self-confirmation bias: the model that
found the issue will tend to defend it. The two-pass structure forces a genuine challenge.

**Pass 1 (finder):** system = SKILL.md content, user = test file + "Identify any case 18
candidates (expected value contradicts the spec). For each candidate, cite the independent
oracle."

**Pass 2 (refuter):** system = "You are a skeptical code reviewer. Your only job is to
argue that the expected value in this test is CORRECT. Assume the test author knew what
they were doing.", user = Pass 1's case 18 finding. If the refuter cannot mount a credible
defense, the finding stands as HIGH. If the refuter's argument holds, downgrade to LOW or
withdraw.

Use `claude-opus-4-8` or `o3` for both passes. See `models.yaml` for the full tier guide.

```python
from openai import OpenAI  # works for any OpenAI-compatible provider

client = OpenAI()  # set base_url + api_key for non-OpenAI providers
skill_protocol = open("SKILL.md").read()
test_code = open("tests/test_example.py").read()

# Pass 1: finder
finder_response = client.chat.completions.create(
    model="o3",
    messages=[
        {"role": "system", "content": skill_protocol},
        {
            "role": "user",
            "content": (
                test_code
                + "\n\nIdentify any case 18 candidates (expected value contradicts the spec)."
                + " For each candidate, cite the independent oracle."
            ),
        },
    ],
)
finder_finding = finder_response.choices[0].message.content

# Pass 2: refuter (fresh context window, no system protocol)
refuter_response = client.chat.completions.create(
    model="o3",
    messages=[
        {
            "role": "system",
            "content": (
                "You are a skeptical code reviewer. Your only job is to argue that the"
                " expected value in this test is CORRECT. Assume the test author knew"
                " what they were doing."
            ),
        },
        {
            "role": "user",
            "content": finder_finding,
        },
    ],
)
refuter_argument = refuter_response.choices[0].message.content

# Decision rule:
# - If the refuter cannot mount a credible defense -> finding stays HIGH
# - If the refuter's argument holds              -> downgrade to LOW or withdraw
print("--- Finder ---")
print(finder_finding)
print("\n--- Refuter ---")
print(refuter_argument)
```

---

## Choosing a provider

For **highest precision** (production/paper-facing use): Anthropic claude-sonnet-4-6
or claude-opus-4-8. These providers have the most validated benchmark results.

For **fastest response** (interactive review, many files): claude-haiku-4-5-20251001
or gpt-4o-mini. Precision may be lower for edge cases.

For **deep case 18 analysis** (expected value contradicts spec): claude-opus-4-8
or OpenAI o3. Both support extended chain-of-thought.

For **cost-sensitive batch analysis**: LLaMA via Groq
(free tier available). Validate results against the benchmark before trusting at scale.

For **local/offline use**: Ollama with llama-3.3-70b or Qwen2.5-72B. Quality
is lower than hosted providers but sufficient for initial triage.
