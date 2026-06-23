# The files under examples/ are illustrative samples, not a runnable test suite:
# they reference functions and modules that do not exist in this repo (the skill
# ships prompt assets, not Python code under test). Keep pytest from collecting
# them so `pytest`/`pytest --collect-only` at the repo root does not fail on a
# missing import (e.g. examples/authoring/test_apply_discount.py imports `shop`).
collect_ignore_glob = ["*"]
