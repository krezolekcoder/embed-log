from __future__ import annotations

import re


def slugify(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-") or "x"
