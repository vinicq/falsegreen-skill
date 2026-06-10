# DeepSeek context

How to run falsegreen-skill on DeepSeek Chat and the DeepSeek API.

---

## Model selection

DeepSeek offers two distinct models. The right choice depends on which pass you are running.

| Model | Name | Best for |
|---|---|---|
| `deepseek-chat` | DeepSeek-V3 | Structural pass (C1-C37), fast, cheap |
| `deepseek-reasoner` | DeepSeek-R1 | Semantic cases (10/11/12/15/18), chain-of-thought |

The recommended split:

- **Step 2 (structural):** `deepseek-chat`. Covers all 37+ patterns, no extended thinking needed.
- **Steps 3-6 (semantic):** `deepseek-chat` handles cases 10/11/12/15 well.
- **Case 18 adversarial verify:** switch to `deepseek-reasoner`. The reasoning trace makes the adversarial argument visible, so you can audit whether the refuter mounted a credible defense before accepting or withdrawing the finding.

---

## DeepSeek Chat (chat.deepseek.com)

DeepSeek Chat has a **System Prompt** field under Settings. Paste the full contents of
`SKILL.md` there. After that, send test code as the user message.

Steps:

1. Open [chat.deepseek.com](https://chat.deepseek.com).
2. Click the settings icon and paste `SKILL.md` into the System Prompt field.
3. Paste the test file (or a snippet) as your first message.
4. For case 18 analysis, switch the model selector to **DeepSeek-R1** to enable reasoning.

The system prompt persists across turns in the same conversation.

---

## DeepSeek API (Python)

DeepSeek exposes an OpenAI-compatible API at `https://api.deepseek.com`. Use the
`openai` Python SDK with a different `base_url` and your DeepSeek API key.

### Standard usage with `deepseek-chat`

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://api.deepseek.com",
    api_key="YOUR_DEEPSEEK_KEY"
)
skill_protocol = open("SKILL.md").read()
test_code = open("tests/test_example.py").read()

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[
        {"role": "system", "content": skill_protocol},
        {"role": "user", "content": test_code}
    ]
)
print(response.choices[0].message.content)
```

### With structured JSON output

DeepSeek supports `response_format: {"type": "json_object"}`. Add a brief
instruction in the user message to request JSON output and the model will
respond with a parseable object.

```python
response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[
        {"role": "system", "content": skill_protocol},
        {
            "role": "user",
            "content": (
                test_code
                + "\n\nRespond with a JSON object following this schema:\n"
                + '{"findings": [{"case": int, "judgment": str, "confidence": "HIGH"|"LOW",'
                + ' "test": str, "finding": str, "evidence": str, "fix_hint": str}],'
                + ' "summary": {"tests_reviewed": int, "findings": int, "clean": int}}'
            )
        }
    ],
    response_format={"type": "json_object"}
)
import json
result = json.loads(response.choices[0].message.content)
```

### Case 18 adversarial verify with `deepseek-reasoner`

Switch the model to `deepseek-reasoner` for the adversarial pass. DeepSeek-R1 returns
a `reasoning_content` field alongside the final answer. That field contains the
chain-of-thought trace, which shows the model working through both the finder
argument and the refuter argument.

```python
response = client.chat.completions.create(
    model="deepseek-reasoner",
    messages=[
        {"role": "system", "content": skill_protocol},
        {
            "role": "user",
            "content": (
                "The following test has a candidate Case 18 finding. "
                "Run Step 5 (adversarial verify): cite the oracle, then argue "
                "that the expected value is actually correct. Report only if the "
                "refuter cannot mount a credible defense.\n\n"
                + test_code
            )
        }
    ]
)

# The reasoning trace -- examine this to audit the adversarial argument
reasoning = response.choices[0].message.reasoning_content
# The final verdict
verdict = response.choices[0].message.content

print("Reasoning trace:\n", reasoning)
print("\nVerdict:\n", verdict)
```

`reasoning_content` is populated only for `deepseek-reasoner`. For `deepseek-chat`,
the field is `None`.

---

## Batch processing entire test suites

DeepSeek's pricing is significantly lower per token than GPT-4o or Claude Sonnet.
This makes batch analysis of large test suites practical without a per-file token
budget.

Minimal batch loop:

```python
import pathlib
from openai import OpenAI

client = OpenAI(
    base_url="https://api.deepseek.com",
    api_key="YOUR_DEEPSEEK_KEY"
)
skill_protocol = open("SKILL.md").read()

results = {}
for path in pathlib.Path("tests").rglob("test_*.py"):
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": skill_protocol},
            {"role": "user", "content": path.read_text()}
        ],
        response_format={"type": "json_object"}
    )
    results[str(path)] = response.choices[0].message.content

# results maps file paths to raw JSON strings
```

For files that yield case 18 candidates in the first pass, re-run those files
with `deepseek-reasoner` to complete Step 5.

---

## Environment variable setup

```bash
export DEEPSEEK_API_KEY="your_key_here"
```

Then in code:

```python
import os
client = OpenAI(
    base_url="https://api.deepseek.com",
    api_key=os.environ["DEEPSEEK_API_KEY"]
)
```

---

## Notes

- The `deepseek-reasoner` model does not support `response_format: json_object`.
  Parse structured output from the text content manually when using R1.
- Context window for both models is 64K tokens. A single large test file (thousands
  of lines) fits within a single call.
- DeepSeek Chat's free web tier applies rate limits. For unattended batch runs, use
  the paid API.
- The OpenAI SDK version must be >= 1.0. Install with `pip install openai`.
