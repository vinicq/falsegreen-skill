# falsegreen-skill on Google Gemini

How to use falsegreen-skill with Google Gemini models, from the AI Studio
playground to the Python API to enterprise Vertex AI.

---

## Model recommendations

| Model | Use case |
|---|---|
| `gemini-2.5-pro` | Default. Best accuracy across J1-J6, especially case 18. |
| `gemini-2.5-flash` | Balanced. Good for interactive review where you need results quickly. |
| `gemini-2.0-flash` | Fast/cheap batch. Use for large dataset passes; validate findings against the benchmark before trusting at scale. |

---

## Gemini CLI extension

Install the skill as a Gemini CLI extension:

```bash
gemini extensions install https://github.com/vinicq/falsegreen-skill
```

The manifest `gemini-extension.json` at the repo root registers the extension
and loads `GEMINI.md` as persistent context (`contextFileName`). After install,
every Gemini CLI session carries the J1-J6 protocol; ask in natural language,
for example "analyze tests/ for false-positive smells".

---

## Google AI Studio (aistudio.google.com)

AI Studio is the fastest way to try the skill without writing any code.

1. Open [aistudio.google.com](https://aistudio.google.com) and create a new prompt.
2. Expand the **System Instructions** field.
3. Paste the full contents of `SKILL.md` into that field.
4. In the main message input, paste the test code you want to analyze.
5. Run with `gemini-2.5-pro`.

**Long context advantage.** Gemini 2.5 Pro supports up to 1 million tokens. You
can paste an entire `tests/` directory in one request and ask for a full suite
analysis. Most other models need file-by-file. A prompt like this works well:

```
Analyze all test functions in the following test suite using the falsegreen-skill
protocol. Apply the full J1-J6 framework to each test and output the findings
in the standard CASE / SUMMARY format.

<paste entire tests/ directory content here>
```

**Model comparison.** AI Studio has a "Compare models" feature. Use it to run
the same test through `gemini-2.5-pro` and `gemini-2.0-flash` side by side and
check for precision differences on borderline cases.

---

## Gemini API (Python)

Two SDK options are available. The newer `google-genai` SDK is the preferred
path for new code. The legacy `google-generativeai` SDK still works.

### New SDK (`google-genai`)

Install:

```bash
pip install google-genai
```

Basic invocation:

```python
from google import genai
from google.genai import types

client = genai.Client(api_key="YOUR_API_KEY")

skill_protocol = open("SKILL.md").read()
test_code = open("tests/test_example.py").read()

response = client.models.generate_content(
    model="gemini-2.5-pro",
    config=types.GenerateContentConfig(
        system_instruction=skill_protocol,
    ),
    contents=test_code,
)
print(response.text)
```

### Legacy SDK (`google-generativeai`)

Install:

```bash
pip install google-generativeai
```

```python
import google.generativeai as genai

genai.configure(api_key="YOUR_API_KEY")

skill_protocol = open("SKILL.md").read()
test_code = open("tests/test_example.py").read()

model = genai.GenerativeModel(
    model_name="gemini-2.5-pro",
    system_instruction=skill_protocol,
)
response = model.generate_content(test_code)
print(response.text)
```

---

## Thinking mode (case 18 deep analysis)

Gemini 2.5 Pro supports a configurable thinking budget. For case 18 findings
(expected value contradicts what the code should do), the adversarial verify
step in the skill protocol requires careful reasoning. Increasing the thinking
budget gives the model more tokens to work through both the finder and refuter
passes before committing to a HIGH confidence finding.

```python
from google import genai
from google.genai import types

client = genai.Client(api_key="YOUR_API_KEY")

skill_protocol = open("SKILL.md").read()
test_code = open("tests/test_suspicious.py").read()

response = client.models.generate_content(
    model="gemini-2.5-pro",
    config=types.GenerateContentConfig(
        system_instruction=skill_protocol,
        thinking_config=types.ThinkingConfig(
            thinking_budget=8192,  # increase for adversarial case 18 analysis
        ),
    ),
    contents=(
        "Analyze this test file. For any case 18 candidates, apply the full "
        "adversarial verify step before reporting.\n\n" + test_code
    ),
)
print(response.text)
```

A thinking budget of `8192` tokens is a reasonable starting point for most
case 18 reviews. For complex domain logic or contested findings, go up to
`16384`. The default (no `thinking_config`) uses a low internal budget that
may skip the full adversarial pass.

---

## Large suite analysis (long context)

The 1M token window changes what is practical. Instead of splitting your test
suite into individual files and running separate API calls, you can send the
whole thing at once:

```python
import pathlib
from google import genai
from google.genai import types

client = genai.Client(api_key="YOUR_API_KEY")
skill_protocol = pathlib.Path("SKILL.md").read_text()

# Collect all test files from your project
tests_dir = pathlib.Path("tests")
suite_content = ""
for test_file in sorted(tests_dir.rglob("test_*.py")):
    suite_content += f"\n\n# FILE: {test_file}\n"
    suite_content += test_file.read_text()

response = client.models.generate_content(
    model="gemini-2.5-pro",
    config=types.GenerateContentConfig(
        system_instruction=skill_protocol,
    ),
    contents=(
        "Analyze every test function in the following suite. "
        "Apply the full J1-J6 framework and output findings in "
        "standard CASE / SUMMARY format.\n\n" + suite_content
    ),
)
print(response.text)
```

This approach finds cross-file issues like case 15 (order-dependent tests)
that are invisible when files are analyzed in isolation.

---

## Structured JSON output

For programmatic processing (CI pipelines, dashboards), request JSON output
directly:

```python
from google import genai
from google.genai import types
import json

client = genai.Client(api_key="YOUR_API_KEY")
skill_protocol = open("SKILL.md").read()
test_code = open("tests/test_example.py").read()

schema = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "findings": types.Schema(
            type=types.Type.ARRAY,
            items=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "case": types.Schema(type=types.Type.INTEGER),
                    "judgment": types.Schema(type=types.Type.STRING),
                    "confidence": types.Schema(type=types.Type.STRING),
                    "language": types.Schema(type=types.Type.STRING),
                    "test_name": types.Schema(type=types.Type.STRING),
                    "finding": types.Schema(type=types.Type.STRING),
                    "evidence": types.Schema(type=types.Type.STRING),
                    "fix_hint": types.Schema(type=types.Type.STRING),
                },
            ),
        ),
        "summary": types.Schema(
            type=types.Type.OBJECT,
            properties={
                "tests_reviewed": types.Schema(type=types.Type.INTEGER),
                "findings_total": types.Schema(type=types.Type.INTEGER),
                "findings_high": types.Schema(type=types.Type.INTEGER),
                "findings_low": types.Schema(type=types.Type.INTEGER),
                "clean": types.Schema(type=types.Type.INTEGER),
            },
        ),
    },
)

response = client.models.generate_content(
    model="gemini-2.5-pro",
    config=types.GenerateContentConfig(
        system_instruction=skill_protocol,
        response_mime_type="application/json",
        response_schema=schema,
    ),
    contents=test_code,
)
result = json.loads(response.text)
print(result["summary"])
```

---

## Vertex AI (enterprise)

The same skill works via Google Cloud Vertex AI. The only change is client
initialization. Use this path when you need VPC controls, audit logging,
or enterprise data residency guarantees.

```python
import vertexai
from vertexai.generative_models import GenerativeModel

vertexai.init(project="YOUR_PROJECT_ID", location="us-central1")

skill_protocol = open("SKILL.md").read()
test_code = open("tests/test_example.py").read()

model = GenerativeModel(
    "gemini-2.5-pro",
    system_instruction=skill_protocol,
)
response = model.generate_content(test_code)
print(response.text)
```

For thinking mode on Vertex AI, pass `generation_config` with
`{"thinking_config": {"thinking_budget": 8192}}`.

---

## Quick reference

| Task | Recommended path |
|---|---|
| Try the skill interactively | AI Studio, System Instructions |
| Single file analysis | `google-genai` SDK, `gemini-2.5-pro` |
| Full test suite (large project) | `google-genai` SDK, long context, all files in one request |
| Case 18 adversarial verify | `gemini-2.5-pro` with `thinking_budget=8192` |
| Batch scoring (Dataset B, CI) | `gemini-2.0-flash`, validate against benchmark first |
| Structured output for tooling | `response_mime_type="application/json"` with `response_schema` |
| Enterprise / GCP-native | Vertex AI client, same model names |

---

## Google AI Studio — Gem setup

To use falsegreen-skill as a persistent Gem in Google AI Studio:

1. Open [AI Studio](https://aistudio.google.com) and create a new Gem.
2. Set the name to `falsegreen-skill`.
3. Set the description to: "Detects false-positive tests using the J1-J6 semantic judgment framework. Paste a test file or directory contents — get a structured finding report with case numbers, confidence levels, and fix hints."
4. Paste the contents of `SKILL.md` as the system instructions.
5. Enable the Code execution capability.

The Gem persists the system instructions, so subsequent chats in that Gem start from the full J1-J6 protocol without re-pasting SKILL.md.
